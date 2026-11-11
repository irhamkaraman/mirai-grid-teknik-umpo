from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
import aiosqlite
from app.core.database import get_db
from app.api.deps import get_current_user, get_client_ip
from app.services.redis_manager import UserRedisManager

router = APIRouter(prefix="/redis", tags=["Redis Manager"])

class RedisStartConfig(BaseModel):
    max_memory_mb: Optional[int] = Field(default=None, ge=4, le=1024)
    eviction_policy: Optional[str] = Field(default="allkeys-lru")

class RedisKeyOp(BaseModel):
    action: str = Field(description="'ping', 'set', 'get', 'del', 'list'")
    key: Optional[str] = ""
    value: Optional[str] = ""
    ttl: Optional[int] = 0

class RedisFillTest(BaseModel):
    target_kb: int = Field(default=5000, ge=100, le=50000)

@router.get("/status")
async def get_redis_status(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        return await UserRedisManager.get_status(db, current_user["id"], current_user["username"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memeriksa status Redis: {str(e)}")

@router.post("/start")
async def start_redis(
    request: Request,
    body: Optional[RedisStartConfig] = None,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    if body is None:
        body = RedisStartConfig()
    try:
        status = await UserRedisManager.start(
            db, 
            current_user["id"], 
            current_user["username"], 
            body.max_memory_mb, 
            body.eviction_policy
        )
        
        # Audit log
        ip = get_client_ip(request)
        await db.execute("""
            INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
            VALUES (?, 'START_REDIS', ?, ?, ?)
        """, (current_user["id"], f"redis:{current_user['username']}", ip, f"Started Redis instance (mem: {status['max_memory_mb']}MB, policy: {status['eviction_policy']})"))
        await db.commit()

        return {"success": True, "message": "Redis instance berhasil diaktifkan.", "data": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop")
async def stop_redis(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        status = await UserRedisManager.stop(db, current_user["id"], current_user["username"])
        
        ip = get_client_ip(request)
        await db.execute("""
            INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
            VALUES (?, 'STOP_REDIS', ?, ?, ?)
        """, (current_user["id"], f"redis:{current_user['username']}", ip, "Stopped Redis instance"))
        await db.commit()

        return {"success": True, "message": "Redis instance berhasil dinonaktifkan.", "data": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restart")
async def restart_redis(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        status = await UserRedisManager.restart(db, current_user["id"], current_user["username"])
        return {"success": True, "message": "Redis instance berhasil dimuat ulang (restarted).", "data": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/flush")
async def flush_redis(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        res = await UserRedisManager.flush(current_user["id"], current_user["username"], db)
        
        ip = get_client_ip(request)
        await db.execute("""
            INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
            VALUES (?, 'FLUSH_REDIS', ?, ?, ?)
        """, (current_user["id"], f"redis:{current_user['username']}", ip, "Flushed all Redis keys"))
        await db.commit()

        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/config")
async def update_redis_config(
    body: RedisStartConfig,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        # Check running state
        is_running = UserRedisManager.is_process_running(current_user["username"])
        if is_running:
            # Restart with new configuration
            status = await UserRedisManager.start(
                db, 
                current_user["id"], 
                current_user["username"], 
                body.max_memory_mb, 
                body.eviction_policy
            )
        else:
            # Just update DB
            mem_mb = body.max_memory_mb or 32
            evict = body.eviction_policy or "allkeys-lru"
            await db.execute("""
                UPDATE user_redis_instances 
                SET max_memory_mb = ?, eviction_policy = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            """, (mem_mb, evict, current_user["id"]))
            await db.commit()
            status = await UserRedisManager.get_status(db, current_user["id"], current_user["username"])

        return {"success": True, "message": "Konfigurasi Redis berhasil diperbarui.", "data": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/key-op")
async def redis_key_operation(
    body: RedisKeyOp,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        return await UserRedisManager.test_key(
            current_user["id"], 
            current_user["username"], 
            body.action, 
            body.key or "", 
            body.value or "", 
            body.ttl or 0, 
            db
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/fill-test")
async def redis_fill_test(
    body: RedisFillTest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        return await UserRedisManager.fill_memory_test(
            current_user["id"], 
            current_user["username"], 
            body.target_kb, 
            db
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/all")
async def list_all_redis_instances(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Hanya Administrator yang memiliki akses.")
    
    cursor = await db.execute("""
        SELECT r.*, u.username, u.name as user_name, u.role
        FROM user_redis_instances r
        JOIN users u ON r.user_id = u.id
        ORDER BY r.id ASC
    """)
    rows = await cursor.fetchall()
    
    results = []
    for row in rows:
        running = UserRedisManager.is_process_running(row["username"])
        results.append({
            "id": row["id"],
            "user_id": row["user_id"],
            "username": row["username"],
            "user_name": row["user_name"],
            "role": row["role"],
            "is_running": running,
            "port": row["port"],
            "socket_path": UserRedisManager.get_virtual_socket_path(row["username"]),
            "max_memory_mb": row["max_memory_mb"],
            "eviction_policy": row["eviction_policy"],
            "updated_at": row["updated_at"]
        })
    return results
