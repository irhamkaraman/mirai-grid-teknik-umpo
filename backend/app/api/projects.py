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

# Request bodies
class FileSaveRequest(BaseModel):
    path: str
    content: str

class FileNewRequest(BaseModel):
    path: str
    name: str
    is_dir: bool = False

class ConsoleExecRequest(BaseModel):
    command: str = "/bin/sh"
    user: str = "root"
    stdin_input: Optional[str] = None

class ProjectConfigUpdate(BaseModel):
    app_config: Dict[str, Any]
    env_vars: Optional[Dict[str, str]] = None

async def get_next_available_port(db: aiosqlite.Connection) -> int:
    cursor = await db.execute("SELECT MAX(allocated_port) FROM projects")
    row = await cursor.fetchone()
    max_port = row[0] if row and row[0] else 10000
    return max(10001, max_port + 1)

def write_starter_template(language: str, version: str, project_dir: str, project_name: str, app_config: Optional[Dict[str, Any]] = None):
    os.makedirs(project_dir, exist_ok=True)
    cfg = app_config or {}

    # 1. PHP Starter & php.ini
    if language == "php":
        directives = cfg.get("directives", {
            "display_errors": "Off",
            "error_log": "error_log",
            "log_errors": "On",
            "max_execution_time": 60,
            "max_input_time": 60,
            "max_input_vars": 1000,
            "memory_limit": "256M",
            "post_max_size": "128M",
            "upload_max_filesize": "128M",
            "session.gc_maxlifetime": 1440,
            "zlib.output_compression": "Off"
        })
        ini_content = TemplateComposer.generate_php_ini_content(directives)
        with open(os.path.join(project_dir, ".miraigrid_php.ini"), "w", encoding="utf-8") as f:
            f.write(ini_content)

        index_php = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>{project_name} — MiraiGrid Lab TI</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #E6D7BE; color: #26160F; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }}
    .card {{ background: #2B1810; color: #FAF5EC; border-radius: 28px; padding: 40px; max-width: 540px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); text-align: center; }}
    h1 {{ margin: 0 0 10px 0; font-size: 26px; font-family: serif; color: #FAF5EC; }}
    p {{ color: #DFCDB5; font-size: 14px; line-height: 1.6; margin: 10px 0; }}
    .badge {{ display: inline-block; background: #C49767; color: #2B1810; padding: 4px 14px; border-radius: 99px; font-size: 11px; font-weight: bold; margin-bottom: 14px; }}
    .info {{ background: #1C0F0A; padding: 12px; border-radius: 14px; font-size: 12px; font-family: monospace; color: #E8DCB8; margin-top: 20px; }}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">PHP {version} • RUNNING</span>
    <h1>{project_name}</h1>
    <p>Aplikasi PHP {version} Anda telah aktif di container terisolasi MiraiGrid Lab TI UMPO.</p>
    <p>Gunakan File Manager untuk mengedit file secara langsung atau meng-upload kode praktikum.</p>
    <div class="info">PHP Version: <?php echo phpversion(); ?> | Server: <?php echo $_SERVER['HTTP_HOST']; ?></div>
  </div>
</body>
</html>"""
        with open(os.path.join(project_dir, "index.php"), "w", encoding="utf-8") as f:
            f.write(index_php)

    # 2. Python Starter (Instant zero-delay HTTP Server)
    elif language == "python":
        startup_file = cfg.get("startup_file", "app.py")
        content = f"""from http.server import HTTPServer, BaseHTTPRequestHandler
import sys

class SimpleHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        html = f'''<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>{project_name} — Python {version}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #E6D7BE; color: #26160F; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }}
    .card {{ background: #2B1810; color: #FAF5EC; border-radius: 28px; padding: 40px; max-width: 540px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); text-align: center; }}
    h1 {{ margin: 0 0 10px 0; font-size: 26px; font-family: serif; color: #FAF5EC; }}
    p {{ color: #DFCDB5; font-size: 14px; line-height: 1.6; margin: 10px 0; }}
    .badge {{ display: inline-block; background: #C49767; color: #2B1810; padding: 4px 14px; border-radius: 99px; font-size: 11px; font-weight: bold; margin-bottom: 14px; }}
    .info {{ background: #1C0F0A; padding: 12px; border-radius: 14px; font-size: 12px; font-family: monospace; color: #E8DCB8; margin-top: 20px; }}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">PYTHON {version} • RUNNING</span>
    <h1>{project_name}</h1>
    <p>Aplikasi Python {version} Anda telah aktif di container terisolasi MiraiGrid Lab TI UMPO.</p>
    <p>Gunakan menu Konfigurasi untuk mengatur startup file atau klik 'Run Pip Install'.</p>
    <div class="info">Python Version: {{sys.version.split()[0]}}</div>
  </div>
</body>
</html>'''
        self.wfile.write(html.encode('utf-8'))

if __name__ == '__main__':
    print("Serving on port 80...")
    HTTPServer(('0.0.0.0', 80), SimpleHandler).serve_forever()
"""
        with open(os.path.join(project_dir, startup_file), "w", encoding="utf-8") as f:
            f.write(content)

        with open(os.path.join(project_dir, "requirements.txt"), "w", encoding="utf-8") as f:
            f.write("# Tuliskan dependensi pip di sini (e.g. flask, requests, pandas)\n")

    # 3. Node.js Starter (Instant zero-delay HTTP Server)
    elif language == "node":
        startup_file = cfg.get("startup_file", "server.js")
        content = f"""const http = require('http');

const server = http.createServer((req, res) => {{
  res.writeHead(200, {{ 'Content-Type': 'text/html; charset=utf-8' }});
  res.end(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>{project_name} — Node.js {version}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #E6D7BE; color: #26160F; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }}
    .card {{ background: #2B1810; color: #FAF5EC; border-radius: 28px; padding: 40px; max-width: 540px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); text-align: center; }}
    h1 {{ margin: 0 0 10px 0; font-size: 26px; font-family: serif; color: #FAF5EC; }}
    p {{ color: #DFCDB5; font-size: 14px; line-height: 1.6; margin: 10px 0; }}
    .badge {{ display: inline-block; background: #C49767; color: #2B1810; padding: 4px 14px; border-radius: 99px; font-size: 11px; font-weight: bold; margin-bottom: 14px; }}
    .info {{ background: #1C0F0A; padding: 12px; border-radius: 14px; font-size: 12px; font-family: monospace; color: #E8DCB8; margin-top: 20px; }}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">NODE.JS {version} • RUNNING</span>
    <h1>{project_name}</h1>
    <p>Aplikasi Node.js {version} Anda telah aktif di container terisolasi MiraiGrid Lab TI UMPO.</p>
    <p>Gunakan menu Konfigurasi untuk mengatur startup file atau klik 'Run NPM Install'.</p>
    <div class="info">Node Version: ${{process.version}}</div>
  </div>
</body>
</html>`);
}});

server.listen(80, '0.0.0.0', () => {{
  console.log('Node.js server listening on port 80');
}});
"""
        with open(os.path.join(project_dir, startup_file), "w", encoding="utf-8") as f:
            f.write(content)

        pkg_json = {
            "name": project_name,
            "version": "1.0.0",
            "main": startup_file,
            "scripts": {
                "start": f"node {startup_file}"
            }
        }
        with open(os.path.join(project_dir, "package.json"), "w", encoding="utf-8") as f:
            f.write(json.dumps(pkg_json, indent=2))

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
        app_cfg = json.loads(r["config_json"]) if ("config_json" in r.keys() and r["config_json"]) else {}

        # Derive language & version
        tmpl = r["template_type"]
        if tmpl.startswith("php"):
            lang = "php"
            v = tmpl.replace("php", "")
            ver = f"{v[0]}.{v[1:]}" if len(v) >= 2 else "8.2"
        elif tmpl.startswith("python"):
            lang = "python"
            v = tmpl.replace("python", "")
            ver = f"{v[0]}.{v[1:]}" if len(v) >= 2 else "3.11"
        elif tmpl.startswith("node"):
            lang = "node"
            ver = tmpl.replace("node", "") or "20"
        else:
            lang = "php"
            ver = "8.2"

        access_url = f"http://{settings.BASE_DOMAIN}:{r['allocated_port']}"
        results.append({
            "id": r["id"],
            "name": r["name"],
            "subdomain": r["subdomain"],
            "template_type": r["template_type"],
            "language": lang,
            "version": ver,
            "app_config": app_cfg,
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

    # Determine template_type slug
    clean_ver = body.version.replace(".", "")
    template_type = f"{body.language}{clean_ver}"

    # 1. Write starter template in container local projects dir
    local_project_dir = os.path.join(settings.PROJECTS_DIR, f"{nim}_{body.name}")
    write_starter_template(body.language, body.version, local_project_dir, body.name, body.app_config)

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
        language=body.language,
        version=body.version,
        project_src_dir=host_project_dir,
        allocated_port=allocated_port,
        app_config=body.app_config or {},
        env_vars=body.env_vars or {},
        mem_limit_mb=mem_limit,
        cpu_cores=cpus
    )

    # 5. Deploy immediately via Portainer API
    stack_name = f"miraigrid_{nim}_{body.name}"
    deploy_res = await portainer.create_standalone_stack(stack_name, compose_yaml)
    stack_id = deploy_res["data"]["Id"] if deploy_res.get("success") else None
    status = "running" if stack_id else "error"

    config_json_str = json.dumps(body.app_config or {})

    cursor = await db.execute("""
        INSERT INTO projects (user_id, name, subdomain, template_type, allocated_port, portainer_stack_id, status, env_vars_enc, config_json, source_type, git_url, last_deployed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    """, (
        current_user["id"],
        body.name,
        subdomain,
        template_type,
        allocated_port,
        stack_id,
        status,
        encrypted_env,
        config_json_str,
        "git" if body.git_url else "zip",
        body.git_url
    ))
    project_id = cursor.lastrowid

    # Audit log
    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'CREATE_PROJECT', ?, ?, ?)
    """, (current_user["id"], body.name, ip, f"Created {body.language} {body.version} project (Stack ID: {stack_id})"))
    await db.commit()

    return {
        "id": project_id,
        "name": body.name,
        "subdomain": subdomain,
        "template_type": template_type,
        "language": body.language,
        "version": body.version,
        "app_config": body.app_config,
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

@router.post("/{project_id}/config")
async def update_project_config(
    project_id: int,
    body: ProjectConfigUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """Updates language/engine configuration and redeploys container with new settings."""
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    project_name = project["name"]
    local_project_dir = os.path.join(settings.PROJECTS_DIR, f"{nim}_{project_name}")
    host_project_dir = os.path.join(settings.HOST_PROJECTS_DIR, f"{nim}_{project_name}").replace("\\", "/")

    # Derive language & version
    tmpl = project["template_type"]
    if tmpl.startswith("php"):
        lang = "php"
        v = tmpl.replace("php", "")
        ver = f"{v[0]}.{v[1:]}" if len(v) >= 2 else "8.2"
        # If PHP, update php.ini immediately
        directives = body.app_config.get("directives", {})
        ini_content = TemplateComposer.generate_php_ini_content(directives)
        with open(os.path.join(local_project_dir, ".miraigrid_php.ini"), "w", encoding="utf-8") as f:
            f.write(ini_content)
    elif tmpl.startswith("python"):
        lang = "python"
        v = tmpl.replace("python", "")
        ver = f"{v[0]}.{v[1:]}" if len(v) >= 2 else "3.11"
    elif tmpl.startswith("node"):
        lang = "node"
        ver = tmpl.replace("node", "") or "20"
    else:
        lang = "php"
        ver = "8.2"

    q_cur = await db.execute("SELECT * FROM quotas WHERE user_id = ?", (current_user["id"],))
    quota = await q_cur.fetchone()
    mem_limit = quota["max_memory_mb"] if quota else 256
    cpus = quota["max_cpu_cores"] if quota else 0.5

    env_vars = body.env_vars or (json.loads(decrypt_secret(project["env_vars_enc"])) if project["env_vars_enc"] else {})
    encrypted_env = encrypt_secret(json.dumps(env_vars))
    config_json_str = json.dumps(body.app_config)

    compose_yaml = TemplateComposer.generate_compose(
        nim=nim,
        project_name=project_name,
        language=lang,
        version=ver,
        project_src_dir=host_project_dir,
        allocated_port=project["allocated_port"],
        app_config=body.app_config,
        env_vars=env_vars,
        mem_limit_mb=mem_limit,
        cpu_cores=cpus
    )

    stack_name = f"miraigrid_{nim}_{project_name}"
    if project["portainer_stack_id"]:
        try:
            await portainer.delete_stack(project["portainer_stack_id"])
        except Exception:
            pass

    deploy_res = await portainer.create_standalone_stack(stack_name, compose_yaml)
    stack_id = deploy_res["data"]["Id"] if deploy_res.get("success") else None

    await db.execute("""
        UPDATE projects
        SET portainer_stack_id = ?, config_json = ?, env_vars_enc = ?, status = 'running', last_deployed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (stack_id, config_json_str, encrypted_env, project_id))
    await db.commit()

    return {"success": True, "message": "Konfigurasi engine berhasil disimpan dan container di-restart!"}

@router.post("/{project_id}/pip-install")
async def run_pip_install(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """Executes pip install -r requirements.txt inside Python container."""
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project or not project["portainer_stack_id"]:
        raise HTTPException(status_code=400, detail="Container tidak tersedia.")

    container_name = f"app_{current_user['username']}_{project['name']}"
    res = await portainer.exec_container_command(
        container_name=container_name,
        cmd=["sh", "-c", "pip install -r requirements.txt"],
        user="root"
    )
    return res

@router.post("/{project_id}/npm-install")
async def run_npm_install(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """Executes npm install inside Node.js container."""
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project or not project["portainer_stack_id"]:
        raise HTTPException(status_code=400, detail="Container tidak tersedia.")

    container_name = f"app_{current_user['username']}_{project['name']}"
    res = await portainer.exec_container_command(
        container_name=container_name,
        cmd=["sh", "-c", "npm install"],
        user="root"
    )
    return res

@router.post("/{project_id}/control")
async def control_project(
    project_id: int,
    action: str,
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
# FILE MANAGER ENDPOINTS
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
# CONTAINER CONSOLE
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
