import secrets
import string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
import aiosqlite
from app.core.database import get_db
from app.core.security import hash_password
from app.models.schemas import (
    CohortCreate, ClassCreate, BulkAccountGenerateRequest,
    BulkCsvImportRequest, UserResponse, AuditLogResponse, UserCreateManual,
    BulkDeleteUsersRequest, UserQuotaUpdateRequest, BulkQuotaUpdateRequest
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
    cursor = await db.execute("""
        SELECT c.*, COUNT(DISTINCT cl.id) as class_count
        FROM cohorts c
        LEFT JOIN classes cl ON cl.cohort_id = c.id
        GROUP BY c.id
        ORDER BY c.year DESC
    """)
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]

@router.delete("/cohorts/{cohort_id}")
async def delete_cohort(cohort_id: int, request: Request, admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM cohorts WHERE id = ?", (cohort_id,))
    cohort = await cursor.fetchone()
    if not cohort:
        raise HTTPException(status_code=404, detail="Angkatan tidak ditemukan.")

    await db.execute("DELETE FROM cohorts WHERE id = ?", (cohort_id,))
    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'DELETE_COHORT', ?, ?, ?)
    """, (admin["id"], str(cohort["year"]), ip, f"Deleted cohort {cohort['year']}"))
    await db.commit()
    return {"success": True, "message": "Angkatan berhasil dihapus."}

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

@router.delete("/classes/{class_id}")
async def delete_class(class_id: int, request: Request, admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM classes WHERE id = ?", (class_id,))
    cl = await cursor.fetchone()
    if not cl:
        raise HTTPException(status_code=404, detail="Kelas tidak ditemukan.")

    await db.execute("DELETE FROM classes WHERE id = ?", (class_id,))
    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'DELETE_CLASS', ?, ?, ?)
    """, (admin["id"], cl["name"], ip, f"Deleted class {cl['name']}"))
    await db.commit()
    return {"success": True, "message": "Kelas berhasil dihapus."}

# Manual Single User Account Creation (Custom username & password)
@router.post("/users/create")
async def create_manual_user(
    body: UserCreateManual,
    request: Request,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    clean_username = body.username.strip()
    clean_name = body.name.strip()

    # Check unique username
    existing = await (await db.execute("SELECT id FROM users WHERE username = ?", (clean_username,))).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail=f"Username/NIM '{clean_username}' sudah digunakan.")

    pass_hash = hash_password(body.password)
    must_change = 1 if body.must_change_password else 0

    cursor = await db.execute("""
        INSERT INTO users (username, name, email, password_hash, role, class_id, must_change_password, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    """, (clean_username, clean_name, body.email, pass_hash, body.role, body.class_id, must_change))
    user_id = cursor.lastrowid

    # Create quota (admin has larger quota)
    max_proj = 999 if body.role == "admin" else 2
    max_db = 999 if body.role == "admin" else 2
    await db.execute("""
        INSERT INTO quotas (user_id, max_projects, max_databases, max_memory_mb, max_cpu_cores, max_disk_mb)
        VALUES (?, ?, ?, 512, 1.0, 1000)
    """, (user_id, max_proj, max_db))

    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'CREATE_USER_MANUAL', ?, ?, ?)
    """, (admin["id"], clean_username, ip, f"Created {body.role} user '{clean_username}'"))
    await db.commit()

    return {
        "success": True,
        "id": user_id,
        "username": clean_username,
        "name": clean_name,
        "role": body.role
    }

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    request: Request,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun Anda sendiri.")

    cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    u = await cursor.fetchone()
    if not u:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")

    await db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'DELETE_USER', ?, ?, ?)
    """, (admin["id"], u["username"], ip, f"Deleted user '{u['username']}'"))
    await db.commit()
    return {"success": True, "message": f"Akun '{u['username']}' berhasil dihapus."}

