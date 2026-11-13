import os
import json
import re
import time
import asyncio
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status, HTTPException
import aiosqlite

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.api.deps import get_current_user_flexible
from app.services.disk_usage import calculate_account_disk_usage

router = APIRouter(tags=["Resources"])

async def query_docker_container_stats(container_name: str) -> Optional[Dict[str, Any]]:
    """
    Query Docker daemon via UNIX domain socket (/var/run/docker.sock) asynchronously.
    Returns memory usage in MB and process count (PIDs) for container.
    """
    if not os.path.exists("/var/run/docker.sock"):
        return None
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_unix_connection("/var/run/docker.sock"),
            timeout=2.0
        )
        req = f"GET /containers/{container_name}/stats?stream=0 HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
        writer.write(req.encode())
        await writer.drain()

        data = await asyncio.wait_for(reader.read(), timeout=3.0)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass

        parts = data.split(b"\r\n\r\n", 1)
        if len(parts) > 1:
            body = parts[1].decode("utf-8", errors="replace")
            try:
                js = json.loads(body)
            except Exception:
                lines = body.split("\r\n")
                json_str = ""
                for line in lines:
                    line_s = line.strip()
                    if line_s.startswith("{") and line_s.endswith("}"):
                        json_str = line_s
                        break
                if json_str:
                    js = json.loads(json_str)
                else:
                    return None

            mem_stats = js.get("memory_stats", {})
            # cgroup v2 / v1 memory usage in MB
            usage_bytes = mem_stats.get("usage", 0)
            usage_mb = round(usage_bytes / (1024 * 1024), 2)
            pids = js.get("pids_stats", {}).get("current", 0)
            return {
                "ram_used_mb": usage_mb,
                "pids": pids
            }
    except Exception:
        return None
    return None

async def fetch_student_metrics(user: dict, db: aiosqlite.Connection) -> dict:
    """
    Gathers student-isolated telemetry and limits:
    - RAM usage: cgroup v2 live usage from authenticated student's container(s)
    - PIDs: live process count for authenticated student
    - Disk usage: physical directory scan of /home/{nim} + repositories/projects
    - Database usage: MariaDB & PostgreSQL storage for authenticated student
    Strict multi-tenant security: Never leaks global host or other NIM's data.
    """
    username = user["username"]
    user_id = user["id"]
    is_admin = user.get("role") == "admin"

    # 1. Quota limits
    cursor = await db.execute("SELECT * FROM quotas WHERE user_id = ?", (user_id,))
    quota = await cursor.fetchone()

    default_disk = 116000.0 if is_admin else 500.0
    default_mem = 11264.0 if is_admin else 256.0
    default_cpu = 4.0 if is_admin else 0.5
    default_proc = 1000 if is_admin else 50
    default_db_disk = 100000.0 if is_admin else 100.0

    max_disk_mb = float(quota["max_disk_mb"]) if (quota and quota["max_disk_mb"]) else default_disk
    max_mem_mb = float(quota["max_memory_mb"]) if (quota and quota["max_memory_mb"]) else default_mem
    max_cpu_cores = float(quota["max_cpu_cores"]) if (quota and quota["max_cpu_cores"]) else default_cpu
    max_processes = int(quota["max_processes"]) if (quota and "max_processes" in quota.keys() and quota["max_processes"]) else default_proc
    max_db_disk_mb = float(quota["max_database_disk_mb"]) if (quota and "max_database_disk_mb" in quota.keys() and quota["max_database_disk_mb"]) else default_db_disk

    # 2. Student databases count
    c_dbs = await (await db.execute("SELECT COUNT(*) FROM student_databases WHERE user_id = ?", (user_id,))).fetchone()
    used_databases = c_dbs[0] if c_dbs else 0

    # 3. Physical Disk Usage calculation (/home/{nim}, projects, repositories)
    disk_used_mb, db_used_mb = calculate_account_disk_usage(username, used_databases)
    if not is_admin:
        disk_used_mb = min(max_disk_mb, disk_used_mb)
    disk_percent = round((disk_used_mb / max_disk_mb) * 100, 1) if max_disk_mb > 0 else 0.0
    db_percent = round((db_used_mb / max_db_disk_mb) * 100, 1) if max_db_disk_mb > 0 else 0.0

    # 4. Student Web Deployments and containers
    dep_cur = await db.execute(
        "SELECT * FROM web_deployments WHERE user_id = ? AND status = 'active' ORDER BY id ASC LIMIT 1",
        (user_id,)
    )
    dep_row = await dep_cur.fetchone()
    primary_domain = dep_row["subdomain"] if dep_row else f"{username}.miraigrid.web.id"

    # Identify tenant container candidates
    candidate_containers = []
    if dep_row and dep_row["container_name"]:
        candidate_containers.append(dep_row["container_name"])
    if is_admin:
        candidate_containers.append("app_admin_simru-teknik")
    else:
        candidate_containers.append(f"app_{username}_public_html")

    # Check ThingsBoard container for this student
    tb_container = f"tb_{username}"

    # Query Docker stats asynchronously for student-isolated containers
    live_ram_mb = 0.0
    live_pids = 0
    containers_found = 0

    for c_name in set(candidate_containers):
        stats = await query_docker_container_stats(c_name)
        if stats:
            containers_found += 1
            live_ram_mb += stats["ram_used_mb"]
            live_pids += stats["pids"]

    # If no web workspace container found, check ThingsBoard container
    if containers_found == 0:
        tb_stats = await query_docker_container_stats(tb_container)
        if tb_stats:
            live_ram_mb += tb_stats["ram_used_mb"]
            live_pids += tb_stats["pids"]
    else:
        tb_stats = None

    # Baseline fallback if container is stopped / not deployed yet
    if containers_found == 0 and not tb_stats:
        # Subtle baseline representation (0.0 MB or idle)
        live_ram_mb = 0.0
        live_pids = 0

    live_ram_mb = round(live_ram_mb, 1)
    ram_percent = min(100.0, round((live_ram_mb / max_mem_mb) * 100, 1)) if max_mem_mb > 0 else 0.0
    process_percent = min(100.0, round((live_pids / max_processes) * 100, 1)) if max_processes > 0 else 0.0

    # Determine internal port & runtime
    p_cur = await db.execute(
        "SELECT * FROM projects WHERE user_id = ? AND status = 'running' ORDER BY id DESC LIMIT 1",
        (user_id,)
    )
    proj_row = await p_cur.fetchone()

    if proj_row:
        p_dict = dict(proj_row)
        port = p_dict.get("allocated_port") or p_dict.get("port") or 10000
        tpl = p_dict.get("template_type", "app")
        runtime_map = {
            "php82": "PHP 8.2-Apache",
            "php83": "PHP 8.3-Apache",
            "node20": "Node.js 20 LTS",
            "python311": "Python 3.11",
            "ols": "OpenLiteSpeed"
        }
        runtime_label = runtime_map.get(tpl, tpl.upper())
        internal_port_str = f"Port {port} ({runtime_label})"
    elif dep_row:
        port = dep_row["target_port"]
        internal_port_str = f"Port {port} (Web Runtime)"
    else:
        internal_port_str = "Port dinamis terisolasi (PHP 8.x / Node / Python)"

    return {
        "nim": username,
        "name": user.get("name") or username,
        "role": user.get("role", "student"),
        "sandbox_status": "active",
        "sandbox_badge": "Terisolasi cgroup v2 Linux - OOM Protected",
        "metrics": {
            "ram": {
                "used_mb": live_ram_mb,
                "max_mb": max_mem_mb,
                "percent": ram_percent,
                "description": "Batas memori cgroup v2 per container. Dilindungi OOM Killer agar tidak saling mengganggu dengan mahasiswa lain."
            },
            "cpu": {
                "cores": max_cpu_cores,
                "cores_label": f"{max_cpu_cores} Cores",
                "process_count": live_pids,
                "max_processes": max_processes,
                "percent": process_percent,
                "description": "Jumlah sub-proses PHP/Node.js/Python yang sedang berjalan bersamaan di dalam workspace."
            },
            "disk": {
                "used_mb": disk_used_mb,
                "max_mb": max_disk_mb,
                "percent": disk_percent,
                "path": f"/home/{username}",
                "description": f"Kapasitas penyimpanan untuk source code, assets, dan unggahan di folder /home/{username}."
            },
            "database": {
                "used_mb": db_used_mb,
                "max_mb": max_db_disk_mb,
                "percent": db_percent,
                "count": used_databases,
                "description": "Alokasi ruang tabel mandiri pada MariaDB 11 & PostgreSQL 16."
            }
        },
        "specs": {
            "domain": primary_domain,
            "reverse_proxy": "Nginx Ingress + HTTP/2 SSL (Cloudflare Edge)",
            "gateway_ip": "10.10.10.10 (LXC Virtual Container)",
            "internal_port": internal_port_str,
            "database_ports": "3306 (MariaDB) & 5432 (PostgreSQL)",
            "bandwidth": "1 Gbps Intranet LAN Lab TI UMPO"
        },
        "timestamp": int(time.time()),
        "is_live": True
    }

