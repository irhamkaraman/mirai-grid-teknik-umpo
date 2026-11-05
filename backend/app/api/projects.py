import os
import json
import shutil
import pathlib
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import aiosqlite
from app.core.config import settings
from app.core.database import get_db
from app.core.security import encrypt_secret, decrypt_secret
from app.models.schemas import ProjectCreate, ProjectResponse
from app.services.zip_handler import safe_extract_zip
from app.services.template_composer import TemplateComposer
from app.services.portainer import portainer
from app.services.file_manager import (
    get_safe_project_path, list_directory_contents,
    get_directory_tree, compress_items_to_zip, extract_zip_archive
)
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

class FileRenameRequest(BaseModel):
    old_path: str
    new_name: str

class FileCopyMoveRequest(BaseModel):
    source_path: str
    dest_dir: str

class FilePermissionRequest(BaseModel):
    path: str
    permissions: str # e.g. "0755", "0644"

class FileCompressRequest(BaseModel):
    paths: List[str]
    destination_zip: str

class FileExtractRequest(BaseModel):
    zip_path: str
    extract_to: Optional[str] = ""

class ConsoleExecRequest(BaseModel):
    command: str = "/bin/sh"
    user: str = "root"
    stdin_input: Optional[str] = None

class ProjectConfigUpdate(BaseModel):
    app_config: Dict[str, Any]
    env_vars: Optional[Dict[str, str]] = None

class StartupFileRequest(BaseModel):
    file_path: str

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

    # 2. Python Starter
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

    # 3. Node.js Starter
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

    if current_user.get("role") != "admin":
        cursor = await db.execute("SELECT max_projects FROM quotas WHERE user_id = ?", (current_user["id"],))
        quota_row = await cursor.fetchone()
        max_projects = quota_row["max_projects"] if quota_row else 2

        c_cur = await db.execute("SELECT COUNT(*) FROM projects WHERE user_id = ?", (current_user["id"],))
        used_projects = (await c_cur.fetchone())[0]

        if used_projects >= max_projects:
            raise HTTPException(status_code=400, detail=f"Batas kuota project tercapai (Maksimal: {max_projects} project).")

    existing = await (await db.execute("SELECT id FROM projects WHERE user_id = ? AND name = ?", (current_user["id"], body.name))).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Nama project sudah digunakan untuk akun Anda.")

    allocated_port = await get_next_available_port(db)
    encrypted_env = encrypt_secret(json.dumps(body.env_vars or {}))

    clean_ver = body.version.replace(".", "")
    template_type = f"{body.language}{clean_ver}"

    local_project_dir = os.path.join(settings.PROJECTS_DIR, f"{nim}_{body.name}")
    write_starter_template(body.language, body.version, local_project_dir, body.name, body.app_config)

    host_project_dir = os.path.join(settings.HOST_PROJECTS_DIR, f"{nim}_{body.name}").replace("\\", "/")

    q_cur = await db.execute("SELECT * FROM quotas WHERE user_id = ?", (current_user["id"],))
    quota = await q_cur.fetchone()
    mem_limit = quota["max_memory_mb"] if quota else 256
    cpus = quota["max_cpu_cores"] if quota else 0.5

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
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    project_name = project["name"]
    local_project_dir = os.path.join(settings.PROJECTS_DIR, f"{nim}_{project_name}")
    host_project_dir = os.path.join(settings.HOST_PROJECTS_DIR, f"{nim}_{project_name}").replace("\\", "/")

    tmpl = project["template_type"]
    if tmpl.startswith("php"):
        lang = "php"
        v = tmpl.replace("php", "")
        ver = f"{v[0]}.{v[1:]}" if len(v) >= 2 else "8.2"
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

