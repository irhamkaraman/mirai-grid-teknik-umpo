from fastapi import APIRouter, Depends, HTTPException, status, Request
import aiosqlite
from app.core.database import get_db
from app.core.security import verify_password, hash_password, create_access_token
from app.models.schemas import LoginRequest, ChangePasswordRequest, Token, UserResponse
from app.api.deps import get_current_user, get_client_ip

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
async def login(
    credentials: LoginRequest,
    request: Request,
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM users WHERE username = ?", (credentials.username,))
    user = await cursor.fetchone()

    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun ini telah dinonaktifkan oleh administrator lab."
        )

    # Audit log
    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'LOGIN', 'auth', ?, 'User successfully logged in')
    """, (user["id"], ip))
    await db.commit()

    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": bool(user["must_change_password"]),
        "role": user["role"],
        "username": user["username"],
        "name": user["name"]
    }

@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    if not verify_password(body.old_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Password lama tidak sesuai.")

    if body.old_password == body.new_password:
        raise HTTPException(status_code=400, detail="Password baru tidak boleh sama dengan password lama.")

    new_hash = hash_password(body.new_password)
    await db.execute("""
        UPDATE users
        SET password_hash = ?, must_change_password = 0
        WHERE id = ?
    """, (new_hash, current_user["id"]))

    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'CHANGE_PASSWORD', 'user_profile', ?, 'Password updated successfully')
    """, (current_user["id"], ip))
    await db.commit()

    return {"success": True, "message": "Password berhasil diperbarui."}

@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("""
        SELECT u.*, c.name as class_name, co.year as cohort_year
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        LEFT JOIN cohorts co ON c.cohort_id = co.id
        WHERE u.id = ?
    """, (current_user["id"],))
    row = await cursor.fetchone()
    return dict(row)
