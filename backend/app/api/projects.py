import os
import json
import shutil
import pathlib
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, Query
from pydantic import BaseModel, Field
import aiosqlite
from app.core.config import settings
from app.core.database import get_db
from app.core.security import encrypt_secret, decrypt_secret
from app.models.schemas import ProjectCreate, ProjectResponse
from app.services.zip_handler import safe_extract_zip
from app.services.template_composer import TemplateComposer
from app.services.portainer import portainer
from app.services.file_manager import get_safe_project_path, list_directory_contents
from app.api.deps import get_current_user, get_client_ip

router = APIRouter(prefix="/projects", tags=["Projects"])

# Request bodies for file manager & console
class FileSaveRequest(BaseModel):
    path: str
    content: str

class FileNewRequest(BaseModel):
    path: str # parent dir or relative path
    name: str
    is_dir: bool = False

class ConsoleExecRequest(BaseModel):
    command: str = "/bin/sh" # or /bin/bash or custom
    user: str = "root"
    stdin_input: Optional[str] = None

async def get_next_available_port(db: aiosqlite.Connection) -> int:
    cursor = await db.execute("SELECT MAX(allocated_port) FROM projects")
    row = await cursor.fetchone()
    max_port = row[0] if row and row[0] else 10000
    return max(10001, max_port + 1)