@router.post("/users/bulk-delete")
async def bulk_delete_users(
    body: BulkDeleteUsersRequest,
    request: Request,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    if not body.user_ids:
        raise HTTPException(status_code=400, detail="Daftar user_ids tidak boleh kosong.")

    # Exclude current admin to prevent accidental self-deletion
    target_ids = [uid for uid in body.user_ids if uid != admin["id"]]
    if not target_ids:
        raise HTTPException(status_code=400, detail="Tidak ada akun valid yang dapat dihapus.")

    placeholders = ",".join("?" for _ in target_ids)
    cursor = await db.execute(f"SELECT id, username, role FROM users WHERE id IN ({placeholders})", target_ids)
    rows = await cursor.fetchall()

    # Filter out admin role users
    valid_delete_ids = [r["id"] for r in rows if r["role"] != "admin"]
    deleted_usernames = [r["username"] for r in rows if r["role"] != "admin"]

    if not valid_delete_ids:
        raise HTTPException(status_code=400, detail="Tidak ada akun mahasiswa yang dapat dihapus (akun admin dilindungi).")

    v_placeholders = ",".join("?" for _ in valid_delete_ids)
    await db.execute(f"DELETE FROM users WHERE id IN ({v_placeholders})", valid_delete_ids)

    ip = get_client_ip(request)
    summary_usernames = ", ".join(deleted_usernames[:10]) + ("..." if len(deleted_usernames) > 10 else "")
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'BULK_DELETE_USERS', 'users', ?, ?)
    """, (admin["id"], ip, f"Bulk deleted {len(deleted_usernames)} accounts: {summary_usernames}"))
    await db.commit()

    return {
        "success": True,
        "deleted_count": len(deleted_usernames),
        "deleted_usernames": deleted_usernames,
        "message": f"Berhasil menghapus massal {len(deleted_usernames)} akun mahasiswa."
    }

@router.put("/users/{user_id}/quota")
async def update_user_quota(
    user_id: int,
    body: UserQuotaUpdateRequest,
    request: Request,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT id, username, role FROM users WHERE id = ?", (user_id,))
    u = await cursor.fetchone()
    if not u:
        raise HTTPException(status_code=404, detail="Akun pengguna tidak ditemukan.")

    cursor = await db.execute("SELECT id FROM quotas WHERE user_id = ?", (user_id,))
    q = await cursor.fetchone()
    if q:
        await db.execute("""
            UPDATE quotas
            SET max_disk_mb = ?, max_memory_mb = ?, max_cpu_cores = ?,
                max_projects = COALESCE(?, max_projects),
                max_databases = COALESCE(?, max_databases),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        """, (body.max_disk_mb, body.max_memory_mb, body.max_cpu_cores, body.max_projects, body.max_databases, user_id))
    else:
        await db.execute("""
            INSERT INTO quotas (user_id, max_disk_mb, max_memory_mb, max_cpu_cores, max_projects, max_databases)
            VALUES (?, ?, ?, ?, COALESCE(?, 2), COALESCE(?, 2))
        """, (user_id, body.max_disk_mb, body.max_memory_mb, body.max_cpu_cores, body.max_projects, body.max_databases))

    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'UPDATE_USER_QUOTA', ?, ?, ?)
    """, (admin["id"], u["username"], ip, f"Updated resource limits for '{u['username']}': Storage {body.max_disk_mb}MB, RAM {body.max_memory_mb}MB, CPU {body.max_cpu_cores} Cores"))
    await db.commit()

    return {
        "success": True,
        "user_id": user_id,
        "username": u["username"],
        "max_disk_mb": body.max_disk_mb,
        "max_memory_mb": body.max_memory_mb,
        "max_cpu_cores": body.max_cpu_cores,
        "message": f"Limit resource akun '{u['username']}' berhasil diperbarui."
    }

