import asyncio
import os
import re
import secrets
import string
import subprocess
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
import aiosqlite
from app.core.database import get_db
from app.core.security import hash_password, encrypt_secret, decrypt_secret
from app.models.schemas import (
    CohortCreate, ClassCreate, BulkAccountGenerateRequest,
    BulkCsvImportRequest, UserResponse, AuditLogResponse, UserCreateManual,
    BulkDeleteUsersRequest, UserQuotaUpdateRequest, BulkQuotaUpdateRequest,
    StudentDatabaseCreate
)
from app.services.db_provisioner import DatabaseProvisioner
from app.services.disk_usage import calculate_account_disk_usage
from app.services.cloudbeaver_sync import sync_cloudbeaver_datasources
from app.services.user_purge import UserPurgeService
from app.services.user_home import ensure_user_home
from app.services.portainer import portainer
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

    onboarding_step = 4 if body.role == "admin" else 1
    onboarding_completed = 1 if body.role == "admin" else 0

    cursor = await db.execute("""
        INSERT INTO users (username, name, email, password_hash, role, class_id, must_change_password, is_active, onboarding_step, onboarding_completed)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    """, (clean_username, clean_name, body.email or f"{clean_username}@umpo.ac.id", pass_hash, body.role, body.class_id, must_change, onboarding_step, onboarding_completed))
    user_id = cursor.lastrowid

    # Create quota (admin: host tier, dosen: 20GB/1GB/1.5 Core, student: 10GB/512MB/0.5 Core)
    if body.role == "admin":
        max_proj, max_db, def_mem, def_cpu, def_disk, def_db_disk = 999, 999, 1024, 2.0, 116000, 10000
    elif body.role == "dosen":
        max_proj, max_db, def_mem, def_cpu, def_disk, def_db_disk = 5, 5, 1024, 1.5, 20480, 10240
    else:
        max_proj, max_db, def_mem, def_cpu, def_disk, def_db_disk = 2, 2, 512, 0.5, 10240, 5120

    max_mem = body.max_memory_mb if body.max_memory_mb is not None else def_mem
    max_cpu = body.max_cpu_cores if body.max_cpu_cores is not None else def_cpu
    max_disk = body.max_disk_mb if body.max_disk_mb is not None else def_disk
    max_db_disk = body.max_database_disk_mb if body.max_database_disk_mb is not None else def_db_disk

    await db.execute("""
        INSERT INTO quotas (user_id, max_projects, max_databases, max_memory_mb, max_cpu_cores, max_disk_mb, max_database_disk_mb)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, max_proj, max_db, max_mem, max_cpu, max_disk, max_db_disk))

    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'CREATE_USER_MANUAL', ?, ?, ?)
    """, (admin["id"], clean_username, ip, f"Created {body.role} user '{clean_username}'"))
    await db.commit()

    try:
        ensure_user_home(clean_username, clean_name, body.email)
    except Exception as e:
        print(f"[Warn] User home provisioning in admin create failed: {e}")

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

    if u["role"] == "admin":
        raise HTTPException(status_code=400, detail="Akun dengan role admin dilindungi dari penghapusan.")

    # 1. Completely purge user and ALL underlying resources (containers, databases, files, configs)
    purge_report = await UserPurgeService.purge_user(db, user_id, u["username"])

    # 2. Record audit log
    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'DELETE_USER', ?, ?, ?)
    """, (admin["id"], u["username"], ip, f"Purged user '{u['username']}' completely (databases, containers, files, records)"))
    await db.commit()

    return {
        "success": True,
        "message": f"Akun '{u['username']}' beserta seluruh database, file, container, dan konfigurasinya berhasil dihapus bersih.",
        "purge_report": purge_report
    }

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
    valid_delete_rows = [r for r in rows if r["role"] != "admin"]
    deleted_usernames = [r["username"] for r in valid_delete_rows]

    if not valid_delete_rows:
        raise HTTPException(status_code=400, detail="Tidak ada akun mahasiswa yang dapat dihapus (akun admin dilindungi).")

    # Purge each user completely
    purge_reports = []
    for r in valid_delete_rows:
        rep = await UserPurgeService.purge_user(db, r["id"], r["username"])
        purge_reports.append(rep)

    ip = get_client_ip(request)
    summary_usernames = ", ".join(deleted_usernames[:10]) + ("..." if len(deleted_usernames) > 10 else "")
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'BULK_DELETE_USERS', 'users', ?, ?)
    """, (admin["id"], ip, f"Bulk purged {len(deleted_usernames)} accounts cleanly: {summary_usernames}"))
    await db.commit()

    return {
        "success": True,
        "deleted_count": len(deleted_usernames),
        "deleted_usernames": deleted_usernames,
        "message": f"Berhasil menghapus massal {len(deleted_usernames)} akun mahasiswa beserta seluruh resource-nya.",
        "purge_reports": purge_reports
    }