def write_starter_template(template_type: str, project_dir: str, project_name: str):
    os.makedirs(project_dir, exist_ok=True)
    if template_type == "php82":
        content = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>{project_name} — MiraiGrid Lab TI</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F5EFE6; color: #23160F; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }}
    .card {{ background: #23160F; color: #FAF8F5; border-radius: 28px; padding: 40px; max-width: 540px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); text-align: center; }}
    h1 {{ margin: 0 0 10px 0; font-size: 26px; font-family: serif; color: #F5EFE6; }}
    p {{ color: #DFC6AF; font-size: 14px; line-height: 1.6; margin: 10px 0; }}
    .badge {{ display: inline-block; background: #D97757; color: #fff; padding: 4px 14px; border-radius: 99px; font-size: 11px; font-weight: bold; margin-bottom: 14px; }}
    .info {{ background: #180D07; padding: 12px; border-radius: 14px; font-size: 12px; font-family: monospace; color: #CEAA8D; margin-top: 20px; }}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">PHP 8.2 • ACTIVE</span>
    <h1>{project_name}</h1>
    <p>Aplikasi web Anda telah berhasil online di server container terisolasi MiraiGrid Lab TI UMPO.</p>
    <p>Gunakan File Manager untuk mengedit file secara langsung atau meng-upload kode praktikum.</p>
    <div class="info">PHP Version: <?php echo phpversion(); ?> | Server: <?php echo $_SERVER['HTTP_HOST']; ?></div>
  </div>
</body>
</html>"""
        with open(os.path.join(project_dir, "index.php"), "w", encoding="utf-8") as f:
            f.write(content)

    elif template_type == "python311":
        content = f"""from flask import Flask
app = Flask(__name__)

@app.route('/')
def home():
    return '''<!DOCTYPE html><html><body style="font-family:sans-serif;background:#F5EFE6;color:#23160F;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
    <div style="background:#23160F;color:#fff;padding:40px;border-radius:24px;text-align:center">
      <h1 style="color:#F5EFE6">{project_name}</h1>
      <p style="color:#DFC6AF">Python 3.11 Starter is Running!</p>
      <p style="color:#A47454;font-size:12px">Edit files via File Manager or upload code.</p>
    </div></body></html>'''

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)
"""
        with open(os.path.join(project_dir, "app.py"), "w", encoding="utf-8") as f:
            f.write(content)

    elif template_type == "node20":
        content = f"""const http = require('http');
const server = http.createServer((req, res) => {{
  res.writeHead(200, {{'Content-Type': 'text/html'}});
  res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#F5EFE6;color:#23160F;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
    <div style="background:#23160F;color:#fff;padding:40px;border-radius:24px;text-align:center">
      <h1 style="color:#F5EFE6">{project_name}</h1>
      <p style="color:#DFC6AF">Node.js 20 Starter is Running!</p>
      <p style="color:#A47454;font-size:12px">Edit files via File Manager or upload code.</p>
    </div></body></html>`);
}});
server.listen(80, '0.0.0.0');
"""
        with open(os.path.join(project_dir, "index.js"), "w", encoding="utf-8") as f:
            f.write(content)

    else:
        content = f"""<!DOCTYPE html>
<html>
<head><title>{project_name} — MiraiGrid</title></head>
<body style="font-family:sans-serif;background:#F5EFE6;color:#23160F;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="background:#23160F;color:#fff;padding:40px;border-radius:24px;text-align:center">
    <h1 style="color:#F5EFE6">{project_name}</h1>
    <p style="color:#DFC6AF">Static Web Site is Running!</p>
  </div>
</body>
</html>"""
        with open(os.path.join(project_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(content)

@router.get("", response_model=List[ProjectResponse])
async def list_my_projects(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("""
        SELECT * FROM projects
        WHERE user_id = ?
        ORDER BY created_at DESC
    """, (current_user["id"],))
    rows = await cursor.fetchall()
    results = []
    for r in rows:
        env_vars = json.loads(decrypt_secret(r["env_vars_enc"])) if r["env_vars_enc"] else {}
        access_url = f"http://{settings.BASE_DOMAIN}:{r['allocated_port']}"
        results.append({
            "id": r["id"],
            "name": r["name"],
            "subdomain": r["subdomain"],
            "template_type": r["template_type"],
            "portainer_stack_id": r["portainer_stack_id"],
            "allocated_port": r["allocated_port"],
            "status": r["status"],
            "env_vars": env_vars,
            "source_type": r["source_type"],
            "git_url": r["git_url"],
            "access_url": access_url,
            "last_deployed_at": r["last_deployed_at"] or "Baru dibuat",
            "created_at": r["created_at"]
        })
    return results

@router.post("/create", response_model=ProjectResponse)
async def create_project(
    body: ProjectCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    nim = current_user["username"]
    subdomain = f"{body.name}-{nim}.{settings.BASE_DOMAIN}"

    # Quota check (Students are constrained, Admin has unlimited)
    if current_user.get("role") != "admin":
        cursor = await db.execute("SELECT max_projects FROM quotas WHERE user_id = ?", (current_user["id"],))
        quota_row = await cursor.fetchone()
        max_projects = quota_row["max_projects"] if quota_row else 2

        c_cur = await db.execute("SELECT COUNT(*) FROM projects WHERE user_id = ?", (current_user["id"],))
        used_projects = (await c_cur.fetchone())[0]

        if used_projects >= max_projects:
            raise HTTPException(status_code=400, detail=f"Batas kuota project tercapai (Maksimal: {max_projects} project).")

    # Check unique name per user
    existing = await (await db.execute("SELECT id FROM projects WHERE user_id = ? AND name = ?", (current_user["id"], body.name))).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Nama project sudah digunakan untuk akun Anda.")

    allocated_port = await get_next_available_port(db)
    encrypted_env = encrypt_secret(json.dumps(body.env_vars or {}))

    # 1. Write starter template in container local projects dir
    local_project_dir = os.path.join(settings.PROJECTS_DIR, f"{nim}_{body.name}")
    write_starter_template(body.template_type, local_project_dir, body.name)

    # 2. Compute Host Path for Docker volume mount
    host_project_dir = os.path.join(settings.HOST_PROJECTS_DIR, f"{nim}_{body.name}").replace("\\", "/")

    # 3. Get quotas
    q_cur = await db.execute("SELECT * FROM quotas WHERE user_id = ?", (current_user["id"],))
    quota = await q_cur.fetchone()
    mem_limit = quota["max_memory_mb"] if quota else 256
    cpus = quota["max_cpu_cores"] if quota else 0.5

    # 4. Generate Compose with Host Volume Mount
    compose_yaml = TemplateComposer.generate_compose(
        nim=nim,
        project_name=body.name,
        template_type=body.template_type,
        project_src_dir=host_project_dir,
        allocated_port=allocated_port,
        env_vars=body.env_vars or {},
        mem_limit_mb=mem_limit,
        cpu_cores=cpus
    )

    # 5. Deploy immediately via Portainer API
    stack_name = f"miraigrid_{nim}_{body.name}"
    deploy_res = await portainer.create_standalone_stack(stack_name, compose_yaml)
    stack_id = deploy_res["data"]["Id"] if deploy_res.get("success") else None
    status = "running" if stack_id else "error"

    cursor = await db.execute("""
        INSERT INTO projects (user_id, name, subdomain, template_type, allocated_port, portainer_stack_id, status, env_vars_enc, source_type, git_url, last_deployed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    """, (
        current_user["id"],
        body.name,
        subdomain,
        body.template_type,
        allocated_port,
        stack_id,
        status,
        encrypted_env,
        "git" if body.git_url else "zip",
        body.git_url
    ))
    project_id = cursor.lastrowid

    # Audit log
    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'CREATE_PROJECT', ?, ?, ?)
    """, (current_user["id"], body.name, ip, f"Created & deployed {body.template_type} project (Stack ID: {stack_id})"))
    await db.commit()

    return {
        "id": project_id,
        "name": body.name,
        "subdomain": subdomain,
        "template_type": body.template_type,
        "portainer_stack_id": stack_id,
        "allocated_port": allocated_port,
        "status": status,
        "env_vars": body.env_vars,
        "source_type": "git" if body.git_url else "zip",
        "git_url": body.git_url,
        "access_url": f"http://{settings.BASE_DOMAIN}:{allocated_port}",
        "last_deployed_at": "Baru saja",
        "created_at": "Baru saja"
    }

@router.post("/{project_id}/control")
async def control_project(
    project_id: int,
    action: str, # 'start', 'stop', 'restart'
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project or not project["portainer_stack_id"]:
        raise HTTPException(status_code=400, detail="Project atau stack Portainer belum tersedia.")

    stack_id = project["portainer_stack_id"]
    if action == "stop":
        ok = await portainer.stop_stack(stack_id)
        new_status = "stopped"
    elif action == "start":
        ok = await portainer.start_stack(stack_id)
        new_status = "running"
    elif action == "restart":
        await portainer.stop_stack(stack_id)
        ok = await portainer.start_stack(stack_id)
        new_status = "running"
    else:
        raise HTTPException(status_code=400, detail="Action tidak valid.")

    if not ok:
        raise HTTPException(status_code=500, detail=f"Gagal melakukan {action} pada container.")

    await db.execute("UPDATE projects SET status = ? WHERE id = ?", (new_status, project_id))
    await db.commit()
    return {"success": True, "status": new_status}

@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    if project["portainer_stack_id"]:
        try:
            await portainer.delete_stack(project["portainer_stack_id"])
        except Exception:
            pass

    nim = current_user["username"]
    project_dir = os.path.join(settings.PROJECTS_DIR, f"{nim}_{project['name']}")
    if os.path.exists(project_dir):
        try:
            shutil.rmtree(project_dir)
        except Exception:
            pass

    await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'DELETE_PROJECT', ?, ?, 'Deleted project and stack')
    """, (current_user["id"], project["name"], ip))
    await db.commit()

    return {"success": True, "message": "Project berhasil dihapus."}

# ==========================================
# FILE MANAGER ENDPOINTS (Sanitized Sandbox)
# ==========================================
@router.get("/{project_id}/files")
async def get_project_files(
    project_id: int,
    path: str = Query("", description="Subdirectory path within project"),
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    try:
        project_root = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"])
        target_dir = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], path)
        items = list_directory_contents(target_dir, project_root)
        clean_current_path = os.path.relpath(target_dir, project_root).replace("\\", "/")
        if clean_current_path == ".":
            clean_current_path = ""
        return {
            "current_path": clean_current_path,
            "items": items
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{project_id}/files/content")
async def get_file_content(
    project_id: int,
    path: str = Query(..., description="File path relative to project root"),
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    try:
        file_path = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], path)
        if not os.path.exists(file_path) or os.path.isdir(file_path):
            raise HTTPException(status_code=404, detail="File tidak ditemukan.")

        # Limit editable file size (max 2MB for browser editor)
        if os.path.getsize(file_path) > 2 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File terlalu besar untuk dibuka di web editor (Maksimal 2MB).")

        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        return {"path": path, "content": content}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{project_id}/files/save")
async def save_file_content(
    project_id: int,
    body: FileSaveRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    try:
        file_path = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], body.path)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(body.content)
        return {"success": True, "message": "File berhasil disimpan."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{project_id}/files/new")
async def create_new_file_or_dir(
    project_id: int,
    body: FileNewRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    try:
        parent_dir = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], body.path)
        target_path = os.path.join(parent_dir, body.name)
        # Verify target is still in safe boundary
        get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], os.path.relpath(target_path, os.path.join(settings.PROJECTS_DIR, f"{nim}_{project['name']}")))

        if body.is_dir:
            os.makedirs(target_path, exist_ok=True)
        else:
            with open(target_path, "w", encoding="utf-8") as f:
                f.write("")
        return {"success": True, "message": f"{'Folder' if body.is_dir else 'File'} berhasil dibuat."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{project_id}/files/upload")
async def upload_files_to_directory(
    project_id: int,
    path: str = Form(""),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    try:
        target_dir = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], path)
        temp_dest = os.path.join(target_dir, file.filename)

        # If it's a zip file, offer auto-extract
        if file.filename.lower().endswith(".zip"):
            with open(temp_dest, "wb") as f:
                shutil.copyfileobj(file.file, f)
            success, msg = safe_extract_zip(temp_dest, target_dir)
            try:
                os.remove(temp_dest)
            except Exception:
                pass
            if not success:
                raise HTTPException(status_code=400, detail=f"Gagal ekstrak zip: {msg}")
            return {"success": True, "message": "File ZIP berhasil diekstrak ke folder ini."}
        else:
            with open(temp_dest, "wb") as f:
                shutil.copyfileobj(file.file, f)
            return {"success": True, "message": f"File '{file.filename}' berhasil di-upload."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{project_id}/files")
async def delete_file_or_dir(
    project_id: int,
    path: str = Query(..., description="Path to delete"),
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    try:
        target = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], path)
        if not os.path.exists(target):
            raise HTTPException(status_code=404, detail="File atau folder tidak ditemukan.")

        if os.path.isdir(target):
            shutil.rmtree(target)
        else:
            os.remove(target)
        return {"success": True, "message": "Item berhasil dihapus."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==========================================
# CONTAINER CONSOLE (Portainer-Style Exec)
# ==========================================
@router.post("/{project_id}/console/exec")
async def execute_console_command(
    project_id: int,
    body: ConsoleExecRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project or not project["portainer_stack_id"]:
        raise HTTPException(status_code=400, detail="Project belum di-deploy atau container tidak tersedia.")

    container_name = f"app_{current_user['username']}_{project['name']}"

    # Build command list
    command_str = body.command.strip()
    if body.stdin_input:
        full_cmd = [command_str, "-c", body.stdin_input]
    else:
        full_cmd = [command_str]

    res = await portainer.exec_container_command(
        container_name=container_name,
        cmd=full_cmd,
        user=body.user or "root"
    )

    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error"))

    return {
        "success": True,
        "container": container_name,
        "command": command_str,
        "user": body.user or "root",
        "output": res.get("output", "")
    }