@router.post("/users/bulk-quota")
async def bulk_update_user_quota(
    body: BulkQuotaUpdateRequest,
    request: Request,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    if not body.user_ids:
        raise HTTPException(status_code=400, detail="Daftar user_ids tidak boleh kosong.")

    target_ids = [uid for uid in body.user_ids if uid != admin["id"]]
    if not target_ids:
        raise HTTPException(status_code=400, detail="Tidak ada akun valid yang dapat diatur limitnya.")

    for uid in target_ids:
        cursor = await db.execute("SELECT id FROM quotas WHERE user_id = ?", (uid,))
        q = await cursor.fetchone()
        if q:
            await db.execute("""
                UPDATE quotas
                SET max_disk_mb = ?, max_memory_mb = ?, max_cpu_cores = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            """, (body.max_disk_mb, body.max_memory_mb, body.max_cpu_cores, uid))
        else:
            await db.execute("""
                INSERT INTO quotas (user_id, max_disk_mb, max_memory_mb, max_cpu_cores, max_projects, max_databases)
                VALUES (?, ?, ?, ?, 2, 2)
            """, (uid, body.max_disk_mb, body.max_memory_mb, body.max_cpu_cores))

    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'BULK_UPDATE_QUOTA', 'users', ?, ?)
    """, (admin["id"], ip, f"Bulk updated limits for {len(target_ids)} users: Storage {body.max_disk_mb}MB, RAM {body.max_memory_mb}MB, CPU {body.max_cpu_cores} Cores"))
    await db.commit()

    return {
        "success": True,
        "updated_count": len(target_ids),
        "message": f"Berhasil memperbarui limit resource untuk {len(target_ids)} akun."
    }

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
        SELECT u.*, c.name as class_name, co.year as cohort_year,
               COALESCE(q.max_disk_mb, 1000) as max_disk_mb,
               COALESCE(q.max_memory_mb, 512) as max_memory_mb,
               COALESCE(q.max_cpu_cores, 1.0) as max_cpu_cores,
               COALESCE(q.max_projects, 2) as max_projects,
               COALESCE(q.max_databases, 2) as max_databases
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        LEFT JOIN cohorts co ON c.cohort_id = co.id
        LEFT JOIN quotas q ON u.id = q.user_id
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

# 5. Global Capacity & Per-Account Distribution Monitor
@router.get("/system-capacity")
async def get_system_capacity(
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    import shutil
    import os

    # 1. Host Disk Usage (shutil.disk_usage)
    try:
        disk_path = "/home/student/lab" if os.path.exists("/home/student/lab") else "/"
        total_b, used_b, free_b = shutil.disk_usage(disk_path)
        disk_total_gb = round(total_b / (1024**3), 1)
        disk_used_gb = round(used_b / (1024**3), 1)
        disk_free_gb = round(free_b / (1024**3), 1)
        disk_percent = round((used_b / total_b) * 100, 1) if total_b > 0 else 0
    except Exception:
        disk_total_gb, disk_used_gb, disk_free_gb, disk_percent = 116.0, 8.6, 107.4, 7.4

    # 2. Host RAM / Memory Usage (from /proc/meminfo)
    mem_total_mb = 11264
    mem_used_mb = 1638
    try:
        if os.path.exists("/proc/meminfo"):
            with open("/proc/meminfo") as f:
                meminfo = {}
                for line in f:
                    parts = line.split(":")
                    if len(parts) == 2:
                        meminfo[parts[0].strip()] = parts[1].strip()
                t = int(meminfo.get("MemTotal", "0 kB").split()[0]) // 1024
                avail = int(meminfo.get("MemAvailable", meminfo.get("MemFree", "0 kB")).split()[0]) // 1024
                if t > 0:
                    mem_total_mb = t
                    mem_used_mb = max(0, t - avail)
    except Exception:
        pass
    mem_percent = round((mem_used_mb / mem_total_mb) * 100, 1) if mem_total_mb > 0 else 0

    # 3. Overall Resource Counts
    c_students = await (await db.execute("SELECT COUNT(*) FROM users WHERE role = 'student'")).fetchone()
    c_admins = await (await db.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")).fetchone()
    c_projects = await (await db.execute("SELECT COUNT(*) FROM projects")).fetchone()
    c_projects_running = await (await db.execute("SELECT COUNT(*) FROM projects WHERE status = 'running'")).fetchone()
    c_dbs = await (await db.execute("SELECT COUNT(*) FROM student_databases")).fetchone()
    c_dbs_pg = await (await db.execute("SELECT COUNT(*) FROM student_databases WHERE engine = 'postgres'")).fetchone()
    c_dbs_maria = await (await db.execute("SELECT COUNT(*) FROM student_databases WHERE engine = 'mariadb'")).fetchone()

    # 4. Per-account distribution (breakdown)
    query = """
        SELECT 
            u.id, u.username, u.name, u.role, u.is_active, u.created_at,
            c.name as class_name, co.year as cohort_year,
            COALESCE(q.max_projects, 2) as max_projects,
            COALESCE(q.max_databases, 2) as max_databases,
            COALESCE(q.max_disk_mb, 500) as max_disk_mb,
            COUNT(DISTINCT p.id) as project_count,
            COUNT(DISTINCT d.id) as database_count,
            GROUP_CONCAT(DISTINCT p.name) as project_names,
            GROUP_CONCAT(DISTINCT d.db_name) as db_names
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        LEFT JOIN cohorts co ON c.cohort_id = co.id
        LEFT JOIN quotas q ON q.user_id = u.id
        LEFT JOIN projects p ON p.user_id = u.id
        LEFT JOIN student_databases d ON d.user_id = u.id
        GROUP BY u.id
        ORDER BY u.role ASC, project_count DESC, database_count DESC, u.username ASC
    """
    cursor = await db.execute(query)
    rows = await cursor.fetchall()

    accounts = []
    total_allocated_disk_mb = 0.0
    for r in rows:
        d = dict(r)
        p_cnt = d.get("project_count", 0) or 0
        db_cnt = d.get("database_count", 0) or 0
        
        if d.get("role") == "admin":
            est_disk_mb = round(p_cnt * 12.8 + db_cnt * 16.4 + 24.5, 1)
        else:
            est_disk_mb = round(p_cnt * 12.8 + db_cnt * 16.4 + (4.2 if p_cnt > 0 else 0), 1)

        total_allocated_disk_mb += est_disk_mb
        d["estimated_disk_mb"] = est_disk_mb
        d["projects_list"] = [x.strip() for x in (d.get("project_names") or "").split(",") if x.strip()]
        d["databases_list"] = [x.strip() for x in (d.get("db_names") or "").split(",") if x.strip()]
        accounts.append(d)

    return {
        "host": {
            "disk_total_gb": disk_total_gb,
            "disk_used_gb": disk_used_gb,
            "disk_free_gb": disk_free_gb,
            "disk_percent": disk_percent,
            "mem_total_mb": mem_total_mb,
            "mem_used_mb": mem_used_mb,
            "mem_free_mb": max(0, mem_total_mb - mem_used_mb),
            "mem_percent": mem_percent,
            "total_students": c_students[0],
            "total_admins": c_admins[0],
            "total_projects": c_projects[0],
            "running_projects": c_projects_running[0],
            "total_databases": c_dbs[0],
            "total_databases_postgres": c_dbs_pg[0],
            "total_databases_mariadb": c_dbs_maria[0],
            "total_allocated_disk_mb": round(total_allocated_disk_mb, 1),
        },
        "accounts": accounts
    }
