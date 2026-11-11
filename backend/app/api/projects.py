import os
import json
import shutil
import pathlib
import posixpath
import re
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, Query, status
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
from app.api.deps import get_current_user, get_client_ip, get_current_user_flexible, require_onboarding_completed

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
    cwd: Optional[str] = None

def get_project_container_root(project: Any) -> str:
    template_type = ""
    try:
        if isinstance(project, dict):
            template_type = str(project.get("template_type") or project.get("language") or "").lower()
        else:
            try:
                template_type = str(project["template_type"] or "").lower()
            except Exception:
                try:
                    template_type = str(project["language"] or "").lower()
                except Exception:
                    template_type = str(getattr(project, "template_type", getattr(project, "language", "")) or "").lower()
    except Exception:
        template_type = "php"

    cfg_val = None
    for key in ["config_json", "app_config"]:
        try:
            if isinstance(project, dict):
                cfg_val = project.get(key)
            else:
                cfg_val = project[key]
            if cfg_val:
                break
        except Exception:
            continue

    cfg = {}
    if cfg_val:
        try:
            cfg = json.loads(cfg_val) if isinstance(cfg_val, str) else (cfg_val if isinstance(cfg_val, dict) else {})
        except Exception:
            cfg = {}

    app_root = ""
    if isinstance(cfg, dict):
        raw_root = str(cfg.get("app_root_subpath") or cfg.get("app_root") or "").strip()
        if raw_root and not raw_root.startswith("/"):
            app_root = raw_root.strip("/")
        elif cfg.get("app_root_subpath"):
            app_root = str(cfg.get("app_root_subpath")).strip("/")

    if any(k in template_type for k in ["python", "node", "django", "fastapi", "flask", "express"]):
        return f"/app/{app_root}" if app_root else "/app"
    elif any(k in template_type for k in ["php", "laravel", "codeigniter", "wordpress"]):
        return f"/var/www/html/{app_root}" if app_root else "/var/www/html"
    elif any(k in template_type for k in ["static", "html", "nginx"]):
        return f"/usr/share/nginx/html/{app_root}" if app_root else "/usr/share/nginx/html"

    return f"/app/{app_root}" if (app_root or "app" in template_type) else "/var/www/html"

def check_console_command_safety(command_str: str, current_cwd: str, project_root: str) -> tuple[bool, str]:
    norm_root = posixpath.normpath(project_root)
    norm_cwd = posixpath.normpath(current_cwd or project_root)

    # 1. Check relative path escapes
    for token in command_str.split():
        token_clean = token.strip("';&|`\"")
        if token_clean.startswith("..") or "/.." in token_clean:
            if command_str.strip() in ["cd ..", "cd ../", "cd ."]:
                continue
            candidate = posixpath.normpath(posixpath.join(norm_cwd, token_clean))
            if not candidate.startswith(norm_root):
                return False, f"Akses ditolak: Navigasi/referensi di luar direktori project ({norm_root}) tidak diizinkan."

    # 2. Forbidden root system paths
    forbidden_pattern = re.compile(
        r"""(?:^|[\s;|&`'"])/(?:etc|root|boot|proc|sys|dev|mnt|opt|srv|media|home|var(?!/www/html))(?=[/\s;|&'"]|$)""",
        re.IGNORECASE
    )
    if forbidden_pattern.search(command_str):
        return False, f"Akses ditolak: Tidak diizinkan mengakses path sistem di luar folder project ({norm_root})."

    # 3. Forbidden root access like 'ls /' or 'find /'
    root_access_pattern = re.compile(
        r"""(?:^|[\s;|&`'"])(?:ls|dir|find|tree|cat|more|less|tail|head|cp|mv|rm|chmod|chown)\s+/(?=[/\s;|&'"]|$)""",
        re.IGNORECASE
    )
    if root_access_pattern.search(command_str):
        return False, f"Akses ditolak: Tidak diizinkan mengakses direktori root (/) sistem."

    return True, norm_cwd
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

