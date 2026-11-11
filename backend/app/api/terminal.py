import os
import posixpath
import subprocess
import shutil
import re
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import aiosqlite

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user

router = APIRouter(prefix="/terminal", tags=["Terminal"])

class TerminalExecRequest(BaseModel):
    command: str
    cwd: Optional[str] = ""

class TerminalExecResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    cwd: str
    server_ip: str

class TerminalAutocompleteRequest(BaseModel):
    command: str
    cwd: Optional[str] = ""

class TerminalAutocompleteResponse(BaseModel):
    matches: List[str]
    common_prefix: str
    token: str
    has_multiple: bool

def ensure_user_sandbox(username: str, db_projects: List[str] = None, db_repos: List[str] = None) -> str:
    """
    Creates and manages an isolated sandbox directory for the user:
    DATA_DIR/home/<username>/
    Mirrors projects and repositories visible in File Manager so 'ls'
    outputs the exact same workspaces.
    """
    clean_user = username.strip()
    home_dir = os.path.realpath(os.path.join(settings.DATA_DIR, "home", clean_user))
    os.makedirs(home_dir, exist_ok=True)

    # 1. Clean up broken or duplicate top-level symlinks
    repos_base = os.path.realpath(os.path.join(settings.DATA_DIR, "repositories", clean_user))
    user_repos = set(os.listdir(repos_base)) if os.path.exists(repos_base) else set()

    for item in os.listdir(home_dir):
        if item in [".", "..", ".composer", ".bashrc", "repositories"]:
            continue
        item_full = os.path.join(home_dir, item)
        if os.path.islink(item_full):
            target = os.path.realpath(item_full)
            # Remove if broken or if item is already inside repositories/
            if not os.path.exists(target) or item in user_repos:
                try:
                    os.unlink(item_full)
                except Exception:
                    pass

    # 2. Mirror Repositories to ~/repositories
    if os.path.exists(repos_base):
        repo_sym_dir = os.path.join(home_dir, "repositories")
        if not os.path.exists(repo_sym_dir):
            try:
                os.symlink(repos_base, repo_sym_dir)
            except Exception:
                pass

    # 3. Mirror Standalone Projects (only if not already in repositories)
    projects_base = os.path.realpath(os.path.join(settings.DATA_DIR, "projects"))
    if os.path.exists(projects_base):
        for item in os.listdir(projects_base):
            item_path = os.path.join(projects_base, item)
            if not os.path.isdir(item_path):
                continue
            
            # Check ownership: <username>_<projname> or matching user projects
            match_prefix = f"{clean_user}_"
            if item.startswith(match_prefix):
                proj_name = item[len(match_prefix):]
                # If this project exists in user repositories, do not duplicate at top-level
                if proj_name in user_repos:
                    continue
                sym_path = os.path.join(home_dir, proj_name)
                if not os.path.exists(sym_path):
                    try:
                        os.symlink(item_path, sym_path)
                    except Exception:
                        pass
            elif db_projects and item in db_projects:
                if item in user_repos:
                    continue
                sym_path = os.path.join(home_dir, item)
                if not os.path.exists(sym_path):
                    try:
                        os.symlink(item_path, sym_path)
                    except Exception:
                        pass

    return home_dir

def check_sandbox_escape(base_sandbox: str, target_dir: str, username: str = None) -> bool:
    """
    Returns True if target_dir is strictly inside:
    - base_sandbox (DATA_DIR/home/<username>), OR
    - user's project directories (DATA_DIR/projects/<username>_*), OR
    - user's repository directories (DATA_DIR/repositories/<username>/*)
    """
    try:
        real_target = os.path.realpath(target_dir)
        real_base = os.path.realpath(base_sandbox)
        
        # 1. Direct subpath of home sandbox
        if os.path.commonpath([real_base, real_target]) == real_base:
            return True
            
        # 2. Check user projects & repositories
        if username:
            clean_user = username.strip()
            # Repositories
            repo_base = os.path.realpath(os.path.join(settings.DATA_DIR, "repositories", clean_user))
            if os.path.exists(repo_base) and os.path.commonpath([repo_base, real_target]) == repo_base:
                return True

            # Projects
            projects_base = os.path.realpath(os.path.join(settings.DATA_DIR, "projects"))
            if os.path.exists(projects_base):
                for item in os.listdir(projects_base):
                    if item.startswith(f"{clean_user}_") or item == clean_user or (clean_user == "admin" and not item.startswith("user")):
                        item_real = os.path.realpath(os.path.join(projects_base, item))
                        if os.path.commonpath([item_real, real_target]) == item_real:
                            return True

        return False
    except Exception:
        return False