# 1. REST Endpoint for Fallback Polling & Initial Load
@router.get("/resources/metrics")
async def get_resource_metrics(
    current_user: dict = Depends(get_current_user_flexible),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Returns student-isolated resource metrics. Used for initial page render
    and graceful fallback polling if WebSocket is reconnecting.
    """
    return await fetch_student_metrics(current_user, db)

# 2. WebSocket Telemetry Stream Endpoint
@router.websocket("/ws/resources")
@router.websocket("/resources/stream")
async def websocket_resources(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    Real-time telemetry WebSocket endpoint streaming student-isolated resource metrics.
    Strictly validates JWT token during handshake before streaming any telemetry.
    Rejects unauthorized / tenant-mismatched connections immediately.
    """
    # Handshake Authentication Validation
    if not token:
        # Check Authorization header if query param missing
        auth_header = websocket.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Token autentikasi tidak disertakan")
        return

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Sesi atau token JWT tidak valid")
        return

    raw_sub = payload.get("sub")
    try:
        user_id = int(raw_sub)
    except (ValueError, TypeError):
        user_id = raw_sub

    # Verify user existence in database
    async with aiosqlite.connect(settings.DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM users WHERE id = ? OR username = ?", (user_id, str(raw_sub)))
        user_row = await cur.fetchone()

    if not user_row or not user_row["is_active"]:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Akun pengguna tidak aktif atau tidak ditemukan")
        return

    user_dict = dict(user_row)

    # Accept WebSocket connection
    await websocket.accept()

    try:
        while True:
            # Re-query metrics in student-isolated scope
            async with aiosqlite.connect(settings.DATABASE_PATH) as db:
                db.row_factory = aiosqlite.Row
                metrics_data = await fetch_student_metrics(user_dict, db)

            await websocket.send_json(metrics_data)

            # Wait 2.5 seconds or receive client ping/pong
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=2.5)
                if msg == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": int(time.time())})
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS Resources Error for {user_dict.get('username')}]: {e}")
