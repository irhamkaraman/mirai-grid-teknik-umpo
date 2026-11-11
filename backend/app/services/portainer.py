import httpx
import http.client
import socket
import json
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

    async def list_containers(self, all_containers: bool = True) -> List[Dict[str, Any]]:
        headers = await self._get_headers()
        async with httpx.AsyncClient(verify=self.ssl_verify, timeout=15.0) as client:
            url = f"{self.base_url}/api/endpoints/{self.endpoint_id}/docker/containers/json?all={'true' if all_containers else 'false'}"
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                return res.json()
            return []

    async def delete_container(self, container_name_or_id: str, force: bool = True) -> bool:
        clean_name = container_name_or_id.lstrip("/")
        headers = await self._get_headers()
        async with httpx.AsyncClient(verify=self.ssl_verify, timeout=30.0) as client:
            url = f"{self.base_url}/api/endpoints/{self.endpoint_id}/docker/containers/{clean_name}?force={'true' if force else 'false'}&v=true"
            res = await client.delete(url, headers=headers)
            return res.status_code in [200, 204, 404]

    async def delete_user_stacks_and_containers(self, username: str) -> Dict[str, Any]:
        """
        Force-removes all stacks and containers belonging to a specific student username.
        Matches miraigrid_{username}_*, app_{username}_*, vscode_{username}, etc.
        """
        deleted_stacks = []
        deleted_containers = []

        # 1. Delete Portainer Stacks
        try:
            stacks = await self.list_stacks()
            for s in stacks:
                s_name = s.get("Name", "")
                if s_name.startswith(f"miraigrid_{username}_") or s_name == f"miraigrid_{username}":
                    s_id = s.get("Id")
                    if s_id:
                        ok = await self.delete_stack(s_id)
                        if ok:
                            deleted_stacks.append(s_name)
        except Exception as e:
            print(f"[Portainer] Error deleting user stacks: {e}")

        # 2. Delete Docker Containers
        try:
            conts = await self.list_containers(all_containers=True)
            for c in conts:
                names = [n.lstrip("/") for n in c.get("Names", [])]
                for name in names:
                    if (
                        name.startswith(f"app_{username}_") or
                        name.startswith(f"miraigrid_{username}_") or
                        name == f"vscode_{username}" or
                        f"_{username}_" in name or
                        name.endswith(f"_{username}")
                    ):
                        c_id = c.get("Id") or name
                        ok = await self.delete_container(c_id, force=True)
                        if ok:
                            deleted_containers.append(name)
        except Exception as e:
            print(f"[Portainer] Error deleting user containers: {e}")

        return {"deleted_stacks": deleted_stacks, "deleted_containers": deleted_containers}

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
    async def exec_container_command(
        self,
        container_name: str,
        cmd: List[str],
        user: str = "root",
        working_dir: Optional[str] = None,
        timeout: float = 300.0
    ) -> Dict[str, Any]:
        """
        Executes a command inside container via Portainer Docker Proxy API
        and returns stdout/stderr output.
        """
        headers = await self._get_headers()
        async with httpx.AsyncClient(verify=self.ssl_verify, timeout=timeout) as client:
            # 1. Create exec instance
            create_url = f"{self.base_url}/api/endpoints/{self.endpoint_id}/docker/containers/{container_name}/exec"
            create_payload = {
                "AttachStdout": True,
                "AttachStderr": True,
                "Tty": True,
                "Cmd": cmd,
                "User": user if user else "root"
            }
            if working_dir:
                create_payload["WorkingDir"] = working_dir
            create_res = await client.post(create_url, json=create_payload, headers=headers)
            if create_res.status_code not in [200, 201]:
                return {"success": False, "error": f"Failed to create exec: {create_res.text}"}

            exec_id = create_res.json().get("Id")

            # 2. Start exec instance
            start_url = f"{self.base_url}/api/endpoints/{self.endpoint_id}/docker/exec/{exec_id}/start"
            start_payload = {
                "Detach": False,
                "Tty": True
            }
            start_res = await client.post(start_url, json=start_payload, headers=headers)
            output = start_res.text if start_res.status_code == 200 else f"Exec start error: {start_res.text}"
            return {"success": True, "output": output}

    @staticmethod
    def _docker_socket_request(method: str, path: str, body_bytes: bytes = b"") -> tuple[int, str]:
        """Direct, synchronous communication with Docker Daemon via unix socket."""
        class UnixSocketHTTPConnection(http.client.HTTPConnection):
            def __init__(self, socket_path):
                super().__init__('localhost')
                self.socket_path = socket_path
            def connect(self):
                self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                self.sock.connect(self.socket_path)

        try:
            conn = UnixSocketHTTPConnection('/var/run/docker.sock')
            headers = {"Host": "localhost"}
            if body_bytes:
                headers["Content-Type"] = "application/json"
            conn.request(method, path, body=body_bytes if body_bytes else None, headers=headers)
            res = conn.getresponse()
            content = res.read().decode('utf-8', errors='replace')
            conn.close()
            return res.status, content
        except Exception as e:
            return 500, str(e)

    async def stop_container(self, container_name: str) -> bool:
        """Stops a container reliably via Docker socket or Portainer proxy."""
        status_code, _ = self._docker_socket_request("POST", f"/containers/{container_name}/stop?t=5")
        if status_code in [204, 304, 404]:
            return True
        try:
            headers = await self._get_headers()
            async with httpx.AsyncClient(verify=self.ssl_verify, timeout=15.0) as client:
                url = f"{self.base_url}/api/endpoints/{self.endpoint_id}/docker/containers/{container_name}/stop?t=5"
                res = await client.post(url, headers=headers)
                return res.status_code in [200, 204, 304, 404]
        except Exception:
            return False

    async def start_container(self, container_name: str) -> bool:
        """Starts a container reliably via Docker socket or Portainer proxy."""
        status_code, _ = self._docker_socket_request("POST", f"/containers/{container_name}/start")
        if status_code in [204, 304]:
            return True
        try:
            headers = await self._get_headers()
            async with httpx.AsyncClient(verify=self.ssl_verify, timeout=15.0) as client:
                url = f"{self.base_url}/api/endpoints/{self.endpoint_id}/docker/containers/{container_name}/start"
                res = await client.post(url, headers=headers)
                return res.status_code in [200, 204, 304]
        except Exception:
            return False

    async def restart_container(self, container_name: str) -> bool:
        """Restarts a container reliably via Docker socket or Portainer proxy."""
        status_code, _ = self._docker_socket_request("POST", f"/containers/{container_name}/restart?t=5")
        if status_code in [204, 304]:
            return True
        try:
            headers = await self._get_headers()
            async with httpx.AsyncClient(verify=self.ssl_verify, timeout=20.0) as client:
                url = f"{self.base_url}/api/endpoints/{self.endpoint_id}/docker/containers/{container_name}/restart?t=5"
                res = await client.post(url, headers=headers)
                return res.status_code in [200, 204]
        except Exception:
            return False

    async def update_container_resources(
        self,
        container_name: str,
        pids_limit: Optional[int] = None,
        mem_limit_mb: Optional[int] = None,
        cpu_cores: Optional[float] = None
    ) -> bool:
        """
        Dynamically updates container resources (pids limit, memory, CPU) with zero downtime
        via Portainer Docker proxy.
        """
        headers = await self._get_headers()
        payload = {}
        if pids_limit is not None:
            payload["PidsLimit"] = int(pids_limit)
        if mem_limit_mb is not None:
            payload["Memory"] = int(mem_limit_mb) * 1024 * 1024
        if cpu_cores is not None:
            payload["NanoCPUs"] = int(float(cpu_cores) * 1e9)
        async with httpx.AsyncClient(verify=self.ssl_verify, timeout=15.0) as client:
            url = f"{self.base_url}/api/endpoints/{self.endpoint_id}/docker/containers/{container_name}/update"
            res = await client.post(url, json=payload, headers=headers)
            return res.status_code in [200, 204]

portainer = PortainerClient()
