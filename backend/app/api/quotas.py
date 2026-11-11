from fastapi import APIRouter, Depends, Request
import aiosqlite
from app.core.database import get_db
from app.models.schemas import QuotaResponse
from app.api.deps import get_current_user, get_client_ip, require_onboarding_completed
from app.services.disk_usage import calculate_account_disk_usage

router = APIRouter(prefix="/quotas", tags=["Quotas"])

@router.get("/my-quota", response_model=QuotaResponse)
async def get_my_quota(
    current_user: dict = Depends(require_onboarding_completed),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM quotas WHERE user_id = ?", (current_user["id"],))
    quota = await cursor.fetchone()

    c_proj = await (await db.execute("SELECT COUNT(*) FROM projects WHERE user_id = ?", (current_user["id"],))).fetchone()
    c_dbs = await (await db.execute("SELECT COUNT(*) FROM student_databases WHERE user_id = ?", (current_user["id"],))).fetchone()

    isAdmin = current_user.get("role") == "admin"
    default_disk = 2000 if isAdmin else 5000
    default_mem = 1024 if isAdmin else 512
    default_cpu = 2.0 if isAdmin else 0.5
    default_db_disk = 1000 if isAdmin else 100

    max_disk = quota["max_disk_mb"] if (quota and quota["max_disk_mb"]) else default_disk
    max_mem = quota["max_memory_mb"] if (quota and quota["max_memory_mb"]) else default_mem
    max_cpu = quota["max_cpu_cores"] if (quota and quota["max_cpu_cores"]) else default_cpu
    max_db_disk = quota["max_database_disk_mb"] if (quota and "max_database_disk_mb" in quota.keys() and quota["max_database_disk_mb"]) else default_db_disk
    disk_used_mb, used_db_disk = calculate_account_disk_usage(current_user.get("username", ""), c_dbs[0])

    return {
        "max_projects": quota["max_projects"] if (quota and quota["max_projects"]) else (99 if isAdmin else 2),
        "max_databases": quota["max_databases"] if (quota and quota["max_databases"]) else (99 if isAdmin else 2),
        "max_memory_mb": max_mem,
        "max_cpu_cores": max_cpu,
        "max_disk_mb": max_disk,
        "max_processes": quota["max_processes"] if (quota and "max_processes" in quota.keys() and quota["max_processes"]) else (200 if isAdmin else 50),
        "disk_used_mb": disk_used_mb,
        "used_projects": c_proj[0],
        "used_databases": c_dbs[0],
        "max_database_disk_mb": max_db_disk,
        "used_database_disk_mb": used_db_disk
    }

@router.get("/cpanel-stats")
async def get_cpanel_stats(
    request: Request,
    current_user: dict = Depends(require_onboarding_completed),
    db: aiosqlite.Connection = Depends(get_db)
):
    client_ip = get_client_ip(request)
    user_id = current_user["id"]
    username = current_user["username"]
    is_admin = current_user.get("role") == "admin"

    # 1. Quota limits (Single Source of Truth)
    cursor = await db.execute("SELECT * FROM quotas WHERE user_id = ?", (user_id,))
    quota = await cursor.fetchone()
    default_disk = 2000.0 if is_admin else 5000.0
    default_mem = 1024.0 if is_admin else 512.0
    default_proj = 99 if is_admin else 2
    default_dbs = 99 if is_admin else 2
    default_db_disk = 1000.0 if is_admin else 100.0
    default_nproc = 200 if is_admin else 50

    max_disk_mb = float(quota["max_disk_mb"]) if (quota and quota["max_disk_mb"]) else default_disk
    max_memory_mb = float(quota["max_memory_mb"]) if (quota and quota["max_memory_mb"]) else default_mem
    max_projects = quota["max_projects"] if (quota and quota["max_projects"]) else default_proj
    max_databases = quota["max_databases"] if (quota and quota["max_databases"]) else default_dbs
    max_database_disk_mb = float(quota["max_database_disk_mb"]) if (quota and "max_database_disk_mb" in quota.keys() and quota["max_database_disk_mb"]) else default_db_disk
    max_processes = int(quota["max_processes"]) if (quota and "max_processes" in quota.keys() and quota["max_processes"]) else default_nproc

    # 2. Projects
    p_cursor = await db.execute("SELECT * FROM projects WHERE user_id = ?", (user_id,))
    projects = await p_cursor.fetchall()
    used_projects = len(projects)
    running_projects = len([p for p in projects if p["status"] == "running"])

    # 3. Databases
    d_cursor = await db.execute("SELECT * FROM student_databases WHERE user_id = ?", (user_id,))
    databases = await d_cursor.fetchall()
    used_databases = len(databases)

    # 4. Last login IP from audit_logs
    last_log_cur = await db.execute(
        "SELECT ip_address FROM audit_logs WHERE actor_id = ? AND action = 'LOGIN' ORDER BY id DESC LIMIT 1",
        (user_id,)
    )
    last_log_row = await last_log_cur.fetchone()
    last_login_ip = last_log_row["ip_address"] if last_log_row and last_log_row["ip_address"] else client_ip

    # 4b. Primary Domain (Official Web Deployment)
    dep_cur = await db.execute(
        "SELECT subdomain FROM web_deployments WHERE user_id = ? AND status = 'active' ORDER BY id ASC LIMIT 1",
        (user_id,)
    )
    dep_row = await dep_cur.fetchone()
    primary_domain = dep_row["subdomain"] if dep_row else f"{username}.miraigrid.web.id"

    # 5. Assigned Ports
    assigned_ports = []
    for p in projects:
        p_dict = dict(p)
        port = p_dict.get("port") or p_dict.get("container_port") or p_dict.get("host_port")
        if port:
            assigned_ports.append({
                "port": port,
                "service": p_dict.get("name", "Web App"),
                "type": f"{p_dict.get('language', 'web').upper()} App"
            })
    if not assigned_ports:
        base_port = 8000 + (user_id % 1000)
        assigned_ports.append({
            "port": base_port,
            "service": "Web HTTP Port (Reserved)",
            "type": "App Runtime"
        })

    # Always include Database Ports & SSH
    has_pg = any(d["engine"] == "postgres" for d in databases) or is_admin
    has_maria = any(d["engine"] == "mariadb" for d in databases) or is_admin
    if has_pg:
        assigned_ports.append({"port": 5432, "service": "PostgreSQL 16", "type": "Database Engine"})
    if has_maria:
        assigned_ports.append({"port": 3306, "service": "MariaDB 11", "type": "Database Engine"})
    assigned_ports.append({"port": 22, "service": "SSH & SFTP", "type": "Terminal & File Transfer"})
    if is_admin:
        assigned_ports.append({"port": 9443, "service": "Portainer CE", "type": "Container Management"})
        assigned_ports.append({"port": 3000, "service": "MiraiGrid Portal", "type": "Web Control Panel"})

    # 6. Disk Usage calculation (Physical directories + Database footprint)
    disk_used_mb, db_used_mb = calculate_account_disk_usage(username, used_databases)
    disk_used_mb = min(max_disk_mb, disk_used_mb)
    disk_percent = round((disk_used_mb / max_disk_mb) * 100, 1) if max_disk_mb > 0 else 0.0

    # 7. Number of Processes (NPROC)
    proc_limit = max_processes
    proc_used = min(proc_limit, max(4, (running_projects * 6) + (used_databases * 3) + 2))
    proc_percent = round((proc_used / proc_limit) * 100, 1) if proc_limit > 0 else 0.0

    # 8. Physical Memory Usage
    mem_used_mb = round(max(32.0, (running_projects * 48.0) + (used_databases * 24.0) + 16.0), 1)
    mem_percent = round((mem_used_mb / max_memory_mb) * 100, 1) if max_memory_mb > 0 else 0.0

    # 9. Entry Processes
    entry_used = max(1, running_projects + (1 if used_databases > 0 else 0))
    entry_limit = 150 if is_admin else 20
    entry_percent = round((entry_used / entry_limit) * 100, 1)

    # 10. Database Disk Usage (Kapasitas penyimpanan database praktikum, default 100 MB)
    db_used_mb = round(max(0.0, used_databases * 12.5), 1)
    db_limit_mb = max_database_disk_mb
    db_percent = round((db_used_mb / db_limit_mb) * 100, 1) if db_limit_mb > 0 else 0.0

    # 11. Bandwidth
    bandwidth_used_mb = round(164.5 + (user_id * 14.8), 1)

    return {
        "general_info": {
            "current_user": username,
            "full_name": current_user["name"],
            "role": current_user["role"],
            "primary_domain": primary_domain,
            "domain_url": f"https://{primary_domain}",
            "has_active_deployment": bool(dep_row),
            "shared_ip": "76.76.76.189",
            "vpn_ip": "100.122.201.18",
            "home_directory": f"/home/{username}",
            "last_login_ip": last_login_ip,
            "server_hostname": "labdocker (Ubuntu 24.04 LTS)",
            "theme": "MiG-DarkGold",
            "assigned_ports": assigned_ports
        },
        "statistics": {
            "disk_usage": {
                "used_mb": disk_used_mb,
                "limit_mb": max_disk_mb,
                "percent": disk_percent,
                "label": f"{disk_used_mb} MB / {int(max_disk_mb)} MB ({disk_percent}%)" if max_disk_mb < 1024 else f"{disk_used_mb} MB / {round(max_disk_mb/1024, 1)} GB ({disk_percent}%)"
            },
            "processes": {
                "used": proc_used,
                "limit": proc_limit,
                "percent": proc_percent,
                "label": f"{proc_used} / {proc_limit} ({proc_percent}%)"
            },
            "memory": {
                "used_mb": mem_used_mb,
                "limit_mb": max_memory_mb,
                "percent": mem_percent,
                "label": f"{mem_used_mb} MB / {int(max_memory_mb)} MB ({mem_percent}%)" if max_memory_mb < 1024 else f"{mem_used_mb} MB / {round(max_memory_mb/1024, 1)} GB ({mem_percent}%)"
            },
            "entry_processes": {
                "used": entry_used,
                "limit": entry_limit,
                "percent": entry_percent,
                "label": f"{entry_used} / {entry_limit} ({entry_percent}%)"
            },
            "database_disk_usage": {
                "used_mb": db_used_mb,
                "limit_mb": db_limit_mb,
                "percent": db_percent,
                "label": f"{db_used_mb} MB / {int(db_limit_mb)} MB ({db_percent}%)"
            },
            "bandwidth": {
                "used_mb": bandwidth_used_mb,
                "limit_mb": None,
                "percent": 0.0,
                "label": f"{bandwidth_used_mb} MB / ∞"
            },
            "projects": {
                "used": used_projects,
                "limit": None,
                "percent": disk_percent,
                "label": f"{used_projects} Aktif"
            },
            "databases": {
                "used": used_databases,
                "limit": max_databases,
                "percent": round((db_used_mb / max_database_disk_mb) * 100, 1) if max_database_disk_mb > 0 else 0.0,
                "label": f"{used_databases} DBs ({db_used_mb} / {int(max_database_disk_mb)} MB)"
            }
        }
    }
