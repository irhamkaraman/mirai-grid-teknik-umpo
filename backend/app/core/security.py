import os
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import bcrypt
import jwt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings

# 1. Password Hashing
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

# 2. JWT Tokens
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.APP_SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.APP_SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        return None

# 3. AES-256-GCM Secret Encryption (For Credentials at rest)
def get_aesgcm() -> AESGCM:
    key_bytes = base64.b64decode(settings.DATA_ENCRYPTION_KEY)
    if len(key_bytes) != 32:
        raise ValueError("DATA_ENCRYPTION_KEY must be a 32-byte base64 string")
    return AESGCM(key_bytes)

def encrypt_secret(plain_text: str) -> str:
    if not plain_text:
        return ""
    aesgcm = get_aesgcm()
    nonce = os.urandom(12)  # 96-bit nonce for AES-GCM
    ciphertext = aesgcm.encrypt(nonce, plain_text.encode("utf-8"), None)
    # Store as nonce + ciphertext encoded in base64
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode("utf-8")

def decrypt_secret(encrypted_text: str) -> str:
    if not encrypted_text:
        return ""
    try:
        data = base64.b64decode(encrypted_text.encode("utf-8"))
        nonce = data[:12]
        ciphertext = data[12:]
        aesgcm = get_aesgcm()
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode("utf-8")
    except Exception as e:
        raise ValueError(f"Failed to decrypt secret: {str(e)}")
