import os
import posixpath
import subprocess
import shutil
import re
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Header, Request, Response, status
from pydantic import BaseModel
import aiosqlite

from app.core.config import settings
from app.core.database import get_db
from app.core.subdomain_auth import verify_subdomain_access
from app.api.deps import get_current_user
from app.api.terminal import ensure_user_sandbox, check_sandbox_escape, FORBIDDEN_PATTERNS

SSH_DANGEROUS_PATTERNS = re.compile(
    r"""(?:\b|[\s;|&`'"])/(?:etc|root|boot|proc|sys|dev|mnt|opt|srv|media|var|usr)(?=[/\s;|&'"]|\b|$)"""
    r"""|(?:\b|[\s;|&`'"])\.\./\.\."""
    r"""|(?:\b|[\s;|&`'"])(?:miraigrid\.db|\.env|id_rsa|id_ed25519)"""
    r"""|\b(reboot|shutdown|poweroff|init|mkfs|dd|killall|fdisk|iptables|ufw|systemctl|service)\b"""
    r"""|\b(sudo|su|doas|pkexec)\b"""
    r"""|\b(apt|apt-get|dpkg|snap|apk|yum|dnf|pacman)\b"""
    r"""|\b(docker|docker-compose|podman|lxc|lxd|kubectl)\b"""
    r"""|\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+(?:/|/\*|\.\.|~|~/\*|\$HOME)(?:\s+.*|$|\b)""",
    re.IGNORECASE
)

router = APIRouter(prefix="/ssh", tags=["SSH Sandbox"])

class SSHExecRequest(BaseModel):
    command: str
    cwd: Optional[str] = ""

class SSHExecResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    cwd: str
    server_ip: str

