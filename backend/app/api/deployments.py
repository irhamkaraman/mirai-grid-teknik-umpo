import re
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Request, Response, status
from pydantic import BaseModel
import aiosqlite

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_flexible
from app.models.schemas import DeploymentPublishRequest, DeploymentResponse

router = APIRouter(prefix="/deployments", tags=["Public Web Deployments"])

PUBLIC_BASE_DOMAIN = "miraigrid.web.id"
MAX_ACTIVE_DEPLOYMENTS_PER_STUDENT = 2


def format_deployment_dict(row: aiosqlite.Row) -> dict:
    d = dict(row)
    subdomain = d["subdomain"]
    # Extract language & version from template_type (e.g. php82 -> php 8.2)
    template_type = d.get("template_type") or ""
    lang = "php"
    ver = "8.2"
    if "python" in template_type.lower():
        lang = "python"
        ver = template_type.lower().replace("python", "")
        if len(ver) == 2:
            ver = f"{ver[0]}.{ver[1]}"
    elif "node" in template_type.lower():
        lang = "node"
        ver = template_type.lower().replace("node", "")
    elif "php" in template_type.lower():
        lang = "php"
        ver = template_type.lower().replace("php", "")
        if len(ver) == 2:
            ver = f"{ver[0]}.{ver[1]}"

    return {
        "id": d["id"],
        "user_id": d["user_id"],
        "project_id": d.get("project_id"),
        "project_name": d.get("project_name") or d.get("name") or "Web Application",
        "subdomain": subdomain,
        "public_url": f"https://{subdomain}",
        "target_port": d["target_port"],
        "container_name": d["container_name"],
        "status": d["status"],
        "language": lang,
        "version": ver,
        "created_at": str(d.get("created_at") or ""),
        "updated_at": str(d.get("updated_at") or ""),
    }


