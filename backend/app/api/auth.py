from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
import aiosqlite
from app.core.database import get_db
from app.core.security import verify_password, hash_password, create_access_token, decode_access_token
from app.models.schemas import LoginRequest, ChangePasswordRequest, Token, UserResponse
from app.api.deps import get_current_user, get_client_ip
from app.services.simtik import verify_simtik
from app.services.user_home import ensure_user_home

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
async def login(
    credentials: LoginRequest,
    request: Request,
    response: Response,
    db: aiosqlite.Connection = Depends(get_db)
):
    ip = get_client_ip(request)
    username = credentials.username.strip()
    password = credentials.password

    # 1. Administrator & Local Account Check (Fast-path / offline resilience)
    cursor = await db.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username,))
    user = await cursor.fetchone()

    # If user exists and local password matches
    if user and verify_password(password, user["password_hash"]):
        if not user["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun ini telah dinonaktifkan oleh administrator lab."
            )

        # Audit log
        await db.execute("""
            INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
            VALUES (?, 'LOGIN', 'auth_local', ?, 'User successfully logged in via local credentials')
        """, (user["id"], ip))
        await db.commit()

        # Provision user home directory with standard isolated cPanel structure
        try:
            ensure_user_home(user["username"], user["name"], user["email"])
        except Exception as e:
            print(f"[Warn] User home provisioning failed: {e}")

        access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
        try:
            response.set_cookie(
                key="miraigrid_token",
                value=access_token,
                domain=".miraigrid.web.id",
                path="/",
                max_age=86400 * 7,
                httponly=False,
                samesite="lax",
                secure=True
            )
        except Exception as e:
            print(f"[Warn] Cookie set failed: {e}")

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "must_change_password": bool(user["must_change_password"]),
            "role": user["role"],
            "username": user["username"],
            "name": user["name"],
            "onboarding_step": int(user["onboarding_step"]) if ("onboarding_step" in user.keys() and user["onboarding_step"] is not None) else (4 if user["role"] == "admin" else 1),
            "onboarding_completed": bool(user["onboarding_completed"]) if ("onboarding_completed" in user.keys() and user["onboarding_completed"] is not None) else (user["role"] == "admin")
        }

    # If it is an admin account but local password was incorrect, fail immediately
    if user and user["role"] == "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password administrator salah."
        )

    # 2. Student Authentication via SIMTIK UMPO Handshake
    simtik_result = await verify_simtik(username, password)

    if not simtik_result["success"]:
        # If SIMTIK rejects, raise clear 401 error
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=simtik_result.get("message", "NIM atau Password SIMTIK salah.")
        )

    # 3. Handshake successful: Auto-provision or sync user in local database
    new_hash = hash_password(password)

    if not user:
        # Auto-provision new student
        student_name = simtik_result.get("nama", f"Mahasiswa {username}")
        student_email = f"{username}@umpo.ac.id"
        
        insert_cur = await db.execute("""
            INSERT INTO users (username, name, email, password_hash, role, must_change_password, is_active, onboarding_step, onboarding_completed)
            VALUES (?, ?, ?, ?, 'student', 0, 1, 1, 0)
        """, (username, student_name, student_email, new_hash))
        user_id = insert_cur.lastrowid

        # Insert default quotas for new student
        await db.execute("""
            INSERT INTO quotas (user_id, max_projects, max_databases, max_memory_mb, max_cpu_cores, max_disk_mb)
            VALUES (?, 2, 2, 256, 0.5, 500)
        """, (user_id,))
        await db.commit()

        cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = await cursor.fetchone()
    else:
        if not user["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun ini telah dinonaktifkan oleh administrator lab."
            )
        # Synchronize password hash
        await db.execute("""
            UPDATE users SET password_hash = ? WHERE id = ?
        """, (new_hash, user["id"]))
        await db.commit()

    # Audit log for SIMTIK login
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'LOGIN', 'auth_simtik', ?, 'User successfully logged in via SIMTIK UMPO SSO Handshake')
    """, (user["id"], ip))
    await db.commit()

    # Provision user home directory with standard isolated cPanel structure
    try:
        ensure_user_home(user["username"], user["name"], user["email"])
    except Exception as e:
        print(f"[Warn] User home provisioning failed: {e}")

    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    try:
        response.set_cookie(
            key="miraigrid_token",
            value=access_token,
            domain=".miraigrid.web.id",
            path="/",
            max_age=86400 * 7,
            httponly=False,
            samesite="lax",
            secure=True
        )
    except Exception as e:
        print(f"[Warn] Cookie set failed: {e}")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": bool(user["must_change_password"]),
        "role": user["role"],
        "username": user["username"],
        "name": user["name"],
        "onboarding_step": int(user["onboarding_step"]) if ("onboarding_step" in user.keys() and user["onboarding_step"] is not None) else (4 if user["role"] == "admin" else 1),
        "onboarding_completed": bool(user["onboarding_completed"]) if ("onboarding_completed" in user.keys() and user["onboarding_completed"] is not None) else (user["role"] == "admin")
    }

@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    # Jika first-login mandatory (must_change_password = 1) atau old_password tidak diinputkan,
    # verifikasi password lama dilewati karena user sudah login sah via JWT.
    is_mandatory = bool(current_user.get("must_change_password"))
    if not is_mandatory and body.old_password:
        if not verify_password(body.old_password, current_user["password_hash"]):
            raise HTTPException(status_code=400, detail="Password lama tidak sesuai.")

    if body.old_password and body.old_password == body.new_password:
        raise HTTPException(status_code=400, detail="Password baru tidak boleh sama dengan password lama.")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password baru minimal 8 karakter.")

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

@router.get("/cb-verify")
async def cb_verify(
    request: Request,
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Subrequest authentication verification endpoint for Nginx auth_request to CloudBeaver.
    Extracts Bearer token from:
    1. Query param 'token'
    2. Cookie 'miraigrid_token'
    3. Authorization header 'Bearer <token>'
    
    Returns 200 with X-User and X-Team headers for CloudBeaver Reverse Proxy auth.
    Returns 401 if unauthorized or invalid.
    """
    token = request.query_params.get("token")
    if not token:
        cookie_header = request.headers.get("cookie", "")
        for part in cookie_header.split(";"):
            part_s = part.strip()
            if part_s.startswith("miraigrid_token="):
                token = part_s.split("=", 1)[1]
                break
    if not token:
        auth_hdr = request.headers.get("authorization", "")
        if auth_hdr.startswith("Bearer "):
            token = auth_hdr[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing MiraiGrid authentication credentials"
        )

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token"
        )

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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account inactive or not found"
        )

    username = str(user["username"]).strip()
    role = str(user["role"]).strip().lower()

    if role == "admin":
        cb_user = "miraigrid_admin" if username == "admin" else f"admin_{username}"
        cb_team = "admin"
    else:
        cb_user = username
        cb_team = "user"

    res = Response(status_code=status.HTTP_200_OK)
    res.headers["X-User"] = cb_user
    res.headers["X-Team"] = cb_team
    res.headers["X-Role"] = cb_team
    res.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return res


@router.get("/session-verify")
async def verify_general_session(
    request: Request,
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Subrequest authentication verification endpoint for static database & system platforms (PMA, PPA, Jupyter).
    Requires an active, authenticated MiraiGrid user session.
    """
    token = request.query_params.get("token")
    if not token:
        token = request.headers.get("x-query-token")
    if not token:
        cookie_header = request.headers.get("cookie", "")
        if cookie_header:
            for part in cookie_header.split(";"):
                part_s = part.strip()
                if part_s.startswith("miraigrid_token="):
                    token = part_s.split("=", 1)[1].strip()
                    break
    if not token:
        auth_hdr = request.headers.get("authorization", "")
        if auth_hdr.startswith("Bearer "):
            token = auth_hdr[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid"
        )

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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account inactive or not found"
        )

    res = Response(status_code=status.HTTP_200_OK, content="OK")
    res.headers["X-Auth-User"] = str(user["username"])
    res.headers["X-Auth-Role"] = str(user["role"])
    res.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return res

