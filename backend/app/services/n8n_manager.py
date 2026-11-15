import os
import hmac
import time
import asyncio
import hashlib
from typing import Dict, Any, Optional
import httpx

from app.core.config import settings

DOCKER_UDS = "/var/run/docker.sock"
DATA_BASE_DIR = "/app/data/home"
HOST_DATA_BASE_DIR = "/var/lib/docker/volumes/miraigrid_miraigrid_data/_data/home"
N8N_IMAGE = "n8nio/n8n:1.76.1"
BASE_PORT = 15000
STUDENT_MEMORY_BYTES = 384 * 1024 * 1024  # 384 MB cgroup v2 limit for students (pool 512 MB)
STUDENT_NANO_CPUS = 500_000_000  # 0.5 Cores for students
STAFF_MEMORY_BYTES = 512 * 1024 * 1024  # 512 MB cgroup v2 limit for dosen/admin (pool 1024 MB+)
STAFF_NANO_CPUS = 800_000_000  # 0.8 Cores for dosen/admin

# In-memory cache of n8n-auth session cookies per username: {username: {"cookie": str, "expires_at": float}}
_N8N_AUTH_CACHE: Dict[str, Dict[str, Any]] = {}
_STARTING_TASKS: Dict[str, asyncio.Task] = {}