@router.get("/info")
async def get_ssh_info(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    username = current_user["username"]
    subdomain = f"ssh-{username}.miraigrid.web.id"
    shared_ip = "76.76.76.189"
    lan_ip = "10.10.10.10"
    port = 22

    # Fetch quota limits
    cursor = await db.execute(
        "SELECT max_disk_mb, max_memory_mb, max_cpu_cores FROM quotas WHERE user_id = ?",
        (current_user["id"],)
    )
    quota = await cursor.fetchone()
    storage_mb = quota["max_disk_mb"] if quota and "max_disk_mb" in quota.keys() else (quota[0] if quota else 500)
    ram_mb = quota["max_memory_mb"] if quota and "max_memory_mb" in quota.keys() else (quota[1] if quota else 256)
    cpu_cores = quota["max_cpu_cores"] if quota and "max_cpu_cores" in quota.keys() else (quota[2] if quota else 0.5)

    return {
        "status": "active",
        "username": username,
        "subdomain": subdomain,
        "host": subdomain,
        "public_ip": shared_ip,
        "lan_ip": lan_ip,
        "port": port,
        "ssh_command": f"ssh {username}@{subdomain} -p {port}",
        "ssh_command_ip": f"ssh {username}@{shared_ip} -p {port}",
        "sftp_command": f"sftp -P {port} {username}@{subdomain}",
        "home_directory": f"/home/{username}",
        "password_note": "Gunakan kata sandi akun MiraiGrid Anda",
        "quota": {
            "storage_mb": storage_mb,
            "ram_mb": ram_mb,
            "cpu_cores": cpu_cores
        },
        "sandbox_engine": "Linux Namespace Jail + cgroups v2",
        "features": [
            "Dedicated Subdomain Ingress (ssh-<nim>.miraigrid.web.id)",
            "System Root Remounted READ-ONLY (/usr, /etc, /opt)",
            "Shadow & Credential Masking (/etc/shadow -> /dev/null)",
            "Dangerous Binaries Neutralized (reboot, shutdown, sudo, docker)",
            "NPM Global Prefix (~/.npm-global/bin)",
            "Composer Home Isolation (~/.composer)",
            "Python Virtualenv & Local Packages (~/.local)",
            "Semua dependency tersinkronisasi langsung ke File Manager"
        ]
    }

@router.get("/resolve")
async def resolve_ssh_subdomain(
    request: Request,
    x_original_host: Optional[str] = Header(None),
    x_ssh_user: Optional[str] = Header(None),
    host: Optional[str] = Header(None),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Dynamic resolver for incoming HTTP/HTTPS requests to 'ssh-<username>.miraigrid.web.id'.
    Enforces strict zero-trust authorization before directing to the Web SSH dashboard.
    """
    target_host = (x_original_host or host or request.query_params.get("host") or "").split(":")[0].strip().lower()

    if not target_host:
        return Response(status_code=400, content="Missing Host Header")

    target_user = None
    if x_ssh_user:
        target_user = x_ssh_user.strip().lower()
    elif target_host.startswith("ssh-"):
        parts = target_host.split(".")
        if parts:
            first = parts[0]
            if first.startswith("ssh-"):
                target_user = first[4:].strip().lower()

    if not target_user:
        return Response(status_code=403, content="Host Not In Scope")

    cursor = await db.execute("SELECT id, username FROM users WHERE LOWER(username) = ?", (target_user,))
    row = await cursor.fetchone()
    if not row:
        return Response(status_code=404, content="User Not Found")

    is_authorized, status_code, err_msg, auth_user = await verify_subdomain_access(
        request=request,
        db=db,
        target_username=target_user,
        scope_name="ssh"
    )

    if not is_authorized:
        return Response(status_code=status_code, content=err_msg)

    response = Response(status_code=200, content="OK")
    response.headers["X-Accel-Redirect"] = "/ssh"
    response.headers["X-SSH-Target-User"] = target_user
    return response

@router.post("/exec", response_model=SSHExecResponse)
async def exec_ssh_command(
    body: SSHExecRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    username = current_user["username"]
    command_raw = body.command.strip()
    raw_cwd = (body.cwd or "").strip().replace("\\", "/")
    server_ip = "76.76.76.189"

    # Fetch user projects and repos for sandbox isolation
    p_cursor = await db.execute("SELECT name FROM projects WHERE user_id = ?", (current_user["id"],))
    user_projects = [r[0] for r in await p_cursor.fetchall()]

    r_cursor = await db.execute("SELECT name FROM git_repositories WHERE user_id = ?", (current_user["id"],))
    user_repos = [r[0] for r in await r_cursor.fetchall()]

    home_dir = ensure_user_sandbox(username, user_projects, user_repos)

    if raw_cwd.startswith("/"):
        raw_cwd = raw_cwd.lstrip("/")

    target_real_dir = os.path.realpath(os.path.join(home_dir, raw_cwd))
    if not check_sandbox_escape(home_dir, target_real_dir, username):
        target_real_dir = home_dir
        raw_cwd = ""

    if not command_raw:
        return SSHExecResponse(
            stdout="",
            stderr="",
            exit_code=0,
            cwd=raw_cwd,
            server_ip=server_ip
        )

    # Built-in cd handling
    if command_raw.startswith("cd "):
        target_arg = command_raw[3:].strip().strip("\"'").replace("\\", "/")
        norm_path = posixpath.normpath(posixpath.join(raw_cwd, target_arg))
        if norm_path.startswith(".."):
            return SSHExecResponse(
                stdout="",
                stderr=f"bash: cd: {target_arg}: Akses ditolak: Anda telah berada di direktori root sandbox (/home/{username})\n",
                exit_code=1,
                cwd=raw_cwd,
                server_ip=server_ip
            )

        candidate_rel = "" if norm_path == "." else norm_path
        candidate_real = os.path.realpath(os.path.join(home_dir, candidate_rel))

        if not check_sandbox_escape(home_dir, candidate_real, username):
            return SSHExecResponse(
                stdout="",
                stderr=f"bash: cd: {target_arg}: Permission denied (Sandboxed Environment)\n",
                exit_code=1,
                cwd=raw_cwd,
                server_ip=server_ip
            )

        if not os.path.exists(candidate_real) or not os.path.isdir(candidate_real):
            return SSHExecResponse(
                stdout="",
                stderr=f"bash: cd: {target_arg}: No such file or directory\n",
                exit_code=1,
                cwd=raw_cwd,
                server_ip=server_ip
            )

        return SSHExecResponse(
            stdout="",
            stderr="",
            exit_code=0,
            cwd=candidate_rel,
            server_ip=server_ip
        )

    # Built-in pwd
    if command_raw == "pwd":
        virtual_path = f"/home/{username}"
        if raw_cwd:
            virtual_path = f"/home/{username}/{raw_cwd}"
        return SSHExecResponse(
            stdout=f"{virtual_path}\n",
            stderr="",
            exit_code=0,
            cwd=raw_cwd,
            server_ip=server_ip
        )

    # Built-in whoami
    if command_raw == "whoami":
        return SSHExecResponse(
            stdout=f"{username}\n",
            stderr="",
            exit_code=0,
            cwd=raw_cwd,
            server_ip=server_ip
        )

    # Built-in help
    if command_raw == "help":
        help_msg = (
            f"MiraiGrid Dedicated SSH & Sandbox v2.5 ({username})\n"
            "Perintah umum yang didukung:\n"
            "  ls, dir         - Tampilkan isi direktori / File Manager akun Anda\n"
            "  cd <folder>     - Berpindah direktori dalam sandbox\n"
            "  pwd             - Tampilkan jalur direktori saat ini\n"
            "  mkdir, touch    - Buat folder atau file baru\n"
            "  node, npm       - Runtime JavaScript & instalasi modul (tersimpan di ~/.npm-global)\n"
            "  python3, pip    - Runtime Python & instalasi package (tersimpan di ~/.local)\n"
            "  php, composer   - Runtime PHP & dependency composer (tersimpan di ~/.composer)\n"
            "  git <args>      - Version control untuk repositori proyek Anda\n"
            "  whoami          - Identitas akun terisolasi\n"
            "  clear           - Bersihkan layar konsol terminal\n"
            "\nKeamanan: Sandboxed cgroups v2, read-only system files, anti-tampering active.\n"
        )
        return SSHExecResponse(
            stdout=help_msg,
            stderr="",
            exit_code=0,
            cwd=raw_cwd,
            server_ip=server_ip
        )

    # Security check for forbidden destructive commands
    if SSH_DANGEROUS_PATTERNS.search(command_raw) or FORBIDDEN_PATTERNS.search(command_raw):
        return SSHExecResponse(
            stdout="",
            stderr="bash: Akses ditolak: Perintah sistem sensitif atau berisiko merusak server dilarang dalam lingkungan sandbox terisolasi.\n",
            exit_code=126,
            cwd=raw_cwd,
            server_ip=server_ip
        )

    # Environment variables enforcing per-user dependency isolation
    env = os.environ.copy()
    env["HOME"] = home_dir
    env["USER"] = username
    env["PWD"] = target_real_dir
    env["LANG"] = "C.UTF-8"
    env["LC_ALL"] = "C.UTF-8"
    env["NPM_CONFIG_PREFIX"] = os.path.join(home_dir, ".npm-global")
    env["COMPOSER_HOME"] = os.path.join(home_dir, ".composer")
    env["PIP_USER"] = "true"
    env["PATH"] = f"{os.path.join(home_dir, '.npm-global', 'bin')}:{os.path.join(home_dir, '.local', 'bin')}:{os.path.join(home_dir, '.composer', 'vendor', 'bin')}:/usr/local/bin:/usr/bin:/bin"

    try:
        shell_cmd = ["/bin/bash", "-c", command_raw] if os.path.exists("/bin/bash") else ["sh", "-c", command_raw]
        process = subprocess.run(
            shell_cmd,
            cwd=target_real_dir,
            capture_output=True,
            text=True,
            timeout=20,
            env=env
        )
        return SSHExecResponse(
            stdout=process.stdout,
            stderr=process.stderr,
            exit_code=process.returncode,
            cwd=raw_cwd,
            server_ip=server_ip
        )
    except subprocess.TimeoutExpired:
        return SSHExecResponse(
            stdout="",
            stderr="bash: Batas waktu eksekusi habis (Command execution timed out: 20s)\n",
            exit_code=124,
            cwd=raw_cwd,
            server_ip=server_ip
        )
    except Exception as e:
        return SSHExecResponse(
            stdout="",
            stderr=f"bash: Kesalahan internal: {str(e)}\n",
            exit_code=1,
            cwd=raw_cwd,
            server_ip=server_ip
        )
