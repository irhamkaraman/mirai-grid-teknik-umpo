import re
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, Request, Response, status
import aiosqlite

from app.core.config import settings
from app.core.database import get_db
from app.core.subdomain_auth import verify_subdomain_access
from app.api.deps import get_current_user
from app.services.thingsboard_manager import ThingsBoardManager

router = APIRouter(prefix="/thingsboard", tags=["ThingsBoard IoT Platform"])

@router.get("/status")
async def get_status(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    user_id = current_user["id"]
    username = current_user["username"]
    return await ThingsBoardManager.get_status(user_id, username, db)

@router.get("/sso")
async def get_sso(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    user_id = current_user["id"]
    username = current_user["username"]
    return await ThingsBoardManager.get_sso_session(user_id, username, db)

@router.post("/start")
async def start_thingsboard(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    user_id = current_user["id"]
    username = current_user["username"]
    return await ThingsBoardManager.start(user_id, username, db)

@router.post("/stop")
async def stop_thingsboard(
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    username = current_user["username"]
    success = await ThingsBoardManager.stop(user_id, username)
    return {"success": success}

@router.post("/restart")
async def restart_thingsboard(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    user_id = current_user["id"]
    username = current_user["username"]
    return await ThingsBoardManager.restart(user_id, username, db)

@router.get("/resolve")
async def resolve_thingsboard_subdomain(
    request: Request,
    x_original_host: Optional[str] = Header(None),
    x_tb_user: Optional[str] = Header(None),
    host: Optional[str] = Header(None),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Internal high-performance dynamic resolver used by Host Nginx auth_request.
    Resolves incoming 'tb-<username>.miraigrid.web.id' to the internal container port.
    """
    target_host = (x_original_host or host or request.query_params.get("host") or "").split(":")[0].strip().lower()

    if not target_host:
        return Response(status_code=400, content="Missing Host Header")

    target_user = None
    if x_tb_user:
        target_user = x_tb_user.strip().lower()
    elif target_host.startswith("tb-"):
        parts = target_host.split(".")
        if parts:
            first = parts[0]
            if first.startswith("tb-"):
                target_user = first[3:].strip().lower()

    if not target_user:
        if target_host in ["tb.miraigrid.web.id", "thingsboard.miraigrid.web.id"]:
            target_user = request.query_params.get("user", "admin").strip().lower()
        else:
            return Response(status_code=403, content="Host Not In Scope")

    cursor = await db.execute("SELECT id, username FROM users WHERE LOWER(username) = ?", (target_user,))
    row = await cursor.fetchone()
    if not row:
        return Response(status_code=404, content="User Not Found")

    user_id = row["id"]
    username = row["username"]
    target_port = 15000 + user_id

    # Check if this is an IoT device request (HTTP/WS telemetry to /api/v1/)
    x_orig_uri = request.headers.get("x-original-uri", "")
    is_device_telemetry = x_orig_uri.startswith("/api/v1/") or request.query_params.get("device") == "1"

    if not is_device_telemetry:
        # STRICT ZERO-TRUST AUTHORIZATION CHECK FOR WEB USER ACCESS
        is_authorized, status_code, err_msg, auth_user = await verify_subdomain_access(
            request=request,
            db=db,
            target_username=target_user,
            platform_name="ThingsBoard IoT Sandbox"
        )
        if not is_authorized:
            resp = Response(status_code=status_code, content=err_msg)
            resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return resp

    # High-Performance Fast-Path for static chunks & assets:
    # Skip container readiness checks and heavy disk traversal on static assets
    is_asset = bool(re.search(r'\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|map)(\?.*)?$', x_orig_uri, re.IGNORECASE))

    if not is_asset:
        # Auto-ensure instance is running only on main page hits
        try:
            is_running = await ThingsBoardManager.is_container_running(username)
            if not is_running:
                await ThingsBoardManager.start(user_id, username, db)
        except Exception as e:
            print(f"[ThingsBoard Resolve] Warning during auto-start for {username}: {e}")

    resp = Response(status_code=200, content="OK")
    resp.headers["X-Target-Port"] = str(target_port)
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return resp
