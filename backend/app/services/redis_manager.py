import http.client
import json
import os
import re
import socket
import time
import secrets
import urllib.parse
from typing import Dict, Any, Optional
import aiosqlite
import redis
from app.core.config import settings

DOCKER_UDS = "/var/run/docker.sock"
REDIS_IMAGE = "redis:7-alpine"
REDIS_NETWORK = "miraigrid_miraigrid_net"
HOST_VOLUME_BASE = "/var/lib/docker/volumes/miraigrid_miraigrid_data/_data"


def sanitize_username(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "", name)


class _DockerUDS(http.client.HTTPConnection):
    def __init__(self, socket_path: str = DOCKER_UDS):
        super().__init__("localhost")
        self.socket_path = socket_path

    def connect(self):
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.connect(self.socket_path)
        self.sock = sock


def _docker_req(method: str, path: str, payload: Optional[Dict[str, Any]] = None, timeout: int = 15):
    conn = _DockerUDS(DOCKER_UDS)
    conn.timeout = timeout
    body = json.dumps(payload) if payload is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    conn.request(method, path, body=body, headers=headers)
    resp = conn.getresponse()
    raw = resp.read().decode("utf-8", errors="replace")
    try:
        data = json.loads(raw) if raw else {}
    except Exception:
        data = raw
    return resp.status, data