FORBIDDEN_PATTERNS = re.compile(
    r"""(?:\b|[\s;|&`'"])/(?:etc|root|boot|proc|sys|dev|mnt|opt|srv|media|var|usr)(?=[/\s;|&'"]|\b|$)"""
    r"""|(?:\b|[\s;|&`'"])\.\./\.\."""
    r"""|miraigrid\.db"""
    r"""|\b(reboot|shutdown|poweroff|mkfs|dd|killall|fdisk|iptables|systemctl|service)\b""",
    re.IGNORECASE
)

@router.post("/exec", response_model=TerminalExecResponse)
async def execute_terminal_command(
    body: TerminalExecRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    username = current_user["username"]

    # Fetch user's projects from DB to ensure links
    p_cursor = await db.execute("SELECT name FROM projects WHERE user_id = ?", (current_user["id"],))
    user_projects = [r[0] for r in await p_cursor.fetchall()]

    r_cursor = await db.execute("SELECT name FROM git_repositories WHERE user_id = ?", (current_user["id"],))
    user_repos = [r[0] for r in await r_cursor.fetchall()]

    home_dir = ensure_user_sandbox(username, user_projects, user_repos)

    # Resolve Current Working Directory
    raw_cwd = (body.cwd or "").strip().replace("\\", "/").strip("/")
    if raw_cwd.startswith(f"home/{username}"):
        raw_cwd = raw_cwd[len(f"home/{username}"):].strip("/")

    target_real_dir = os.path.realpath(os.path.join(home_dir, raw_cwd))
    if not check_sandbox_escape(home_dir, target_real_dir, username) or not os.path.exists(target_real_dir):
        target_real_dir = home_dir
        raw_cwd = ""

    command_raw = body.command.strip()
    server_ip = settings.BASE_DOMAIN or "76.76.76.189"

    # Handle built-in: cd
    if command_raw in ["cd /", "cd //", "cd /root", "cd /etc", "cd /var", "cd /usr", "cd /home"]:
        return TerminalExecResponse(
            stdout="",
            stderr=f"bash: cd: Akses ditolak: Direktori sistem dibatasi oleh sandbox (/home/{username})\n",
            exit_code=1,
            cwd=raw_cwd,
            server_ip=server_ip
        )

    if command_raw == "cd" or command_raw == "cd ~":
        return TerminalExecResponse(
            stdout="",
            stderr="",
            exit_code=0,
            cwd="",
            server_ip=server_ip
        )

    if command_raw.startswith("cd "):
        target_arg = command_raw[3:].strip().strip("\"'").replace("\\", "/")
        
        # Normalize relative path
        norm_path = posixpath.normpath(posixpath.join(raw_cwd, target_arg))
        if norm_path.startswith(".."):
            return TerminalExecResponse(
                stdout="",
                stderr=f"bash: cd: {target_arg}: Akses ditolak: Anda telah berada di direktori root sandbox (/home/{username})\n",
                exit_code=1,
                cwd=raw_cwd,
                server_ip=server_ip
            )

        candidate_rel = "" if norm_path == "." else norm_path
        candidate_real = os.path.realpath(os.path.join(home_dir, candidate_rel))

        if not check_sandbox_escape(home_dir, candidate_real, username):
            return TerminalExecResponse(
                stdout="",
                stderr=f"bash: cd: {target_arg}: Permission denied (Sandboxed Environment)\n",
                exit_code=1,
                cwd=raw_cwd,
                server_ip=server_ip
            )

        if not os.path.exists(candidate_real) or not os.path.isdir(candidate_real):
            return TerminalExecResponse(
                stdout="",
                stderr=f"bash: cd: {target_arg}: No such file or directory\n",
                exit_code=1,
                cwd=raw_cwd,
                server_ip=server_ip
            )

        return TerminalExecResponse(
            stdout="",
            stderr="",
            exit_code=0,
            cwd=candidate_rel,
            server_ip=server_ip
        )

    # Built-in: pwd
    if command_raw == "pwd":
        virtual_path = f"/home/{username}"
        if raw_cwd:
            virtual_path = f"/home/{username}/{raw_cwd}"
        return TerminalExecResponse(
            stdout=f"{virtual_path}\n",
            stderr="",
            exit_code=0,
            cwd=raw_cwd,
            server_ip=server_ip
        )

    # Built-in: help
    if command_raw == "help":
        help_msg = (
            "MiraiGrid Sandboxed Shell v2.4\n"
            "Perintah umum yang didukung:\n"
            "  ls, dir         - Tampilkan isi folder & file File Manager Anda\n"
            "  cd <folder>     - Navigasi antar direktori dalam sandbox akun\n"
            "  pwd             - Tampilkan jalur direktori aktif saat ini\n"
            "  mkdir <nama>    - Buat folder baru\n"
            "  touch <nama>    - Buat file kosong baru\n"
            "  cat <file>      - Baca isi file teks\n"
            "  rm [-r] <nama>  - Hapus file atau folder\n"
            "  cp / mv         - Salin atau pindahkan file\n"
            "  git <args>      - Eksekusi perintah Git pada repositori lokal\n"
            "  python3 <file>  - Jalankan skrip Python terisolasi\n"
            "  whoami          - Informasi identitas akun aktif\n"
            "  clear           - Bersihkan layar konsol terminal\n"
            "\nCatatan Keamanan: Shell ini terisolasi ketat dalam ruang akun Anda (/home/{username}).\n"
        )
        return TerminalExecResponse(
            stdout=help_msg,
            stderr="",
            exit_code=0,
            cwd=raw_cwd,
            server_ip=server_ip
        )

    # Built-in: whoami
    if command_raw == "whoami":
        return TerminalExecResponse(
            stdout=f"{username}\n",
            stderr="",
            exit_code=0,
            cwd=raw_cwd,
            server_ip=server_ip
        )

    # Security Inspection for Command
    if FORBIDDEN_PATTERNS.search(command_raw):
        return TerminalExecResponse(
            stdout="",
            stderr="bash: Akses ditolak: Perintah atau jalur dilarang dalam lingkungan sandbox terisolasi.\n",
            exit_code=126,
            cwd=raw_cwd,
            server_ip=server_ip
        )

    # Execute system command inside sandbox directory
    env = os.environ.copy()
    env["HOME"] = home_dir
    env["USER"] = username
    env["PWD"] = target_real_dir
    env["LANG"] = "C.UTF-8"
    env["LC_ALL"] = "C.UTF-8"

    try:
        # If running on Linux/Docker container
        shell_cmd = ["/bin/bash", "-c", command_raw] if os.path.exists("/bin/bash") else ["sh", "-c", command_raw]
        process = subprocess.run(
            shell_cmd,
            cwd=target_real_dir,
            capture_output=True,
            text=True,
            timeout=15,
            env=env
        )
        return TerminalExecResponse(
            stdout=process.stdout,
            stderr=process.stderr,
            exit_code=process.returncode,
            cwd=raw_cwd,
            server_ip=server_ip
        )
    except subprocess.TimeoutExpired:
        return TerminalExecResponse(
            stdout="",
            stderr="bash: Batas waktu eksekusi habis (Command execution timed out: 15s)\n",
            exit_code=124,
            cwd=raw_cwd,
            server_ip=server_ip
        )
    except Exception as e:
        return TerminalExecResponse(
            stdout="",
            stderr=f"bash: Kesalahan internal: {str(e)}\n",
            exit_code=1,
            cwd=raw_cwd,
            server_ip=server_ip
        )

@router.post("/autocomplete", response_model=TerminalAutocompleteResponse)
async def autocomplete_terminal(
    body: TerminalAutocompleteRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    username = current_user["username"]
    p_cursor = await db.execute("SELECT name FROM projects WHERE user_id = ?", (current_user["id"],))
    user_projects = [r[0] for r in await p_cursor.fetchall()]

    r_cursor = await db.execute("SELECT name FROM git_repositories WHERE user_id = ?", (current_user["id"],))
    user_repos = [r[0] for r in await r_cursor.fetchall()]

    home_dir = ensure_user_sandbox(username, user_projects, user_repos)

    raw_cwd = (body.cwd or "").strip().replace("\\", "/").lstrip("/")
    if raw_cwd.startswith(f"home/{username}"):
        raw_cwd = raw_cwd[len(f"home/{username}"):].lstrip("/")

    target_real_dir = os.path.realpath(os.path.join(home_dir, raw_cwd))
    if not check_sandbox_escape(home_dir, target_real_dir) or not os.path.exists(target_real_dir):
        target_real_dir = home_dir

    cmd = body.command
    if not cmd.strip():
        token = ""
    else:
        if cmd.endswith(" "):
            token = ""
        else:
            tokens = cmd.split()
            token = tokens[-1] if tokens else ""

    token_dir_part, token_base_part = os.path.split(token)
    if token_dir_part:
        search_dir = os.path.realpath(os.path.join(target_real_dir, token_dir_part))
    else:
        search_dir = target_real_dir

    matches = []
    if check_sandbox_escape(home_dir, search_dir, username) and os.path.exists(search_dir) and os.path.isdir(search_dir):
        try:
            for entry in sorted(os.listdir(search_dir)):
                if entry.startswith(".") and not token_base_part.startswith("."):
                    continue
                if entry.lower().startswith(token_base_part.lower()):
                    full_entry_path = os.path.join(search_dir, entry)
                    is_dir = os.path.isdir(full_entry_path)
                    display_name = (token_dir_part + "/" + entry if token_dir_part else entry) + ("/" if is_dir else "")
                    matches.append(display_name)
        except Exception:
            pass

    common_prefix = ""
    if matches:
        if len(matches) == 1:
            common_prefix = matches[0]
        else:
            common_prefix = os.path.commonprefix(matches)

    return TerminalAutocompleteResponse(
        matches=matches,
        common_prefix=common_prefix,
        token=token,
        has_multiple=len(matches) > 1
    )
