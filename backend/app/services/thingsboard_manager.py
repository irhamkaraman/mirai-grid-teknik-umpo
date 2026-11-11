import os
import asyncio
from typing import Dict, Any, Optional
import httpx
import aiosqlite

from app.core.config import settings

DOCKER_UDS = "/var/run/docker.sock"
DATA_BASE_DIR = "/app/data/home"
HOST_DATA_BASE_DIR = "/var/lib/docker/volumes/miraigrid_miraigrid_data/_data/home"
THINGSBOARD_IMAGE = "thingsboard/tb-postgres:latest"

class ThingsBoardManager:
    """
    Manages isolated ThingsBoard IoT sandbox containers for MiraiGrid users.
    Enforces cgroups v2 resource quotas (RAM, CPU), dedicated storage directories,
    and automatic subdomain routing.
    """

    @staticmethod
    def _get_docker_client() -> httpx.AsyncClient:
        transport = httpx.AsyncHTTPTransport(uds=DOCKER_UDS)
        return httpx.AsyncClient(transport=transport, timeout=30.0)

    @staticmethod
    async def get_user_quotas(user_id: int, db: Optional[aiosqlite.Connection] = None) -> Dict[str, Any]:
        """Fetch RAM, CPU, and storage quotas assigned to user."""
        default_quotas = {
            "ram_quota_mb": 512,
            "cpu_quota": 0.5,
            "storage_quota_mb": 1024
        }
        if db is None:
            db_path = settings.SQLITE_DB_PATH
            try:
                async with aiosqlite.connect(db_path) as local_db:
                    local_db.row_factory = aiosqlite.Row
                    cursor = await local_db.execute(
                        "SELECT ram_quota_mb, cpu_quota, storage_quota_mb FROM quotas WHERE user_id = ?",
                        (user_id,)
                    )
                    row = await cursor.fetchone()
                    if row:
                        return {
                            "ram_quota_mb": row["ram_quota_mb"] or 512,
                            "cpu_quota": row["cpu_quota"] or 0.5,
                            "storage_quota_mb": row["storage_quota_mb"] or 1024
                        }
            except Exception:
                pass
            return default_quotas

        try:
            cursor = await db.execute(
                "SELECT ram_quota_mb, cpu_quota, storage_quota_mb FROM quotas WHERE user_id = ?",
                (user_id,)
            )
            row = await cursor.fetchone()
            if row:
                return {
                    "ram_quota_mb": row["ram_quota_mb"] or 512,
                    "cpu_quota": row["cpu_quota"] or 0.5,
                    "storage_quota_mb": row["storage_quota_mb"] or 1024
                }
        except Exception:
            pass
        return default_quotas

    @staticmethod
    def ensure_storage_dir(username: str) -> str:
        """Create and set permissions for ThingsBoard storage inside student's home."""
        user_tb_dir = os.path.join(DATA_BASE_DIR, username, "thingsboard", "data")
        os.makedirs(user_tb_dir, exist_ok=True)
        try:
            # ThingsBoard container runs as UID 799 (thingsboard:thingsboard)
            os.chown(user_tb_dir, 799, 799)
            os.chmod(user_tb_dir, 0o777)
        except Exception as e:
            print(f"[ThingsBoard] Warning setting permissions on {user_tb_dir}: {e}")
        return user_tb_dir

    @staticmethod
    async def is_http_ready(port: int) -> bool:
        """Check if ThingsBoard Spring Boot web interface is ready on the local port."""
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"http://127.0.0.1:{port}/")
                return res.status_code == 200
        except Exception:
            return False

    @classmethod
    async def get_status(cls, user_id: int, username: str, db: Optional[aiosqlite.Connection] = None) -> Dict[str, Any]:
        container_name = f"tb_{username}"
        port = 15000 + user_id
        quotas = await cls.get_user_quotas(user_id, db)
        subdomain = f"tb-{username}.miraigrid.web.id"

        user_tb_dir = os.path.join(DATA_BASE_DIR, username, "thingsboard", "data")
        is_initialized = os.path.exists(user_tb_dir) and len(os.listdir(user_tb_dir)) > 0

        async with cls._get_docker_client() as client:
            try:
                res = await client.get(f"http://docker/containers/{container_name}/json")
                if res.status_code == 200:
                    data = res.json()
                    state = data.get("State", {})
                    is_running = state.get("Running", False)
                    ready = False
                    if is_running:
                        ready = await cls.is_http_ready(port)

                    status_str = "online" if ready else ("starting" if is_running else "stopped")
                    return {
                        "exists": True,
                        "running": is_running,
                        "ready": ready,
                        "status": status_str,
                        "initialized": is_initialized,
                        "container_name": container_name,
                        "port": port,
                        "subdomain": subdomain,
                        "public_url": f"https://{subdomain}",
                        "campus_url": f"http://100.122.201.18:{port}",
                        "external_url": f"http://76.76.76.189:{port}",
                        "quotas": quotas
                    }
            except Exception as e:
                print(f"[ThingsBoard] Error checking status: {e}")

        return {
            "exists": False,
            "running": False,
            "ready": False,
            "status": "not_created",
            "initialized": is_initialized,
            "container_name": container_name,
            "port": port,
            "subdomain": subdomain,
            "public_url": f"https://{subdomain}",
            "campus_url": f"http://100.122.201.18:{port}",
            "external_url": f"http://76.76.76.189:{port}",
            "quotas": quotas
        }

    @classmethod
    async def start(cls, user_id: int, username: str, db: Optional[aiosqlite.Connection] = None) -> Dict[str, Any]:
        container_name = f"tb_{username}"
        port = 15000 + user_id
        quotas = await cls.get_user_quotas(user_id, db)

        # 1. Ensure storage directory on student persistent volume
        cls.ensure_storage_dir(username)
        host_mount_dir = f"{HOST_DATA_BASE_DIR}/{username}/thingsboard/data"

        # 2. Memory & CPU cgroups limit calculation
        ram_mb = quotas["ram_quota_mb"]
        cpu_quota = quotas["cpu_quota"]
        heap_max = max(256, int(ram_mb * 0.75))

        async with cls._get_docker_client() as client:
            # Check if container already exists
            inspect_res = await client.get(f"http://docker/containers/{container_name}/json")
            if inspect_res.status_code == 200:
                c_data = inspect_res.json()
                if not c_data.get("State", {}).get("Running", False):
                    start_res = await client.post(f"http://docker/containers/{container_name}/start")
                    if start_res.status_code not in [204, 304]:
                        raise RuntimeError(f"Gagal menjalankan container ThingsBoard: {start_res.text}")
                return await cls.get_status(user_id, username, db)

            # Create container
            create_payload = {
                "Image": THINGSBOARD_IMAGE,
                "Env": [
                    f"JAVA_OPTS=-Xms128M -Xmx{heap_max}M",
                    "HTTP_BIND_PORT=9090"
                ],
                "HostConfig": {
                    "Binds": [
                        f"{host_mount_dir}:/data"
                    ],
                    "PortBindings": {
                        "9090/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(port)}]
                    },
                    "Memory": ram_mb * 1024 * 1024,
                    "NanoCpus": int(cpu_quota * 1e9),
                    "RestartPolicy": {"Name": "unless-stopped"}
                }
            }

            create_res = await client.post(
                f"http://docker/containers/create?name={container_name}",
                json=create_payload
            )
            if create_res.status_code != 201:
                raise RuntimeError(f"Gagal membuat container ThingsBoard: {create_res.text}")

            start_res = await client.post(f"http://docker/containers/{container_name}/start")
            if start_res.status_code not in [204, 304]:
                raise RuntimeError(f"Gagal memulai container ThingsBoard baru: {start_res.text}")

            return await cls.get_status(user_id, username, db)

    @classmethod
    async def stop(cls, user_id: int, username: str) -> bool:
        container_name = f"tb_{username}"
        async with cls._get_docker_client() as client:
            res = await client.post(f"http://docker/containers/{container_name}/stop?t=10")
            return res.status_code in [204, 304, 404]

    @classmethod
    async def restart(cls, user_id: int, username: str, db: Optional[aiosqlite.Connection] = None) -> Dict[str, Any]:
        container_name = f"tb_{username}"
        async with cls._get_docker_client() as client:
            res = await client.post(f"http://docker/containers/{container_name}/restart?t=10")
            if res.status_code not in [204, 304]:
                # If container doesn't exist, start it fresh
                return await cls.start(user_id, username, db)
            return await cls.get_status(user_id, username, db)