class N8nManager:
    """
    Manages dedicated per-account n8n Workflow Automation Engine containers (`n8n_<username>`)
    with cgroup v2 isolation, persistent storage in `/home/<username>/.n8n`,
    and zero-touch owner provisioning + auto-login (`n8n-auth` session cookie).
    """

    @staticmethod
    def _clean_user(username: str) -> str:
        return username.strip().lower()

    @staticmethod
    def _role_limits(role: str = "student") -> tuple[int, int, int, float]:
        r = (role or "student").strip().lower()
        if r in ("dosen", "lecturer", "admin", "staff"):
            return STAFF_MEMORY_BYTES, STAFF_NANO_CPUS, 512, 0.8
        return STUDENT_MEMORY_BYTES, STUDENT_NANO_CPUS, 384, 0.5

    @classmethod
    def container_name(cls, username: str) -> str:
        return f"n8n_{cls._clean_user(username)}"

    @staticmethod
    def container_port(user_id: int) -> int:
        return BASE_PORT + int(user_id)

    @classmethod
    def public_url(cls, username: str) -> str:
        return f"https://n8n-{cls._clean_user(username)}.miraigrid.web.id"

    @staticmethod
    def _owner_credentials(user_id: int, username: str, full_name: str = "") -> Dict[str, str]:
        clean = username.strip().lower()
        secret = (getattr(settings, "SECRET_KEY", None) or "miraigrid-n8n-secret").encode("utf-8")
        digest = hmac.new(secret, f"n8n-owner:{user_id}:{clean}".encode("utf-8"), hashlib.sha256).hexdigest()
        password = f"Mg{digest[:16]}!9"
        parts = (full_name or clean).strip().split()
        first_name = parts[0][:40] if parts else clean
        last_name = " ".join(parts[1:])[:40] if len(parts) > 1 else "UMPO"
        return {
            "email": f"{clean}@miraigrid.web.id",
            "firstName": first_name,
            "lastName": last_name,
            "password": password,
        }

    @staticmethod
    def _get_docker_client() -> httpx.AsyncClient:
        transport = httpx.AsyncHTTPTransport(uds=DOCKER_UDS)
        return httpx.AsyncClient(transport=transport, timeout=30.0)

    @staticmethod
    def _ensure_data_dir(username: str) -> str:
        clean = username.strip().lower()
        container_side = os.path.join(DATA_BASE_DIR, clean, ".n8n")
        os.makedirs(container_side, exist_ok=True)
        try:
            # n8n official image runs as uid=1000 gid=1000 ('node')
            os.chown(container_side, 1000, 1000)
            os.chmod(container_side, 0o755)
        except Exception:
            pass
        return f"{HOST_DATA_BASE_DIR}/{clean}/.n8n"

    @staticmethod
    async def _find_n8n_settings(port: int) -> tuple[Optional[str], Optional[Dict[str, Any]]]:
        for target_host in ["10.10.10.10", "127.0.0.1", "172.17.0.1"]:
            try:
                async with httpx.AsyncClient(timeout=2.5) as client:
                    res = await client.get(f"http://{target_host}:{port}/rest/settings")
                    if res.status_code == 200:
                        um = ((res.json() or {}).get("data") or {}).get("userManagement") or {}
                        return target_host, um
            except Exception:
                continue
        return None, None

    @classmethod
    async def _find_n8n_host(cls, port: int) -> Optional[str]:
        host, _ = await cls._find_n8n_settings(port)
        return host

    @classmethod
    async def inspect_container(cls, username: str) -> Optional[Dict[str, Any]]:
        cname = cls.container_name(username)
        try:
            async with cls._get_docker_client() as client:
                res = await client.get(f"http://docker/containers/{cname}/json")
                if res.status_code == 200:
                    return res.json()
        except Exception:
            pass
        return None

    @classmethod
    async def get_status(cls, user_id: int, username: str, role: str = "student") -> Dict[str, Any]:
        clean = cls._clean_user(username)
        port = cls.container_port(user_id)
        cname = cls.container_name(clean)
        info = await cls.inspect_container(clean)
        exists = info is not None
        running = bool(info and info.get("State", {}).get("Running", False))
        host, um = (await cls._find_n8n_settings(port)) if running else (None, None)
        setup_pending = bool(um and um.get("showSetupOnFirstLoad"))
        ready = bool(running and host is not None and not setup_pending)
        _, _, default_ram_mb, default_cpu = cls._role_limits(role)
        hc = (info or {}).get("HostConfig") or {}
        mem_bytes = hc.get("Memory") or 0
        nano_cpus = hc.get("NanoCpus") or 0
        ram_limit_mb = int(mem_bytes // (1024 * 1024)) if mem_bytes > 0 else default_ram_mb
        cpu_limit = round(nano_cpus / 1_000_000_000, 2) if nano_cpus > 0 else default_cpu
        return {
            "exists": exists,
            "running": running,
            "ready": ready,
            "container_name": cname,
            "port": port,
            "subdomain": f"n8n-{clean}.miraigrid.web.id",
            "public_url": cls.public_url(clean),
            "ram_limit_mb": ram_limit_mb,
            "cpu_limit": cpu_limit,
        }

    @classmethod
    async def start(cls, user_id: int, username: str, full_name: str = "", role: str = "student") -> Dict[str, Any]:
        clean = cls._clean_user(username)
        port = cls.container_port(user_id)
        cname = cls.container_name(clean)
        host_n8n_dir = cls._ensure_data_dir(clean)
        mem_bytes, nano_cpus, _, _ = cls._role_limits(role)
        node_heap_mb = 384 if mem_bytes >= STAFF_MEMORY_BYTES else 256

        info = await cls.inspect_container(clean)
        async with cls._get_docker_client() as client:
            if info is not None:
                hc_now = info.get("HostConfig") or {}
                if (hc_now.get("Memory") or 0) != mem_bytes or (hc_now.get("NanoCpus") or 0) != nano_cpus:
                    try:
                        await client.post(
                            f"http://docker/containers/{cname}/update",
                            json={
                                "Memory": mem_bytes,
                                "MemorySwap": mem_bytes * 2,
                                "NanoCpus": nano_cpus,
                            },
                        )
                    except Exception:
                        pass
            if info is None:
                payload = {
                    "Image": N8N_IMAGE,
                    "Env": [
                        f"N8N_HOST=n8n-{clean}.miraigrid.web.id",
                        "N8N_PORT=5678",
                        "N8N_PROTOCOL=https",
                        f"WEBHOOK_URL=https://n8n-{clean}.miraigrid.web.id/",
                        f"N8N_EDITOR_BASE_URL=https://n8n-{clean}.miraigrid.web.id/",
                        "N8N_SECURE_COOKIE=true",
                        "N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true",
                        "N8N_DIAGNOSTICS_ENABLED=false",
                        "N8N_PERSONALIZATION_ENABLED=false",
                        "N8N_HIRING_BANNER_ENABLED=false",
                        "N8N_TEMPLATES_ENABLED=true",
                        "GENERIC_TIMEZONE=Asia/Jakarta",
                        "TZ=Asia/Jakarta",
                        "DB_SQLITE_POOL_SIZE=2",
                        "N8N_RUNNERS_ENABLED=false",
                        f"NODE_OPTIONS=--max-old-space-size={node_heap_mb}",
                    ],
                    "ExposedPorts": {"5678/tcp": {}},
                    "Labels": {
                        "miraigrid.managed": "true",
                        "miraigrid.service": "n8n",
                        "miraigrid.user": clean,
                        "miraigrid.role": (role or "student").strip().lower(),
                    },
                    "HostConfig": {
                        "Binds": [f"{host_n8n_dir}:/home/node/.n8n"],
                        "PortBindings": {"5678/tcp": [{"HostIp": "0.0.0.0", "HostPort": str(port)}]},
                        "Memory": mem_bytes,
                        "NanoCpus": nano_cpus,
                        "RestartPolicy": {"Name": "unless-stopped"},
                    },
                }
                c_res = await client.post(f"http://docker/containers/create?name={cname}", json=payload)
                if c_res.status_code not in (200, 201):
                    raise RuntimeError(f"Gagal membuat container n8n ({c_res.status_code}): {c_res.text}")
                s_res = await client.post(f"http://docker/containers/{cname}/start")
                if s_res.status_code not in (204, 304):
                    raise RuntimeError(f"Gagal menjalankan container n8n ({s_res.status_code}): {s_res.text}")
            elif not info.get("State", {}).get("Running", False):
                s_res = await client.post(f"http://docker/containers/{cname}/start")
                if s_res.status_code not in (204, 304):
                    raise RuntimeError(f"Gagal menghidupkan container n8n ({s_res.status_code}): {s_res.text}")

        # Poll briefly for /healthz readiness (up to 75s on cold SQLite migration)
        for _ in range(75):
            if await cls._find_n8n_host(port):
                break
            await asyncio.sleep(1.0)

        return await cls.get_status(user_id, clean, role)

    @classmethod
    async def ensure_starting(cls, user_id: int, username: str, full_name: str = "", role: str = "student") -> Dict[str, Any]:
        """Trigger non-blocking container boot + SSO pre-warm if not already ready."""
        clean = cls._clean_user(username)
        status_info = await cls.get_status(user_id, clean, role)
        if status_info.get("ready"):
            return status_info

        existing = _STARTING_TASKS.get(clean)
        if existing is None or existing.done():
            async def _boot():
                try:
                    await cls.get_sso_session(user_id, clean, full_name, role)
                except Exception:
                    pass

            _STARTING_TASKS[clean] = asyncio.create_task(_boot())
        return status_info

    @classmethod
    async def stop(cls, user_id: int, username: str) -> bool:
        clean = cls._clean_user(username)
        cname = cls.container_name(clean)
        _N8N_AUTH_CACHE.pop(clean, None)
        try:
            async with cls._get_docker_client() as client:
                res = await client.post(f"http://docker/containers/{cname}/stop?t=5")
                return res.status_code in (204, 304, 404)
        except Exception:
            return False

    @classmethod
    async def restart(cls, user_id: int, username: str, full_name: str = "", role: str = "student") -> Dict[str, Any]:
        clean = cls._clean_user(username)
        cname = cls.container_name(clean)
        _N8N_AUTH_CACHE.pop(clean, None)
        info = await cls.inspect_container(clean)
        if info is None:
            return await cls.start(user_id, clean, full_name, role)
        async with cls._get_docker_client() as client:
            await client.post(f"http://docker/containers/{cname}/restart?t=5")
        port = cls.container_port(user_id)
        for _ in range(75):
            if await cls._find_n8n_host(port):
                break
            await asyncio.sleep(1.0)
        return await cls.get_status(user_id, clean, role)

    @classmethod
    async def remove_container(cls, username: str) -> bool:
        clean = cls._clean_user(username)
        cname = cls.container_name(clean)
        _N8N_AUTH_CACHE.pop(clean, None)
        try:
            async with cls._get_docker_client() as client:
                res = await client.delete(f"http://docker/containers/{cname}?force=true")
                return res.status_code in (204, 404)
        except Exception:
            return False

    @staticmethod
    def _extract_n8n_auth_cookie(res: httpx.Response) -> Optional[str]:
        val = res.cookies.get("n8n-auth")
        if val:
            return val
        for raw_cookie in res.headers.get_list("set-cookie"):
            for part in raw_cookie.split(";"):
                part = part.strip()
                if part.startswith("n8n-auth="):
                    return part.split("=", 1)[1].strip()
        return None

    @classmethod
    async def get_sso_session(cls, user_id: int, username: str, full_name: str = "", role: str = "student") -> Dict[str, Any]:
        clean = cls._clean_user(username)
        status_info = await cls.get_status(user_id, clean, role)
        if not status_info["running"]:
            status_info = await cls.start(user_id, clean, full_name, role)

        port = cls.container_port(user_id)
        host = await cls._find_n8n_host(port)
        if not host:
            # Wait briefly if container just started
            for _ in range(30):
                host = await cls._find_n8n_host(port)
                if host:
                    break
                await asyncio.sleep(1.0)
        if not host:
            return {
                **status_info,
                "ready": False,
                "n8n_auth_cookie": None,
                "sso_url": cls.public_url(clean),
            }

        cached = _N8N_AUTH_CACHE.get(clean)
        if cached and cached.get("expires_at", 0) > time.time() and cached.get("cookie"):
            status_info = await cls.get_status(user_id, clean, role)
            if status_info.get("ready"):
                return {
                    **status_info,
                    "ready": True,
                    "n8n_auth_cookie": cached["cookie"],
                    "sso_url": cls.public_url(clean),
                }

        creds = cls._owner_credentials(user_id, clean, full_name)
        base_url = f"http://{host}:{port}"
        auth_cookie: Optional[str] = None

        async with httpx.AsyncClient(timeout=25.0) as client:
            # 1. Check if first-load owner setup is required
            try:
                settings_res = await client.get(f"{base_url}/rest/settings")
                if settings_res.status_code == 200:
                    um = (settings_res.json().get("data") or {}).get("userManagement") or {}
                    if um.get("showSetupOnFirstLoad"):
                        setup_res = await client.post(
                            f"{base_url}/rest/owner/setup",
                            json={
                                "email": creds["email"],
                                "firstName": creds["firstName"],
                                "lastName": creds["lastName"],
                                "password": creds["password"],
                            },
                        )
                        if setup_res.status_code == 200:
                            auth_cookie = cls._extract_n8n_auth_cookie(setup_res)
            except Exception:
                pass

            # 2. Login to obtain fresh n8n-auth cookie if not already obtained from setup
            if not auth_cookie:
                try:
                    login_res = await client.post(
                        f"{base_url}/rest/login",
                        json={
                            "email": creds["email"],
                            "password": creds["password"],
                        },
                    )
                    if login_res.status_code == 400:
                        login_res = await client.post(
                            f"{base_url}/rest/login",
                            json={
                                "emailOrLdapLoginId": creds["email"],
                                "password": creds["password"],
                            },
                        )
                    if login_res.status_code == 200:
                        auth_cookie = cls._extract_n8n_auth_cookie(login_res)
                except Exception:
                    pass

        if auth_cookie:
            _N8N_AUTH_CACHE[clean] = {
                "cookie": auth_cookie,
                "expires_at": time.time() + 6 * 3600,
            }

        return {
            **status_info,
            "ready": True,
            "n8n_auth_cookie": auth_cookie,
            "sso_url": cls.public_url(clean),
        }
