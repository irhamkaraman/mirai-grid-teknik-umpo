import httpx
from typing import Optional, Dict, Any, List
from app.core.config import settings

class PortainerClient:
    def __init__(self):
        self.base_url = settings.PORTAINER_URL.rstrip("/")
        self.endpoint_id = settings.PORTAINER_ENDPOINT_ID
        self.ssl_verify = settings.PORTAINER_SSL_VERIFY
        self.api_key = settings.PORTAINER_API_KEY
        self.jwt_token: Optional[str] = None

    async def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        else:
            if not self.jwt_token:
                await self.authenticate()
            headers["Authorization"] = f"Bearer {self.jwt_token}"
        return headers

    async def authenticate(self) -> bool:
        if self.api_key:
            return True
        async with httpx.AsyncClient(verify=self.ssl_verify, timeout=10.0) as client:
            try:
                res = await client.post(
                    f"{self.base_url}/api/auth",
                    json={"Username": "admin", "Password": "splitti26nakama"}
                )
                if res.status_code == 200:
                    data = res.json()
                    self.jwt_token = data.get("jwt")
                    return True
                return False
            except Exception as e:
                print(f"[Portainer Auth Error]: {e}")
                return False

    async def list_stacks(self) -> List[Dict[str, Any]]:
        headers = await self._get_headers()
        async with httpx.AsyncClient(verify=self.ssl_verify, timeout=15.0) as client:
            res = await client.get(f"{self.base_url}/api/stacks", headers=headers)
            if res.status_code == 200:
                return res.json()
            return []

    async def create_standalone_stack(self, name: str, compose_content: str) -> Dict[str, Any]:
        """
        Deploy a stack from compose string via Portainer API:
        POST /api/stacks/create/standalone/string?endpointId={endpointId}
        """
        headers = await self._get_headers()
        payload = {
            "name": name,
            "stackFileContent": compose_content,
            "env": []
        }
        async with httpx.AsyncClient(verify=self.ssl_verify, timeout=60.0) as client:
            url = f"{self.base_url}/api/stacks/create/standalone/string?endpointId={self.endpoint_id}"
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code in [200, 201]:
                return {"success": True, "data": res.json()}
            return {"success": False, "status_code": res.status_code, "error": res.text}

    async def start_stack(self, stack_id: int) -> bool:
        headers = await self._get_headers()
        async with httpx.AsyncClient(verify=self.ssl_verify, timeout=30.0) as client:
            url = f"{self.base_url}/api/stacks/{stack_id}/start?endpointId={self.endpoint_id}"
            res = await client.post(url, headers=headers)
            return res.status_code in [200, 204]

    async def stop_stack(self, stack_id: int) -> bool:
        headers = await self._get_headers()
        async with httpx.AsyncClient(verify=self.ssl_verify, timeout=30.0) as client:
            url = f"{self.base_url}/api/stacks/{stack_id}/stop?endpointId={self.endpoint_id}"
            res = await client.post(url, headers=headers)
            return res.status_code in [200, 204]

    async def delete_stack(self, stack_id: int) -> bool:
        headers = await self._get_headers()
        async with httpx.AsyncClient(verify=self.ssl_verify, timeout=30.0) as client:
            url = f"{self.base_url}/api/stacks/{stack_id}?endpointId={self.endpoint_id}"
            res = await client.delete(url, headers=headers)
            return res.status_code in [200, 204]

    async def get_container_logs(self, container_name: str, tail: int = 100) -> str:
        """
        Query container logs via Portainer Docker Proxy API
        GET /api/endpoints/{endpointId}/docker/containers/{id}/logs
        """
        headers = await self._get_headers()
        async with httpx.AsyncClient(verify=self.ssl_verify, timeout=15.0) as client:
            url = f"{self.base_url}/api/endpoints/{self.endpoint_id}/docker/containers/{container_name}/logs?stdout=1&stderr=1&tail={tail}&timestamps=1"
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                # Docker log header stripping (first 8 bytes per frame)
                raw = res.content
                lines = []
                idx = 0
                while idx < len(raw):
                    if idx + 8 > len(raw):
                        break
                    frame_size = int.from_bytes(raw[idx+4:idx+8], byteorder="big")
                    line = raw[idx+8 : idx+8+frame_size].decode("utf-8", errors="ignore")
                    lines.append(line)
                    idx += 8 + frame_size
                return "".join(lines) if lines else res.text
            return f"Unable to fetch logs: {res.text}"

portainer = PortainerClient()
