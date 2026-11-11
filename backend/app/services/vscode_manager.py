import httpx
from typing import Dict, Any, List, Optional
from app.core.config import settings

DAEMON_URL = "http://10.10.10.10:13999"

class VSCodeManager:
    """
    Client for MiraiGrid IDE Daemon on labdocker.
    Controls per-user code-server instances, port allocation, and folder mappings.
    """

    @staticmethod
    async def get_status(user_id: int, username: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                res = await client.get(f"{DAEMON_URL}/status", params={"user_id": user_id, "username": username})
                if res.status_code == 200:
                    data = res.json()
                    port = data.get("port", 14000 + user_id)
                    data["public_url"] = f"https://code-{username}.miraigrid.web.id"
                    data["campus_url"] = f"http://100.122.201.18:{port}"
                    data["external_url"] = f"http://76.76.76.189:{port}"
                    return data
                return {
                    "running": False,
                    "port": 14000 + user_id,
                    "subdomain": f"code-{username}.miraigrid.web.id",
                    "public_url": f"https://code-{username}.miraigrid.web.id",
                    "campus_url": f"http://100.122.201.18:{14000 + user_id}",
                    "external_url": f"http://76.76.76.189:{14000 + user_id}"
                }
            except Exception as e:
                return {
                    "running": False,
                    "error": str(e),
                    "port": 14000 + user_id,
                    "public_url": f"https://code-{username}.miraigrid.web.id",
                    "campus_url": f"http://100.122.201.18:{14000 + user_id}",
                    "external_url": f"http://76.76.76.189:{14000 + user_id}"
                }

    @staticmethod
    async def get_folders(username: str) -> List[Dict[str, str]]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                res = await client.get(f"{DAEMON_URL}/folders", params={"username": username})
                if res.status_code == 200:
                    return res.json().get("folders", [])
            except Exception:
                pass
        return [{"id": "root", "name": f"Home Root (/home/{username})", "path": f"/home/{username}"}]

    @staticmethod
    async def start(user_id: int, username: str, folder: Optional[str] = None) -> Dict[str, Any]:
        payload = {"user_id": user_id, "username": username, "folder": folder}
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(f"{DAEMON_URL}/start", json=payload)
            if res.status_code == 200:
                data = res.json()
                port = data.get("port", 14000 + user_id)
                data["public_url"] = f"https://code-{username}.miraigrid.web.id"
                data["campus_url"] = f"http://100.122.201.18:{port}"
                data["external_url"] = f"http://76.76.76.189:{port}"
                return data
            raise RuntimeError(f"Gagal memulai VS Code: {res.text}")

    @staticmethod
    async def stop(user_id: int, username: str) -> bool:
        payload = {"user_id": user_id, "username": username}
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(f"{DAEMON_URL}/stop", json=payload)
            return res.status_code == 200

    @staticmethod
    async def restart(user_id: int, username: str, folder: Optional[str] = None) -> Dict[str, Any]:
        payload = {"user_id": user_id, "username": username, "folder": folder}
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(f"{DAEMON_URL}/restart", json=payload)
            if res.status_code == 200:
                data = res.json()
                port = data.get("port", 14000 + user_id)
                data["public_url"] = f"https://code-{username}.miraigrid.web.id"
                data["campus_url"] = f"http://100.122.201.18:{port}"
                data["external_url"] = f"http://76.76.76.189:{port}"
                return data
            raise RuntimeError(f"Gagal merestart VS Code: {res.text}")
