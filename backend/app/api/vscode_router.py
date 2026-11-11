import re
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Header, Request, Response, status
from pydantic import BaseModel
import aiosqlite

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_flexible
from app.services.vscode_manager import VSCodeManager

router = APIRouter(prefix="/vscode", tags=["Web IDE (VS Code)"])

class StartVSCodeRequest(BaseModel):
    folder: Optional[str] = None

@router.get("/status")
async def get_status(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    username = current_user["username"]
    return await VSCodeManager.get_status(user_id, username)

@router.get("/folders")
async def get_folders(current_user: dict = Depends(get_current_user)):
    username = current_user["username"]
    folders = await VSCodeManager.get_folders(username)
    return {"folders": folders}

@router.post("/start")
async def start_vscode(
    body: StartVSCodeRequest = StartVSCodeRequest(),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    username = current_user["username"]
    return await VSCodeManager.start(user_id, username, body.folder)

@router.post("/stop")
async def stop_vscode(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    username = current_user["username"]
    success = await VSCodeManager.stop(user_id, username)
    return {"success": success}

@router.post("/restart")
async def restart_vscode(
    body: StartVSCodeRequest = StartVSCodeRequest(),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    username = current_user["username"]
    return await VSCodeManager.restart(user_id, username, body.folder)

@router.get("/resolve")
async def resolve_vscode_subdomain(
    request: Request,
    x_original_host: Optional[str] = Header(None),
    x_code_user: Optional[str] = Header(None),
    host: Optional[str] = Header(None),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Internal high-performance dynamic resolver used by Host Nginx auth_request.
    Resolves incoming 'code-<username>.miraigrid.web.id' to the internal container port.
    """
    target_host = (x_original_host or host or request.query_params.get("host") or "").split(":")[0].strip().lower()

    if not target_host:
        return Response(status_code=400, content="Missing Host Header")

    target_user = None
    if x_code_user:
        target_user = x_code_user.strip().lower()
    elif target_host.startswith("code-"):
        # Extract username from 'code-<user>.miraigrid.web.id'
        parts = target_host.split(".")
        if parts:
            first = parts[0]
            if first.startswith("code-"):
                target_user = first[5:].strip().lower()

    if not target_user:
        # Default or root domain check
        if target_host in ["code.miraigrid.web.id", "vscode.miraigrid.web.id"]:
            # Route to admin by default or query param
            target_user = request.query_params.get("user", "admin").strip().lower()
        else:
            return Response(status_code=403, content="Host Not In Scope")

    cursor = await db.execute("SELECT id, username FROM users WHERE LOWER(username) = ?", (target_user,))
    row = await cursor.fetchone()
    if not row:
        return Response(status_code=404, content="User Not Found")

    user_id = row["id"]
    username = row["username"]
    target_port = 14000 + user_id

    # Ensure instance is started
    try:
        status_info = await VSCodeManager.get_status(user_id, username)
        if not status_info.get("running"):
            await VSCodeManager.start(user_id, username)
    except Exception:
        pass

    response = Response(status_code=200, content="OK")
    response.headers["X-Target-Port"] = str(target_port)
    response.headers["X-Code-User"] = str(username)
    response.headers["Cache-Control"] = "public, max-age=10"
    return response
