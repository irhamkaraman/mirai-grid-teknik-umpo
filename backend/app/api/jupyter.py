"""Endpoint SSO dan Otentikasi JupyterHub untuk MiraiGrid."""

import os
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
import aiosqlite

from app.core.database import get_db
from app.core.security import verify_password
from app.services.jupyter_sso import sign_jupyter_token
from app.api.deps import get_current_user

router = APIRouter(prefix="/jupyter", tags=["jupyter"])

# Format resmi NIM Teknik Informatika (S1) UMPO:
# - Angkatan 23 ke atas: (2[3-9]|[3-9]\d)533\d{3}
# - Format 8-digit standar: \d{2}53\d{4}
NIM_TI_REGEX = re.compile(r"^(?:(2[3-9]|[3-9]\d)533\d{3}|\d{2}53\d{4})$")


class SsoLaunchResponse(BaseModel):
    success: bool
    action_url: str
    fields: dict[str, str]
    username: str
    expires_in: int


class VerifyCredentialsRequest(BaseModel):
    username: str
    password: str


class VerifyCredentialsResponse(BaseModel):
    success: bool
    username: str
    name: str
    role: str
    token: Optional[str] = None
    message: Optional[str] = "Otentikasi berhasil"


@router.post("/sso-launch", response_model=SsoLaunchResponse)
async def sso_launch(response: Response, user=Depends(get_current_user)):
    response.headers["Cache-Control"] = "no-store"

    user_dict = user if isinstance(user, dict) else (user.__dict__ if hasattr(user, "__dict__") else {})
    nim = str(user_dict.get("nim") or user_dict.get("username") or getattr(user, "nim", "") or getattr(user, "username", "")).strip()
    nama = str(
        user_dict.get("name")
        or user_dict.get("nama")
        or user_dict.get("full_name")
        or getattr(user, "name", "")
        or getattr(user, "nama", "")
        or getattr(user, "full_name", "")
        or f"Mahasiswa {nim}"
    )
    role = str(user_dict.get("role") or getattr(user, "role", "")).strip()

    # Admin bypass for testing or must be Teknik Informatika (S1) student (code 53 / 533)
    if role in ("admin", "dosen"):
        if not NIM_TI_REGEX.match(nim):
            nim = "23533740"  # Dedicated administrative NIM for TI JupyterHub testing
    elif not NIM_TI_REGEX.match(nim):
        raise HTTPException(
            status_code=403,
            detail="Akses dibatasi: Hanya mahasiswa Teknik Informatika (S1) yang diizinkan mengakses JupyterHub.",
        )

    action_url = os.environ.get("JUPYTER_SSO_URL", "http://76.76.76.188:8090/hub/sso/miraigrid").strip()
    if not action_url:
        raise HTTPException(
            status_code=500,
            detail="JUPYTER_SSO_URL belum dikonfigurasi di server.",
        )

    try:
        token = sign_jupyter_token(nim, nama)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal menandatangani SSO token: {str(e)}",
        )

    return SsoLaunchResponse(
        success=True,
        action_url=action_url,
        fields={"token": token},
        username=f"m{nim}",
        expires_in=60,
    )


@router.post("/verify-credentials", response_model=VerifyCredentialsResponse)
async def verify_credentials(req: VerifyCredentialsRequest, db: aiosqlite.Connection = Depends(get_db)):
    """Verifikasi NIM dan Password mahasiswa untuk autentikasi JupyterHub."""
    username = req.username.strip()
    password = req.password

    if not username or not password:
        raise HTTPException(status_code=400, detail="NIM / Username dan password wajib diisi.")

    # 1. Cek database lokal MiraiGrid
    cursor = await db.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username,))
    user = await cursor.fetchone()

    is_valid = False
    name = f"Mahasiswa {username}"
    role = "student"

    if user and verify_password(password, user["password_hash"]):
        if not user["is_active"]:
            raise HTTPException(status_code=403, detail="Akun MiraiGrid sedang dinonaktifkan.")
        is_valid = True
        name = user["name"] or name
        role = user["role"]
    else:
        # 2. Cek SIMTIK UMPO jika kredensial lokal belum terdaftar
        try:
            from app.services.simtik import verify_simtik
            simtik_res = await verify_simtik(username, password)
            if simtik_res.get("success"):
                is_valid = True
                name = simtik_res.get("nama") or simtik_res.get("name") or name
        except Exception:
            pass

    if not is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="NIM atau Password salah.")

    # Cek hak akses mahasiswa Teknik Informatika
    is_ti = bool(
        role in ("admin", "dosen")
        or NIM_TI_REGEX.match(username)
        or re.fullmatch(r"(2[3-9]|[3-9]\d)533\d{3}", username)
    )
    if not is_ti:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses dibatasi: Hanya mahasiswa Teknik Informatika (S1) yang diizinkan masuk ke JupyterHub.",
        )

    try:
        sso_token = sign_jupyter_token(username, name)
    except Exception:
        sso_token = None

    return VerifyCredentialsResponse(
        success=True,
        username=username,
        name=name,
        role=role,
        token=sso_token,
        message="Otentikasi JupyterHub berhasil diverifikasi.",
    )