def resolve_app_root_paths(
    current_user: dict,
    project_owner_username: str,
    project_name: str,
    app_root_raw: Optional[str] = None
) -> dict:
    """
    Validasi dan resolusi App Root Directory untuk deployment.
    
    Aturan Keamanan:
    - Mahasiswa (Student):
      * DILARANG traversal (..), null byte (\\0), atau tilde (~).
      * Jika memasukkan path absolut '/', HANYA boleh diawali dengan '/home/{project_owner_username}/{project_name}'.
      * Jalur lokal di host terisolasi ketat di dalam settings.PROJECTS_DIR/{project_owner_username}_{project_name}.
      * Mahasiswa tidak dapat mengakses folder mahasiswa lain, admin, repositori git akun lain, atau direktori root sistem.
    - Administrator:
      * Bebas menggunakan subpath relatif biasa (misal 'public', 'src').
      * Bebas mengarahkan ke Git™ repositories (misal '/home/admin/repositories/{repo_name}').
      * Bebas mengarahkan ke custom directory server di bawah /home/admin/....
    """
    is_admin = current_user.get("role") == "admin"
    raw = (app_root_raw or "").strip()

    # Standard base paths
    standard_local_dir = os.path.realpath(os.path.join(settings.PROJECTS_DIR, f"{project_owner_username}_{project_name}"))
    standard_host_dir = os.path.join(settings.HOST_PROJECTS_DIR, f"{project_owner_username}_{project_name}").replace("\\", "/")
    standard_virtual_prefix = f"/home/{project_owner_username}/{project_name}"

    # Default / Empty case
    if not raw or raw == standard_virtual_prefix or raw == f"{standard_virtual_prefix}/":
        os.makedirs(standard_local_dir, exist_ok=True)
        return {
            "app_root": "",
            "app_root_subpath": "",
            "virtual_path": standard_virtual_prefix,
            "display_app_root": standard_virtual_prefix,
            "local_project_dir": standard_local_dir,
            "host_project_dir": standard_host_dir,
            "is_custom_dir": False,
            "is_git_repo": False
        }

    # If student: STRICT SANDBOX
    if not is_admin:
        if ".." in raw or "\0" in raw or raw.startswith("~"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Akses Ditolak: Karakter traversal '..' dilarang pada Application Root demi keamanan sandbox."
            )

        # Parse subpath flexibly for students (e.g. 'public', '/public', or full path '/home/{nim}/{proj}/public')
        if raw.startswith(standard_virtual_prefix):
            subpath = raw[len(standard_virtual_prefix):].strip("/").replace("\\", "/")
        elif raw.startswith(f"/home/{project_owner_username}"):
            remainder = raw[len(f"/home/{project_owner_username}"):].strip("/").replace("\\", "/")
            if remainder.startswith(f"{project_name}/"):
                subpath = remainder[len(f"{project_name}/"):].strip("/")
            elif remainder == project_name:
                subpath = ""
            else:
                subpath = remainder
        else:
            subpath = raw.strip("/\\").replace("\\", "/")

        os.makedirs(standard_local_dir, exist_ok=True)
        target_local = os.path.realpath(os.path.join(standard_local_dir, subpath)) if subpath else standard_local_dir

        if target_local != standard_local_dir and not target_local.startswith(standard_local_dir + os.sep):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Pelanggaran Keamanan: Direktori root aplikasi berada di luar batas folder project Anda."
            )

        if subpath:
            os.makedirs(target_local, exist_ok=True)

        virtual_path = f"{standard_virtual_prefix}/{subpath}" if subpath else standard_virtual_prefix
        return {
            "app_root": subpath,
            "app_root_subpath": subpath,
            "virtual_path": virtual_path,
            "display_app_root": virtual_path,
            "local_project_dir": standard_local_dir,
            "host_project_dir": standard_host_dir,
            "is_custom_dir": False,
            "is_git_repo": False
        }

    # If admin: Full flexibility
    # 1. Check if points to Git repository: /home/{user}/repositories/{repo_name}
    repo_match = re.match(r"^/home/([^/]+)/repositories/([^/]+)(?:/(.*))?$", raw)
    if repo_match:
        repo_user = repo_match.group(1)
        repo_name = repo_match.group(2)
        repo_subpath = (repo_match.group(3) or "").strip("/").replace("\\", "/")

        local_repo_dir = os.path.realpath(os.path.join(settings.DATA_DIR, "repositories", repo_user, repo_name))
        os.makedirs(local_repo_dir, exist_ok=True)
        if repo_subpath:
            os.makedirs(os.path.join(local_repo_dir, repo_subpath), exist_ok=True)

        host_repo_dir = f"/var/lib/docker/volumes/miraigrid_miraigrid_data/_data/repositories/{repo_user}/{repo_name}"
        virtual_path = raw.rstrip("/")

        return {
            "app_root": virtual_path,
            "app_root_subpath": repo_subpath,
            "virtual_path": virtual_path,
            "display_app_root": virtual_path,
            "local_project_dir": local_repo_dir,
            "host_project_dir": host_repo_dir,
            "is_custom_dir": True,
            "is_git_repo": True
        }

    # 2. Relative subpath for admin (e.g. 'public', 'src')
    if not raw.startswith("/"):
        subpath = raw.strip("/").replace("\\", "/")
        os.makedirs(standard_local_dir, exist_ok=True)
        if subpath:
            os.makedirs(os.path.join(standard_local_dir, subpath), exist_ok=True)

        virtual_path = f"{standard_virtual_prefix}/{subpath}" if subpath else standard_virtual_prefix
        return {
            "app_root": subpath,
            "app_root_subpath": subpath,
            "virtual_path": virtual_path,
            "display_app_root": virtual_path,
            "local_project_dir": standard_local_dir,
            "host_project_dir": standard_host_dir,
            "is_custom_dir": False,
            "is_git_repo": False
        }

    # 3. Custom path under standard prefix for admin
    if raw.startswith(standard_virtual_prefix):
        subpath = raw[len(standard_virtual_prefix):].strip("/").replace("\\", "/")
        os.makedirs(standard_local_dir, exist_ok=True)
        if subpath:
            os.makedirs(os.path.join(standard_local_dir, subpath), exist_ok=True)
        virtual_path = raw.rstrip("/")
        return {
            "app_root": subpath,
            "app_root_subpath": subpath,
            "virtual_path": virtual_path,
            "display_app_root": virtual_path,
            "local_project_dir": standard_local_dir,
            "host_project_dir": standard_host_dir,
            "is_custom_dir": False,
            "is_git_repo": False
        }

    # 4. Other custom path for admin (e.g. /home/admin/custom_dir or arbitrary path)
    clean_rel = raw.lstrip("/")
    local_target = os.path.realpath(os.path.join(settings.DATA_DIR, clean_rel))
    os.makedirs(local_target, exist_ok=True)
    host_target = f"/var/lib/docker/volumes/miraigrid_miraigrid_data/_data/{clean_rel}".replace("\\", "/")
    virtual_path = raw.rstrip("/")

    return {
        "app_root": virtual_path,
        "app_root_subpath": "",
        "virtual_path": virtual_path,
        "display_app_root": virtual_path,
        "local_project_dir": local_target,
        "host_project_dir": host_target,
        "is_custom_dir": True,
        "is_git_repo": False
    }