@router.post("/{project_id}/set-startup-file")
async def set_project_startup_file(
    project_id: int,
    body: StartupFileRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    project_name = project["name"]
    clean_file = body.file_path.strip().lstrip("/\\")

    file_path = get_safe_project_path(settings.PROJECTS_DIR, nim, project_name, clean_file)
    if not os.path.exists(file_path) or os.path.isdir(file_path):
        raise HTTPException(status_code=400, detail="File startup tidak ditemukan di dalam workspace project.")

    app_cfg = json.loads(project["config_json"]) if ("config_json" in project.keys() and project["config_json"]) else {}
    app_cfg["startup_file"] = clean_file
    config_json_str = json.dumps(app_cfg)

    tmpl = project["template_type"]
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

    host_project_dir = os.path.join(settings.HOST_PROJECTS_DIR, f"{nim}_{project_name}").replace("\\", "/")
    q_cur = await db.execute("SELECT * FROM quotas WHERE user_id = ?", (current_user["id"],))
    quota = await q_cur.fetchone()
    mem_limit = quota["max_memory_mb"] if quota else 256
    cpus = quota["max_cpu_cores"] if quota else 0.5
    env_vars = json.loads(decrypt_secret(project["env_vars_enc"])) if project["env_vars_enc"] else {}

    compose_yaml = TemplateComposer.generate_compose(
        nim=nim,
        project_name=project_name,
        language=lang,
        version=ver,
        project_src_dir=host_project_dir,
        allocated_port=project["allocated_port"],
        app_config=app_cfg,
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
        SET portainer_stack_id = ?, config_json = ?, status = 'running', last_deployed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (stack_id, config_json_str, project_id))
    await db.commit()

    return {
        "success": True,
        "message": f"File '{clean_file}' berhasil diatur sebagai Application Startup File!",
        "startup_file": clean_file
    }

@router.post("/{project_id}/pip-install")
async def run_pip_install(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
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

# =========================================================
# CPANEL-STYLE ADVANCED FILE MANAGER ENDPOINTS
# =========================================================
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

@router.get("/{project_id}/files/tree")
async def get_project_files_tree(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """Returns directory tree for cPanel left sidebar."""
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    try:
        project_root = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"])
        tree = get_directory_tree(project_root)
        return {"tree": tree}
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
            raise HTTPException(status_code=400, detail="File terlalu besar untuk dibuka di editor (Maksimal 2MB).")

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
        return {"success": True, "message": f"{'Folder' if body.is_dir else 'File'} '{body.name}' berhasil dibuat."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{project_id}/files/rename")
async def rename_file_or_dir(
    project_id: int,
    body: FileRenameRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    try:
        source_path = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], body.old_path)
        parent_dir = os.path.dirname(source_path)
        dest_path = os.path.join(parent_dir, body.new_name)
        get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], os.path.relpath(dest_path, os.path.join(settings.PROJECTS_DIR, f"{nim}_{project['name']}")))

        os.rename(source_path, dest_path)
        return {"success": True, "message": f"Berhasil diubah menjadi '{body.new_name}'"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{project_id}/files/copy")
async def copy_file_or_dir(
    project_id: int,
    body: FileCopyMoveRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    try:
        source = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], body.source_path)
        dest_dir = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], body.dest_dir)
        dest_target = os.path.join(dest_dir, os.path.basename(source))

        if os.path.isdir(source):
            shutil.copytree(source, dest_target, dirs_exist_ok=True)
        else:
            shutil.copy2(source, dest_target)
        return {"success": True, "message": "Berhasil disalin."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{project_id}/files/move")
async def move_file_or_dir(
    project_id: int,
    body: FileCopyMoveRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    try:
        source = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], body.source_path)
        dest_dir = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], body.dest_dir)
        dest_target = os.path.join(dest_dir, os.path.basename(source))

        shutil.move(source, dest_target)
        return {"success": True, "message": "Berhasil dipindahkan."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{project_id}/files/permissions")
async def change_file_permissions(
    project_id: int,
    body: FilePermissionRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    nim = current_user["username"]
    try:
        target = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], body.path)
        # Parse octal e.g. "0755"
        mode = int(body.permissions, 8)
        os.chmod(target, mode)
        return {"success": True, "message": f"Permissions diubah menjadi {body.permissions}."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{project_id}/files/compress")
async def compress_files(
    project_id: int,
    body: FileCompressRequest,
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
        src_full_paths = [get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], p) for p in body.paths]
        dest_zip = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], body.destination_zip)

        compress_items_to_zip(src_full_paths, dest_zip, project_root)
        return {"success": True, "message": f"Berhasil dikompresi ke '{os.path.basename(dest_zip)}'"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{project_id}/files/extract")
async def extract_archive(
    project_id: int,
    body: FileExtractRequest,
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
        zip_full_path = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], body.zip_path)
        dest_dir = get_safe_project_path(settings.PROJECTS_DIR, nim, project["name"], body.extract_to or "")

        extract_zip_archive(zip_full_path, dest_dir, project_root)
        return {"success": True, "message": f"Arsip ZIP berhasil diekstrak."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{project_id}/files/download")
async def download_file(
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

        return FileResponse(file_path, filename=os.path.basename(file_path))
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

        with open(temp_dest, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # If it's a zip file, extract safely
        if file.filename.lower().endswith(".zip"):
            success, msg = safe_extract_zip(temp_dest, target_dir)
            try:
                os.remove(temp_dest)
            except Exception:
                pass
            if not success:
                raise HTTPException(status_code=400, detail=f"Gagal ekstrak zip: {msg}")
            return {"success": True, "message": "File ZIP berhasil di-upload dan diekstrak."}
        else:
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
