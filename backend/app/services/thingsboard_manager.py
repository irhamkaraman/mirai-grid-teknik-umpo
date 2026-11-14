import os
import time
from urllib.parse import quote
from typing import Dict, Any, Optional
import httpx
import aiosqlite

DOCKER_UDS = "/var/run/docker.sock"
DATA_BASE_DIR = "/app/data/home"
HOST_DATA_BASE_DIR = "/var/lib/docker/volumes/miraigrid_miraigrid_data/_data"
THINGSBOARD_IMAGE = "thingsboard/tb-postgres:latest"
CENTRAL_CONTAINER_NAME = "thingsboard"
CENTRAL_HTTP_PORT = 9090

# In-memory SSO JWT cache per username: {username: {"token": str, "refresh_token": str, "expires_at": float}}
_SSO_TOKEN_CACHE: Dict[str, Dict[str, Any]] = {}


class ThingsBoardManager:
    """
    Manages the single central multi-tenant ThingsBoard IoT Core container (`thingsboard` on port 9090).
    Provisions isolated ThingsBoard Customers & Customer Users per student/dosen via ThingsBoard REST API
    instead of spawning per-user containers.
    """

    @staticmethod
    def _get_docker_client() -> httpx.AsyncClient:
        transport = httpx.AsyncHTTPTransport(uds=DOCKER_UDS)
        return httpx.AsyncClient(transport=transport, timeout=30.0)

    @staticmethod
    async def get_user_quotas(user_id: int, db: Optional[aiosqlite.Connection] = None) -> Dict[str, Any]:
        """Central ThingsBoard Core specs (shared multi-tenant instance)."""
        return {
            "ram_quota_mb": 2048,
            "cpu_quota": 2.0,
            "storage_quota_mb": 1000,
        }

    @staticmethod
    async def _find_tb_host(port: int = CENTRAL_HTTP_PORT) -> Optional[str]:
        for target_host in ["127.0.0.1", "10.10.10.10", "172.17.0.1"]:
            try:
                async with httpx.AsyncClient(timeout=1.8) as client:
                    res = await client.get(f"http://{target_host}:{port}/", follow_redirects=True)
                    if res.status_code in [200, 302]:
                        return target_host
            except Exception:
                continue
        return None

    @classmethod
    async def is_http_ready(cls, port: int = CENTRAL_HTTP_PORT) -> bool:
        return (await cls._find_tb_host(port)) is not None

    @classmethod
    async def is_container_running(cls, username: str = "") -> bool:
        """Check whether the single central `thingsboard` container is running."""
        try:
            async with cls._get_docker_client() as client:
                res = await client.get(f"http://docker/containers/{CENTRAL_CONTAINER_NAME}/json")
                if res.status_code == 200:
                    return res.json().get("State", {}).get("Running", False)
        except Exception:
            pass
        return False

    @classmethod
    async def _ensure_customer_user_tokens(
        cls,
        client: httpx.AsyncClient,
        base_url: str,
        admin_token: str,
        username: str,
    ) -> Optional[tuple[str, str]]:
        """
        Ensures a ThingsBoard Customer & Customer User exist for `username`,
        then returns (token, refreshToken) via ThingsBoard Tenant Admin user token API.
        """
        headers = {"X-Authorization": f"Bearer {admin_token}"}
        clean_user = username.strip().lower()
        customer_title = f"MiraiGrid - {clean_user}"
        user_email = f"{clean_user}@miraigrid.web.id"

        # 1. Find or create Customer
        customer_id = None
        c_search = await client.get(
            f"{base_url}/api/customers",
            params={"pageSize": 20, "page": 0, "textSearch": clean_user},
            headers=headers,
        )
        if c_search.status_code == 200:
            for item in c_search.json().get("data", []):
                if item.get("title") == customer_title:
                    customer_id = (item.get("id") or {}).get("id")
                    break

        if not customer_id:
            c_create = await client.post(
                f"{base_url}/api/customer",
                json={"title": customer_title},
                headers=headers,
            )
            if c_create.status_code == 200:
                customer_id = (c_create.json().get("id") or {}).get("id")

        if not customer_id:
            return None

        # 2. Find or create Customer User
        tb_user_id = None
        u_search = await client.get(
            f"{base_url}/api/customer/{customer_id}/users",
            params={"pageSize": 20, "page": 0, "textSearch": clean_user},
            headers=headers,
        )
        if u_search.status_code == 200:
            for item in u_search.json().get("data", []):
                if (item.get("email") or "").lower() == user_email:
                    tb_user_id = (item.get("id") or {}).get("id")
                    break

        if not tb_user_id:
            u_create = await client.post(
                f"{base_url}/api/user",
                params={"sendActivationMail": "false"},
                json={
                    "email": user_email,
                    "authority": "CUSTOMER_USER",
                    "firstName": clean_user,
                    "lastName": "MiraiGrid",
                    "customerId": {"entityType": "CUSTOMER", "id": customer_id},
                },
                headers=headers,
            )
            if u_create.status_code == 200:
                tb_user_id = (u_create.json().get("id") or {}).get("id")

        if not tb_user_id:
            return None

        # 3. Fetch Customer User JWT via Tenant Admin impersonation endpoint
        tok_res = await client.get(f"{base_url}/api/user/{tb_user_id}/token", headers=headers)
        if tok_res.status_code == 200:
            t_data = tok_res.json()
            tok = t_data.get("token", "")
            ref = t_data.get("refreshToken", "")
            if tok:
                return tok, ref
        return None

    @classmethod
    async def get_tenant_tokens(
        cls,
        port: int = CENTRAL_HTTP_PORT,
        username: str = "",
        force_refresh: bool = False,
        is_admin: bool = False,
    ) -> tuple[str, str]:
        """Fetch active JWT session tokens from the central ThingsBoard instance."""
        now = time.time()
        cache_key = username or "admin"
        if not force_refresh:
            cached = _SSO_TOKEN_CACHE.get(cache_key)
            if cached and cached.get("expires_at", 0) > now and cached.get("token"):
                return cached["token"], cached.get("refresh_token", "")

        target_host = await cls._find_tb_host(port)
        if not target_host:
            return "", ""

        base_url = f"http://{target_host}:{port}"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                login_res = await client.post(
                    f"{base_url}/api/auth/login",
                    json={"username": "tenant@thingsboard.org", "password": "tenant"},
                )
                if login_res.status_code != 200:
                    return "", ""

                t_data = login_res.json()
                admin_tok = t_data.get("token", "")
                admin_ref = t_data.get("refreshToken", "")
                if not admin_tok:
                    return "", ""

                tok, ref = admin_tok, admin_ref
                if username and not is_admin and username.lower() not in ("admin", "labti", "kaprodi"):
                    try:
                        cust_tokens = await cls._ensure_customer_user_tokens(client, base_url, admin_tok, username)
                        if cust_tokens:
                            tok, ref = cust_tokens
                    except Exception as ce:
                        print(f"[ThingsBoard] Customer user provisioning fallback for {username}: {ce}")

                _SSO_TOKEN_CACHE[cache_key] = {
                    "token": tok,
                    "refresh_token": ref,
                    "expires_at": now + 2700,
                }
                return tok, ref
        except Exception as e:
            print(f"[ThingsBoard] Error getting tokens: {e}")
        return "", ""

    @staticmethod
    def _compose_sso_url(subdomain: str, jwt_tok: str, ref_tok: str, mg_token: Optional[str] = None) -> str:
        if not jwt_tok:
            if mg_token:
                return f"https://{subdomain}/sso?mg_token={quote(mg_token)}"
            return f"https://{subdomain}"
        url = f"https://{subdomain}/sso?token={quote(jwt_tok)}&refresh_token={quote(ref_tok)}"
        if mg_token:
            url += f"&mg_token={quote(mg_token)}"
        return url

    @classmethod
    async def get_status(
        cls,
        user_id: int,
        username: str,
        db: Optional[aiosqlite.Connection] = None,
        fetch_tokens: bool = False,
        mg_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        quotas = await cls.get_user_quotas(user_id, db)
        subdomain = f"tb-{username}.miraigrid.web.id" if username != "admin" else "tb.miraigrid.web.id"
        is_admin = (user_id == 1 or username.lower() in ("admin", "labti", "kaprodi"))

        async with cls._get_docker_client() as client:
            try:
                res = await client.get(f"http://docker/containers/{CENTRAL_CONTAINER_NAME}/json")
                if res.status_code == 200:
                    data = res.json()
                    state = data.get("State", {})
                    is_running = state.get("Running", False)
                    ready = False
                    sso_url = f"https://{subdomain}"
                    if is_running:
                        ready = await cls.is_http_ready(CENTRAL_HTTP_PORT)
                        if ready:
                            jwt_tok, ref_tok = await cls.get_tenant_tokens(
                                CENTRAL_HTTP_PORT,
                                username=username,
                                is_admin=is_admin,
                            )
                            sso_url = cls._compose_sso_url(subdomain, jwt_tok, ref_tok, mg_token)

                    status_str = "online" if ready else ("starting" if is_running else "stopped")
                    return {
                        "exists": True,
                        "running": is_running,
                        "ready": ready,
                        "status": status_str,
                        "initialized": True,
                        "container_name": CENTRAL_CONTAINER_NAME,
                        "port": CENTRAL_HTTP_PORT,
                        "subdomain": subdomain,
                        "public_url": f"https://{subdomain}",
                        "sso_url": sso_url,
                        "campus_url": f"http://100.122.201.18:{CENTRAL_HTTP_PORT}",
                        "external_url": f"http://76.76.76.189:{CENTRAL_HTTP_PORT}",
                        "quotas": quotas,
                        "multi_tenant": True,
                    }
            except Exception as e:
                print(f"[ThingsBoard] Error checking status: {e}")

        return {
            "exists": False,
            "running": False,
            "ready": False,
            "status": "not_created",
            "initialized": False,
            "container_name": CENTRAL_CONTAINER_NAME,
            "port": CENTRAL_HTTP_PORT,
            "subdomain": subdomain,
            "public_url": f"https://{subdomain}",
            "sso_url": f"https://{subdomain}",
            "campus_url": f"http://100.122.201.18:{CENTRAL_HTTP_PORT}",
            "external_url": f"http://76.76.76.189:{CENTRAL_HTTP_PORT}",
            "quotas": quotas,
            "multi_tenant": True,
        }

    @classmethod
    async def get_sso_session(
        cls,
        user_id: int,
        username: str,
        db: Optional[aiosqlite.Connection] = None,
        mg_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a one-click multi-tenant SSO redirect session into central ThingsBoard."""
        status_info = await cls.get_status(user_id, username, db, fetch_tokens=True, mg_token=mg_token)
        if not status_info.get("running"):
            await cls.start(user_id, username, db, mg_token=mg_token)
            status_info = await cls.get_status(user_id, username, db, fetch_tokens=True, mg_token=mg_token)

        subdomain = status_info.get("subdomain", "tb.miraigrid.web.id")
        public_url = status_info.get("public_url", f"https://{subdomain}")
        is_ready = status_info.get("ready", False)
        is_admin = (user_id == 1 or username.lower() in ("admin", "labti", "kaprodi"))

        sso_url = status_info.get("sso_url", public_url)
        if is_ready and "token=" not in sso_url:
            jwt_tok, ref_tok = await cls.get_tenant_tokens(
                CENTRAL_HTTP_PORT,
                username=username,
                force_refresh=True,
                is_admin=is_admin,
            )
            sso_url = cls._compose_sso_url(subdomain, jwt_tok, ref_tok, mg_token)

        return {
            "ready": is_ready,
            "running": status_info.get("running", False),
            "sso_url": sso_url,
            "public_url": public_url,
            "port": CENTRAL_HTTP_PORT,
            "subdomain": subdomain,
            "quotas": status_info.get("quotas", {}),
        }

    @classmethod
    async def start(
        cls,
        user_id: int,
        username: str,
        db: Optional[aiosqlite.Connection] = None,
        mg_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Ensures the single central `thingsboard` container is running (never spawns per-user containers).
        """
        core_dir = f"{HOST_DATA_BASE_DIR}/thingsboard_core"
        ram_mb = 2048
        cpu_quota = 2.0
        heap_max = 1024

        async with cls._get_docker_client() as client:
            inspect_res = await client.get(f"http://docker/containers/{CENTRAL_CONTAINER_NAME}/json")
            if inspect_res.status_code == 200:
                c_data = inspect_res.json()
                if not c_data.get("State", {}).get("Running", False):
                    start_res = await client.post(f"http://docker/containers/{CENTRAL_CONTAINER_NAME}/start")
                    if start_res.status_code not in [204, 304]:
                        raise RuntimeError(f"Gagal menjalankan container ThingsBoard: {start_res.text}")
                return await cls.get_status(user_id, username, db, mg_token=mg_token)

            create_payload = {
                "Image": THINGSBOARD_IMAGE,
                "Env": [
                    f"JAVA_OPTS=-Xms256M -Xmx{heap_max}M -XX:+ExitOnOutOfMemoryError",
                    f"HTTP_BIND_PORT={CENTRAL_HTTP_PORT}",
                ],
                "HostConfig": {
                    "Binds": [
                        f"{core_dir}/data:/data",
                        f"{core_dir}/logs:/var/log/thingsboard",
                    ],
                    "PortBindings": {
                        f"{CENTRAL_HTTP_PORT}/tcp": [{"HostIp": "0.0.0.0", "HostPort": str(CENTRAL_HTTP_PORT)}],
                        "1883/tcp": [{"HostIp": "0.0.0.0", "HostPort": "1883"}],
                        "5683/udp": [{"HostIp": "0.0.0.0", "HostPort": "5683"}],
                    },
                    "Memory": ram_mb * 1024 * 1024,
                    "MemorySwap": (ram_mb + 1024) * 1024 * 1024,
                    "NanoCpus": int(cpu_quota * 1e9),
                    "RestartPolicy": {"Name": "unless-stopped"},
                },
            }

            create_res = await client.post(
                f"http://docker/containers/create?name={CENTRAL_CONTAINER_NAME}",
                json=create_payload,
            )
            if create_res.status_code != 201:
                raise RuntimeError(f"Gagal membuat container ThingsBoard: {create_res.text}")

            start_res = await client.post(f"http://docker/containers/{CENTRAL_CONTAINER_NAME}/start")
            if start_res.status_code not in [204, 304]:
                raise RuntimeError(f"Gagal memulai container ThingsBoard: {start_res.text}")

            return await cls.get_status(user_id, username, db, mg_token=mg_token)

    @classmethod
    async def stop(cls, user_id: int, username: str) -> bool:
        """Clears user SSO cache; never stops the shared multi-tenant ThingsBoard instance."""
        _SSO_TOKEN_CACHE.pop(username, None)
        return True

    @classmethod
    async def restart(
        cls,
        user_id: int,
        username: str,
        db: Optional[aiosqlite.Connection] = None,
        mg_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        _SSO_TOKEN_CACHE.pop(username, None)
        if user_id == 1 or username.lower() == "admin":
            async with cls._get_docker_client() as client:
                res = await client.post(f"http://docker/containers/{CENTRAL_CONTAINER_NAME}/restart?t=10")
                if res.status_code not in [204, 304]:
                    return await cls.start(user_id, username, db, mg_token=mg_token)
        return await cls.get_status(user_id, username, db, mg_token=mg_token)
