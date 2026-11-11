import os
import re
import shutil
import subprocess
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import aiosqlite
from app.core.config import settings

logger = logging.getLogger("miraigrid.git")

# Allowed characters in repository name: letters, numbers, hyphens, underscores, dots
REPO_NAME_REGEX = re.compile(r"^[a-zA-Z0-9_\-\.]+$")

def validate_repo_name(name: str) -> str:
    clean = name.strip()
    if not clean or len(clean) > 80:
        raise ValueError("Nama repositori wajib diisi (1 - 80 karakter).")
    if clean.startswith("-") or clean.startswith("."):
        raise ValueError("Nama repositori tidak boleh diawali dengan tanda minus atau titik.")
    if not REPO_NAME_REGEX.match(clean):
        raise ValueError("Nama repositori hanya boleh berisi huruf, angka, minus (-), underscore (_), atau titik (.).")
    if ".." in clean:
        raise ValueError("Karakter '..' dilarang pada nama repositori demi keamanan.")
    return clean

def validate_clone_url(url: str) -> str:
    clean = url.strip()
    if not clean:
        raise ValueError("Clone URL wajib diisi.")
    
    # Must start with standard protocols
    valid_prefixes = ("http://", "https://", "git://", "ssh://", "git@")
    if not any(clean.startswith(prefix) for prefix in valid_prefixes):
        raise ValueError("URL remote Git harus diawali dengan http://, https://, ssh://, git://, atau git@")
    
    # Check for command injection characters
    forbidden_chars = [";", "&", "|", "`", "$", "(", ")", "\n", "\r", "\x00"]
    for char in forbidden_chars:
        if char in clean:
            raise ValueError(f"Karakter terlarang '{char}' terdeteksi pada Clone URL demi keamanan sistem.")
    return clean

def get_repo_paths(username: str, repo_name: str) -> Tuple[str, str]:
    """
    Returns (virtual_path, real_filesystem_path).
    Ensures the realpath is strictly confined within the user's isolated repository root.
    """
    clean_user = username.strip()
    clean_repo = validate_repo_name(repo_name)

    virtual_path = f"/home/{clean_user}/repositories/{clean_repo}"

    user_base_dir = os.path.realpath(os.path.join(settings.DATA_DIR, "repositories", clean_user))
    os.makedirs(user_base_dir, exist_ok=True)

    target_dir = os.path.realpath(os.path.join(user_base_dir, clean_repo))

    # Security check: ensure target_dir is strictly inside user_base_dir
    try:
        common = os.path.commonpath([user_base_dir, target_dir])
    except ValueError:
        raise ValueError("Pelanggaran Keamanan: Jalur repositori berada di luar direktori akun Anda.")

    if common != user_base_dir:
        raise ValueError("Pelanggaran Keamanan: Direktori repositori harus berada di dalam ruang akun Anda.")

    return virtual_path, target_dir

def run_git_cmd(args: List[str], cwd: str, timeout: int = 45) -> Tuple[int, str, str]:
    """
    Executes a Git command with strict parameter isolation (shell=False).
    """
    try:
        res = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False
        )
        return res.returncode, res.stdout.strip(), res.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", f"Operasi Git timed out setelah {timeout} detik."
    except Exception as e:
        return -1, "", str(e)

