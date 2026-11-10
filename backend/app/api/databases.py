import hmac
import hashlib
import time
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Request
import aiosqlite
from app.core.database import get_db
from app.core.security import encrypt_secret, decrypt_secret
from app.models.schemas import (
    StudentDatabaseCreate, StudentDatabaseResponse,
    ExternalDatabaseCreate, ExternalDatabaseResponse
)
from app.services.db_provisioner import DatabaseProvisioner, sanitize_identifier
from app.api.deps import get_current_user, get_client_ip

router = APIRouter(prefix="/databases", tags=["Databases"])

@router.get("/my-databases", response_model=List[StudentDatabaseResponse])
async def list_my_databases(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("""
        SELECT * FROM student_databases
        WHERE user_id = ?
        ORDER BY created_at DESC
    """, (current_user["id"],))
    rows = await cursor.fetchall()
    results = []
    for r in rows:
        decrypted_pass = decrypt_secret(r["db_password_enc"])
        uri_scheme = "postgresql" if r["engine"] == "postgres" else "mysql"
        results.append({
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
    return results

@router.post("/create", response_model=StudentDatabaseResponse)
async def create_database(
    body: StudentDatabaseCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    # 1. Quota check
    cursor = await db.execute("SELECT max_databases FROM quotas WHERE user_id = ?", (current_user["id"],))
    quota_row = await cursor.fetchone()
    max_dbs = quota_row["max_databases"] if quota_row else 2

    c_cur = await db.execute("SELECT COUNT(*) FROM student_databases WHERE user_id = ?", (current_user["id"],))
    used_dbs = (await c_cur.fetchone())[0]

    if used_dbs >= max_dbs:
        raise HTTPException(status_code=400, detail=f"Batas kuota database tercapai (Maksimal: {max_dbs} database).")

    nim = current_user["username"]
    try:
        if body.engine == "postgres":
            prov = await DatabaseProvisioner.create_postgres_db(nim, body.db_name)
        elif body.engine == "mariadb":
            prov = await DatabaseProvisioner.create_mariadb_db(nim, body.db_name)
        else:
            raise HTTPException(status_code=400, detail="Database engine tidak didukung.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal membuat database di engine: {str(e)}")

    encrypted_pass = encrypt_secret(prov["db_password"])
    cursor = await db.execute("""
        INSERT INTO student_databases (user_id, engine, db_name, db_username, db_password_enc, host, port)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        current_user["id"],
        prov["engine"],
        prov["db_name"],
        prov["db_username"],
        encrypted_pass,
        prov["host"],
        prov["port"]
    ))
    db_id = cursor.lastrowid

    # Audit log
    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'CREATE_DB', ?, ?, ?)
    """, (current_user["id"], prov["db_name"], ip, f"Created {body.engine} database"))
    await db.commit()

    return {
        "id": db_id,
        "engine": prov["engine"],
        "db_name": prov["db_name"],
        "db_username": prov["db_username"],
        "db_password": prov["db_password"],
        "host": prov["host"],
        "port": prov["port"],
        "connection_uri": prov["connection_uri"],
        "created_at": "Just now"
    }

@router.delete("/{db_id}")
async def delete_database(
    db_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM student_databases WHERE id = ? AND user_id = ?", (db_id, current_user["id"]))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Database tidak ditemukan.")

    nim = current_user["username"]
    # Drop database from engine
    raw_name = row["db_name"].replace(f"s{nim}_", "", 1)
    try:
        if row["engine"] == "postgres":
            await DatabaseProvisioner.delete_postgres_db(nim, raw_name)
        elif row["engine"] == "mariadb":
            await DatabaseProvisioner.delete_mariadb_db(nim, raw_name)
    except Exception as e:
        print(f"[Warn] Drop DB engine error: {e}")

    await db.execute("DELETE FROM student_databases WHERE id = ?", (db_id,))
    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'DELETE_DB', ?, ?, 'Database deleted')
    """, (current_user["id"], row["db_name"], ip))
    await db.commit()

    return {"success": True, "message": "Database berhasil dihapus."}

# External Database Connections
@router.get("/external", response_model=List[ExternalDatabaseResponse])
async def list_external_databases(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT id, alias_name, engine, host, port, db_name, username, created_at FROM external_databases WHERE user_id = ?", (current_user["id"],))
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]

@router.post("/external", response_model=ExternalDatabaseResponse)
async def add_external_database(
    body: ExternalDatabaseCreate,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    encrypted_pass = encrypt_secret(body.password)
    cursor = await db.execute("""
        INSERT INTO external_databases (user_id, alias_name, engine, host, port, db_name, username, password_enc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (current_user["id"], body.alias_name, body.engine, body.host, body.port, body.db_name, body.username, encrypted_pass))
    await db.commit()
    return {
        "id": cursor.lastrowid,
        "alias_name": body.alias_name,
        "engine": body.engine,
        "host": body.host,
        "port": body.port,
        "db_name": body.db_name,
        "username": body.username,
        "created_at": "Just now"
    }

@router.delete("/external/{ext_id}")
async def delete_external_database(
    ext_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    await db.execute("DELETE FROM external_databases WHERE id = ? AND user_id = ?", (ext_id, current_user["id"]))
    await db.commit()
    return {"success": True, "message": "Koneksi database eksternal dihapus."}

# Single Sign-On (Auto-Login) Launch for phpMyAdmin (8080) & phpPgAdmin (8088)
SSO_SHARED_SECRET = "MiraiGrid-LabTI-SuperSecretKey-2026"

class SSOLaunchRequest(BaseModel):
    engine: str = "postgres"
    db_id: Optional[int] = None

@router.post("/sso-launch")
async def sso_launch_database(
    body: SSOLaunchRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    engine_norm = "mariadb" if ("maria" in body.engine.lower() or "mysql" in body.engine.lower()) else "postgres"
    
    row = None
    if body.db_id:
        cursor = await db.execute(
            "SELECT * FROM student_databases WHERE id = ? AND user_id = ?",
            (body.db_id, current_user["id"])
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Database tidak ditemukan atau bukan milik akun Anda.")
    else:
        cursor = await db.execute(
            "SELECT * FROM student_databases WHERE user_id = ? AND engine = ? ORDER BY id ASC LIMIT 1",
            (current_user["id"], engine_norm)
        )
        row = await cursor.fetchone()
        if not row:
            # Auto-provision a default isolated database for this student
            nim = current_user["username"]
            raw_db_name = "db"
            try:
                if engine_norm == "mariadb":
                    prov = await DatabaseProvisioner.create_mariadb_db(nim, raw_db_name)
                else:
                    prov = await DatabaseProvisioner.create_postgres_db(nim, raw_db_name)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Gagal membuat database otomatis: {str(e)}")

            encrypted_pass = encrypt_secret(prov["db_password"])
            cursor = await db.execute("""
                INSERT INTO student_databases (user_id, engine, db_name, db_username, db_password_enc, host, port)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (current_user["id"], prov["engine"], prov["db_name"], prov["db_username"], encrypted_pass, prov["host"], prov["port"]))
            await db.commit()
            
            cursor = await db.execute("SELECT * FROM student_databases WHERE id = ?", (cursor.lastrowid,))
            row = await cursor.fetchone()

    # Strict multi-tenant authorization check
    if row["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Akses ditolak: Anda tidak memiliki akses ke database ini.")

    decrypted_pass = decrypt_secret(row["db_password_enc"])
    db_user = row["db_username"]
    timestamp = int(time.time())

    # Generate HMAC SHA256 Signature (valid for 120s)
    msg = f"{db_user}:{timestamp}".encode("utf-8")
    token = hmac.new(SSO_SHARED_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    is_maria = ("maria" in row["engine"] or "mysql" in row["engine"])
    port = 8080 if is_maria else 8088

    return {
        "success": True,
        "engine": row["engine"],
        "db_name": row["db_name"],
        "db_username": db_user,
        "port": port,
        "path": "/signon.php",
        "fields": {
            "user": db_user,
            "password": decrypted_pass,
            "time": timestamp,
            "token": token
        }
    }
