"""
Subdomain Authorization & Zero-Trust Gatekeeper Service for MiraiGrid.
Validates incoming requests for isolated multi-tenant services:
- Web IDE (VS Code Server): code-<username>.miraigrid.web.id
- ThingsBoard IoT Sandbox: tb-<username>.miraigrid.web.id
- Database Studios: cloudbeaver, pma, ppa
"""

from typing import Tuple, Dict, Any, Optional
from fastapi import Request
import aiosqlite
from app.core.security import decode_access_token


def extract_token_from_request(request: Request) -> Optional[str]:
    """
    Extracts authentication token from multiple request locations:
    1. Query parameter 'token'
    2. Header 'X-Query-Token' (forwarded from Nginx $arg_token)
    3. Cookie 'miraigrid_token'
    4. Header 'Authorization: Bearer <token>'
    """
    # 1. Query parameter
    token = request.query_params.get("token")
    if token and token.strip():
        return token.strip()

    # 2. X-Query-Token header
    x_query = request.headers.get("x-query-token")
    if x_query and x_query.strip():
        return x_query.strip()

    # 3. Cookie header
    cookie_header = request.headers.get("cookie", "")
    if cookie_header:
        for part in cookie_header.split(";"):
            part_s = part.strip()
            if part_s.startswith("miraigrid_token="):
                val = part_s.split("=", 1)[1].strip()
                if val:
                    return val

    # 4. Authorization Bearer header
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        val = auth_header[7:].strip()
        if val:
            return val

    return None


async def verify_subdomain_access(
    request: Request,
    db: aiosqlite.Connection,
    target_username: Optional[str] = None,
    platform_name: str = "workspace"
) -> Tuple[bool, int, str, Dict[str, Any]]:
    """
    Verifies that the incoming subrequest is authenticated and authorized.

    Rules:
    - If unauthenticated or token expired -> (False, 401, error_message, {})
    - If target_username is None or empty:
        Any authenticated user is permitted (status 200).
    - If target_username is specified:
        * Admin users (role == 'admin') can access any user's workspace/platform.
        * Standard users can ONLY access their own workspace (username == target_username).
        * Cross-user access returns (False, 403, error_message, user_dict).
    """
    token = extract_token_from_request(request)
    if not token:
        return False, 401, f"Otentikasi diperlukan untuk mengakses {platform_name}. Silakan login terlebih dahulu.", {}

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        return False, 401, "Sesi login Anda telah berakhir atau tidak valid. Silakan login kembali.", {}

    raw_sub = payload["sub"]
    try:
        user_id = int(raw_sub)
    except (ValueError, TypeError):
        user_id = raw_sub

    cursor = await db.execute(
        "SELECT id, username, role, is_active FROM users WHERE id = ? OR username = ?",
        (user_id, str(raw_sub))
    )
    user = await cursor.fetchone()
    if not user or not user["is_active"]:
        return False, 401, "Akun pengguna tidak aktif atau tidak ditemukan di sistem MiraiGrid.", {}

    user_dict = dict(user)
    current_user_name = str(user_dict["username"]).strip().lower()
    current_user_role = str(user_dict["role"]).strip().lower()

    # If no target specified, general session check passes
    if not target_username or not target_username.strip():
        return True, 200, "Authenticated", user_dict

    target_user_clean = target_username.strip().lower()

    # Rule 1: Administrators have access to any workspace/sandbox
    if current_user_role == "admin":
        return True, 200, "Authorized as Administrator", user_dict

    # Rule 2: Resource owner has full access
    if current_user_name == target_user_clean:
        return True, 200, "Authorized as Resource Owner", user_dict

    # Rule 3: Cross-tenant tampering attempt blocked
    return False, 403, f"Akses Ditolak: Anda login sebagai '{current_user_name}' dan tidak memiliki izin mengakses {platform_name} milik akun '{target_user_clean}'.", user_dict
