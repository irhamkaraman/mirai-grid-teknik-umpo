import pytest
from app.core.security import (
    hash_password, verify_password,
    create_access_token, decode_access_token,
    encrypt_secret, decrypt_secret
)

def test_password_hashing():
    raw_pass = "RahasiaPraktikum2026!"
    hashed = hash_password(raw_pass)
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("SalahPassword", hashed) is False

def test_jwt_token_roundtrip():
    data = {"sub": 42, "role": "student"}
    token = create_access_token(data)
    assert isinstance(token, str)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert int(decoded["sub"]) == 42
    assert decoded["role"] == "student"

def test_aes_gcm_secret_encryption():
    plain = "DbPasswordRahasia123!"
    encrypted = encrypt_secret(plain)
    assert encrypted != plain
    decrypted = decrypt_secret(encrypted)
    assert decrypted == plain

def test_empty_secret_encryption():
    assert encrypt_secret("") == ""
    assert decrypt_secret("") == ""
