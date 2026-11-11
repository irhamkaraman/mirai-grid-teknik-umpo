from typing import Optional
from fastapi import Depends, HTTPException, status, Request, Query
from fastapi.security import OAuth2PasswordBearer
import aiosqlite
from app.core.database import get_db
from app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: aiosqlite.Connection = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    raw_sub = payload.get("sub")
    if raw_sub is None:
        raise credentials_exception
    try:
        user_id = int(raw_sub)
    except (ValueError, TypeError):
        user_id = raw_sub

    cursor = await db.execute("SELECT * FROM users WHERE id = ? OR username = ?", (user_id, str(raw_sub)))
    user = await cursor.fetchone()
    if user is None:
        raise credentials_exception
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="User account is suspended")

    return dict(user)

async def get_current_user_flexible(
    request: Request,
    token_param: Optional[str] = Query(None, alias="token"),
    header_token: Optional[str] = Depends(oauth2_scheme_optional),
    db: aiosqlite.Connection = Depends(get_db)
) -> dict:
    effective_token = header_token or token_param
    if not effective_token:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            effective_token = auth[7:].strip()

    if not effective_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(effective_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    raw_sub = payload.get("sub")
    if raw_sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = int(raw_sub)
    except (ValueError, TypeError):
        user_id = raw_sub

    cursor = await db.execute("SELECT * FROM users WHERE id = ? OR username = ?", (user_id, str(raw_sub)))
    user = await cursor.fetchone()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="User account is suspended")

    return dict(user)

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required"
        )
    return current_user

async def require_onboarding_completed(current_user: dict = Depends(get_current_user)) -> dict:
    # Admins always bypass onboarding
    if current_user.get("role") == "admin":
        return current_user
    
    is_completed = bool(current_user.get("onboarding_completed", False))
    if not is_completed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "ONBOARDING_REQUIRED",
                "message": "Akses diblokir: Anda harus menyelesaikan Onboarding Wizard terlebih dahulu sebelum mengakses dashboard.",
                "onboarding_step": current_user.get("onboarding_step", 1),
                "onboarding_completed": False
            }
        )
    return current_user