def write_starter_template(language: str, version: str, project_dir: str, project_name: str, app_config: Optional[Dict[str, Any]] = None):
    os.makedirs(project_dir, exist_ok=True)
    cfg = app_config or {}

    # If the target directory already contains application files, preserve existing code!
    existing_files = os.listdir(project_dir)
    visible_files = [f for f in existing_files if not f.startswith(".")]
    if visible_files:
        if language == "php" and ".miraigrid_php.ini" not in existing_files:
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
        return

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

async def get_project_with_access(project_id: int, current_user: dict, db: aiosqlite.Connection) -> dict:
    """
    Mengambil data project dengan perizinan bertingkat:
    - Admin: Dapat mengakses semua project dari semua mahasiswa/user.
    - Mahasiswa: Hanya dapat mengakses project miliknya sendiri.
    """
    is_admin = current_user.get("role") == "admin"
    if is_admin:
        cursor = await db.execute("""
            SELECT p.*, u.username as owner_username, u.name as owner_name, u.role as owner_role
            FROM projects p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ?
        """, (project_id,))
    else:
        cursor = await db.execute("""
            SELECT p.*, u.username as owner_username, u.name as owner_name, u.role as owner_role
            FROM projects p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ? AND p.user_id = ?
        """, (project_id, current_user["id"]))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")
    return dict(row)

