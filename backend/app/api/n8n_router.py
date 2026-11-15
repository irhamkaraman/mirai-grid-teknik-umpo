import re
from typing import Optional
from fastapi import APIRouter, Depends, Header, Request, Response
import aiosqlite

from app.core.database import get_db
from app.core.subdomain_auth import verify_subdomain_access
from app.api.deps import get_current_user
from app.services.n8n_manager import N8nManager

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


@router.get("/status")
async def get_status(current_user: dict = Depends(get_current_user)):
    return await N8nManager.get_status(
        current_user["id"],
        current_user["username"],
        current_user.get("role", "student"),
    )


@router.post("/start")
async def start_n8n(current_user: dict = Depends(get_current_user)):
    return await N8nManager.start(
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
async def restart_n8n(current_user: dict = Depends(get_current_user)):
    return await N8nManager.restart(
        current_user["id"],
        current_user["username"],
        current_user.get("name", ""),
        current_user.get("role", "student"),
    )


@router.get("/sso")
async def get_sso(response: Response, current_user: dict = Depends(get_current_user)):
    data = await N8nManager.get_sso_session(
        current_user["id"],
        current_user["username"],
        current_user.get("name", ""),
        current_user.get("role", "student"),
    )
    cookie_val = data.pop("n8n_auth_cookie", None)
    _attach_n8n_cookie(response, cookie_val)
    return data


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

        # Auto-boot & ensure n8n-auth cookie if browser doesn't have one yet
        status_info = await N8nManager.get_status(user_id, username, user_role)
        if not status_info.get("running"):
            await N8nManager.start(user_id, username, full_name, user_role)

    resp = Response(status_code=200)
    resp.headers["X-Target-Port"] = str(target_port)
    resp.headers["X-Target-User"] = username
    return resp
