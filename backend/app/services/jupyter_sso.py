"""Pembuat token SSO JupyterHub untuk MiraiGrid."""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

SSO_ISSUER = "miraigrid.web.id"
SSO_AUDIENCE = "jupyterhub-lab.umpo"
SSO_TTL_SECONDS = 60


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def sign_jupyter_token(nim: str, name: str, ttl: int = SSO_TTL_SECONDS) -> str:
    secret = os.environ.get("JUPYTER_SSO_SECRET", "").strip()
    if not secret:
        try:
            from app.core.config import settings
            secret = getattr(settings, "JUPYTER_SSO_SECRET", "").strip()
        except Exception:
            pass

    if len(secret) < 32:
        raise RuntimeError("JUPYTER_SSO_SECRET minimal 32 karakter")

    now = int(time.time())
    header = _b64url(json.dumps(
        {"alg": "HS256", "typ": "JWT"}, separators=(",", ":")
    ).encode("utf-8"))
    payload = _b64url(json.dumps({
        "iss": SSO_ISSUER,
        "aud": SSO_AUDIENCE,
        "sub": str(nim).strip(),
        "name": name,
        "iat": now,
        "exp": now + ttl,
        "jti": secrets.token_hex(16),
    }, separators=(",", ":")).encode("utf-8"))

    signature = hmac.new(
        secret.encode("utf-8"),
        f"{header}.{payload}".encode("ascii"),
        hashlib.sha256,
    ).digest()

    return f"{header}.{payload}.{_b64url(signature)}"
