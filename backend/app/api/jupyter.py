"""Endpoint SSO JupyterHub untuk MiraiGrid."""

import os
import re

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.services.jupyter_sso import sign_jupyter_token
from app.api.deps import get_current_user

router = APIRouter(prefix="/jupyter", tags=["jupyter"])

NIM_TI_REGEX = re.compile(r"^\d{2}53\d{4}$")


class SsoLaunchResponse(BaseModel):
    success: bool
    action_url: str
    fields: dict[str, str]
    username: str
    expires_in: int


@router.post("/sso-launch", response_model=SsoLaunchResponse)
def sso_launch(response: Response, user=Depends(get_current_user)):
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

    # Admin bypass for testing or must be Teknik Informatika (S1) student (code 53)
    if role == "admin" and not NIM_TI_REGEX.match(nim):
        nim = "23530000"  # Dedicated administrative NIM for TI JupyterHub testing
    elif not NIM_TI_REGEX.match(nim):
        raise HTTPException(
            status_code=403,
            detail="Hanya mahasiswa Teknik Informatika (S1) yang diizinkan.",
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