@router.get("/users/{user_id}/detail")
async def get_user_detail(
    user_id: int,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("""
        SELECT u.*, c.name as class_name, co.year as cohort_year,
               COALESCE(q.max_disk_mb, 10240) as max_disk_mb,
               COALESCE(q.max_memory_mb, 512) as max_memory_mb,
               COALESCE(q.max_cpu_cores, 0.5) as max_cpu_cores,
               COALESCE(q.max_processes, 50) as max_processes,
               COALESCE(q.max_projects, 2) as max_projects,
               COALESCE(q.max_databases, 99) as max_databases,
               COALESCE(q.max_database_disk_mb, 5120) as max_database_disk_mb,
               COALESCE(q.allow_postgres, 1) as allow_postgres,
               COALESCE(q.allow_mariadb, 1) as allow_mariadb,
               COALESCE(q.allow_remote_db, 1) as allow_remote_db
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        LEFT JOIN cohorts co ON c.cohort_id = co.id
        LEFT JOIN quotas q ON u.id = q.user_id
        WHERE u.id = ?
    """, (user_id,))
    u = await cursor.fetchone()
    if not u:
        raise HTTPException(status_code=404, detail="Akun pengguna tidak ditemukan.")

    user_data = dict(u)

    # Databases
    dbs_cur = await db.execute("""
        SELECT * FROM student_databases
        WHERE user_id = ?
        ORDER BY created_at DESC
    """, (user_id,))
    dbs = await dbs_cur.fetchall()
    db_list = []
    for r in dbs:
        decrypted_pass = decrypt_secret(r["db_password_enc"])
        uri_scheme = "postgresql" if r["engine"] == "postgres" else "mysql"
        db_list.append({
            "id": r["id"],
            "engine": r["engine"],
            "db_name": r["db_name"],
            "db_username": r["db_username"],
            "db_password": decrypted_pass,
            "host": r["host"],
            "port": r["port"],
            "connection_uri": f"{uri_scheme}://{r['db_username']}:{decrypted_pass}@{r['host']}:{r['port']}/{r['db_name']}",
            "created_at": r["created_at"]
        })
    user_data["databases"] = db_list

    # Projects count
    p_cur = await db.execute("SELECT COUNT(*) FROM projects WHERE user_id = ?", (user_id,))
    user_data["projects_count"] = (await p_cur.fetchone())[0]

    return {"success": True, "user": user_data}

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
                max_processes = COALESCE(?, max_processes),
                max_projects = COALESCE(?, max_projects),
                max_databases = COALESCE(?, max_databases),
                max_database_disk_mb = COALESCE(?, max_database_disk_mb),
                allow_postgres = COALESCE(?, allow_postgres),
                allow_mariadb = COALESCE(?, allow_mariadb),
                allow_remote_db = COALESCE(?, allow_remote_db),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        """, (
            body.max_disk_mb, body.max_memory_mb, body.max_cpu_cores,
            body.max_processes,
            body.max_projects, body.max_databases, body.max_database_disk_mb,
            body.allow_postgres, body.allow_mariadb, body.allow_remote_db,
            user_id
        ))
    else:
        await db.execute("""
            INSERT INTO quotas (
                user_id, max_disk_mb, max_memory_mb, max_cpu_cores, max_processes,
                max_projects, max_databases, max_database_disk_mb, allow_postgres, allow_mariadb, allow_remote_db
            )
            VALUES (?, ?, ?, ?, COALESCE(?, 50), COALESCE(?, 2), COALESCE(?, 99), COALESCE(?, 100), COALESCE(?, 1), COALESCE(?, 1), COALESCE(?, 1))
        """, (
            user_id, body.max_disk_mb, body.max_memory_mb, body.max_cpu_cores, body.max_processes,
            body.max_projects, body.max_databases, body.max_database_disk_mb,
            body.allow_postgres, body.allow_mariadb, body.allow_remote_db
        ))

    # Synchronize live docker resources & pids-limit to running containers if quota changed
    try:
        p_cur = await db.execute("SELECT name FROM projects WHERE user_id = ? AND status = 'running'", (user_id,))
        running_projs = await p_cur.fetchall()
        for rp in running_projs:
            c_name = f"app_{u['username']}_{rp['name']}"
            await portainer.update_container_resources(
                container_name=c_name,
                pids_limit=body.max_processes,
                mem_limit_mb=body.max_memory_mb,
                cpu_cores=body.max_cpu_cores
            )
    except Exception as e:
        print(f"[Warn] Failed to live update container resources for {u['username']}: {e}")

    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'UPDATE_USER_QUOTA', ?, ?, ?)
    """, (admin["id"], u["username"], ip, f"Updated resource & DB limits for '{u['username']}': Files {body.max_disk_mb}MB, DB Storage {body.max_database_disk_mb}MB, RAM {body.max_memory_mb}MB, CPU {body.max_cpu_cores}C, NPROC {body.max_processes or 50}"))
    await db.commit()

    return {
        "success": True,
        "user_id": user_id,
        "username": u["username"],
        "max_disk_mb": body.max_disk_mb,
        "max_database_disk_mb": body.max_database_disk_mb,
        "max_memory_mb": body.max_memory_mb,
        "max_cpu_cores": body.max_cpu_cores,
        "max_processes": body.max_processes or 50,
        "max_projects": body.max_projects,
        "max_databases": body.max_databases,
        "allow_postgres": body.allow_postgres,
        "allow_mariadb": body.allow_mariadb,
        "allow_remote_db": body.allow_remote_db,
        "message": f"Konfigurasi resource & database akun '{u['username']}' berhasil diperbarui."
    }