@router.api_route("/resolve", methods=["GET", "POST", "HEAD"])
async def resolve_subdomain(
    request: Request,
    x_original_host: Optional[str] = Header(None),
    host: Optional[str] = Header(None),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Internal high-performance dynamic resolver used by Host Nginx auth_request.
    Resolves incoming 'web-<rand4hex>-<nim>.miraigrid.web.id' to the internal container port.
    """
    target_host = (x_original_host or host or request.query_params.get("host") or "").split(":")[0].strip().lower()

    if not target_host:
        return Response(status_code=400, content="Missing Host Header")

    # 1. Resolve VS Code Web IDE Subdomains (code-<username>.miraigrid.web.id or code.miraigrid.web.id)
    if (target_host.startswith("code-") or target_host.startswith("code.") or target_host.startswith("vscode.")) and target_host.endswith(PUBLIC_BASE_DOMAIN):
        first_part = target_host.split(".")[0]
        code_username = first_part[5:].strip().lower() if first_part.startswith("code-") else "admin"
        u_cursor = await db.execute("SELECT id, username FROM users WHERE LOWER(username) = ?", (code_username,))
        u_row = await u_cursor.fetchone()
        if not u_row:
            return Response(status_code=404, content="User Not Found")
        
        target_port = 14000 + u_row["id"]
        try:
            from app.services.vscode_manager import VSCodeManager
            st = await VSCodeManager.get_status(u_row["id"], u_row["username"])
            if not st.get("running"):
                await VSCodeManager.start(u_row["id"], u_row["username"])
        except Exception:
            pass

        response = Response(status_code=200, content="OK")
        response.headers["X-Target-Port"] = str(target_port)
        response.headers["X-Deployment-Status"] = "active"
        response.headers["Cache-Control"] = "public, max-age=10"
        return response

    # 2. Resolve ThingsBoard IoT Subdomains (tb-<username>.miraigrid.web.id or tb.miraigrid.web.id or thingsboard.miraigrid.web.id)
    if (target_host.startswith("tb-") or target_host.startswith("tb.") or target_host.startswith("thingsboard.")) and target_host.endswith(PUBLIC_BASE_DOMAIN):
        first_part = target_host.split(".")[0]
        tb_username = first_part[3:].strip().lower() if first_part.startswith("tb-") else "admin"
        u_cursor = await db.execute("SELECT id, username FROM users WHERE LOWER(username) = ?", (tb_username,))
        u_row = await u_cursor.fetchone()
        if not u_row:
            return Response(status_code=404, content="ThingsBoard User Not Found")
        
        target_port = 15000 + u_row["id"]
        try:
            from app.services.thingsboard_manager import ThingsBoardManager
            st = await ThingsBoardManager.get_status(u_row["id"], u_row["username"], db)
            if not st.get("running"):
                await ThingsBoardManager.start(u_row["id"], u_row["username"], db)
        except Exception as e:
            print(f"[Resolve ThingsBoard] Warning: {e}")

        response = Response(status_code=200, content="OK")
        response.headers["X-Target-Port"] = str(target_port)
        response.headers["X-Deployment-Status"] = "active"
        response.headers["Cache-Control"] = "public, max-age=5"
        return response

    # 3. Only resolve subdomains matching pattern: web-<4hex>-<nim>.miraigrid.web.id
    if not target_host.endswith(PUBLIC_BASE_DOMAIN) or not target_host.startswith("web-"):
        return Response(status_code=403, content="Host Not In Scope")

    cursor = await db.execute("""
        SELECT d.target_port, d.status, p.status as project_status
        FROM web_deployments d
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE LOWER(d.subdomain) = ? AND d.status = 'active'
    """, (target_host,))
    row = await cursor.fetchone()

    if not row or not row["target_port"] or row["project_status"] == "stopped":
        response = Response(status_code=403, content="Deployment Not Found or Inactive")
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response

    response = Response(status_code=200, content="OK")
    response.headers["X-Target-Port"] = str(row["target_port"])
    response.headers["X-Deployment-Status"] = str(row["status"])
    response.headers["Cache-Control"] = "public, max-age=2"
    return response


@router.get("/my")
async def list_my_deployments(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """List all public web deployments owned by the current student/admin."""
    cursor = await db.execute("""
        SELECT d.*, p.name as project_name, p.template_type, p.status as project_status
        FROM web_deployments d
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE d.user_id = ?
        ORDER BY d.created_at DESC
    """, (current_user["id"],))
    rows = await cursor.fetchall()
    return [format_deployment_dict(r) for r in rows]


@router.get("/quota")
async def get_deployment_quota(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """Returns active deployment count and quota limits."""
    cursor = await db.execute(
        "SELECT COUNT(*) FROM web_deployments WHERE user_id = ? AND status = 'active'",
        (current_user["id"],)
    )
    active_count = (await cursor.fetchone())[0]

    max_deployments = 99 if current_user.get("role") == "admin" else MAX_ACTIVE_DEPLOYMENTS_PER_STUDENT

    return {
        "active_deployments": active_count,
        "max_deployments": max_deployments,
        "can_deploy": active_count < max_deployments
    }


@router.post("/publish")
async def publish_deployment(
    body: DeploymentPublishRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Publish a web project to a public subdomain:
    web-<random4hex>-<nim>.miraigrid.web.id
    """
    nim = re.sub(r'[^a-zA-Z0-9_-]', '', str(current_user["username"])).lower()

    # 1. Verify project ownership & existence
    cursor = await db.execute(
        "SELECT * FROM projects WHERE id = ? AND user_id = ?",
        (body.project_id, current_user["id"])
    )
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Proyek web tidak ditemukan atau Anda tidak memiliki akses.")

    target_port = project["allocated_port"]
    if not target_port:
        raise HTTPException(
            status_code=400,
            detail="Proyek ini belum memiliki port alokasi kontainer yang aktif. Jalankan proyek terlebih dahulu."
        )

    # 2. Check if a deployment already exists for this project
    cursor = await db.execute(
        "SELECT * FROM web_deployments WHERE project_id = ? AND user_id = ?",
        (body.project_id, current_user["id"])
    )
    existing = await cursor.fetchone()

    if existing:
        # If it was stopped, reactivate it (check quota)
        if existing["status"] != "active":
            c_active = await (await db.execute(
                "SELECT COUNT(*) FROM web_deployments WHERE user_id = ? AND status = 'active' AND id != ?",
                (current_user["id"], existing["id"])
            )).fetchone()
            if current_user.get("role") != "admin" and c_active[0] >= MAX_ACTIVE_DEPLOYMENTS_PER_STUDENT:
                raise HTTPException(
                    status_code=400,
                    detail=f"Batas kuota tercapai: Tiap mahasiswa maksimal memiliki {MAX_ACTIVE_DEPLOYMENTS_PER_STUDENT} deployment web aktif."
                )

            await db.execute("""
                UPDATE web_deployments
                SET status = 'active', target_port = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (target_port, existing["id"]))
            await db.commit()

        cursor = await db.execute("""
            SELECT d.*, p.name as project_name, p.template_type, p.status as project_status
            FROM web_deployments d
            LEFT JOIN projects p ON d.project_id = p.id
            WHERE d.id = ?
        """, (existing["id"],))
        updated = await cursor.fetchone()
        return format_deployment_dict(updated)

    # 3. Quota verification for new deployment
    if current_user.get("role") != "admin":
        c_active = await (await db.execute(
            "SELECT COUNT(*) FROM web_deployments WHERE user_id = ? AND status = 'active'",
            (current_user["id"],)
        )).fetchone()
        if c_active[0] >= MAX_ACTIVE_DEPLOYMENTS_PER_STUDENT:
            raise HTTPException(
                status_code=400,
                detail=f"Batas kuota tercapai: Tiap mahasiswa maksimal memiliki {MAX_ACTIVE_DEPLOYMENTS_PER_STUDENT} deployment web aktif. Silakan nonaktifkan salah satu deployment lama terlebih dahulu."
            )

    # 4. Generate unique subdomain: web-<random4hex>-<nim>.miraigrid.web.id
    subdomain = None
    for _ in range(10):
        rand_hex = secrets.token_hex(2).lower()  # Exactly 4 hex chars
        candidate = f"web-{rand_hex}-{nim}.{PUBLIC_BASE_DOMAIN}"
        c_sub = await (await db.execute("SELECT id FROM web_deployments WHERE subdomain = ?", (candidate,))).fetchone()
        if not c_sub:
            subdomain = candidate
            break

    if not subdomain:
        raise HTTPException(status_code=500, detail="Gagal mengenerate subdomain unik. Silakan coba kembali.")

    container_name = f"app_{nim}_{project['name']}"

    # 5. Insert new deployment record
    cursor = await db.execute("""
        INSERT INTO web_deployments (user_id, project_id, subdomain, target_port, container_name, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """, (
        current_user["id"],
        body.project_id,
        subdomain,
        target_port,
        container_name
    ))
    dep_id = cursor.lastrowid
    await db.commit()

    cursor = await db.execute("""
        SELECT d.*, p.name as project_name, p.template_type, p.status as project_status
        FROM web_deployments d
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE d.id = ?
    """, (dep_id,))
    new_dep = await cursor.fetchone()
    return format_deployment_dict(new_dep)


@router.post("/{deployment_id}/toggle")
async def toggle_deployment_status(
    deployment_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """Toggle deployment status between 'active' and 'stopped'."""
    cursor = await db.execute(
        "SELECT * FROM web_deployments WHERE id = ? AND user_id = ?",
        (deployment_id, current_user["id"])
    )
    dep = await cursor.fetchone()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment tidak ditemukan.")

    new_status = "stopped" if dep["status"] == "active" else "active"

    # If reactivating, verify quota
    if new_status == "active" and current_user.get("role") != "admin":
        c_active = await (await db.execute(
            "SELECT COUNT(*) FROM web_deployments WHERE user_id = ? AND status = 'active' AND id != ?",
            (current_user["id"], deployment_id)
        )).fetchone()
        if c_active[0] >= MAX_ACTIVE_DEPLOYMENTS_PER_STUDENT:
            raise HTTPException(
                status_code=400,
                detail=f"Batas kuota tercapai: Tiap mahasiswa maksimal memiliki {MAX_ACTIVE_DEPLOYMENTS_PER_STUDENT} deployment web aktif."
            )

    await db.execute("""
        UPDATE web_deployments
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (new_status, deployment_id))
    await db.commit()

    cursor = await db.execute("""
        SELECT d.*, p.name as project_name, p.template_type, p.status as project_status
        FROM web_deployments d
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE d.id = ?
    """, (deployment_id,))
    updated = await cursor.fetchone()
    return format_deployment_dict(updated)


@router.delete("/{deployment_id}")
async def delete_deployment(
    deployment_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """Delete a deployment and free up subdomain and quota."""
    cursor = await db.execute(
        "SELECT id FROM web_deployments WHERE id = ? AND user_id = ?",
        (deployment_id, current_user["id"])
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Deployment tidak ditemukan.")

    await db.execute("DELETE FROM web_deployments WHERE id = ?", (deployment_id,))
    await db.commit()

    return {"success": True, "message": "Deployment publik berhasil dihapus."}