async def create_or_clone_repo(
    db: aiosqlite.Connection,
    user_id: int,
    username: str,
    repo_name: str,
    clone_url: Optional[str] = None
) -> Dict[str, Any]:
    clean_name = validate_repo_name(repo_name)
    virtual_path, real_path = get_repo_paths(username, clean_name)

    # 1. Check duplicate in database
    cur = await db.execute(
        "SELECT id FROM git_repositories WHERE user_id = ? AND name = ?",
        (user_id, clean_name)
    )
    if await cur.fetchone():
        raise ValueError(f"Repositori dengan nama '{clean_name}' sudah ada di akun Anda.")

    # 2. Check if directory exists
    is_existing_git = False
    if os.path.exists(real_path) and os.path.isdir(os.path.join(real_path, ".git")):
        # Existing git repository found on disk, we can adopt it
        is_existing_git = True
    elif os.path.exists(real_path) and os.listdir(real_path):
        raise ValueError(f"Direktori {virtual_path} sudah ada dan tidak kosong di filesystem.")

    os.makedirs(real_path, exist_ok=True)

    default_branch = "main"
    remote_url_val = None

    if is_existing_git:
        # Detect active branch from existing repo
        _, branch_out, _ = run_git_cmd(["rev-parse", "--abbrev-ref", "HEAD"], cwd=real_path)
        if branch_out:
            default_branch = branch_out
        # Detect remote url if any
        _, remote_out, _ = run_git_cmd(["remote", "get-url", "origin"], cwd=real_path)
        if remote_out:
            remote_url_val = remote_out
    elif clone_url and clone_url.strip():
        valid_url = validate_clone_url(clone_url)
        remote_url_val = valid_url

        # Execute git clone
        code, out, err = run_git_cmd(["clone", "--", valid_url, "."], cwd=real_path, timeout=90)
        if code != 0:
            # Clean up on failure
            if os.path.exists(real_path):
                shutil.rmtree(real_path, ignore_errors=True)
            raise ValueError(f"Gagal melakukan cloning repositori: {err or out}")
        
        # Detect active branch
        _, branch_out, _ = run_git_cmd(["rev-parse", "--abbrev-ref", "HEAD"], cwd=real_path)
        if branch_out:
            default_branch = branch_out
    else:
        # Initialize new repository
        code, out, err = run_git_cmd(["init", "-b", "main"], cwd=real_path)
        if code != 0:
            # Fallback for older git without -b
            run_git_cmd(["init"], cwd=real_path)
            run_git_cmd(["checkout", "-b", "main"], cwd=real_path)

        # Set local committer info
        run_git_cmd(["config", "user.name", username], cwd=real_path)
        run_git_cmd(["config", "user.email", f"{username}@umpo.ac.id"], cwd=real_path)

        # Create initial README
        readme_path = os.path.join(real_path, "README.md")
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write(f"# {clean_name}\n\nRepositori Git™ Version Control MiraiGrid - Lab Teknik Informatika UMPO.\n")

        run_git_cmd(["add", "README.md"], cwd=real_path)
        run_git_cmd(["commit", "-m", "Initial commit"], cwd=real_path)

    # 3. Read current HEAD commit info
    head_hash = ""
    _, log_out, _ = run_git_cmd(["log", "-1", "--format=%H"], cwd=real_path)
    if log_out:
        head_hash = log_out

    # 4. Insert into database
    cur = await db.execute("""
        INSERT INTO git_repositories (
            user_id, name, path, filesystem_path, remote_url, default_branch, last_deployed_commit
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, clean_name, virtual_path, real_path, remote_url_val, default_branch, head_hash))
    await db.commit()
    repo_id = cur.lastrowid

    return {
        "id": repo_id,
        "name": clean_name,
        "path": virtual_path,
        "remote_url": remote_url_val,
        "default_branch": default_branch,
        "head_commit": head_hash
    }

async def get_repo_details(db: aiosqlite.Connection, user_id: int, repo_id: int) -> Dict[str, Any]:
    cur = await db.execute(
        "SELECT * FROM git_repositories WHERE id = ? AND user_id = ?",
        (repo_id, user_id)
    )
    row = await cur.fetchone()
    if not row:
        raise ValueError("Repositori tidak ditemukan atau Anda tidak memiliki akses.")

    repo = dict(row)
    real_path = repo["filesystem_path"]

    if not os.path.exists(real_path) or not os.path.exists(os.path.join(real_path, ".git")):
        repo["status"] = "missing_directory"
        repo["branches"] = [repo["default_branch"] or "main"]
        repo["head_commit"] = None
        return repo

    # 1. Current Branch
    _, curr_branch, _ = run_git_cmd(["rev-parse", "--abbrev-ref", "HEAD"], cwd=real_path)
    repo["current_branch"] = curr_branch or repo["default_branch"] or "main"

    # 2. Local Branches
    _, branches_out, _ = run_git_cmd(["for-each-ref", "--format=%(refname:short)", "refs/heads/"], cwd=real_path)
    branches = [b.strip() for b in branches_out.splitlines() if b.strip()]
    if repo["current_branch"] not in branches and repo["current_branch"]:
        branches.append(repo["current_branch"])
    repo["branches"] = branches or ["main"]

    # 3. HEAD Commit Info
    fmt = "%H%x1f%h%x1f%an%x1f%ae%x1f%ad%x1f%s"
    _, log_out, _ = run_git_cmd(["log", "-1", f"--format={fmt}", "--date=iso"], cwd=real_path)
    if log_out and "\x1f" in log_out:
        parts = log_out.split("\x1f")
        repo["head_commit"] = {
            "hash": parts[0],
            "short_hash": parts[1] if len(parts) > 1 else parts[0][:7],
            "author_name": parts[2] if len(parts) > 2 else "",
            "author_email": parts[3] if len(parts) > 3 else "",
            "date": parts[4] if len(parts) > 4 else "",
            "message": parts[5] if len(parts) > 5 else ""
        }
    else:
        repo["head_commit"] = None

    # 4. Remote URL
    _, remote_out, _ = run_git_cmd(["remote", "get-url", "origin"], cwd=real_path)
    if remote_out:
        repo["remote_url"] = remote_out

    return repo

async def list_user_repos(db: aiosqlite.Connection, user_id: int, is_admin: bool = False) -> List[Dict[str, Any]]:
    if is_admin:
        cur = await db.execute("""
            SELECT r.*, u.username as owner_username, u.name as owner_name
            FROM git_repositories r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.id DESC
        """)
    else:
        cur = await db.execute("""
            SELECT r.*, u.username as owner_username, u.name as owner_name
            FROM git_repositories r
            JOIN users u ON r.user_id = u.id
            WHERE r.user_id = ?
            ORDER BY r.id DESC
        """, (user_id,))
    rows = await cur.fetchall()
    repos = []
    for r in rows:
        d = dict(r)
        real_path = d["filesystem_path"]
        if os.path.exists(real_path) and os.path.exists(os.path.join(real_path, ".git")):
            _, curr_branch, _ = run_git_cmd(["rev-parse", "--abbrev-ref", "HEAD"], cwd=real_path)
            d["current_branch"] = curr_branch or d["default_branch"] or "main"
            
            fmt = "%h%x1f%s%x1f%ad"
            _, log_out, _ = run_git_cmd(["log", "-1", f"--format={fmt}", "--date=short"], cwd=real_path)
            if log_out and "\x1f" in log_out:
                parts = log_out.split("\x1f")
                d["last_commit_short"] = parts[0]
                d["last_commit_message"] = parts[1] if len(parts) > 1 else ""
                d["last_commit_date"] = parts[2] if len(parts) > 2 else ""
            else:
                d["last_commit_short"] = ""
                d["last_commit_message"] = ""
                d["last_commit_date"] = ""
        else:
            d["current_branch"] = d["default_branch"] or "main"
            d["last_commit_short"] = ""
            d["last_commit_message"] = ""
            d["last_commit_date"] = ""

        repos.append(d)
    return repos

async def get_commit_history(db: aiosqlite.Connection, user_id: int, repo_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    details = await get_repo_details(db, user_id, repo_id)
    real_path = details["filesystem_path"]

    if not os.path.exists(real_path) or not os.path.exists(os.path.join(real_path, ".git")):
        return []

    fmt = "%H%x1f%h%x1f%an%x1f%ae%x1f%ad%x1f%s"
    code, log_out, err = run_git_cmd(
        ["log", f"-n{limit}", f"--format={fmt}", "--date=format:%Y-%m-%d %H:%M:%S"],
        cwd=real_path
    )
    if code != 0 or not log_out:
        return []

    commits = []
    for line in log_out.splitlines():
        if not line.strip() or "\x1f" not in line:
            continue
        parts = line.split("\x1f")
        commits.append({
            "hash": parts[0],
            "short_hash": parts[1] if len(parts) > 1 else parts[0][:7],
            "author_name": parts[2] if len(parts) > 2 else "",
            "author_email": parts[3] if len(parts) > 3 else "",
            "date": parts[4] if len(parts) > 4 else "",
            "message": parts[5] if len(parts) > 5 else ""
        })
    return commits

async def update_from_remote(db: aiosqlite.Connection, user_id: int, repo_id: int) -> Dict[str, Any]:
    details = await get_repo_details(db, user_id, repo_id)
    real_path = details["filesystem_path"]
    curr_branch = details["current_branch"]

    # 1. Fetch
    code_f, out_f, err_f = run_git_cmd(["fetch", "origin"], cwd=real_path, timeout=60)
    if code_f != 0:
        raise ValueError(f"Gagal melakukan 'git fetch origin': {err_f or out_f}")

    # 2. Pull
    code_p, out_p, err_p = run_git_cmd(["pull", "origin", curr_branch], cwd=real_path, timeout=60)
    if code_p != 0:
        raise ValueError(f"Gagal melakukan 'git pull origin {curr_branch}': {err_p or out_p}")

    now_iso = datetime.utcnow().isoformat()
    await db.execute(
        "UPDATE git_repositories SET updated_at = ? WHERE id = ?",
        (now_iso, repo_id)
    )
    await db.commit()

    updated = await get_repo_details(db, user_id, repo_id)
    return {
        "success": True,
        "message": out_p or "Repositori berhasil diperbarui dari remote.",
        "output": f"{out_f}\n{out_p}".strip(),
        "head_commit": updated.get("head_commit")
    }

async def checkout_branch(db: aiosqlite.Connection, user_id: int, repo_id: int, branch: str) -> Dict[str, Any]:
    clean_branch = branch.strip()
    if not clean_branch or not re.match(r"^[a-zA-Z0-9_\-\./]+$", clean_branch):
        raise ValueError("Nama branch tidak valid.")

    details = await get_repo_details(db, user_id, repo_id)
    real_path = details["filesystem_path"]

    code, out, err = run_git_cmd(["checkout", clean_branch], cwd=real_path)
    if code != 0:
        raise ValueError(f"Gagal beralih ke branch '{clean_branch}': {err or out}")

    await db.execute(
        "UPDATE git_repositories SET default_branch = ?, updated_at = ? WHERE id = ?",
        (clean_branch, datetime.utcnow().isoformat(), repo_id)
    )
    await db.commit()

    updated = await get_repo_details(db, user_id, repo_id)
    return {
        "success": True,
        "message": f"Berhasil checkout ke branch '{clean_branch}'.",
        "current_branch": clean_branch,
        "head_commit": updated.get("head_commit")
    }

async def deploy_head_commit(
    db: aiosqlite.Connection,
    user_id: int,
    username: str,
    repo_id: int,
    target_project_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Deploys the repository's files into the student's project workspace.
    Synchronizes files excluding .git metadata.
    """
    details = await get_repo_details(db, user_id, repo_id)
    repo_real_path = details["filesystem_path"]

    # Determine destination project workspace
    project_row = None
    if target_project_id:
        cur = await db.execute(
            "SELECT * FROM projects WHERE id = ? AND user_id = ?",
            (target_project_id, user_id)
        )
        project_row = await cur.fetchone()
        if not project_row:
            raise ValueError("Target project tidak ditemukan atau Anda tidak memiliki akses.")
    else:
        # Auto-detect user's first/active project
        cur = await db.execute(
            "SELECT * FROM projects WHERE user_id = ? ORDER BY id ASC LIMIT 1",
            (user_id,)
        )
        project_row = await cur.fetchone()

    target_name = ""
    target_dir = None
    synced_files_count = 0

    if project_row:
        p_data = dict(project_row)
        target_name = p_data["name"]
        target_dir = os.path.realpath(os.path.join(settings.PROJECTS_DIR, f"{username}_{target_name}"))
        os.makedirs(target_dir, exist_ok=True)

        # Copy files excluding .git
        for item in os.listdir(repo_real_path):
            if item == ".git":
                continue
            s = os.path.join(repo_real_path, item)
            d = os.path.join(target_dir, item)
            if os.path.isdir(s):
                shutil.copytree(s, d, dirs_exist_ok=True)
            else:
                shutil.copy2(s, d)
            synced_files_count += 1

    head_hash = ""
    if details.get("head_commit"):
        head_hash = details["head_commit"].get("hash", "")

    now_iso = datetime.utcnow().isoformat()
    await db.execute("""
        UPDATE git_repositories
        SET last_deployed_at = ?, last_deployed_commit = ?, target_project_id = ?
        WHERE id = ?
    """, (now_iso, head_hash, target_project_id or (project_row["id"] if project_row else None), repo_id))
    await db.commit()

    return {
        "success": True,
        "message": f"Deployment commit {head_hash[:7]} berhasil diterapkan" + (f" ke project '{target_name}'." if target_name else "."),
        "deployed_commit": head_hash,
        "deployed_at": now_iso,
        "target_project": target_name,
        "synced_items": synced_files_count
    }

async def remove_repository(
    db: aiosqlite.Connection,
    user_id: int,
    repo_id: int,
    delete_files: bool = False
) -> Dict[str, Any]:
    """
    Removes the repository from MiraiGrid Git™ Version Control.
    If delete_files is False (default), the files in File Manager remain untouched!
    """
    details = await get_repo_details(db, user_id, repo_id)
    real_path = details["filesystem_path"]

    # 1. Delete from database
    await db.execute("DELETE FROM git_repositories WHERE id = ? AND user_id = ?", (repo_id, user_id))
    await db.commit()

    deleted_from_disk = False
    if delete_files:
        if os.path.exists(real_path):
            shutil.rmtree(real_path, ignore_errors=True)
            deleted_from_disk = True

    return {
        "success": True,
        "message": f"Repositori '{details['name']}' berhasil dihapus dari Git™ Version Control" +
                   (" beserta seluruh filenya di disk." if deleted_from_disk else " (file di File Manager tetap dipertahankan)."),
        "deleted_from_disk": deleted_from_disk
    }