@router.post("/users/{user_id}/databases")
async def admin_create_user_database(
    user_id: int,
    body: StudentDatabaseCreate,
    request: Request,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT id, username FROM users WHERE id = ?", (user_id,))
    u = await cursor.fetchone()
    if not u:
        raise HTTPException(status_code=404, detail="Akun pengguna tidak ditemukan.")

    nim = u["username"]
    try:
        if body.engine == "postgres":
            prov = await DatabaseProvisioner.create_postgres_db(nim, body.db_name)
        elif body.engine == "mariadb":
            prov = await DatabaseProvisioner.create_mariadb_db(nim, body.db_name)
        else:
            raise HTTPException(status_code=400, detail="Database engine tidak didukung.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal membuat database: {str(e)}")

    encrypted_pass = encrypt_secret(prov["db_password"])
    cursor = await db.execute("""
        INSERT INTO student_databases (user_id, engine, db_name, db_username, db_password_enc, host, port)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, prov["engine"], prov["db_name"], prov["db_username"], encrypted_pass, prov["host"], prov["port"]))
    db_id = cursor.lastrowid

    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'ADMIN_CREATE_DB', ?, ?, ?)
    """, (admin["id"], prov["db_name"], ip, f"Admin created {body.engine} database for '{nim}'"))
    await db.commit()

    try:
        await sync_cloudbeaver_datasources(db)
    except Exception as e:
        print(f"[Warn] CloudBeaver sync failed: {e}")

    return {
        "success": True,
        "id": db_id,
        "db_name": prov["db_name"],
        "engine": prov["engine"],
        "message": f"Database '{prov['db_name']}' berhasil dibuat untuk akun '{nim}'."
    }

@router.delete("/users/{user_id}/databases/{db_id}")
async def admin_delete_user_database(
    user_id: int,
    db_id: int,
    request: Request,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM student_databases WHERE id = ? AND user_id = ?", (db_id, user_id))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Database tidak ditemukan.")

    cursor_u = await db.execute("SELECT username FROM users WHERE id = ?", (user_id,))
    u = await cursor_u.fetchone()
    nim = u["username"]
    raw_name = row["db_name"].replace(f"s{nim}_", "", 1)

    try:
        if row["engine"] == "postgres":
            await DatabaseProvisioner.delete_postgres_db(nim, raw_name)
        elif row["engine"] == "mariadb":
            await DatabaseProvisioner.delete_mariadb_db(nim, raw_name)
    except Exception:
        pass

    await db.execute("DELETE FROM student_databases WHERE id = ?", (db_id,))

    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'ADMIN_DELETE_DB', ?, ?, ?)
    """, (admin["id"], row["db_name"], ip, f"Admin deleted database for '{nim}'"))
    await db.commit()

    try:
        await sync_cloudbeaver_datasources(db)
    except Exception as e:
        print(f"[Warn] CloudBeaver sync failed: {e}")

    return {"success": True, "message": f"Database '{row['db_name']}' berhasil dihapus."}

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
                SET max_disk_mb = ?, max_memory_mb = ?, max_cpu_cores = ?,
                    max_processes = COALESCE(?, max_processes),
                    max_database_disk_mb = COALESCE(?, max_database_disk_mb),
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            """, (body.max_disk_mb, body.max_memory_mb, body.max_cpu_cores, body.max_processes, body.max_database_disk_mb, uid))
        else:
            await db.execute("""
                INSERT INTO quotas (user_id, max_disk_mb, max_memory_mb, max_cpu_cores, max_processes, max_projects, max_databases, max_database_disk_mb)
                VALUES (?, ?, ?, ?, COALESCE(?, 50), 2, 99, COALESCE(?, 100))
            """, (uid, body.max_disk_mb, body.max_memory_mb, body.max_cpu_cores, body.max_processes, body.max_database_disk_mb))

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
               COALESCE(q.max_disk_mb, CASE WHEN u.role = 'admin' THEN 20000 ELSE 10240 END) as max_disk_mb,
               COALESCE(q.max_memory_mb, CASE WHEN u.role = 'admin' THEN 1024 ELSE 512 END) as max_memory_mb,
               COALESCE(q.max_cpu_cores, CASE WHEN u.role = 'admin' THEN 2.0 ELSE 0.5 END) as max_cpu_cores,
               COALESCE(q.max_projects, CASE WHEN u.role = 'admin' THEN 99 ELSE 2 END) as max_projects,
               COALESCE(q.max_databases, CASE WHEN u.role = 'admin' THEN 99 ELSE 2 END) as max_databases,
               COALESCE(q.max_database_disk_mb, CASE WHEN u.role = 'admin' THEN 10000 ELSE 5120 END) as max_database_disk_mb
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
    users = []
    for r in rows:
        d = dict(r)
        if d.get("role") == "admin":
            d["is_unlimited"] = True
            d["max_disk_label"] = "Tanpa Batas"
        else:
            d["is_unlimited"] = False
            d["max_disk_label"] = f"{d.get('max_disk_mb', 10240)} MB"
        users.append(d)
    return users

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
    c_admins = await (await db.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")).fetchone()
    c_projects = await (await db.execute("SELECT COUNT(*) FROM projects")).fetchone()
    c_dbs = await (await db.execute("SELECT COUNT(*) FROM student_databases")).fetchone()

    return {
        "total_students": c_users[0],
        "total_admins": c_admins[0],
        "total_projects": c_projects[0],
        "total_databases": c_dbs[0]
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
        disk_path = settings.DATA_DIR if os.path.exists(settings.DATA_DIR) else "/"
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
            COALESCE(q.max_projects, CASE WHEN u.role = 'admin' THEN 99 ELSE 2 END) as max_projects,
            COALESCE(q.max_databases, CASE WHEN u.role = 'admin' THEN 99 ELSE 2 END) as max_databases,
            COALESCE(q.max_disk_mb, CASE WHEN u.role = 'admin' THEN 20000 ELSE 10240 END) as max_disk_mb,
            COALESCE(q.max_database_disk_mb, CASE WHEN u.role = 'admin' THEN 10000 ELSE 5120 END) as max_database_disk_mb,
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
        
        u_name = d.get("username", "")
        est_disk_mb, est_db_storage_mb = calculate_account_disk_usage(u_name, db_cnt)

        total_allocated_disk_mb += est_disk_mb
        d["estimated_disk_mb"] = est_disk_mb
        d["estimated_db_storage_mb"] = est_db_storage_mb
        d["max_database_disk_mb"] = d.get("max_database_disk_mb") or 5120
        d["projects_list"] = [x.strip() for x in (d.get("project_names") or "").split(",") if x.strip()]
        d["databases_list"] = [x.strip() for x in (d.get("db_names") or "").split(",") if x.strip()]
        if d.get("role") == "admin":
            d["is_unlimited"] = True
            d["max_disk_label"] = "Tanpa Batas"
        else:
            d["is_unlimited"] = False
            d["max_disk_label"] = f"{d.get('max_disk_mb', 10240)} MB"
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


def _read_proc_meminfo() -> Dict[str, float]:
    mem_total_kb = 0
    mem_avail_kb = 0
    try:
        with open("/proc/meminfo", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    mem_total_kb = int(line.split()[1])
                elif line.startswith("MemAvailable:"):
                    mem_avail_kb = int(line.split()[1])
    except Exception:
        pass
    total_mb = round(mem_total_kb / 1024.0, 1)
    avail_mb = round(mem_avail_kb / 1024.0, 1)
    used_mb = round(max(0.0, total_mb - avail_mb), 1)
    pct = round((used_mb / total_mb) * 100.0, 1) if total_mb > 0 else 0.0
    return {
        "total_mb": total_mb,
        "used_mb": used_mb,
        "available_mb": avail_mb,
        "percent": pct,
    }


def _read_proc_cpu_stat() -> tuple[int, int]:
    try:
        with open("/proc/stat", "r", encoding="utf-8") as f:
            first = f.readline().strip()
        parts = [int(x) for x in first.split()[1:]]
        idle = parts[3] + (parts[4] if len(parts) > 4 else 0)
        total = sum(parts)
        return idle, total
    except Exception:
        return 0, 0


def _read_cpu_model() -> str:
    try:
        with open("/proc/cpuinfo", "r", encoding="utf-8") as f:
            for line in f:
                if line.lower().startswith("model name"):
                    return line.split(":", 1)[1].strip()
    except Exception:
        pass
    return "x86_64 Processor"


def _detect_gpu_info() -> Dict[str, Any]:
    try:
        res = subprocess.run(["lspci"], capture_output=True, text=True, timeout=2)
        if res.returncode == 0:
            for line in res.stdout.splitlines():
                low = line.lower()
                if any(k in low for k in ("vga", "3d controller", "display controller")):
                    name = line.split(":", 2)[-1].strip()
                    dedicated = any(v in low for v in ("nvidia", "radeon", "amd"))
                    return {"name": name, "status": "Active", "has_dedicated_gpu": dedicated}
    except Exception:
        pass

    drm_dir = "/sys/class/drm"
    vendor_map = {
        "0x8086": "Intel Integrated / UHD Graphics",
        "0x102b": "Matrox Integrated Graphics",
        "0x10de": "NVIDIA GPU",
        "0x1002": "AMD Radeon GPU",
    }
    if os.path.isdir(drm_dir):
        try:
            for entry in sorted(os.listdir(drm_dir)):
                vpath = os.path.join(drm_dir, entry, "device", "vendor")
                if os.path.isfile(vpath):
                    vendor = open(vpath, "r", encoding="utf-8").read().strip().lower()
                    name = vendor_map.get(vendor, f"DRM Graphics ({vendor})")
                    return {
                        "name": name,
                        "status": "Integrated / Active",
                        "has_dedicated_gpu": vendor in ("0x10de", "0x1002"),
                    }
            if any(e.startswith("card") for e in os.listdir(drm_dir)):
                return {"name": "Virtual / Integrated Graphics (DRM)", "status": "Integrated", "has_dedicated_gpu": False}
        except Exception:
            pass
    return {"name": "No Dedicated GPU Detected", "status": "Headless", "has_dedicated_gpu": False}


def _collect_disk_partitions() -> List[Dict[str, Any]]:
    partitions = []
    seen_sigs = set()
    for mount in ["/", "/home", "/data"]:
        if not os.path.exists(mount):
            continue
        try:
            st = os.statvfs(mount)
            total_bytes = st.f_blocks * st.f_frsize
            free_bytes = st.f_bavail * st.f_frsize
            used_bytes = max(0, total_bytes - (st.f_bfree * st.f_frsize))
            sig = (total_bytes, st.f_frsize)
            if sig in seen_sigs or total_bytes == 0:
                continue
            seen_sigs.add(sig)
            partitions.append({
                "mount": mount,
                "total_gb": round(total_bytes / (1024 ** 3), 2),
                "used_gb": round(used_bytes / (1024 ** 3), 2),
                "free_gb": round(free_bytes / (1024 ** 3), 2),
                "percent": round((used_bytes / total_bytes) * 100.0, 1) if total_bytes > 0 else 0.0,
            })
        except Exception:
            continue
    return partitions


def _extract_container_owner(name: str, labels: Dict[str, Any], known_usernames: set[str]) -> Optional[str]:
    for key in ("miraigrid.user", "miraigrid.owner"):
        val = (labels or {}).get(key)
        if val and val in known_usernames:
            return val
    for prefix in ("app_", "miraigrid_"):
        if name.startswith(prefix):
            rest = name[len(prefix):]
            parts = rest.split("_")
            if parts and parts[0] in known_usernames:
                return parts[0]
            for uname in known_usernames:
                if rest.startswith(f"{uname}_") or rest == uname:
                    return uname
    for prefix in ("vscode_", "tb_", "n8n_"):
        if name.startswith(prefix):
            cand = name[len(prefix):]
            if cand in known_usernames:
                return cand
    return None


@router.get("/host-metrics")
async def get_host_metrics(admin: dict = Depends(require_admin)):
    """
    Returns live host/node CPU, RAM, disk partitions, GPU telemetry, and
    container memory overcommitment status for the Admin Infrastructure Dashboard.
    """
    idle1, total1 = _read_proc_cpu_stat()
    await asyncio.sleep(0.15)
    idle2, total2 = _read_proc_cpu_stat()
    total_delta = max(1, total2 - total1)
    idle_delta = max(0, idle2 - idle1)
    cpu_percent = round(max(0.0, min(100.0, (1.0 - (idle_delta / total_delta)) * 100.0)), 1)

    ram = _read_proc_meminfo()
    partitions = _collect_disk_partitions()
    gpu = _detect_gpu_info()
    cpu_model = _read_cpu_model()
    cpu_cores = os.cpu_count() or 1

    containers = portainer.list_containers_socket(all_containers=True)
    if containers is None:
        containers = await portainer.list_containers(all_containers=True)

    running_count = 0
    allocated_ram_bytes = 0
    sem = asyncio.Semaphore(10)

    async def _inspect_mem(c: Dict[str, Any]):
        nonlocal running_count, allocated_ram_bytes
        state = (c.get("State") or "").lower()
        if state == "running":
            running_count += 1
        cid = c.get("Id") or ""
        async with sem:
            info = await asyncio.to_thread(portainer.inspect_container_socket, cid)
        if info:
            mem = (info.get("HostConfig") or {}).get("Memory") or 0
            if state == "running" and mem > 0:
                allocated_ram_bytes += int(mem)

    await asyncio.gather(*[_inspect_mem(c) for c in containers])

    allocated_ram_mb = round(allocated_ram_bytes / (1024 * 1024), 1)
    total_ram_mb = ram["total_mb"]
    overcommitment_ratio = round((allocated_ram_mb / total_ram_mb) * 100.0, 1) if total_ram_mb > 0 else 0.0
    overcommitment_alert = total_ram_mb > 0 and allocated_ram_mb > total_ram_mb

    return {
        "ram": {
            **ram,
            "allocated_container_mb": allocated_ram_mb,
            "overcommitment_percent": overcommitment_ratio,
            "overcommitment_alert": overcommitment_alert,
        },
        "cpu": {
            "model": cpu_model,
            "cores": cpu_cores,
            "usage_percent": cpu_percent,
        },
        "disk": partitions,
        "gpu": gpu,
        "containers_summary": {
            "total": len(containers),
            "running": running_count,
            "stopped": max(0, len(containers) - running_count),
        },
    }


@router.get("/containers/tracking")
async def get_containers_tracking(
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Returns real-time Docker fleet tracking with owner role mapping, RAM/Disk/CPU
    utilization, alert row flags (RAM > 85% or Disk > 90%), and DB vs Docker quota drift.
    """
    cursor = await db.execute("""
        SELECT u.id, u.username, u.name, u.role,
               COALESCE(q.max_memory_mb, CASE WHEN u.role = 'dosen' THEN 1024 WHEN u.role = 'admin' THEN 1024 ELSE 512 END) as max_memory_mb,
               COALESCE(q.max_cpu_cores, CASE WHEN u.role = 'dosen' THEN 1.5 WHEN u.role = 'admin' THEN 2.0 ELSE 0.5 END) as max_cpu_cores,
               COALESCE(q.max_disk_mb, CASE WHEN u.role = 'dosen' THEN 20480 WHEN u.role = 'admin' THEN 20000 ELSE 10240 END) as max_disk_mb
        FROM users u
        LEFT JOIN quotas q ON q.user_id = u.id
    """)
    user_rows = await cursor.fetchall()
    users_map: Dict[str, Dict[str, Any]] = {r["username"]: dict(r) for r in user_rows}
    known_usernames = set(users_map.keys())

    containers = portainer.list_containers_socket(all_containers=True)
    if containers is None:
        containers = await portainer.list_containers(all_containers=True)

    disk_cache: Dict[str, float] = {}
    for uname in known_usernames:
        # Pre-compute only if referenced later, or lazily cache below
        pass

    def _get_user_disk_mb(uname: str) -> float:
        if uname not in disk_cache:
            used_mb, _ = calculate_account_disk_usage(uname, 0)
            disk_cache[uname] = used_mb
        return disk_cache[uname]

    def _get_project_dir_mb(uname: str, project_slug: str) -> float:
        total_bytes = 0
        for candidate in (
            os.path.join("/app/data/home", uname, project_slug),
            os.path.join("/app/data/projects", f"{uname}_{project_slug}"),
        ):
            if os.path.isdir(candidate):
                try:
                    for root, _, files in os.walk(candidate):
                        for f in files:
                            try:
                                total_bytes += os.path.getsize(os.path.join(root, f))
                            except OSError:
                                pass
                except Exception:
                    pass
                break
        return round(total_bytes / (1024 * 1024), 1)

    host_partitions = _collect_disk_partitions()
    host_disk_mb = round(host_partitions[0]["total_gb"] * 1024, 1) if host_partitions else 116000.0

    sem = asyncio.Semaphore(10)

    async def _collect_one(c: Dict[str, Any]) -> Dict[str, Any]:
        names = [n.lstrip("/") for n in (c.get("Names") or [])]
        cname = names[0] if names else (c.get("Id") or "")[:12]
        cid = c.get("Id") or cname
        state = (c.get("State") or "unknown").lower()
        status_text = c.get("Status") or state
        image = c.get("Image") or ""
        labels = c.get("Labels") or {}

        owner_username = _extract_container_owner(cname, labels, known_usernames)
        owner_info = users_map.get(owner_username) if owner_username else None

        if owner_info:
            raw_role = (owner_info.get("role") or "student").lower()
            role_label = "Dosen" if raw_role == "dosen" else ("Admin" if raw_role == "admin" else "Mahasiswa")
            owner_name = owner_info.get("name") or owner_username
        else:
            raw_role = "system"
            role_label = "Sistem"
            owner_name = "Core Infrastructure"

        async with sem:
            inspect_data = await asyncio.to_thread(portainer.inspect_container_socket, cid)
            stats_data = await asyncio.to_thread(portainer.get_container_stats_socket, cid) if state == "running" else None

        host_cfg = (inspect_data or {}).get("HostConfig") or {}
        mem_limit_bytes = host_cfg.get("Memory") or 0
        nano_cpus = host_cfg.get("NanoCpus") or 0

        ram_limit_mb = round(mem_limit_bytes / (1024 * 1024), 1) if mem_limit_bytes > 0 else None
        cpu_quota_cores = round(nano_cpus / 1e9, 2) if nano_cpus > 0 else None

        ram_used_mb = 0.0
        cpu_pct = 0.0
        if stats_data:
            mem_stats = stats_data.get("memory_stats") or {}
            raw_usage = mem_stats.get("usage") or 0
            st_detail = mem_stats.get("stats") or {}
            cache = st_detail.get("inactive_file") or st_detail.get("cache") or 0
            ram_used_mb = round(max(0.0, (raw_usage - cache) / (1024 * 1024)), 1)
            if ram_limit_mb is None and (mem_stats.get("limit") or 0) > 0:
                # Only use stats limit if container actually has a cgroup cap smaller than host
                pass

            cpu_stats = stats_data.get("cpu_stats") or {}
            precpu_stats = stats_data.get("precpu_stats") or {}
            cpu_delta = (cpu_stats.get("cpu_usage") or {}).get("total_usage", 0) - (precpu_stats.get("cpu_usage") or {}).get("total_usage", 0)
            sys_delta = (cpu_stats.get("system_cpu_usage") or 0) - (precpu_stats.get("system_cpu_usage") or 0)
            online_cpus = cpu_stats.get("online_cpus") or len((cpu_stats.get("cpu_usage") or {}).get("percpu_usage") or []) or 1
            if sys_delta > 0 and cpu_delta > 0:
                cpu_pct = round((cpu_delta / sys_delta) * online_cpus * 100.0, 1)

        ram_pct = round((ram_used_mb / ram_limit_mb) * 100.0, 1) if (ram_limit_mb and ram_limit_mb > 0) else None

        disk_used_mb = None
        account_disk_used_mb = None
        disk_limit_mb = None
        disk_pct = None
        is_pool_storage = False
        is_uncapped_disk = False
        if owner_username and owner_info:
            account_disk_used_mb = await asyncio.to_thread(_get_user_disk_mb, owner_username)
            if cname.startswith(f"app_{owner_username}_"):
                project_slug = cname[len(f"app_{owner_username}_"):]
                disk_used_mb = await asyncio.to_thread(_get_project_dir_mb, owner_username, project_slug)
                is_pool_storage = True
            else:
                disk_used_mb = account_disk_used_mb

            if raw_role == "admin":
                disk_limit_mb = host_disk_mb
                is_uncapped_disk = True
            else:
                disk_limit_mb = float(owner_info.get("max_disk_mb") or (20480 if raw_role == "dosen" else 10240))
            disk_pct = round((account_disk_used_mb / disk_limit_mb) * 100.0, 1) if disk_limit_mb > 0 else None

        is_high_ram = ram_pct is not None and ram_pct > 85.0
        is_high_disk = disk_pct is not None and disk_pct > 90.0
        is_alert = is_high_ram or is_high_disk

        if state != "running":
            health_status = "Exited"
        elif is_high_ram:
            health_status = "High Memory"
        elif is_high_disk:
            health_status = "High Disk"
        else:
            health_status = "Running"

        # DB vs Docker drift check (applies to user app containers)
        db_mem = float(owner_info["max_memory_mb"]) if owner_info else None
        db_cpu = float(owner_info["max_cpu_cores"]) if owner_info else None
        is_user_app = owner_info is not None and (cname.startswith("app_") or cname.startswith("miraigrid_"))
        has_drift = False
        if is_user_app and db_mem is not None and db_cpu is not None:
            mem_mismatch = ram_limit_mb is None or abs(ram_limit_mb - db_mem) > 2.0
            cpu_mismatch = cpu_quota_cores is None or abs(cpu_quota_cores - db_cpu) > 0.05
            has_drift = mem_mismatch or cpu_mismatch

        return {
            "id": cid[:12],
            "name": cname,
            "image": image,
            "state": state,
            "status_text": status_text,
            "health_status": health_status,
            "owner_username": owner_username,
            "owner_name": owner_name,
            "role": raw_role,
            "role_label": role_label,
            "ram_used_mb": ram_used_mb,
            "ram_limit_mb": ram_limit_mb,
            "ram_pct": ram_pct,
            "cpu_pct": cpu_pct,
            "cpu_quota_cores": cpu_quota_cores,
            "disk_used_mb": disk_used_mb,
            "account_disk_used_mb": account_disk_used_mb,
            "disk_limit_mb": disk_limit_mb,
            "disk_pct": disk_pct,
            "is_pool_storage": is_pool_storage,
            "is_uncapped_disk": is_uncapped_disk,
            "is_alert": is_alert,
            "db_quota_memory_mb": db_mem,
            "db_quota_cpu_cores": db_cpu,
            "has_drift": has_drift,
        }

    items = await asyncio.gather(*[_collect_one(c) for c in containers])
    items.sort(key=lambda x: (not x["is_alert"], x["role"] == "system", x["name"]))
    return {"containers": items, "total": len(items)}


@router.post("/containers/{container_name}/sync-limit")
async def sync_container_limit(
    container_name: str,
    request: Request,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Reconciles a user container's Docker cgroup RAM and CPU limits with the database quota.
    """
    cursor = await db.execute("""
        SELECT u.id, u.username, u.role,
               COALESCE(q.max_memory_mb, CASE WHEN u.role = 'dosen' THEN 1024 WHEN u.role = 'admin' THEN 1024 ELSE 512 END) as max_memory_mb,
               COALESCE(q.max_cpu_cores, CASE WHEN u.role = 'dosen' THEN 1.5 WHEN u.role = 'admin' THEN 2.0 ELSE 0.5 END) as max_cpu_cores
        FROM users u
        LEFT JOIN quotas q ON q.user_id = u.id
    """)
    user_rows = await cursor.fetchall()
    users_map = {r["username"]: dict(r) for r in user_rows}

    inspect_data = await asyncio.to_thread(portainer.inspect_container_socket, container_name)
    if not inspect_data:
        raise HTTPException(status_code=404, detail=f"Container '{container_name}' tidak ditemukan.")

    labels = (inspect_data.get("Config") or {}).get("Labels") or {}
    owner_username = _extract_container_owner(container_name, labels, set(users_map.keys()))
    if not owner_username or owner_username not in users_map:
        raise HTTPException(status_code=400, detail="Container ini bukan container proyek pengguna atau pemilik tidak ditemukan di DB.")

    target_user = users_map[owner_username]
    max_mem_mb = int(target_user["max_memory_mb"])
    max_cpu_cores = float(target_user["max_cpu_cores"])

    ok = await portainer.update_container_resources(
        container_name=container_name,
        mem_limit_mb=max_mem_mb,
        cpu_cores=max_cpu_cores
    )
    if not ok:
        raise HTTPException(status_code=500, detail=f"Gagal menyinkronkan limit Docker untuk '{container_name}'.")

    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'SYNC_CONTAINER_LIMIT', ?, ?, ?)
    """, (admin["id"], container_name, ip, f"Synced {container_name} to RAM={max_mem_mb}MB, CPU={max_cpu_cores} cores"))
    await db.commit()

    return {
        "success": True,
        "message": f"Limit '{container_name}' berhasil disinkronkan ({max_mem_mb} MB RAM, {max_cpu_cores} Cores).",
        "max_memory_mb": max_mem_mb,
        "max_cpu_cores": max_cpu_cores,
    }


def _extract_host_port(inspect_data: Optional[Dict[str, Any]]) -> Optional[int]:
    if not inspect_data:
        return None
    port_bindings = (inspect_data.get("HostConfig") or {}).get("PortBindings") or {}
    for _, bindings in port_bindings.items():
        if isinstance(bindings, list) and bindings:
            hp = bindings[0].get("HostPort")
            if hp and str(hp).isdigit():
                return int(hp)
    return None


def _get_du_sm_mb(username: str) -> float:
    home_dir = os.path.join("/app/data/home", username)
    if os.path.isdir(home_dir):
        try:
            res = subprocess.run(["du", "-sm", home_dir], capture_output=True, text=True, timeout=8)
            if res.returncode == 0 and res.stdout.strip():
                val = res.stdout.strip().split()[0]
                if val.isdigit():
                    return float(int(val))
        except Exception:
            pass
    used_mb, _ = calculate_account_disk_usage(username, 0)
    return used_mb


async def _build_fleet_summary(db: aiosqlite.Connection) -> List[Dict[str, Any]]:
    cursor = await db.execute("""
        SELECT u.id, u.username, u.name, u.role,
               COALESCE(q.max_memory_mb, CASE WHEN u.role = 'dosen' THEN 1024 WHEN u.role = 'admin' THEN 1024 ELSE 512 END) as max_memory_mb,
               COALESCE(q.max_cpu_cores, CASE WHEN u.role = 'dosen' THEN 1.5 WHEN u.role = 'admin' THEN 2.0 ELSE 0.5 END) as max_cpu_cores,
               COALESCE(q.max_disk_mb, CASE WHEN u.role = 'dosen' THEN 20480 WHEN u.role = 'admin' THEN 116000 ELSE 10240 END) as max_disk_mb
        FROM users u
        LEFT JOIN quotas q ON q.user_id = u.id
    """)
    user_rows = await cursor.fetchall()
    users_map: Dict[str, Dict[str, Any]] = {r["username"]: dict(r) for r in user_rows}
    known_usernames = set(users_map.keys())

    containers = portainer.list_containers_socket(all_containers=True)
    if containers is None:
        containers = await portainer.list_containers(all_containers=True)

    host_partitions = _collect_disk_partitions()
    host_disk_mb = round(host_partitions[0]["total_gb"] * 1024, 1) if host_partitions else 116000.0
    sem = asyncio.Semaphore(10)

    async def _inspect_one(c: Dict[str, Any]) -> Dict[str, Any]:
        names = [n.lstrip("/") for n in (c.get("Names") or [])]
        cname = names[0] if names else (c.get("Id") or "")[:12]
        cid = c.get("Id") or cname
        state = (c.get("State") or "unknown").lower()
        image = c.get("Image") or ""
        labels = c.get("Labels") or {}

        owner_username = _extract_container_owner(cname, labels, known_usernames)
        async with sem:
            inspect_data = await asyncio.to_thread(portainer.inspect_container_socket, cid)
            stats_data = await asyncio.to_thread(portainer.get_container_stats_socket, cid) if state == "running" else None

        host_cfg = (inspect_data or {}).get("HostConfig") or {}
        mem_limit_bytes = host_cfg.get("Memory") or 0
        nano_cpus = host_cfg.get("NanoCpus") or 0
        ram_limit_mb = round(mem_limit_bytes / (1024 * 1024), 1) if mem_limit_bytes > 0 else None
        cpu_quota_cores = round(nano_cpus / 1e9, 2) if nano_cpus > 0 else None
        internal_port = _extract_host_port(inspect_data)

        ram_used_mb = 0.0
        cpu_pct = 0.0
        if stats_data:
            mem_stats = stats_data.get("memory_stats") or {}
            raw_usage = mem_stats.get("usage") or 0
            st_detail = mem_stats.get("stats") or {}
            cache = st_detail.get("inactive_file") or st_detail.get("cache") or 0
            ram_used_mb = round(max(0.0, (raw_usage - cache) / (1024 * 1024)), 1)

            cpu_stats = stats_data.get("cpu_stats") or {}
            precpu_stats = stats_data.get("precpu_stats") or {}
            cpu_delta = (cpu_stats.get("cpu_usage") or {}).get("total_usage", 0) - (precpu_stats.get("cpu_usage") or {}).get("total_usage", 0)
            sys_delta = (cpu_stats.get("system_cpu_usage") or 0) - (precpu_stats.get("system_cpu_usage") or 0)
            online_cpus = cpu_stats.get("online_cpus") or len((cpu_stats.get("cpu_usage") or {}).get("percpu_usage") or []) or 1
            if sys_delta > 0 and cpu_delta > 0:
                cpu_pct = round((cpu_delta / sys_delta) * online_cpus * 100.0, 1)

        project_slug = None
        if owner_username and cname.startswith(f"app_{owner_username}_"):
            project_slug = cname[len(f"app_{owner_username}_"):]

        return {
            "id": cid[:12],
            "name": cname,
            "project_slug": project_slug,
            "image": image,
            "port": internal_port,
            "state": state,
            "health_status": "Running" if state == "running" else "Exited",
            "owner_username": owner_username,
            "ram_used_mb": ram_used_mb,
            "ram_limit_mb": ram_limit_mb,
            "cpu_pct": cpu_pct,
            "cpu_quota_cores": cpu_quota_cores,
        }

    inspected = await asyncio.gather(*[_inspect_one(c) for c in containers])

    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for item in inspected:
        key = item["owner_username"] or "__system__"
        grouped.setdefault(key, []).append(item)

    accounts: List[Dict[str, Any]] = []
    for key, c_list in grouped.items():
        c_list.sort(key=lambda x: x["name"])
        total_ram_used_mb = round(sum(c["ram_used_mb"] for c in c_list if c["state"] == "running"), 1)
        running_count = sum(1 for c in c_list if c["state"] == "running")

        if key == "__system__":
            accounts.append({
                "username": "system",
                "name": "Core Infrastructure",
                "role": "system",
                "role_label": "Sistem",
                "container_count": len(c_list),
                "running_count": running_count,
                "total_ram_used_mb": total_ram_used_mb,
                "ram_limit_mb": None,
                "ram_pct": None,
                "disk_used_mb": None,
                "disk_limit_mb": None,
                "disk_pct": None,
                "is_uncapped_disk": True,
                "is_high_ram": False,
                "is_high_disk": False,
                "is_alert": False,
                "health_status": "Normal" if running_count > 0 else "Stopped",
                "containers": c_list,
            })
            continue

        u_info = users_map[key]
        raw_role = (u_info.get("role") or "student").lower()
        role_label = "Dosen" if raw_role == "dosen" else ("Admin" if raw_role == "admin" else "Mahasiswa")
        ram_limit_mb = float(u_info.get("max_memory_mb") or (1024 if raw_role in ("dosen", "admin") else 512))
        ram_pct = round((total_ram_used_mb / ram_limit_mb) * 100.0, 1) if ram_limit_mb > 0 else 0.0

        disk_used_mb = await asyncio.to_thread(_get_du_sm_mb, key)
        is_uncapped_disk = (raw_role == "admin")
        disk_limit_mb = host_disk_mb if is_uncapped_disk else float(u_info.get("max_disk_mb") or (20480 if raw_role == "dosen" else 10240))
        disk_pct = round((disk_used_mb / disk_limit_mb) * 100.0, 1) if disk_limit_mb > 0 else 0.0

        is_high_ram = ram_pct >= 85.0
        is_high_disk = disk_pct >= 90.0
        is_alert = is_high_ram or is_high_disk

        if is_high_ram:
            health_status = "High Memory"
        elif is_high_disk:
            health_status = "High Disk"
        elif running_count == 0:
            health_status = "Stopped"
        else:
            health_status = "Normal"

        accounts.append({
            "username": key,
            "name": u_info.get("name") or key,
            "role": raw_role,
            "role_label": role_label,
            "container_count": len(c_list),
            "running_count": running_count,
            "total_ram_used_mb": total_ram_used_mb,
            "ram_limit_mb": ram_limit_mb,
            "ram_pct": ram_pct,
            "disk_used_mb": disk_used_mb,
            "disk_limit_mb": disk_limit_mb,
            "disk_pct": disk_pct,
            "is_uncapped_disk": is_uncapped_disk,
            "is_high_ram": is_high_ram,
            "is_high_disk": is_high_disk,
            "is_alert": is_alert,
            "health_status": health_status,
            "containers": c_list,
        })

    accounts.sort(key=lambda x: (not x["is_alert"], x["role"] == "system", x["username"]))
    return accounts


@router.get("/fleet/summary")
async def get_fleet_summary(
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Aggregates Docker fleet metrics per user account (1 row per user) with live RAM sum and du -sm disk pool.
    """
    accounts = await _build_fleet_summary(db)
    return {"accounts": accounts, "total": len(accounts)}


@router.get("/fleet/users/{username}/containers")
async def get_user_fleet_containers(
    username: str,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    accounts = await _build_fleet_summary(db)
    target = next((a for a in accounts if a["username"].lower() == username.strip().lower()), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Data kontainer untuk akun '{username}' tidak ditemukan.")
    return {"account": target}


@router.post("/containers/{container_name}/restart")
async def admin_restart_container(
    container_name: str,
    request: Request,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    status_code, text = await asyncio.to_thread(
        portainer._docker_socket_request, "POST", f"/containers/{container_name}/restart?t=5"
    )
    if status_code not in (204, 304):
        raise HTTPException(status_code=500, detail=f"Gagal me-restart container '{container_name}': {text}")
    ip = get_client_ip(request)
    await db.execute(
        "INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details) VALUES (?, 'ADMIN_RESTART_CONTAINER', ?, ?, ?)",
        (admin["id"], container_name, ip, f"Admin restarted container {container_name}"),
    )
    await db.commit()
    return {"success": True, "message": f"Container '{container_name}' berhasil di-restart."}


@router.post("/containers/{container_name}/stop")
async def admin_stop_container(
    container_name: str,
    request: Request,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    if container_name in ("miraigrid_backend", "miraigrid_frontend"):
        raise HTTPException(status_code=400, detail="Container inti platform tidak dapat dihentikan dari panel ini.")
    status_code, text = await asyncio.to_thread(
        portainer._docker_socket_request, "POST", f"/containers/{container_name}/stop?t=5"
    )
    if status_code not in (204, 304):
        raise HTTPException(status_code=500, detail=f"Gagal menghentikan container '{container_name}': {text}")
    ip = get_client_ip(request)
    await db.execute(
        "INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details) VALUES (?, 'ADMIN_STOP_CONTAINER', ?, ?, ?)",
        (admin["id"], container_name, ip, f"Admin stopped container {container_name}"),
    )
    await db.commit()
    return {"success": True, "message": f"Container '{container_name}' berhasil dihentikan."}


@router.get("/containers/{container_name}/logs")
async def admin_container_logs(
    container_name: str,
    tail: int = 120,
    admin: dict = Depends(require_admin),
):
    safe_tail = max(10, min(500, tail))
    status_code, raw_logs = await asyncio.to_thread(
        portainer._docker_socket_request,
        "GET",
        f"/containers/{container_name}/logs?stdout=1&stderr=1&tail={safe_tail}",
    )
    if status_code == 404:
        raise HTTPException(status_code=404, detail=f"Container '{container_name}' tidak ditemukan.")
    # Strip Docker multiplexed stream 8-byte header characters if present
    cleaned_lines = []
    for line in (raw_logs or "").splitlines():
        cleaned_lines.append("".join(ch for ch in line if ch == "\t" or ord(ch) >= 32))
    return {"container_name": container_name, "logs": "\n".join(cleaned_lines)}

