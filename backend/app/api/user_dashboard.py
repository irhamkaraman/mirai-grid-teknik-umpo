import asyncio
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
import aiosqlite

from app.core.database import get_db
from app.api.deps import get_current_user, get_client_ip
from app.api.admin import _build_fleet_summary, _extract_container_owner
from app.services.portainer import portainer

router = APIRouter(prefix="/user", tags=["User Dashboard"])


def _detect_container_meta(
    cname: str,
    username: str,
    project_map: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """Derive human-readable display name, type, public URL, and management route for a user container."""
    low = cname.lower()
    app_prefix = f"app_{username}_"

    if cname.startswith(app_prefix):
        slug = cname[len(app_prefix):]
        proj = project_map.get(slug, {})
        sub = proj.get("subdomain")
        service_url = f"https://{sub}" if sub and "." in str(sub) else (f"https://{sub}.miraigrid.web.id" if sub else None)
        lang = (proj.get("template_type") or proj.get("language") or "web").upper()
        return {
            "display_name": f"Deployment Web ({slug})",
            "type": "deployment",
            "type_label": f"Deployment {lang}",
            "subdomain": sub,
            "service_url": service_url,
            "project_id": proj.get("id"),
            "manage_route": f"/deploy/{proj['id']}" if proj.get("id") else "/deploy",
        }

    if low == f"n8n_{username.lower()}" or low.startswith(f"n8n_{username.lower()}_"):
        sub = f"n8n-{username}.miraigrid.web.id"
        return {
            "display_name": "Otomasi n8n",
            "type": "n8n",
            "type_label": "Otomasi n8n",
            "subdomain": sub,
            "service_url": f"https://{sub}",
            "project_id": None,
            "manage_route": "/n8n",
        }

    if low == f"tb_{username.lower()}" or low.startswith(f"tb_{username.lower()}_"):
        sub = f"tb-{username}.miraigrid.web.id"
        return {
            "display_name": "ThingsBoard IoT",
            "type": "thingsboard",
            "type_label": "IoT ThingsBoard",
            "subdomain": sub,
            "service_url": f"https://{sub}",
            "project_id": None,
            "manage_route": "/thingsboard",
        }

    if low in (f"code_{username.lower()}", f"vscode_{username.lower()}") or low.startswith(f"code_{username.lower()}_"):
        sub = f"code-{username}.miraigrid.web.id"
        return {
            "display_name": "Web IDE (VS Code)",
            "type": "vscode",
            "type_label": "Web IDE",
            "subdomain": sub,
            "service_url": f"https://{sub}",
            "project_id": None,
            "manage_route": "/vscode",
        }

    if low == f"redis_{username.lower()}" or low.startswith(f"redis_{username.lower()}_"):
        return {
            "display_name": "Redis Cache & Queue",
            "type": "redis",
            "type_label": "Redis Cache",
            "subdomain": None,
            "service_url": None,
            "project_id": None,
            "manage_route": "/redis",
        }

    if "db" in low or "mariadb" in low or "postgres" in low or "redis" in low:
        return {
            "display_name": f"Database ({cname})",
            "type": "database",
            "type_label": "Database",
            "subdomain": None,
            "service_url": None,
            "project_id": None,
            "manage_route": "/databases",
        }

    return {
        "display_name": cname,
        "type": "other",
        "type_label": "Container",
        "subdomain": None,
        "service_url": None,
        "project_id": None,
        "manage_route": "/deploy",
    }


@router.get("/dashboard-summary")
async def get_user_dashboard_summary(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Return personal telemetry and container fleet for the authenticated user,
    using the exact same calculation pipeline as Admin Fleet Summary.
    """
    username = current_user["username"]
    accounts = await _build_fleet_summary(db, only_username=username)
    account = accounts[0] if accounts else None

    if not account:
        raise HTTPException(status_code=404, detail="Data akun tidak ditemukan.")

    # Map user's projects & active web_deployments for subdomain/manage links
    cur_proj = await db.execute(
        """
        SELECT p.id, p.name, p.subdomain, p.template_type,
               d.subdomain as deployment_subdomain, d.status as deployment_status
        FROM projects p
        LEFT JOIN web_deployments d ON d.project_id = p.id
        WHERE p.user_id = ?
        """,
        (current_user["id"],),
    )
    project_map: Dict[str, Dict[str, Any]] = {}
    for row in await cur_proj.fetchall():
        r = dict(row)
        active_sub = r.get("deployment_subdomain") if r.get("deployment_status") == "active" else None
        r["subdomain"] = active_sub or r.get("subdomain")
        project_map[r["name"]] = r

    enriched_containers = []
    for c in account.get("containers", []):
        meta = _detect_container_meta(c["name"], username, project_map)
        ram_limit = c.get("ram_limit_mb") or account.get("ram_limit_mb") or 512
        enriched_containers.append({
            "id": c["id"],
            "name": c["name"],
            "display_name": meta["display_name"],
            "type": meta["type"],
            "type_label": meta["type_label"],
            "status": c["state"],
            "health_status": c["health_status"],
            "ram_usage_mb": c.get("ram_used_mb", 0.0),
            "ram_limit_mb": ram_limit,
            "cpu_usage_pct": c.get("cpu_pct", 0.0),
            "subdomain": meta["subdomain"],
            "service_url": meta["service_url"],
            "project_id": meta["project_id"],
            "manage_route": meta["manage_route"],
            "image": c.get("image", ""),
        })

    disk_used_mb = float(account.get("disk_used_mb") or 0.0)
    disk_limit_mb = float(account.get("disk_limit_mb") or 10240.0)

    return {
        "user": {
            "username": account["username"],
            "name": account["name"],
            "role": account["role"],
            "role_label": account["role_label"],
            "ram_quota_limit_mb": account["ram_limit_mb"],
            "ram_used_mb": account["total_ram_used_mb"],
            "ram_pct": account["ram_pct"],
            "disk_used_mb": disk_used_mb,
            "disk_limit_mb": disk_limit_mb,
            "disk_pct": account["disk_pct"],
            "disk_used_bytes": int(round(disk_used_mb * 1024 * 1024)),
            "disk_quota_bytes": int(round(disk_limit_mb * 1024 * 1024)),
            "running_count": account["running_count"],
            "total_count": account["container_count"],
            "health_status": account["health_status"],
        },
        "containers": enriched_containers,
    }


def _verify_user_container_ownership(container_name: str, username: str) -> None:
    """Ensure non-admin users can only control containers belonging strictly to their own username."""
    inspect_data = portainer.inspect_container_socket(container_name)
    if not inspect_data:
        raise HTTPException(status_code=404, detail=f"Container '{container_name}' tidak ditemukan.")
    labels = ((inspect_data.get("Config") or {}).get("Labels")) or {}
    owner = _extract_container_owner(container_name, labels, {username})
    if owner != username:
        raise HTTPException(
            status_code=403,
            detail="Akses ditolak: Anda hanya diizinkan mengelola kontainer milik akun Anda sendiri.",
        )


@router.post("/containers/{container_name}/{action}")
async def control_user_container(
    container_name: str,
    action: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Restart, stop, or start a container owned by the authenticated user."""
    if action not in ("restart", "stop", "start"):
        raise HTTPException(status_code=400, detail="Aksi container tidak valid. Gunakan start, stop, atau restart.")

    username = current_user["username"]
    await asyncio.to_thread(_verify_user_container_ownership, container_name, username)

    if action == "restart":
        status_code, text = await asyncio.to_thread(
            portainer._docker_socket_request, "POST", f"/containers/{container_name}/restart?t=5"
        )
        new_proj_status = "running"
    elif action == "stop":
        status_code, text = await asyncio.to_thread(
            portainer._docker_socket_request, "POST", f"/containers/{container_name}/stop?t=5"
        )
        new_proj_status = "stopped"
    else:
        status_code, text = await asyncio.to_thread(
            portainer._docker_socket_request, "POST", f"/containers/{container_name}/start"
        )
        new_proj_status = "running"

    if status_code not in (204, 304):
        raise HTTPException(status_code=500, detail=f"Gagal melakukan {action} pada container '{container_name}': {text}")

    # Sync project status if this is a web deployment container
    app_prefix = f"app_{username}_"
    if container_name.startswith(app_prefix):
        slug = container_name[len(app_prefix):]
        await db.execute(
            "UPDATE projects SET status = ? WHERE user_id = ? AND name = ?",
            (new_proj_status, current_user["id"], slug),
        )

    ip = get_client_ip(request)
    await db.execute(
        "INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details) VALUES (?, ?, ?, ?, ?)",
        (current_user["id"], f"USER_{action.upper()}_CONTAINER", container_name, ip, f"User {username} ran {action} on {container_name}"),
    )
    await db.commit()

    return {"success": True, "message": f"Container '{container_name}' berhasil di-{action}."}