class UserRedisManager:
    """
    Manages isolated per-user Redis instances inside dedicated Docker containers
    (`redis_<username>` on `redis:7-alpine`) with strict cgroup v2 RAM/CPU/PID limits,
    private user storage (/home/<username>/.redis), and requirepass auth.
    """

    @staticmethod
    def get_container_name(username: str) -> str:
        return f"redis_{sanitize_username(username)}"

    @staticmethod
    def get_user_redis_dir(username: str) -> str:
        clean_user = sanitize_username(username)
        base_dir = os.path.realpath(os.path.join(settings.DATA_DIR, "home", clean_user, ".redis"))
        os.makedirs(base_dir, exist_ok=True)
        os.makedirs(os.path.join(base_dir, "db"), exist_ok=True)
        try:
            os.chmod(base_dir, 0o750)
            os.chmod(os.path.join(base_dir, "db"), 0o750)
        except Exception:
            pass
        return base_dir

    @staticmethod
    def get_host_redis_dir(username: str) -> str:
        clean_user = sanitize_username(username)
        return f"{HOST_VOLUME_BASE}/home/{clean_user}/.redis"

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

            q_cur = await db.execute("SELECT max_memory_mb, max_disk_mb FROM quotas WHERE user_id = ?", (user_id,))
            q_row = await q_cur.fetchone()
            default_mem = 32
            if q_row and q_row["max_memory_mb"]:
                default_mem = min(64, q_row["max_memory_mb"])

            await db.execute(
                """
                INSERT INTO user_redis_instances (user_id, is_active, port, socket_path, password, max_memory_mb, eviction_policy)
                VALUES (?, 0, ?, ?, ?, ?, 'allkeys-lru')
                """,
                (user_id, port, virtual_sock, password, default_mem),
            )
            await db.commit()

            cursor = await db.execute("SELECT * FROM user_redis_instances WHERE user_id = ?", (user_id,))
            row = await cursor.fetchone()

        return dict(row)

    @staticmethod
    def is_process_running(username: str) -> bool:
        cname = UserRedisManager.get_container_name(username)
        try:
            st, data = _docker_req("GET", f"/containers/{urllib.parse.quote(cname)}/json", timeout=5)
            if st == 200 and isinstance(data, dict):
                return bool(data.get("State", {}).get("Running"))
        except Exception:
            pass
        return False

    @staticmethod
    def generate_redis_conf(username: str, port: int, password: str, max_memory_mb: int, policy: str) -> str:
        UserRedisManager.get_user_redis_dir(username)
        conf_content = f"""# MiraiGrid Isolated Per-Account Redis Container Configuration
daemonize no
port {port}
bind 0.0.0.0
unixsocket /data/redis.sock
unixsocketperm 750
timeout 0
tcp-keepalive 300
loglevel notice
logfile /data/redis.log
databases 16
save 900 1
save 300 10
dir /data/db
dbfilename dump.rdb
requirepass {password}
maxmemory {max_memory_mb}mb
maxmemory-policy {policy}
protected-mode no
"""
        conf_file = UserRedisManager.get_conf_path(username)
        with open(conf_file, "w", encoding="utf-8") as f:
            f.write(conf_content)
        try:
            os.chmod(conf_file, 0o640)
        except Exception:
            pass
        return conf_file

    @staticmethod
    def _remove_container_sync(cname: str):
        qname = urllib.parse.quote(cname)
        _docker_req("POST", f"/containers/{qname}/stop?t=3", timeout=10)
        _docker_req("DELETE", f"/containers/{qname}?force=true", timeout=10)

    @staticmethod
    async def start(
        db: aiosqlite.Connection,
        user_id: int,
        username: str,
        max_memory_mb: Optional[int] = None,
        policy: Optional[str] = None,
    ) -> Dict[str, Any]:
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)

        mem_mb = int(max_memory_mb or cfg["max_memory_mb"] or 32)
        evict = policy or cfg["eviction_policy"] or "allkeys-lru"

        q_cur = await db.execute("SELECT max_memory_mb, max_cpu_cores FROM quotas WHERE user_id = ?", (user_id,))
        q_row = await q_cur.fetchone()
        if q_row and q_row["max_memory_mb"] and mem_mb > q_row["max_memory_mb"]:
            mem_mb = int(q_row["max_memory_mb"])
        cpu_limit = min(0.5, float(q_row["max_cpu_cores"])) if (q_row and q_row["max_cpu_cores"]) else 0.25

        cname = UserRedisManager.get_container_name(username)
        port = int(cfg["port"])
        UserRedisManager.generate_redis_conf(username, port, cfg["password"], mem_mb, evict)

        # Recreate container cleanly with updated cgroup limits & config
        UserRedisManager._remove_container_sync(cname)

        host_redis_dir = UserRedisManager.get_host_redis_dir(username)
        cgroup_mem_bytes = (mem_mb + 16) * 1024 * 1024
        port_key = f"{port}/tcp"

        create_payload = {
            "Image": REDIS_IMAGE,
            "Cmd": ["redis-server", "/data/redis.conf"],
            "Labels": {
                "miraigrid.managed": "true",
                "owner": sanitize_username(username),
                "service": "redis",
            },
            "ExposedPorts": {port_key: {}},
            "HostConfig": {
                "Binds": [f"{host_redis_dir}:/data:rw"],
                "Memory": cgroup_mem_bytes,
                "MemorySwap": cgroup_mem_bytes,
                "NanoCpus": int(cpu_limit * 1_000_000_000),
                "PidsLimit": 64,
                "PortBindings": {port_key: [{"HostIp": "0.0.0.0", "HostPort": str(port)}]},
                "RestartPolicy": {"Name": "unless-stopped"},
                "NetworkMode": REDIS_NETWORK,
            },
        }

        st, res = _docker_req("POST", f"/containers/create?name={urllib.parse.quote(cname)}", create_payload, timeout=20)
        if st not in (200, 201):
            raise RuntimeError(f"Gagal membuat container Redis ({st}): {res}")

        st2, res2 = _docker_req("POST", f"/containers/{urllib.parse.quote(cname)}/start", timeout=15)
        if st2 not in (200, 204):
            raise RuntimeError(f"Gagal menjalankan container Redis ({st2}): {res2}")

        # Wait up to 4s for Redis TCP readiness
        ready = False
        for _ in range(20):
            try:
                r = UserRedisManager.get_redis_client(username, cfg["password"], timeout=1.0)
                if r.ping():
                    ready = True
                    break
            except Exception:
                time.sleep(0.2)

        if not ready:
            raise RuntimeError("Container Redis aktif namun belum merespons PING.")

        await db.execute(
            """
            UPDATE user_redis_instances
            SET is_active = 1, max_memory_mb = ?, eviction_policy = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
            """,
            (mem_mb, evict, user_id),
        )
        await db.commit()

        return await UserRedisManager.get_status(db, user_id, username)

    @staticmethod
    def stop_sync(username: str, password: str = "") -> bool:
        cname = UserRedisManager.get_container_name(username)
        st, _ = _docker_req("POST", f"/containers/{urllib.parse.quote(cname)}/stop?t=3", timeout=10)
        return st in (200, 204, 304, 404)

    @staticmethod
    async def stop(db: aiosqlite.Connection, user_id: int, username: str) -> Dict[str, Any]:
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)
        UserRedisManager.stop_sync(username, cfg["password"])

        await db.execute(
            """
            UPDATE user_redis_instances
            SET is_active = 0, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
            """,
            (user_id,),
        )
        await db.commit()

        return await UserRedisManager.get_status(db, user_id, username)

    @staticmethod
    async def restart(db: aiosqlite.Connection, user_id: int, username: str) -> Dict[str, Any]:
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)
        return await UserRedisManager.start(db, user_id, username, cfg["max_memory_mb"], cfg["eviction_policy"])

    @staticmethod
    def get_redis_client(username: str, password: str, port: Optional[int] = None, timeout: float = 2.0) -> redis.Redis:
        cname = UserRedisManager.get_container_name(username)
        if port is None:
            # Resolve port from conf if omitted
            conf_path = UserRedisManager.get_conf_path(username)
            port = 13000
            if os.path.exists(conf_path):
                with open(conf_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.startswith("port "):
                            port = int(line.split()[1])
                            break
        return redis.Redis(host=cname, port=int(port), password=password, socket_timeout=timeout, decode_responses=True)

    @staticmethod
    async def get_status(db: aiosqlite.Connection, user_id: int, username: str) -> Dict[str, Any]:
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)
        running = UserRedisManager.is_process_running(username)
        virtual_sock = UserRedisManager.get_virtual_socket_path(username)
        real_sock = UserRedisManager.get_socket_path(username)
        cname = UserRedisManager.get_container_name(username)

        q_cur = await db.execute("SELECT max_memory_mb, max_disk_mb FROM quotas WHERE user_id = ?", (user_id,))
        q_row = await q_cur.fetchone()
        quota_mem_mb = q_row["max_memory_mb"] if q_row and q_row["max_memory_mb"] else 512
        quota_disk_mb = q_row["max_disk_mb"] if q_row and q_row["max_disk_mb"] else 10240

        metrics = {
            "is_running": running,
            "status": "Running" if running else "Stopped",
            "container_name": cname,
            "host": cname,
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
            "cli_command": f"redis-cli -h 10.10.10.10 -p {cfg['port']} -a \"{cfg['password']}\"",
        }

        if running:
            try:
                r = UserRedisManager.get_redis_client(username, cfg["password"], port=cfg["port"], timeout=1.5)
                info = r.info()

                used_bytes = info.get("used_memory", 0)
                max_bytes = info.get("maxmemory", cfg["max_memory_mb"] * 1024 * 1024)
                if max_bytes == 0:
                    max_bytes = cfg["max_memory_mb"] * 1024 * 1024

                percent = round((used_bytes / max_bytes) * 100, 1) if max_bytes > 0 else 0.0

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
                    "uptime_human": uptime_str,
                })
            except Exception:
                metrics["status"] = "Starting / Reconnecting"

        return metrics

    @staticmethod
    async def flush(user_id: int, username: str, db: aiosqlite.Connection) -> Dict[str, Any]:
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)
        if not UserRedisManager.is_process_running(username):
            raise RuntimeError("Redis instance sedang tidak aktif.")

        r = UserRedisManager.get_redis_client(username, cfg["password"], port=cfg["port"])
        r.flushall()
        return {"success": True, "message": "Seluruh cache dan database Redis berhasil dibersihkan (FLUSHALL)."}

    @staticmethod
    async def test_key(
        user_id: int,
        username: str,
        action: str,
        key: str = "",
        value: str = "",
        ttl: int = 0,
        db: Optional[aiosqlite.Connection] = None,
    ) -> Dict[str, Any]:
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)
        if not UserRedisManager.is_process_running(username):
            if action == "list":
                return {"success": True, "action": "list", "total_keys": 0, "items": [], "keys": []}
            raise RuntimeError("Redis instance sedang tidak aktif. Silakan aktifkan terlebih dahulu.")

        r = UserRedisManager.get_redis_client(username, cfg["password"], port=cfg["port"])

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
                if "OOM" in str(err) or "maxmemory" in str(err).lower():
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
        Tests what happens when memory capacity is reached (validating evictions or OOM errors)
        inside the user's isolated Redis container.
        """
        cfg = await UserRedisManager.get_or_create_config(db, user_id, username)
        if not UserRedisManager.is_process_running(username):
            raise RuntimeError("Redis instance belum diaktifkan.")

        r = UserRedisManager.get_redis_client(username, cfg["password"], port=cfg["port"])
        chunk = "X" * 1024  # 1 KB string
        keys_created = 0
        oom_triggered = False

        pipe = r.pipeline()
        batch_size = 200
        ts = int(time.time())
        for i in range(target_kb):
            pipe.set(f"test_load_{i}_{ts}", chunk)
            if (i + 1) % batch_size == 0 or i == target_kb - 1:
                try:
                    results = pipe.execute()
                    keys_created += sum(1 for ok in results if ok)
                except redis.exceptions.ResponseError as err:
                    if "OOM" in str(err) or "maxmemory" in str(err).lower():
                        oom_triggered = True
                        break
                    raise err
                pipe = r.pipeline()

        status = await UserRedisManager.get_status(db, user_id, username)
        return {
            "success": True,
            "keys_created": keys_created,
            "oom_triggered": oom_triggered,
            "eviction_policy": cfg["eviction_policy"],
            "status": status,
        }
