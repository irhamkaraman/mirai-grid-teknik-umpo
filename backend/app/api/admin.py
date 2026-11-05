import secrets
import string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
import aiosqlite
from app.core.database import get_db
from app.core.security import hash_password
from app.models.schemas import (
    CohortCreate, ClassCreate, BulkAccountGenerateRequest,
    BulkCsvImportRequest, UserResponse, AuditLogResponse
)
from app.api.deps import require_admin, get_client_ip

router = APIRouter(prefix="/admin", tags=["Administrator"])

def generate_temp_password(length: int = 8) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))

# 1. Cohorts & Classes
@router.post("/cohorts")
async def create_cohort(body: CohortCreate, admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    try:
        cursor = await db.execute("INSERT INTO cohorts (year, description) VALUES (?, ?)", (body.year, body.description))
        await db.commit()
        return {"id": cursor.lastrowid, "year": body.year, "description": body.description}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cohort creation error: {str(e)}")

@router.get("/cohorts")
async def list_cohorts(admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM cohorts ORDER BY year DESC")
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]

@router.post("/classes")
async def create_class(body: ClassCreate, admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    try:
        cursor = await db.execute("INSERT INTO classes (cohort_id, name) VALUES (?, ?)", (body.cohort_id, body.name))
        await db.commit()
        return {"id": cursor.lastrowid, "cohort_id": body.cohort_id, "name": body.name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Class creation error: {str(e)}")

@router.get("/classes")
async def list_classes(cohort_id: Optional[int] = None, admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    query = """
        SELECT c.*, co.year as cohort_year, COUNT(u.id) as student_count
        FROM classes c
        JOIN cohorts co ON c.cohort_id = co.id
        LEFT JOIN users u ON u.class_id = c.id
    """
    params = []
    if cohort_id:
        query += " WHERE c.cohort_id = ?"
        params.append(cohort_id)
    query += " GROUP BY c.id ORDER BY co.year DESC, c.name ASC"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]

# 2. Bulk Account Generation
@router.post("/generate-bulk-accounts")
async def generate_bulk_accounts(
    body: BulkAccountGenerateRequest,
    request: Request,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    results = []
    for i in range(body.count):
        num = body.start_number + i
        nim = f"{body.nim_prefix}{num:03d}"
        name = f"{body.name_prefix} {num:03d}"
        temp_pass = generate_temp_password(8)
        pass_hash = hash_password(temp_pass)

        # Check existing
        cursor = await db.execute("SELECT id FROM users WHERE username = ?", (nim,))
        existing = await cursor.fetchone()
        if existing:
            continue

        cursor = await db.execute("""
            INSERT INTO users (username, name, password_hash, role, class_id, must_change_password, is_active)
            VALUES (?, ?, ?, 'student', ?, 1, 1)
        """, (nim, name, pass_hash, body.class_id))
        user_id = cursor.lastrowid

        # Insert default quota
        await db.execute("INSERT INTO quotas (user_id) VALUES (?)", (user_id,))

        results.append({
            "nim": nim,
            "name": name,
            "initial_password": temp_pass
        })

    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'GENERATE_BULK_ACCOUNTS', 'users', ?, ?)
    """, (admin["id"], ip, f"Generated {len(results)} accounts for class_id {body.class_id}"))
    await db.commit()

    return {
        "success": True,
        "total_generated": len(results),
        "accounts": results
    }

@router.post("/import-csv-accounts")
async def import_csv_accounts(
    body: BulkCsvImportRequest,
    request: Request,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    results = []
    for student in body.students:
        nim = student.nim.strip()
        name = student.name.strip()
        email = student.email.strip() if student.email else None
        temp_pass = generate_temp_password(8)
        pass_hash = hash_password(temp_pass)

        cursor = await db.execute("SELECT id FROM users WHERE username = ?", (nim,))
        if await cursor.fetchone():
            continue

        cursor = await db.execute("""
            INSERT INTO users (username, name, email, password_hash, role, class_id, must_change_password, is_active)
            VALUES (?, ?, ?, ?, 'student', ?, 1, 1)
        """, (nim, name, email, pass_hash, body.class_id))
        user_id = cursor.lastrowid

        await db.execute("INSERT INTO quotas (user_id) VALUES (?)", (user_id,))
        results.append({
            "nim": nim,
            "name": name,
            "initial_password": temp_pass
        })

    await db.commit()
    return {"success": True, "total_imported": len(results), "accounts": results}

# 3. User Management
@router.get("/users")
async def list_users(
    class_id: Optional[int] = None,
    search: Optional[str] = None,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    query = """
        SELECT u.*, c.name as class_name, co.year as cohort_year
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        LEFT JOIN cohorts co ON c.cohort_id = co.id
        WHERE 1=1
    """
    params = []
    if class_id:
        query += " AND u.class_id = ?"
        params.append(class_id)
    if search:
        query += " AND (u.username LIKE ? OR u.name LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY u.role ASC, u.username ASC"
    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]

@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    temp_pass = generate_temp_password(8)
    pass_hash = hash_password(temp_pass)
    await db.execute("""
        UPDATE users
        SET password_hash = ?, must_change_password = 1
        WHERE id = ?
    """, (pass_hash, user_id))
    await db.commit()
    return {"success": True, "new_temporary_password": temp_pass}

@router.post("/users/{user_id}/toggle-status")
async def toggle_user_status(
    user_id: int,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT is_active FROM users WHERE id = ?", (user_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    new_status = 0 if row["is_active"] else 1
    await db.execute("UPDATE users SET is_active = ? WHERE id = ?", (new_status, user_id))
    await db.commit()
    return {"success": True, "is_active": bool(new_status)}

# 4. Audit Logs & System Stats
@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    limit: int = 100,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("""
        SELECT a.*, u.name as actor_name
        FROM audit_logs a
        LEFT JOIN users u ON a.actor_id = u.id
        ORDER BY a.created_at DESC
        LIMIT ?
    """, (limit,))
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]

@router.get("/stats")
async def get_system_stats(
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    c_users = await (await db.execute("SELECT COUNT(*) FROM users WHERE role = 'student'")).fetchone()
    c_projects = await (await db.execute("SELECT COUNT(*) FROM projects")).fetchone()
    c_dbs = await (await db.execute("SELECT COUNT(*) FROM student_databases")).fetchone()
    c_classes = await (await db.execute("SELECT COUNT(*) FROM classes")).fetchone()

    return {
        "total_students": c_users[0],
        "total_projects": c_projects[0],
        "total_databases": c_dbs[0],
        "total_classes": c_classes[0]
    }