@router.get("", response_model=List[ProjectResponse])
async def list_my_projects(
    current_user: dict = Depends(require_onboarding_completed),
    db: aiosqlite.Connection = Depends(get_db)
):
    is_admin = current_user.get("role") == "admin"
    if is_admin:
        cursor = await db.execute("""
            SELECT p.*, u.username as owner_username, u.name as owner_name, u.role as owner_role
            FROM projects p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
        """)
    else:
        cursor = await db.execute("""
            SELECT p.*, u.username as owner_username, u.name as owner_name, u.role as owner_role
            FROM projects p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC
        """, (current_user["id"],))
    rows = await cursor.fetchall()
    
    # Load all web deployments for mapping
    try:
        dep_cursor = await db.execute("SELECT id, project_id, subdomain, status FROM web_deployments WHERE user_id = ?", (current_user["id"],))
        dep_rows = await dep_cursor.fetchall()
        dep_map = {d["project_id"]: dict(d) for d in dep_rows if d["project_id"]}
    except Exception:
        dep_map = {}

    results = []
    for r in rows:
        env_vars = json.loads(decrypt_secret(r["env_vars_enc"])) if r["env_vars_enc"] else {}
        app_cfg = json.loads(r["config_json"]) if ("config_json" in r.keys() and r["config_json"]) else {}

        owner_usr = r["owner_username"] if "owner_username" in r.keys() else current_user.get("username")
        if isinstance(app_cfg, dict) and "display_app_root" not in app_cfg:
            raw_ar = str(app_cfg.get("app_root") or "").strip()
            if raw_ar.startswith("/"):
                app_cfg["display_app_root"] = raw_ar
            elif raw_ar:
                app_cfg["display_app_root"] = f"/home/{owner_usr}/{r['name']}/{raw_ar.strip('/')}"
            else:
                app_cfg["display_app_root"] = f"/home/{owner_usr}/{r['name']}"

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
        dep = dep_map.get(r["id"])
        public_subdomain = dep["subdomain"] if dep else None
        public_url = f"https://{dep['subdomain']}" if dep else None
        is_published = (dep["status"] == "active") if dep else False
        deployment_id = dep["id"] if dep else None
        deployment_status = dep["status"] if dep else None

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
            "created_at": r["created_at"],
            "owner_username": r["owner_username"] if "owner_username" in r.keys() else current_user.get("username"),
            "owner_name": r["owner_name"] if "owner_name" in r.keys() else current_user.get("name"),
            "public_subdomain": public_subdomain,
            "public_url": public_url,
            "is_published": is_published,
            "deployment_id": deployment_id,
            "deployment_status": deployment_status
        })
    return results

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project_by_id(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    r = await get_project_with_access(project_id, current_user, db)
    env_vars = json.loads(decrypt_secret(r["env_vars_enc"])) if r["env_vars_enc"] else {}
    app_cfg = json.loads(r["config_json"]) if ("config_json" in r.keys() and r["config_json"]) else {}

    owner_usr = r["owner_username"] if "owner_username" in r.keys() else current_user.get("username")
    if isinstance(app_cfg, dict) and "display_app_root" not in app_cfg:
        raw_ar = str(app_cfg.get("app_root") or "").strip()
        if raw_ar.startswith("/"):
            app_cfg["display_app_root"] = raw_ar
        elif raw_ar:
            app_cfg["display_app_root"] = f"/home/{owner_usr}/{r['name']}/{raw_ar.strip('/')}"
        else:
            app_cfg["display_app_root"] = f"/home/{owner_usr}/{r['name']}"

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
    
    try:
        dep_c = await db.execute("SELECT id, subdomain, status FROM web_deployments WHERE project_id = ?", (project_id,))
        dep_r = await dep_c.fetchone()
        public_subdomain = dep_r["subdomain"] if dep_r else None
        public_url = f"https://{dep_r['subdomain']}" if dep_r else None
        is_published = (dep_r["status"] == "active") if dep_r else False
        deployment_id = dep_r["id"] if dep_r else None
        deployment_status = dep_r["status"] if dep_r else None
    except Exception:
        public_subdomain = None
        public_url = None
        is_published = False
        deployment_id = None
        deployment_status = None

    return {
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
        "created_at": r["created_at"],
        "owner_username": r["owner_username"] if "owner_username" in r.keys() else current_user.get("username"),
        "owner_name": r["owner_name"] if "owner_name" in r.keys() else current_user.get("name"),
        "public_subdomain": public_subdomain,
        "public_url": public_url,
        "is_published": is_published,
        "deployment_id": deployment_id,
        "deployment_status": deployment_status
    }

@router.post("/create", response_model=ProjectResponse)
async def create_project(
    body: ProjectCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    nim = current_user["username"]
    subdomain = f"{body.name}-{nim}.{settings.BASE_DOMAIN}"

    # Batasan berbasis kuota storage file manager (bukan batasan slot project)
    if current_user.get("role") != "admin":
        cursor = await db.execute("SELECT max_disk_mb FROM quotas WHERE user_id = ?", (current_user["id"],))
        quota_row = await cursor.fetchone()
        max_disk_mb = quota_row["max_disk_mb"] if (quota_row and quota_row["max_disk_mb"]) else 500

        c_cur = await db.execute("SELECT COUNT(*) FROM projects WHERE user_id = ?", (current_user["id"],))
        c_dbs = await (await db.execute("SELECT COUNT(*) FROM student_databases WHERE user_id = ?", (current_user["id"],))).fetchone()
        used_p = (await c_cur.fetchone())[0]
        used_d = c_dbs[0]
        est_disk = round(14.2 + (used_p * 18.5) + (used_d * 8.6), 1)

        if (est_disk + 18.5) > max_disk_mb:
            raise HTTPException(
                status_code=400,
                detail=f"Batas kuota Storage File Manager penuh ({est_disk} MB dari {max_disk_mb} MB). Silakan bersihkan file/project lama atau hubungi asisten lab."
            )

    existing = await (await db.execute("SELECT id FROM projects WHERE user_id = ? AND name = ?", (current_user["id"], body.name))).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Nama project sudah digunakan untuk akun Anda.")

    allocated_port = await get_next_available_port(db)
    encrypted_env = encrypt_secret(json.dumps(body.env_vars or {}))

    clean_ver = body.version.replace(".", "")
    template_type = f"{body.language}{clean_ver}"

    raw_app_root = (body.app_config or {}).get("app_root")
    path_info = resolve_app_root_paths(
        current_user=current_user,
        project_owner_username=nim,
        project_name=body.name,
        app_root_raw=raw_app_root
    )

    local_project_dir = path_info["local_project_dir"]
    host_project_dir = path_info["host_project_dir"]

    # Only write starter template if the target dir does not exist or has no files
    if not os.path.exists(local_project_dir) or not os.listdir(local_project_dir):
        write_starter_template(body.language, body.version, local_project_dir, body.name, body.app_config)
    elif body.language == "php" and not os.path.exists(os.path.join(local_project_dir, ".miraigrid_php.ini")):
        directives = (body.app_config or {}).get("directives", {})
        ini_content = TemplateComposer.generate_php_ini_content(directives)
        with open(os.path.join(local_project_dir, ".miraigrid_php.ini"), "w", encoding="utf-8") as f:
            f.write(ini_content)

    merged_app_config = dict(body.app_config or {})
    merged_app_config["app_root"] = path_info["app_root"]
    merged_app_config["app_root_subpath"] = path_info["app_root_subpath"]
    merged_app_config["display_app_root"] = path_info["display_app_root"]
    merged_app_config["is_custom_dir"] = path_info["is_custom_dir"]
    if path_info.get("is_git_repo"):
        merged_app_config["is_git_repo"] = True

    q_cur = await db.execute("SELECT * FROM quotas WHERE user_id = ?", (current_user["id"],))
    quota = await q_cur.fetchone()
    mem_limit = quota["max_memory_mb"] if quota else 256
    cpus = quota["max_cpu_cores"] if quota else 0.5
    pids = quota["max_processes"] if (quota and "max_processes" in quota.keys() and quota["max_processes"]) else 50

    compose_yaml = TemplateComposer.generate_compose(
        nim=nim,
        project_name=body.name,
        language=body.language,
        version=body.version,
        project_src_dir=host_project_dir,
        allocated_port=allocated_port,
        app_config=merged_app_config,
        env_vars=body.env_vars or {},
        mem_limit_mb=mem_limit,
        cpu_cores=cpus,
        pids_limit=pids
    )

    stack_name = f"miraigrid_{nim}_{body.name}"
    deploy_res = await portainer.create_standalone_stack(stack_name, compose_yaml)
    stack_id = deploy_res["data"]["Id"] if deploy_res.get("success") else None
    status = "running" if stack_id else "error"

    config_json_str = json.dumps(merged_app_config)

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
        "app_config": merged_app_config,
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
    project = await get_project_with_access(project_id, current_user, db)
    nim = project["owner_username"]
    project_name = project["name"]

    raw_app_root = (body.app_config or {}).get("app_root")
    path_info = resolve_app_root_paths(
        current_user=current_user,
        project_owner_username=nim,
        project_name=project_name,
        app_root_raw=raw_app_root
    )

    local_project_dir = path_info["local_project_dir"]
    host_project_dir = path_info["host_project_dir"]

    merged_app_config = dict(body.app_config or {})
    merged_app_config["app_root"] = path_info["app_root"]
    merged_app_config["app_root_subpath"] = path_info["app_root_subpath"]
    merged_app_config["display_app_root"] = path_info["display_app_root"]
    merged_app_config["is_custom_dir"] = path_info["is_custom_dir"]
    if path_info.get("is_git_repo"):
        merged_app_config["is_git_repo"] = True

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
    pids = quota["max_processes"] if (quota and "max_processes" in quota.keys() and quota["max_processes"]) else 50

    env_vars = body.env_vars or (json.loads(decrypt_secret(project["env_vars_enc"])) if project["env_vars_enc"] else {})
    encrypted_env = encrypt_secret(json.dumps(env_vars))
    config_json_str = json.dumps(merged_app_config)

    compose_yaml = TemplateComposer.generate_compose(
        nim=nim,
        project_name=project_name,
        language=lang,
        version=ver,
        project_src_dir=host_project_dir,
        allocated_port=project["allocated_port"],
        app_config=merged_app_config,
        env_vars=env_vars,
        mem_limit_mb=mem_limit,
        cpu_cores=cpus,
        pids_limit=pids
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
    project = await get_project_with_access(project_id, current_user, db)
    nim = project["owner_username"]
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
    pids = quota["max_processes"] if (quota and "max_processes" in quota.keys() and quota["max_processes"]) else 50
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
        cpu_cores=cpus,
        pids_limit=pids
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
    project = await get_project_with_access(project_id, current_user, db)
    if not project or not project.get("portainer_stack_id"):
        raise HTTPException(status_code=400, detail="Container tidak tersedia.")

    container_name = f"app_{project['owner_username']}_{project['name']}"
    project_root = get_project_container_root(project)
    res = await portainer.exec_container_command(
        container_name=container_name,
        cmd=["sh", "-c", "pip install --no-cache-dir -r requirements.txt"],
        user="root",
        working_dir=project_root,
        timeout=300.0
    )
    return res

@router.post("/{project_id}/npm-install")
async def run_npm_install(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    project = await get_project_with_access(project_id, current_user, db)
    if not project or not project.get("portainer_stack_id"):
        raise HTTPException(status_code=400, detail="Container tidak tersedia.")

    container_name = f"app_{project['owner_username']}_{project['name']}"
    project_root = get_project_container_root(project)
    res = await portainer.exec_container_command(
        container_name=container_name,
        cmd=["sh", "-c", "npm install --production=false"],
        user="root",
        working_dir=project_root,
        timeout=300.0
    )
    return res

@router.post("/{project_id}/composer-install")
async def run_composer_install(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """Executes Composer Install with automatic permissions and Laravel environment validation."""
    project = await get_project_with_access(project_id, current_user, db)
    if not project or not project.get("portainer_stack_id"):
        raise HTTPException(status_code=400, detail="Container tidak tersedia.")

    container_name = f"app_{project['owner_username']}_{project['name']}"
    project_root = get_project_container_root(project)
    composer_cmd = (
        "if [ ! -f .env ] && [ -f .env.example ]; then cp .env.example .env; fi; "
        "if [ -d storage ] || [ -d bootstrap/cache ]; then mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views bootstrap/cache && chown -R www-data:www-data storage bootstrap/cache && chmod -R 775 storage bootstrap/cache; fi; "
        "composer install --no-interaction --prefer-dist --optimize-autoloader; "
        "if [ -f artisan ] && grep -q \"APP_KEY=\" .env 2>/dev/null; then "
        "if ! grep -q \"APP_KEY=base64:\" .env 2>/dev/null; then php artisan key:generate --force; fi; "
        "fi; "
        "if [ -d storage ] || [ -d bootstrap/cache ]; then chown -R www-data:www-data storage bootstrap/cache && chmod -R 775 storage bootstrap/cache; fi"
    )
    res = await portainer.exec_container_command(
        container_name=container_name,
        cmd=["sh", "-c", composer_cmd],
        user="root",
        working_dir=project_root,
        timeout=300.0
    )
    return res

@router.post("/{project_id}/build")
async def run_project_build(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """Smart Multi-Engine Compiler & Dependency Resolver (PHP/Laravel/CI3, Python/Flask/FastAPI/Django, Node/React/Next/Express)"""
    project = await get_project_with_access(project_id, current_user, db)
    if not project or not project.get("portainer_stack_id"):
        raise HTTPException(status_code=400, detail="Container tidak tersedia.")

    container_name = f"app_{project['owner_username']}_{project['name']}"
    project_root = get_project_container_root(project)
    template_type = str(project.get("template_type") or "").lower()

    if any(k in template_type for k in ["php", "laravel", "codeigniter", "wordpress"]):
        build_cmd = (
            "echo '=== [MiraiGrid Compiler: PHP Engine] ===' && "
            "if [ ! -f .env ] && [ -f .env.example ]; then cp .env.example .env && echo '[OK] Initialized .env from .env.example'; fi; "
            "if [ -d storage ] || [ -d bootstrap/cache ]; then mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views bootstrap/cache && chown -R www-data:www-data storage bootstrap/cache && chmod -R 777 storage bootstrap/cache; fi; "
            "if [ -f composer.json ]; then echo '[*] Compiling Composer Dependencies...' && composer install --no-interaction --prefer-dist --optimize-autoloader; fi; "
            "if [ -f artisan ]; then "
            "if grep -q \"APP_KEY=\" .env 2>/dev/null && ! grep -q \"APP_KEY=base64:\" .env 2>/dev/null; then php artisan key:generate --force && echo '[OK] Generated Laravel APP_KEY'; fi; "
            "php artisan optimize:clear 2>/dev/null || true; "
            "fi; "
            "if [ -d storage ] || [ -d bootstrap/cache ]; then chown -R www-data:www-data storage bootstrap/cache && chmod -R 777 storage bootstrap/cache; fi && "
            "echo '=== [Compilation & Build Finished Successfully] ==='"
        )
    elif any(k in template_type for k in ["node", "react", "next", "express", "vue"]):
        build_cmd = (
            "echo '=== [MiraiGrid Compiler: Node.js Engine] ===' && "
            "if [ -f package.json ]; then echo '[*] Running npm install...' && npm install --production=false; fi; "
            "if grep -q '\"build\":' package.json 2>/dev/null; then echo '[*] Running npm run build...' && npm run build; fi; "
            "echo '=== [Compilation & Build Finished Successfully] ==='"
        )
    elif any(k in template_type for k in ["python", "flask", "fastapi", "django"]):
        build_cmd = (
            "echo '=== [MiraiGrid Compiler: Python Engine] ===' && "
            "if [ -f requirements.txt ]; then echo '[*] Installing Python requirements.txt...' && pip install --no-cache-dir -r requirements.txt; fi; "
            "if [ -f manage.py ]; then python manage.py migrate --noinput 2>/dev/null || true; fi; "
            "echo '=== [Compilation & Build Finished Successfully] ==='"
        )
    else:
        build_cmd = "echo '=== [MiraiGrid Compiler] ===' && echo 'No specific compilation pipeline required for static web.'"

    res = await portainer.exec_container_command(
        container_name=container_name,
        cmd=["sh", "-c", build_cmd],
        user="root",
        working_dir=project_root,
        timeout=300.0
    )
    return res

@router.post("/{project_id}/control")
async def control_project(
    project_id: int,
    action: str,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    project = await get_project_with_access(project_id, current_user, db)
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    container_name = f"app_{project['owner_username']}_{project['name']}"
    stack_id = project.get("portainer_stack_id")

    ok = False
    if action == "stop":
        ok = await portainer.stop_container(container_name)
        if not ok and stack_id:
            ok = await portainer.stop_stack(stack_id)
        new_status = "stopped"
    elif action == "start":
        ok = await portainer.start_container(container_name)
        if not ok and stack_id:
            ok = await portainer.start_stack(stack_id)
        new_status = "running"
    elif action == "restart":
        ok = await portainer.restart_container(container_name)
        if not ok and stack_id:
            await portainer.stop_stack(stack_id)
            await asyncio.sleep(1)
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
    project = await get_project_with_access(project_id, current_user, db)
    nim = project["owner_username"]
    container_name = f"app_{nim}_{project['name']}"

    # 1. Stop and remove Docker container directly
    try:
        await portainer.delete_container(container_name, force=True)
    except Exception:
        pass

    # 2. Delete Portainer stack if exists
    if project.get("portainer_stack_id"):
        try:
            await portainer.delete_stack(project["portainer_stack_id"])
        except Exception:
            pass

    # 3. Clean up associated web_deployments
    try:
        await db.execute("DELETE FROM web_deployments WHERE project_id = ?", (project_id,))
    except Exception:
        pass

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
def get_project_target_path(project: dict, subpath: str = "") -> str:
    """
    Resolves the actual file/folder path for a project, properly honoring custom directories 
    and Git repositories configured in config_json.
    """
    nim = project.get("owner_username") or "user"
    cfg_raw = project.get("config_json")
    project_root = None
    if cfg_raw:
        try:
            cfg = json.loads(cfg_raw) if isinstance(cfg_raw, str) else cfg_raw
            raw_root = cfg.get("app_root") or cfg.get("display_app_root") or ""
            repo_match = re.match(r"^/home/([^/]+)/repositories/([^/]+)", raw_root)
            if repo_match:
                repo_user = repo_match.group(1)
                repo_name = repo_match.group(2)
                project_root = os.path.realpath(os.path.join(settings.DATA_DIR, "repositories", repo_user, repo_name))
        except Exception:
            pass

    if not project_root:
        project_root = os.path.realpath(os.path.join(settings.PROJECTS_DIR, f"{nim}_{project['name']}"))

    os.makedirs(project_root, exist_ok=True)
    if not subpath or subpath.strip() in ["/", "\\", "."]:
        return project_root

    clean_sub = subpath.strip().lstrip("/\\")
    target = os.path.realpath(os.path.join(project_root, clean_sub))
    if os.path.commonpath([project_root, target]) != project_root:
        raise ValueError("Security Violation: Access outside project sandbox is strictly prohibited.")
    return target

@router.get("/{project_id}/files")
async def get_project_files(
    project_id: int,
    path: str = Query("", description="Subdirectory path within project"),
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    project = await get_project_with_access(project_id, current_user, db)
    try:
        project_root = get_project_target_path(project, "")
        target_dir = get_project_target_path(project, path)
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
    project = await get_project_with_access(project_id, current_user, db)
    try:
        project_root = get_project_target_path(project, "")
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
    project = await get_project_with_access(project_id, current_user, db)
    try:
        file_path = get_project_target_path(project, path)
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
    project = await get_project_with_access(project_id, current_user, db)
    try:
        file_path = get_project_target_path(project, body.path)
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
    project = await get_project_with_access(project_id, current_user, db)
    try:
        parent_dir = get_project_target_path(project, body.path)
        target_path = os.path.join(parent_dir, body.name)
        get_project_target_path(project, os.path.relpath(target_path, get_project_target_path(project, "")))

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
    project = await get_project_with_access(project_id, current_user, db)
    try:
        source_path = get_project_target_path(project, body.old_path)
        parent_dir = os.path.dirname(source_path)
        dest_path = os.path.join(parent_dir, body.new_name)
        get_project_target_path(project, os.path.relpath(dest_path, get_project_target_path(project, "")))

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
    project = await get_project_with_access(project_id, current_user, db)
    try:
        source = get_project_target_path(project, body.source_path)
        dest_dir = get_project_target_path(project, body.dest_dir)
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
    project = await get_project_with_access(project_id, current_user, db)
    try:
        source = get_project_target_path(project, body.source_path)
        dest_dir = get_project_target_path(project, body.dest_dir)
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
    project = await get_project_with_access(project_id, current_user, db)
    try:
        target = get_project_target_path(project, body.path)
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
    project = await get_project_with_access(project_id, current_user, db)
    try:
        project_root = get_project_target_path(project, "")
        src_full_paths = [get_project_target_path(project, p) for p in body.paths]
        dest_zip = get_project_target_path(project, body.destination_zip)

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
    project = await get_project_with_access(project_id, current_user, db)
    try:
        project_root = get_project_target_path(project, "")
        zip_full_path = get_project_target_path(project, body.zip_path)
        dest_dir = get_project_target_path(project, body.extract_to or "")

        # Storage Quota Check
        cursor_q = await db.execute("SELECT max_disk_mb FROM quotas WHERE user_id = ?", (current_user["id"],))
        quota_row = await cursor_q.fetchone()
        is_admin = current_user.get("role") == "admin"
        max_disk_mb = quota_row["max_disk_mb"] if (quota_row and quota_row["max_disk_mb"]) else (2000.0 if is_admin else 500.0)

        from app.services.disk_usage import calculate_account_disk_usage
        disk_used_mb, _ = calculate_account_disk_usage(current_user["username"])

        import zipfile
        if os.path.exists(zip_full_path) and zipfile.is_zipfile(zip_full_path):
            with zipfile.ZipFile(zip_full_path, "r") as zf:
                uncompressed_sz = sum(info.file_size for info in zf.infolist() if not info.is_dir())
                if disk_used_mb + (uncompressed_sz / (1024 * 1024)) > max_disk_mb:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Ekstraksi arsip melebihi batas kuota penyimpanan ({int(max_disk_mb)} MB)."
                    )

        extract_zip_archive(zip_full_path, dest_dir, project_root)
        return {"success": True, "message": f"Arsip ZIP berhasil diekstrak."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{project_id}/files/download")
async def download_file(
    project_id: int,
    path: str = Query(..., description="File path relative to project root"),
    current_user: dict = Depends(get_current_user_flexible),
    db: aiosqlite.Connection = Depends(get_db)
):
    project = await get_project_with_access(project_id, current_user, db)
    try:
        file_path = get_project_target_path(project, path)
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
    project = await get_project_with_access(project_id, current_user, db)
    try:
        target_dir = get_project_target_path(project, path)
        temp_dest = os.path.join(target_dir, file.filename)

        # Storage Quota Check
        cursor_q = await db.execute("SELECT max_disk_mb FROM quotas WHERE user_id = ?", (current_user["id"],))
        quota_row = await cursor_q.fetchone()
        is_admin = current_user.get("role") == "admin"
        max_disk_mb = quota_row["max_disk_mb"] if (quota_row and quota_row["max_disk_mb"]) else (2000.0 if is_admin else 500.0)

        from app.services.disk_usage import calculate_account_disk_usage
        disk_used_mb, _ = calculate_account_disk_usage(current_user["username"])

        file.file.seek(0, os.SEEK_END)
        file_size = file.file.tell()
        file.file.seek(0)

        if disk_used_mb + (file_size / (1024 * 1024)) > max_disk_mb:
            raise HTTPException(
                status_code=413,
                detail=f"Kapasitas penyimpanan workspace mahasiswa telah mencapai batas kuota ({int(max_disk_mb)} MB)."
            )

        with open(temp_dest, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # If it's a zip file, extract safely
        if file.filename.lower().endswith(".zip"):
            import zipfile
            if zipfile.is_zipfile(temp_dest):
                with zipfile.ZipFile(temp_dest, "r") as zf:
                    uncompressed_sz = sum(info.file_size for info in zf.infolist() if not info.is_dir())
                    if disk_used_mb + (uncompressed_sz / (1024 * 1024)) > max_disk_mb:
                        try:
                            os.remove(temp_dest)
                        except Exception:
                            pass
                        raise HTTPException(
                            status_code=413,
                            detail=f"Kapasitas penyimpanan workspace mahasiswa telah mencapai batas kuota ({int(max_disk_mb)} MB)."
                        )

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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{project_id}/files")
async def delete_file_or_dir(
    project_id: int,
    path: str = Query(..., description="Path to delete"),
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    project = await get_project_with_access(project_id, current_user, db)
    try:
        target = get_project_target_path(project, path)
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
# CONTAINER CONSOLE (SANDBOXED DIRECTORY JAIL)
# ==========================================
@router.post("/{project_id}/console/exec")
async def execute_console_command(
    project_id: int,
    body: ConsoleExecRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    project = await get_project_with_access(project_id, current_user, db)
    if not project or not project.get("portainer_stack_id"):
        raise HTTPException(status_code=400, detail="Project belum di-deploy atau container tidak tersedia.")

    container_name = f"app_{project['owner_username']}_{project['name']}"
    project_root = get_project_container_root(project)

    # Determine and sanitize cwd
    req_cwd = (body.cwd or "").strip()
    norm_root = posixpath.normpath(project_root)
    if not req_cwd:
        safe_cwd = norm_root
    else:
        norm_req = posixpath.normpath(req_cwd)
        safe_cwd = norm_req if norm_req.startswith(norm_root) else norm_root

    raw_input = (body.stdin_input or "").strip()

    # Safety validation for suspicious traversal or outside root access
    if raw_input:
        is_safe, err_msg = check_console_command_safety(raw_input, safe_cwd, project_root)
        if not is_safe:
            return {
                "success": True,
                "container": container_name,
                "command": body.command,
                "user": body.user or "root",
                "output": f"\x1b[1;31m[AKSES DITOLAK] {err_msg}\x1b[0m\r\n__MIRAIGRID_PWD__{safe_cwd}\r\n"
            }

    # Shell Jail Wrapper Script
    # Intercepts 'cd', prevents navigating outside project_root, clamps to project_root
    jail_script = f"""
BASE_DIR="{project_root}"
cd() {{
    _t="${{1:-$BASE_DIR}}"
    if [ "$_t" = "/" ] || [ "$_t" = "~" ]; then
        command cd "$BASE_DIR"
        return
    fi
    command cd "$_t" 2>/dev/null || {{ echo "cd: $_t: No such file or directory" >&2; return 1; }}
    _p="$(pwd -P 2>/dev/null || pwd)"
    case "$_p" in
        "$BASE_DIR"*) ;;
        *)
            command cd "$BASE_DIR"
            echo "Akses ditolak: Navigasi di luar direktori project ($BASE_DIR) dibatasi." >&2
            return 1
            ;;
    esac
}}
command cd "{safe_cwd}" 2>/dev/null || command cd "$BASE_DIR"
{raw_input}
echo "__MIRAIGRID_PWD__$(pwd)"
"""

    shell_cmd = body.command.strip() if body.command else "/bin/sh"
    # If caller requested python/node directly, wrap via /bin/sh
    if shell_cmd in ["python", "python3", "python3.11"]:
        raw_input = f"python {raw_input}" if raw_input else "python --version"
        shell_cmd = "/bin/sh"
    elif shell_cmd in ["node", "nodejs"]:
        raw_input = f"node {raw_input}" if raw_input else "node --version"
        shell_cmd = "/bin/sh"

    full_cmd = [shell_cmd, "-c", jail_script]

    res = await portainer.exec_container_command(
        container_name=container_name,
        cmd=full_cmd,
        user=body.user or "root",
        working_dir=safe_cwd
    )

    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error"))

    return {
        "success": True,
        "container": container_name,
        "command": shell_cmd,
        "user": body.user or "root",
        "output": res.get("output", "")
    }
