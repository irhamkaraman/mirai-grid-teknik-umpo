import os
import json
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
import aiosqlite
from app.core.config import settings
from app.core.database import get_db
from app.core.security import encrypt_secret, decrypt_secret
from app.models.schemas import ProjectCreate, ProjectResponse
from app.services.zip_handler import safe_extract_zip
from app.services.template_composer import TemplateComposer
from app.services.portainer import portainer
from app.api.deps import get_current_user, get_client_ip

router = APIRouter(prefix="/projects", tags=["Projects"])

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
    <p>Silakan upload file .ZIP kode praktikum Anda melalui dashboard untuk memperbarui website ini.</p>
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
      <p style="color:#A47454;font-size:12px">Upload your ZIP to deploy your custom app.</p>
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
      <p style="color:#A47454;font-size:12px">Upload your ZIP to deploy your custom app.</p>
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

    # Quota check
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

@router.post("/{project_id}/upload-and-deploy")
async def upload_and_deploy(
    project_id: int,
    request: Request,
    file: UploadFile = File(...),
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

    # 1. Save uploaded zip temporarily
    temp_zip_path = os.path.join(settings.UPLOADS_DIR, f"{nim}_{project_name}.zip")
    with open(temp_zip_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # 2. Extract with anti-zip-slip protection
    success, message = safe_extract_zip(temp_zip_path, local_project_dir)
    try:
        os.remove(temp_zip_path)
    except Exception:
        pass

    if not success:
        raise HTTPException(status_code=400, detail=f"Gagal memproses file ZIP: {message}")

    # 3. Get student quotas
    q_cur = await db.execute("SELECT * FROM quotas WHERE user_id = ?", (current_user["id"],))
    quota = await q_cur.fetchone()
    mem_limit = quota["max_memory_mb"] if quota else 256
    cpus = quota["max_cpu_cores"] if quota else 0.5

    # 4. Generate secure Docker Compose file with HOST volume path
    env_vars = json.loads(decrypt_secret(project["env_vars_enc"])) if project["env_vars_enc"] else {}
    compose_yaml = TemplateComposer.generate_compose(
        nim=nim,
        project_name=project_name,
        template_type=project["template_type"],
        project_src_dir=host_project_dir,
        allocated_port=project["allocated_port"],
        env_vars=env_vars,
        mem_limit_mb=mem_limit,
        cpu_cores=cpus
    )

    # 5. Deploy / Redeploy via Portainer REST API
    stack_name = f"miraigrid_{nim}_{project_name}"
    if project["portainer_stack_id"]:
        try:
            await portainer.delete_stack(project["portainer_stack_id"])
        except Exception:
            pass

    deploy_res = await portainer.create_standalone_stack(stack_name, compose_yaml)
    if not deploy_res.get("success"):
        await db.execute("UPDATE projects SET status = 'error' WHERE id = ?", (project_id,))
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Portainer Deploy Error: {deploy_res.get('error')}")

    stack_id = deploy_res["data"]["Id"]
    await db.execute("""
        UPDATE projects
        SET portainer_stack_id = ?, status = 'running', last_deployed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (stack_id, project_id))

    ip = get_client_ip(request)
    await db.execute("""
        INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
        VALUES (?, 'DEPLOY_PROJECT', ?, ?, ?)
    """, (current_user["id"], project_name, ip, f"Uploaded code and redeployed stack {stack_name} (Portainer ID: {stack_id})"))
    await db.commit()

    return {
        "success": True,
        "message": "Kode aplikasi berhasil di-upload dan di-deploy!",
        "access_url": f"http://{settings.BASE_DOMAIN}:{project['allocated_port']}"
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
        raise HTTPException(status_code=400, detail="Project atau stack Portainer belum tersedia. Silakan klik 'Upload ZIP' terlebih dahulu.")

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

@router.get("/{project_id}/logs")
async def get_project_logs(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, current_user["id"]))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    if not project["portainer_stack_id"]:
        return {
            "container": f"app_{current_user['username']}_{project['name']}",
            "logs": "Container belum di-deploy. Silakan upload file .ZIP aplikasi Anda untuk menjalankan container."
        }

    container_name = f"app_{current_user['username']}_{project['name']}"
    logs = await portainer.get_container_logs(container_name, tail=150)
    return {"container": container_name, "logs": logs}

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

    # 1. Delete Portainer stack
    if project["portainer_stack_id"]:
        try:
            await portainer.delete_stack(project["portainer_stack_id"])
        except Exception:
            pass

    # 2. Remove project workspace directory
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
