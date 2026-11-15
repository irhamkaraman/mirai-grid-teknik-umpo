import os
import asyncio
from typing import Any, Dict, List, Optional
import aiosqlite
import httpx

DOCKER_UDS = "/var/run/docker.sock"


def _default_ram_limit_mb(role: str) -> float:
    r = (role or "student").strip().lower()
    if r == "admin":
        return 11264.0
    if r in ("dosen", "lecturer", "staff"):
        return 1024.0
    return 512.0


async def get_account_ram_limit_mb(
    user_id: int,
    role: str = "student",
    db: Optional[aiosqlite.Connection] = None,
) -> float:
    r = (role or "student").strip().lower()
    if r == "admin":
        return 11264.0
    fallback = _default_ram_limit_mb(r)
    if db is not None:
        try:
            cur = await db.execute("SELECT max_memory_mb FROM quotas WHERE user_id = ?", (user_id,))
            row = await cur.fetchone()
            if row and row["max_memory_mb"]:
                return float(row["max_memory_mb"])
        except Exception:
            pass
    return fallback


async def _query_container_ram_mb(cname: str) -> float:
    if not os.path.exists(DOCKER_UDS):
        return 0.0
    try:
        transport = httpx.AsyncHTTPTransport(uds=DOCKER_UDS)
        async with httpx.AsyncClient(transport=transport, timeout=3.0) as client:
            res = await client.get(f"http://docker/containers/{cname}/stats?stream=0")
            if res.status_code != 200:
                return 0.0
            js = res.json()
            mem_stats = js.get("memory_stats", {}) or {}
            stats_detail = mem_stats.get("stats", {}) or {}
            inactive_file = stats_detail.get("inactive_file") or stats_detail.get("total_inactive_file") or 0
            usage_bytes = max(0, mem_stats.get("usage", 0) - inactive_file)
            return round(usage_bytes / (1024 * 1024), 1)
    except Exception:
        return 0.0


async def list_user_running_containers(username: str) -> List[Dict[str, Any]]:
    clean = (username or "").strip().lower()
    if not clean or not os.path.exists(DOCKER_UDS):
        return []
    service_names = {f"n8n_{clean}", f"vscode_{clean}", f"tb_{clean}"}
    app_prefix = f"app_{clean}_"
    matched: List[str] = []
    try:
        transport = httpx.AsyncHTTPTransport(uds=DOCKER_UDS)
        async with httpx.AsyncClient(transport=transport, timeout=4.0) as client:
            res = await client.get("http://docker/containers/json")
            if res.status_code != 200:
                return []
            for item in res.json():
                if (item.get("State") or "").lower() != "running":
                    continue
                for raw_name in item.get("Names") or []:
                    cname = raw_name.lstrip("/")
                    if cname in service_names or cname.startswith(app_prefix):
                        matched.append(cname)
                        break
    except Exception:
        return []

    if not matched:
        return []

    rams = await asyncio.gather(*(_query_container_ram_mb(c) for c in matched))
    return [{"name": c, "ram_used_mb": r} for c, r in zip(matched, rams)]


async def _stop_container(cname: str) -> bool:
    try:
        transport = httpx.AsyncHTTPTransport(uds=DOCKER_UDS)
        async with httpx.AsyncClient(transport=transport, timeout=8.0) as client:
            res = await client.post(f"http://docker/containers/{cname}/stop?t=3")
            return res.status_code in (204, 304, 404)
    except Exception:
        return False


async def enforce_account_ram_limit(
    user_id: int,
    username: str,
    role: str = "student",
    db: Optional[aiosqlite.Connection] = None,
    preferred_stop_name: Optional[str] = None,
    check_only: bool = False,
) -> Dict[str, Any]:
    """
    Sums live RAM across all running containers belonging to `username` (`app_*`, `n8n_*`, `vscode_*`, `tb_*`).
    If non-admin usage reaches or exceeds the account limit (`512 MB` student, `1024 MB` dosen),
    stops the offending/auxiliary container(s) from the backend and returns a warning payload.
    """
    clean = (username or "").strip().lower()
    r = (role or "student").strip().lower()
    ram_limit_mb = await get_account_ram_limit_mb(user_id, r, db)
    running = await list_user_running_containers(clean)
    total_ram_mb = round(sum(c["ram_used_mb"] for c in running), 1)

    if r == "admin" or total_ram_mb < ram_limit_mb:
        return {
            "allowed": True,
            "exceeded": False,
            "total_ram_mb": total_ram_mb,
            "ram_limit_mb": ram_limit_mb,
            "containers": running,
            "stopped_containers": [],
            "warning": None,
        }

    stopped: List[str] = []
    if not check_only and running:
        def _priority(item: Dict[str, Any]) -> tuple:
            name = item["name"]
            if preferred_stop_name and name == preferred_stop_name:
                return (0, -item["ram_used_mb"])
            if name == f"n8n_{clean}":
                return (1, -item["ram_used_mb"])
            if name in (f"vscode_{clean}", f"tb_{clean}"):
                return (2, -item["ram_used_mb"])
            return (3, -item["ram_used_mb"])

        ordered = sorted(running, key=_priority)
        remaining_ram = total_ram_mb
        for item in ordered:
            if remaining_ram < ram_limit_mb:
                break
            if await _stop_container(item["name"]):
                stopped.append(item["name"])
                remaining_ram = round(max(0.0, remaining_ram - item["ram_used_mb"]), 1)

    warning = (
        f"Batas kapasitas RAM akun tercapai ({total_ram_mb:.1f} MB / {int(ram_limit_mb)} MB). "
        f"Sistem menghentikan akses/container ({', '.join(stopped) if stopped else 'layanan aktif'}) secara otomatis. "
        f"Hentikan salah satu layanan atau project lain terlebih dahulu."
    )
    return {
        "allowed": False,
        "exceeded": True,
        "total_ram_mb": total_ram_mb,
        "ram_limit_mb": ram_limit_mb,
        "containers": running,
        "stopped_containers": stopped,
        "warning": warning,
    }
