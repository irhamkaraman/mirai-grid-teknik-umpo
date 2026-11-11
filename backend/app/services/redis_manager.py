import os
import re
import time
import secrets
import subprocess
import aiosqlite
import redis
from typing import Dict, Any, Optional, List
from app.core.config import settings

def sanitize_username(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "", name)

class UserRedisManager:
    """
    Manages isolated per-user Redis instances with dedicated Unix domain sockets,
    loopback TCP ports, authentication tokens, and strict quota/memory caps.
    
    100% Zero-Leak Multi-Tenant Architecture:
    - Each user has their own private runtime folder: DATA_DIR/home/<username>/.redis/
    - Isolated Unix domain socket: /home/<username>/.redis/redis.sock (mode 770)
    - Independent TCP loopback port: 13000 + user_id
    - Strong randomized requirepass token
    - OS file permissions forbid cross-student access to peer home directories
    """

    @staticmethod
    def get_user_redis_dir(username: str) -> str:
        clean_user = sanitize_username(username)
        # Physical path inside backend filesystem
        base_dir = os.path.realpath(os.path.join(settings.DATA_DIR, "home", clean_user, ".redis"))
        os.makedirs(base_dir, exist_ok=True)
        os.makedirs(os.path.join(base_dir, "db"), exist_ok=True)
        return base_dir

    @staticmethod
    def get_socket_path(username: str) -> str:
        rdir = UserRedisManager.get_user_redis_dir(username)
        return os.path.join(rdir, "redis.sock")

    @staticmethod
    def get_virtual_socket_path(username: str) -> str:
        clean_user = sanitize_username(username)
        return f"/home/{clean_user}/.redis/redis.sock"

    @staticmethod
    def get_pid_path(username: str) -> str:
        rdir = UserRedisManager.get_user_redis_dir(username)
        return os.path.join(rdir, "redis.pid")

    @staticmethod
    def get_conf_path(username: str) -> str:
        rdir = UserRedisManager.get_user_redis_dir(username)
        return os.path.join(rdir, "redis.conf")

    @staticmethod
    async def get_or_create_config(db: aiosqlite.Connection, user_id: int, username: str) -> Dict[str, Any]:
        cursor = await db.execute("SELECT * FROM user_redis_instances WHERE user_id = ?", (user_id,))
        row = await cursor.fetchone()
        
        if not row:
            clean_user = sanitize_username(username)
            port = 13000 + int(user_id)
            virtual_sock = f"/home/{clean_user}/.redis/redis.sock"
            password = secrets.token_urlsafe(18)
            
            # Check user quota for memory cap
            q_cur = await db.execute("SELECT max_memory_mb, max_disk_mb FROM quotas WHERE user_id = ?", (user_id,))
            q_row = await q_cur.fetchone()
            default_mem = 32
            if q_row and q_row["max_memory_mb"]:
                default_mem = min(64, q_row["max_memory_mb"])

            await db.execute("""
                INSERT INTO user_redis_instances (user_id, is_active, port, socket_path, password, max_memory_mb, eviction_policy)
                VALUES (?, 0, ?, ?, ?, ?, 'allkeys-lru')
            """, (user_id, port, virtual_sock, password, default_mem))
            await db.commit()
            
            cursor = await db.execute("SELECT * FROM user_redis_instances WHERE user_id = ?", (user_id,))
            row = await cursor.fetchone()

        return dict(row)

    @staticmethod
    def is_process_running(username: str) -> bool:
        pid_file = UserRedisManager.get_pid_path(username)
        if not os.path.exists(pid_file):
            return False
        try:
            with open(pid_file, "r") as f:
                pid = int(f.read().strip())
            # Check if process is alive
            os.kill(pid, 0)
            return True
        except Exception:
            return False

    @staticmethod
    def generate_redis_conf(username: str, port: int, password: str, max_memory_mb: int, policy: str) -> str:
        rdir = UserRedisManager.get_user_redis_dir(username)
        sock_path = UserRedisManager.get_socket_path(username)
        pid_path = UserRedisManager.get_pid_path(username)
        db_dir = os.path.join(rdir, "db")
        log_path = os.path.join(rdir, "redis.log")

        conf_content = f"""# MiraiGrid Isolated Per-Account Redis Configuration
daemonize yes
pidfile {pid_path}
port {port}
bind 127.0.0.1
unixsocket {sock_path}
unixsocketperm 770
timeout 0
tcp-keepalive 300
loglevel notice
logfile {log_path}
databases 16
save 900 1
save 300 10
dir {db_dir}
dbfilename dump.rdb
requirepass {password}
maxmemory {max_memory_mb}mb
maxmemory-policy {policy}
protected-mode yes
"""
        conf_file = UserRedisManager.get_conf_path(username)
        with open(conf_file, "w", encoding="utf-8") as f:
            f.write(conf_content)
        return conf_file

    @staticmethod
    async def start(db: aiosqlite.Connection, user_id: int, username: str, max_memory_mb: Optional[int] = None, policy: Optional[str] = None) -> Dict[str, Any]:
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)
        
        mem_mb = max_memory_mb or cfg["max_memory_mb"]
        evict = policy or cfg["eviction_policy"]
        
        # Enforce quota boundary
        q_cur = await db.execute("SELECT max_memory_mb FROM quotas WHERE user_id = ?", (user_id,))
        q_row = await q_cur.fetchone()
        if q_row and q_row["max_memory_mb"] and mem_mb > q_row["max_memory_mb"]:
            mem_mb = q_row["max_memory_mb"]

        # Stop existing if running
        if UserRedisManager.is_process_running(username):
            UserRedisManager.stop_sync(username, cfg["password"])
            time.sleep(0.5)

        # Generate config
        conf_file = UserRedisManager.generate_redis_conf(username, cfg["port"], cfg["password"], mem_mb, evict)
        
        # Start redis-server process
        try:
            res = subprocess.run(["redis-server", conf_file], capture_output=True, text=True, timeout=10)
            if res.returncode != 0:
                raise RuntimeError(f"Gagal menjalankan redis-server: {res.stderr or res.stdout}")
        except Exception as e:
            raise RuntimeError(f"Gagal eksekusi redis-server: {str(e)}")

        # Wait for socket to become available (up to 3 seconds)
        sock_path = UserRedisManager.get_socket_path(username)
        started = False
        for _ in range(15):
            if os.path.exists(sock_path) and UserRedisManager.is_process_running(username):
                started = True
                break
            time.sleep(0.2)

        if not started:
            raise RuntimeError("Redis instance gagal membuat socket atau tidak aktif setelah dijalankan.")

        await db.execute("""
            UPDATE user_redis_instances 
            SET is_active = 1, max_memory_mb = ?, eviction_policy = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        """, (mem_mb, evict, user_id))
        await db.commit()

        return await UserRedisManager.get_status(db, user_id, username)

    @staticmethod
    def stop_sync(username: str, password: str) -> bool:
        sock_path = UserRedisManager.get_socket_path(username)
        # Attempt graceful shutdown via redis-cli
        if os.path.exists(sock_path):
            try:
                subprocess.run(["redis-cli", "-s", sock_path, "-a", password, "shutdown"], capture_output=True, timeout=5)
            except Exception:
                pass
        
        # Fallback: check PID
        pid_file = UserRedisManager.get_pid_path(username)
        if os.path.exists(pid_file):
            try:
                with open(pid_file, "r") as f:
                    pid = int(f.read().strip())
                os.kill(pid, 15) # SIGTERM
                time.sleep(0.5)
                if UserRedisManager.is_process_running(username):
                    os.kill(pid, 9) # SIGKILL
            except Exception:
                pass
            try:
                os.remove(pid_file)
            except Exception:
                pass

        if os.path.exists(sock_path):
            try:
                os.remove(sock_path)
            except Exception:
                pass
        return True

    @staticmethod
    async def stop(db: aiosqlite.Connection, user_id: int, username: str) -> Dict[str, Any]:
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)
        UserRedisManager.stop_sync(username, cfg["password"])
        
        await db.execute("""
            UPDATE user_redis_instances 
            SET is_active = 0, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        """, (user_id,))
        await db.commit()

        return await UserRedisManager.get_status(db, user_id, username)

    @staticmethod
    async def restart(db: aiosqlite.Connection, user_id: int, username: str) -> Dict[str, Any]:
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)
        return await UserRedisManager.start(db, user_id, username, cfg["max_memory_mb"], cfg["eviction_policy"])

    @staticmethod
    def get_redis_client(username: str, password: str, timeout: float = 2.0) -> redis.Redis:
        sock_path = UserRedisManager.get_socket_path(username)
        return redis.Redis(unix_socket_path=sock_path, password=password, socket_timeout=timeout, decode_responses=True)

    @staticmethod
    async def get_status(db: aiosqlite.Connection, user_id: int, username: str) -> Dict[str, Any]:
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)
        running = UserRedisManager.is_process_running(username)
        virtual_sock = UserRedisManager.get_virtual_socket_path(username)
        real_sock = UserRedisManager.get_socket_path(username)

        # Get quota details
        q_cur = await db.execute("SELECT max_memory_mb, max_disk_mb FROM quotas WHERE user_id = ?", (user_id,))
        q_row = await q_cur.fetchone()
        quota_mem_mb = q_row["max_memory_mb"] if q_row and q_row["max_memory_mb"] else 256
        quota_disk_mb = q_row["max_disk_mb"] if q_row and q_row["max_disk_mb"] else 500

        metrics = {
            "is_running": running,
            "status": "Running" if running else "Stopped",
            "port": cfg["port"],
            "socket_path": virtual_sock,
            "real_socket_path": real_sock,
            "password": cfg["password"],
            "max_memory_mb": cfg["max_memory_mb"],
            "eviction_policy": cfg["eviction_policy"],
            "quota_max_memory_mb": quota_mem_mb,
            "quota_max_disk_mb": quota_disk_mb,
            "used_memory_bytes": 0,
            "used_memory_human": "0B",
            "used_memory_peak_human": "0B",
            "max_memory_bytes": cfg["max_memory_mb"] * 1024 * 1024,
            "memory_usage_percent": 0.0,
            "is_full": False,
            "connected_clients": 0,
            "total_keys": 0,
            "keyspace_hits": 0,
            "keyspace_misses": 0,
            "hit_rate_percent": 0.0,
            "uptime_seconds": 0,
            "uptime_human": "Offline",
            "cli_command": f"redis-cli -s {virtual_sock} -a \"{cfg['password']}\""
        }

        if running and os.path.exists(real_sock):
            try:
                r = UserRedisManager.get_redis_client(username, cfg["password"], timeout=1.5)
                info = r.info()
                
                used_bytes = info.get("used_memory", 0)
                max_bytes = info.get("maxmemory", cfg["max_memory_mb"] * 1024 * 1024)
                if max_bytes == 0:
                    max_bytes = cfg["max_memory_mb"] * 1024 * 1024

                percent = round((used_bytes / max_bytes) * 100, 1) if max_bytes > 0 else 0.0

                # Count keys across databases
                total_keys = 0
                for db_idx in range(16):
                    db_info = info.get(f"db{db_idx}")
                    if isinstance(db_info, dict) and "keys" in db_info:
                        total_keys += db_info["keys"]

                hits = info.get("keyspace_hits", 0)
                misses = info.get("keyspace_misses", 0)
                tot_req = hits + misses
                hit_rate = round((hits / tot_req) * 100, 1) if tot_req > 0 else 0.0

                uptime_s = info.get("uptime_in_seconds", 0)
                days = uptime_s // 86400
                hours = (uptime_s % 86400) // 3600
                minutes = (uptime_s % 3600) // 60
                secs = uptime_s % 60
                
                if days > 0:
                    uptime_str = f"{days}h {hours}j {minutes}m"
                elif hours > 0:
                    uptime_str = f"{hours}j {minutes}m {secs}d"
                else:
                    uptime_str = f"{minutes}m {secs}d"

                metrics.update({
                    "used_memory_bytes": used_bytes,
                    "used_memory_human": info.get("used_memory_human", f"{round(used_bytes/1024/1024, 2)}M"),
                    "used_memory_peak_human": info.get("used_memory_peak_human", "0M"),
                    "max_memory_bytes": max_bytes,
                    "memory_usage_percent": percent,
                    "is_full": percent >= 95.0,
                    "connected_clients": info.get("connected_clients", 0),
                    "total_keys": total_keys,
                    "keyspace_hits": hits,
                    "keyspace_misses": misses,
                    "hit_rate_percent": hit_rate,
                    "uptime_seconds": uptime_s,
                    "uptime_human": uptime_str
                })
            except Exception as e:
                # Process might be shutting down or transient
                metrics["status"] = "Starting / Reconnecting"

        return metrics

    @staticmethod
    async def flush(user_id: int, username: str, db: aiosqlite.Connection) -> Dict[str, Any]:
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)
        if not UserRedisManager.is_process_running(username):
            raise RuntimeError("Redis instance sedang tidak aktif.")
        
        r = UserRedisManager.get_redis_client(username, cfg["password"])
        r.flushall()
        return {"success": True, "message": "Seluruh cache dan database Redis berhasil dibersihkan (FLUSHALL)."}

    @staticmethod
    async def test_key(user_id: int, username: str, action: str, key: str = "", value: str = "", ttl: int = 0, db: Optional[aiosqlite.Connection] = None) -> Dict[str, Any]:
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)
        if not UserRedisManager.is_process_running(username):
            if action == "list":
                return {"success": True, "action": "list", "total_keys": 0, "items": [], "keys": []}
            raise RuntimeError("Redis instance sedang tidak aktif. Silakan aktifkan terlebih dahulu.")
        
        r = UserRedisManager.get_redis_client(username, cfg["password"])
        
        if action == "ping":
            pong = r.ping()
            return {"success": True, "action": "ping", "result": "PONG" if pong else "FAILED"}
        
        elif action == "set":
            if not key:
                raise ValueError("Key tidak boleh kosong.")
            try:
                if ttl > 0:
                    r.setex(key, ttl, value)
                else:
                    r.set(key, value)
                return {"success": True, "action": "set", "key": key, "value": value, "ttl": ttl, "message": f"Key '{key}' berhasil disimpan."}
            except redis.exceptions.ResponseError as err:
                if "OOM" in str(err):
                    return {"success": False, "action": "set", "key": key, "error": f"Kapasitas Redis penuh! Kebijakan '{cfg['eviction_policy']}' menolak penulisan baru (OOM Protected)."}
                raise err

        elif action == "get":
            val = r.get(key)
            ttl_val = r.ttl(key)
            return {"success": True, "action": "get", "key": key, "value": val, "ttl": ttl_val, "exists": val is not None}

        elif action == "del":
            del_count = r.delete(key)
            return {"success": True, "action": "del", "key": key, "deleted_count": del_count, "message": f"Key '{key}' berhasil dihapus."}

        elif action == "list":
            keys = r.keys("*")[:100]
            items = []
            for k in keys:
                try:
                    k_type = r.type(k)
                    k_ttl = r.ttl(k)
                    items.append({"key": str(k), "type": str(k_type), "ttl": k_ttl})
                except Exception:
                    items.append({"key": str(k), "type": "string", "ttl": -1})
            return {"success": True, "action": "list", "total_keys": len(keys), "items": items, "keys": items}

        raise ValueError(f"Aksi '{action}' tidak didukung.")

    @staticmethod
    async def fill_memory_test(user_id: int, username: str, target_kb: int, db: aiosqlite.Connection) -> Dict[str, Any]:
        """
        Tests what happens when memory capacity is reached (validating evictions or OOM errors).
        """
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)
        if not UserRedisManager.is_process_running(username):
            raise RuntimeError("Redis instance belum diaktifkan.")

        r = UserRedisManager.get_redis_client(username, cfg["password"])
        chunk = "X" * 1024 # 1 KB string
        keys_created = 0
        oom_triggered = False

        for i in range(target_kb):
            try:
                r.set(f"test_load_{i}_{int(time.time())}", chunk)
                keys_created += 1
            except redis.exceptions.ResponseError as err:
                if "OOM" in str(err):
                    oom_triggered = True
                    break
                raise err

        status = await UserRedisManager.get_status(db, user_id, username)
        return {
            "success": True,
            "keys_created": keys_created,
            "oom_triggered": oom_triggered,
            "eviction_policy": cfg["eviction_policy"],
            "status": status
        }
