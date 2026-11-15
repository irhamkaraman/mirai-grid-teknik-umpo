import re
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
import aiosqlite

from app.core.database import get_db
from app.core.subdomain_auth import verify_subdomain_access
from app.api.deps import get_current_user, get_current_user_flexible
from app.services.n8n_manager import N8nManager
from app.services.account_resource_guard import enforce_account_ram_limit

router = APIRouter(prefix="/n8n", tags=["n8n Workflow Automation"])


def _attach_n8n_cookie(response: Response, cookie_val: Optional[str]) -> None:
    if cookie_val:
        response.set_cookie(
            key="n8n-auth",
            value=cookie_val,
            domain=".miraigrid.web.id",
            path="/",
            max_age=6 * 3600,
            httponly=True,
            secure=True,
            samesite="lax",
        )


async def _check_ram_guard(current_user: dict, db: aiosqlite.Connection) -> dict:
    return await enforce_account_ram_limit(
        current_user["id"],
        current_user["username"],
        current_user.get("role", "student"),
        db=db,
        preferred_stop_name=N8nManager.container_name(current_user["username"]),
    )


@router.get("/status")
async def get_status(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    guard = await _check_ram_guard(current_user, db)
    status_info = await N8nManager.get_status(
        current_user["id"],
        current_user["username"],
        current_user.get("role", "student"),
    )
    status_info["ram_limit_exceeded"] = not guard["allowed"]
    status_info["ram_warning"] = guard["warning"]
    status_info["account_ram_used_mb"] = guard["total_ram_mb"]
    status_info["account_ram_limit_mb"] = guard["ram_limit_mb"]
    return status_info


@router.post("/start")
async def start_n8n(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    guard = await _check_ram_guard(current_user, db)
    if not guard["allowed"]:
        raise HTTPException(status_code=429, detail=guard["warning"])
    return await N8nManager.start(
        current_user["id"],
        current_user["username"],
        current_user.get("name", ""),
        current_user.get("role", "student"),
    )


@router.post("/start-async")
async def start_n8n_async(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    guard = await _check_ram_guard(current_user, db)
    if not guard["allowed"]:
        raise HTTPException(status_code=429, detail=guard["warning"])
    return await N8nManager.ensure_starting(
        current_user["id"],
        current_user["username"],
        current_user.get("name", ""),
        current_user.get("role", "student"),
    )


@router.post("/stop")
async def stop_n8n(current_user: dict = Depends(get_current_user)):
    success = await N8nManager.stop(current_user["id"], current_user["username"])
    return {"success": success}


@router.post("/restart")
async def restart_n8n(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    guard = await _check_ram_guard(current_user, db)
    if not guard["allowed"]:
        raise HTTPException(status_code=429, detail=guard["warning"])
    return await N8nManager.restart(
        current_user["id"],
        current_user["username"],
        current_user.get("name", ""),
        current_user.get("role", "student"),
    )


@router.get("/sso")
async def get_sso(
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    guard = await _check_ram_guard(current_user, db)
    if not guard["allowed"]:
        raise HTTPException(status_code=429, detail=guard["warning"])
    data = await N8nManager.get_sso_session(
        current_user["id"],
        current_user["username"],
        current_user.get("name", ""),
        current_user.get("role", "student"),
    )
    cookie_val = data.pop("n8n_auth_cookie", None)
    _attach_n8n_cookie(response, cookie_val)
    return data


@router.get("/sso-redirect")
async def sso_redirect(
    request: Request,
    token: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user_flexible),
    db: aiosqlite.Connection = Depends(get_db),
):
    guard = await _check_ram_guard(current_user, db)
    if not guard["allowed"]:
        return RedirectResponse(url="https://miraigrid.web.id/n8n?ram_limit=1", status_code=302)
    data = await N8nManager.get_sso_session(
        current_user["id"],
        current_user["username"],
        current_user.get("name", ""),
        current_user.get("role", "student"),
    )
    cookie_val = data.pop("n8n_auth_cookie", None)
    if not cookie_val:
        return RedirectResponse(url="https://miraigrid.web.id/n8n?autolaunch=1", status_code=302)
    redirect_resp = RedirectResponse(url=data["sso_url"], status_code=302)
    redirect_resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    _attach_n8n_cookie(redirect_resp, cookie_val)
    raw_token = token or request.cookies.get("miraigrid_token")
    if raw_token:
        redirect_resp.set_cookie(
            key="miraigrid_token",
            value=raw_token,
            domain=".miraigrid.web.id",
            path="/",
            max_age=7 * 24 * 3600,
            httponly=True,
            secure=True,
            samesite="lax",
        )
    return redirect_resp


@router.get("/resolve")
async def resolve_n8n_subdomain(
    request: Request,
    x_original_host: Optional[str] = Header(None),
    x_n8n_user: Optional[str] = Header(None),
    host: Optional[str] = Header(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Internal dynamic resolver used by Host Nginx auth_request.
    Resolves incoming 'n8n-<username>.miraigrid.web.id' to internal port (15000 + user_id).
    """
    target_host = (x_original_host or host or request.query_params.get("host") or "").split(":")[0].strip().lower()
    if not target_host:
        return Response(status_code=400, content="Missing Host Header")

    target_user = None
    if x_n8n_user:
        target_user = x_n8n_user.strip().lower()
    elif target_host.startswith("n8n-"):
        first = target_host.split(".")[0]
        if first.startswith("n8n-"):
            target_user = first[4:].strip().lower()

    if not target_user:
        if target_host == "n8n.miraigrid.web.id":
            target_user = request.query_params.get("user", "admin").strip().lower()
        else:
            return Response(status_code=403, content="Host Not In Scope")

    cursor = await db.execute(
        "SELECT id, username, name, role FROM users WHERE LOWER(username) = ?",
        (target_user,),
    )
    row = await cursor.fetchone()
    if not row:
        return Response(status_code=404, content="User Not Found")

    user_id = row["id"]
    username = row["username"]
    full_name = row["name"] or ""
    user_role = row["role"] or "student"
    target_port = N8nManager.container_port(user_id)

    x_orig_uri = request.headers.get("x-original-uri", "")
    # Allow public webhook endpoints & static assets without MiraiGrid browser session cookie
    is_webhook = (
        x_orig_uri.startswith("/webhook/")
        or x_orig_uri.startswith("/webhook-test/")
        or x_orig_uri.startswith("/webhook-waiting/")
        or x_orig_uri.startswith("/rest/oauth2-credential/callback")
    )
    is_asset = (
        x_orig_uri.startswith("/assets/")
        or x_orig_uri.startswith("/static/")
        or bool(re.search(r"\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|otf|json|webp|wasm|map)(\?.*)?$", x_orig_uri, re.IGNORECASE))
    )

    n8n_set_cookie_hdr = ""
    if not is_webhook and not is_asset:
        is_authorized, status_code, err_msg, _ = await verify_subdomain_access(
            request=request,
            db=db,
            target_username=target_user,
            platform_name="n8n Workflow Automation",
        )
        if not is_authorized:
            resp = Response(status_code=status_code, content=err_msg)
            resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return resp

        guard = await enforce_account_ram_limit(
            user_id,
            username,
            user_role,
            db=db,
            preferred_stop_name=N8nManager.container_name(username),
        )
        if not guard["allowed"]:
            resp = Response(status_code=403, content=guard["warning"])
            resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return resp

        # Auto-boot & inject n8n-auth cookie if browser doesn't have one yet (fixes direct access / refresh on /signin)
        if not request.cookies.get("n8n-auth"):
            sso_data = await N8nManager.get_sso_session(user_id, username, full_name, user_role)
            cookie_val = sso_data.get("n8n_auth_cookie")
            if cookie_val:
                n8n_set_cookie_hdr = (
                    f"n8n-auth={cookie_val}; Domain=.miraigrid.web.id; Path=/; "
                    f"Max-Age=21600; HttpOnly; Secure; SameSite=Lax"
                )
        else:
            status_info = await N8nManager.get_status(user_id, username, user_role)
            if not status_info.get("running"):
                await N8nManager.start(user_id, username, full_name, user_role)

    resp = Response(status_code=200)
    resp.headers["X-Target-Port"] = str(target_port)
    resp.headers["X-Target-User"] = username
    if n8n_set_cookie_hdr:
        resp.headers["X-N8n-Set-Cookie"] = n8n_set_cookie_hdr
    return resp
