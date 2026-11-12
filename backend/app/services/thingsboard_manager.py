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
        """Fetch RAM, CPU, and storage quotas assigned to user from single source of truth."""
        default_quotas = {
            "ram_quota_mb": 512,
            "cpu_quota": 0.5,
            "storage_quota_mb": 1000
        }
        query = "SELECT max_memory_mb, max_cpu_cores, max_disk_mb FROM quotas WHERE user_id = ?"
        if db is None:
            db_path = settings.DATABASE_PATH
            try:
                async with aiosqlite.connect(db_path) as local_db:
                    local_db.row_factory = aiosqlite.Row
                    cursor = await local_db.execute(query, (user_id,))
                    row = await cursor.fetchone()
                    if row:
                        return {
                            "ram_quota_mb": row["max_memory_mb"] or 512,
                            "cpu_quota": row["max_cpu_cores"] or 0.5,
                            "storage_quota_mb": row["max_disk_mb"] or 1000
                        }
            except Exception:
                pass
            return default_quotas

        try:
            cursor = await db.execute(query, (user_id,))
            row = await cursor.fetchone()
            if row:
                return {
                    "ram_quota_mb": row["max_memory_mb"] or 512,
                    "cpu_quota": row["max_cpu_cores"] or 0.5,
                    "storage_quota_mb": row["max_disk_mb"] or 1000
                }
        except Exception:
            pass
        return default_quotas

    @staticmethod
    def ensure_storage_dir(username: str, quotas: Optional[Dict[str, Any]] = None) -> str:
        """
        Create and set permissions for isolated ThingsBoard storage, configs, and logs
        inside student's home directory (/home/{username}/thingsboard).
        Ensures visibility and editability inside CPanel File Manager.
        """
        tb_base = os.path.join(DATA_BASE_DIR, username, "thingsboard")
        data_dir = os.path.join(tb_base, "data")
        conf_dir = os.path.join(tb_base, "conf")
        logs_dir = os.path.join(tb_base, "logs")

        os.makedirs(data_dir, exist_ok=True)
        os.makedirs(conf_dir, exist_ok=True)
        os.makedirs(logs_dir, exist_ok=True)

        try:
            # ThingsBoard container runs as UID 799 (thingsboard).
            # PostgreSQL requires /data/db to be owned by UID 799 with 0700 permissions.
            os.chmod(tb_base, 0o777)
            os.chmod(data_dir, 0o777)
            os.chmod(logs_dir, 0o777)
            db_dir = os.path.join(data_dir, "db")
            if os.path.exists(db_dir):
                os.chmod(db_dir, 0o700)
                try:
                    os.chown(db_dir, 799, 799)
                except Exception:
                    pass
        except Exception as e:
            print(f"[ThingsBoard] Warning adjusting permissions: {e}")

        q = quotas or {}
        cpu = q.get("cpu_quota", 0.5)
        ram = q.get("ram_quota_mb", 512)
        disk = q.get("storage_quota_mb", 1000)
        heap = min(512, int(ram * 0.65))

        # 1. Template thingsboard.conf
        conf_file = os.path.join(conf_dir, "thingsboard.conf")
        if not os.path.exists(conf_file):
            try:
                with open(conf_file, "w", encoding="utf-8") as f:
                    f.write(f"""# ==============================================================================
# MiraiGrid IoT Sandbox - ThingsBoard Configuration File
# Mahasiswa / Pengguna: {username}
# Alokasi Resource MiraiGrid: {cpu} CPU Core | {ram} MB RAM | {disk} MB Disk
# ==============================================================================
# File konfigurasi ini berada di dalam home directory Anda (/home/{username}/thingsboard/conf).
# Anda dapat mengedit parameter ini langsung dari CPanel File Manager atau Web VS Code.
# Perubahan akan diterapkan setelah ThingsBoard di-restart.

export HTTP_BIND_PORT=9090
export DATABASE_ENTITIES_TYPE=sql

# Batasan Memori Java Virtual Machine (JVM) mengikuti Alokasi Akun
export JAVA_OPTS="-Xms128M -Xmx{heap}M -XX:+ExitOnOutOfMemoryError"

# Pengaturan Logging Sistem
export LOGGING_LEVEL_ROOT=INFO
export LOGGING_LEVEL_ORG_THINGSBOARD=INFO
""")
            except Exception as e:
                print(f"[ThingsBoard] Error creating thingsboard.conf: {e}")

        # 2. Template env.conf
        env_file = os.path.join(conf_dir, "env.conf")
        if not os.path.exists(env_file):
            try:
                with open(env_file, "w", encoding="utf-8") as f:
                    f.write(f"""# ThingsBoard Environment Variables Override
TB_HOST=tb-{username}.miraigrid.web.id
TB_PORT=9090
MQTT_PORT=1883
COAP_PORT=5683
""")
            except Exception as e:
                print(f"[ThingsBoard] Error creating env.conf: {e}")

        # 3. Informative README.md inside student File Manager
        readme_file = os.path.join(tb_base, "README.md")
        if not os.path.exists(readme_file):
            try:
                with open(readme_file, "w", encoding="utf-8") as f:
                    f.write(f"""# 🌐 ThingsBoard IoT Cloud Sandbox - MiraiGrid
**Akun Mahasiswa**: `{username}`  
**Subdomain Akses**: [https://tb-{username}.miraigrid.web.id](https://tb-{username}.miraigrid.web.id)  
**Alokasi Resource**: {cpu} CPU Core | {ram} MB RAM | {disk} MB Disk  

---

## 📁 Struktur Direktori Sandbox Anda
- `conf/` : Berisi file konfigurasi sistem ThingsBoard (`thingsboard.conf`, `env.conf`).
- `logs/` : Berisi catatan log runtime sistem ThingsBoard (`thingsboard.log`).
- `data/` : Berisi basis data PostgreSQL terisolasi & penyimpanan telemetry perangkat IoT Anda.

## 🔌 Protokol Komunikasi IoT yang Didukung
1. **HTTP Telemetry API**:
   ```bash
   curl -v -X POST -d '{{"temperature": 28.5, "humidity": 70}}' \\
     https://tb-{username}.miraigrid.web.id/api/v1/$ACCESS_TOKEN/telemetry \\
     --header "Content-Type:application/json"
   ```
2. **MQTT Broker Telemetry**:
   - Host: `tb-{username}.miraigrid.web.id`
   - Port: `1883`
   - Topic: `v1/devices/me/telemetry`
3. **CoAP Telemetry**:
   - Host: `tb-{username}.miraigrid.web.id`
   - Port: `5683`
""")
            except Exception as e:
                print(f"[ThingsBoard] Error creating README.md: {e}")

        # Set permissions recursively, strictly excluding PostgreSQL data dir /data/db
        try:
            for root, dirs, files in os.walk(tb_base):
                # Critical: Never chmod PostgreSQL data directory /data/db to 0777!
                # PostgreSQL refuses to start if data directory has group/world permissions.
                if "db" in dirs:
                    dirs.remove("db")
                for d in dirs:
                    try:
                        os.chmod(os.path.join(root, d), 0o777)
                    except Exception:
                        pass
                for fl in files:
                    try:
                        os.chmod(os.path.join(root, fl), 0o666)
                    except Exception:
                        pass

            # Explicitly enforce 0700 permissions and UID 799 for PostgreSQL data directory
            db_dir = os.path.join(data_dir, "db")
            if os.path.exists(db_dir):
                try:
                    os.chmod(db_dir, 0o700)
                    os.chown(db_dir, 799, 799)
                except Exception:
                    pass
        except Exception as e:
            print(f"[ThingsBoard] Warning setting permissions on {tb_base}: {e}")

        return data_dir

    @staticmethod
    async def get_tenant_tokens(port: int) -> tuple[str, str]:
        """Fetch active JWT session tokens for Tenant Admin in this container."""
        for target_host in ["10.10.10.10", "172.17.0.1", "127.0.0.1"]:
            try:
                async with httpx.AsyncClient(timeout=2.5) as client:
                    login_res = await client.post(
                        f"http://{target_host}:{port}/api/auth/login",
                        json={"username": "tenant@thingsboard.org", "password": "tenant"}
                    )
                    if login_res.status_code == 200:
                        t_data = login_res.json()
                        return t_data.get("token", ""), t_data.get("refreshToken", "")
            except Exception:
                continue
        return "", ""

    @staticmethod
    async def is_http_ready(port: int) -> bool:
        """Check if ThingsBoard Spring Boot web interface is ready on the local port."""
        for target_host in ["10.10.10.10", "172.17.0.1", "127.0.0.1"]:
            try:
                async with httpx.AsyncClient(timeout=2.0) as client:
                    res = await client.get(f"http://{target_host}:{port}/", follow_redirects=True)
                    if res.status_code in [200, 302]:
                        return True
            except Exception:
                continue
        return False

    @classmethod
    async def is_container_running(cls, username: str) -> bool:
        """Lightweight non-blocking check whether user's ThingsBoard container is alive and running."""
        container_name = f"tb_{username}"
        try:
            async with cls._get_docker_client() as client:
                res = await client.get(f"http://docker/containers/{container_name}/json")
                if res.status_code == 200:
                    return res.json().get("State", {}).get("Running", False)
        except Exception:
            pass
        return False

    @classmethod
    async def get_status(cls, user_id: int, username: str, db: Optional[aiosqlite.Connection] = None, fetch_tokens: bool = False) -> Dict[str, Any]:
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
                    sso_url = f"https://{subdomain}"
                    if is_running:
                        ready = await cls.is_http_ready(port)
                        if ready and fetch_tokens:
                            jwt_tok, ref_tok = await cls.get_tenant_tokens(port)
                            if jwt_tok:
                                sso_url = f"https://{subdomain}/sso?token={jwt_tok}&refresh_token={ref_tok}"

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
                        "sso_url": sso_url,
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
            "sso_url": f"https://{subdomain}",
            "campus_url": f"http://100.122.201.18:{port}",
            "external_url": f"http://76.76.76.189:{port}",
            "quotas": quotas
        }

    @classmethod
    async def get_sso_session(cls, user_id: int, username: str, db: Optional[aiosqlite.Connection] = None) -> Dict[str, Any]:
        """Generate a one-click SSO redirect session into ThingsBoard."""
        status_info = await cls.get_status(user_id, username, db, fetch_tokens=True)
        if not status_info.get("running"):
            await cls.start(user_id, username, db)
            status_info = await cls.get_status(user_id, username, db, fetch_tokens=True)

        port = status_info.get("port", 15000 + user_id)
        subdomain = status_info.get("subdomain", f"tb-{username}.miraigrid.web.id")
        public_url = status_info.get("public_url", f"https://{subdomain}")
        is_ready = status_info.get("ready", False)

        sso_url = status_info.get("sso_url", public_url)
        if is_ready and "token=" not in sso_url:
            jwt_tok, ref_tok = await cls.get_tenant_tokens(port)
            if jwt_tok:
                sso_url = f"https://{subdomain}/sso?token={jwt_tok}&refresh_token={ref_tok}"

        return {
            "ready": is_ready,
            "running": status_info.get("running", False),
            "sso_url": sso_url,
            "public_url": public_url,
            "port": port,
            "subdomain": subdomain,
            "quotas": status_info.get("quotas", {})
        }

    @classmethod
    async def start(cls, user_id: int, username: str, db: Optional[aiosqlite.Connection] = None) -> Dict[str, Any]:
        container_name = f"tb_{username}"
        port = 15000 + user_id
        quotas = await cls.get_user_quotas(user_id, db)

        # 1. Ensure storage directory on student persistent volume with complete configs & logs
        cls.ensure_storage_dir(username, quotas)
        host_user_dir = f"{HOST_DATA_BASE_DIR}/{username}/thingsboard"

        # 2. Memory & CPU cgroups limit calculation (Generous allocation for Admin, guaranteed 1GB+ for students)
        user_ram = quotas.get("ram_quota_mb", 512)
        user_cpu = quotas.get("cpu_quota", 0.5)

        if user_id == 1 or username == "admin":
            ram_mb = 3072      # 3 GB dedicated RAM for Admin ThingsBoard
            cpu_quota = 3.0    # 3 CPU Cores
            heap_max = 1536    # 1.5 GB Heap for ThingsBoard JVM
        else:
            ram_mb = max(1024, user_ram)
            cpu_quota = max(0.5, user_cpu)
            heap_max = min(768, max(256, int(ram_mb * 0.6)))

        target_mem = ram_mb * 1024 * 1024
        target_cpus = int(cpu_quota * 1e9)

        async with cls._get_docker_client() as client:
            # Check if container already exists
            inspect_res = await client.get(f"http://docker/containers/{container_name}/json")
            if inspect_res.status_code == 200:
                c_data = inspect_res.json()
                port_bindings = c_data.get("HostConfig", {}).get("PortBindings", {})
                current_host_ip = ""
                if "9090/tcp" in port_bindings and len(port_bindings["9090/tcp"]) > 0:
                    current_host_ip = port_bindings["9090/tcp"][0].get("HostIp", "")

                current_mem = c_data.get("HostConfig", {}).get("Memory", 0)
                current_nano_cpus = c_data.get("HostConfig", {}).get("NanoCpus", 0)

                # If bound to 127.0.0.1 or memory/cpu is below target allocation, recreate container
                if current_host_ip == "127.0.0.1" or current_mem < target_mem or current_nano_cpus < target_cpus:
                    print(f"[ThingsBoard] Upgrading container {container_name} to {ram_mb}MB RAM and {cpu_quota} CPU...")
                    await client.post(f"http://docker/containers/{container_name}/stop?t=5")
                    await client.delete(f"http://docker/containers/{container_name}?v=false")
                else:
                    if not c_data.get("State", {}).get("Running", False):
                        start_res = await client.post(f"http://docker/containers/{container_name}/start")
                        if start_res.status_code not in [204, 304]:
                            raise RuntimeError(f"Gagal menjalankan container ThingsBoard: {start_res.text}")
                    return await cls.get_status(user_id, username, db)

            # Create container
            create_payload = {
                "Image": THINGSBOARD_IMAGE,
                "Env": [
                    f"JAVA_OPTS=-Xms256M -Xmx{heap_max}M -XX:+ExitOnOutOfMemoryError",
                    "HTTP_BIND_PORT=9090"
                ],
                "HostConfig": {
                    "Binds": [
                        f"{host_user_dir}/data:/data",
                        f"{host_user_dir}/logs:/var/log/thingsboard"
                    ],
                    "PortBindings": {
                        "9090/tcp": [{"HostIp": "0.0.0.0", "HostPort": str(port)}]
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
