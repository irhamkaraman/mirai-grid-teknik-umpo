import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import aiosqlite
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_flexible, get_client_ip
from app.services import git_manager
from app.services.file_manager import list_directory_contents, get_directory_tree, extract_zip_archive

router = APIRouter(prefix="/git", tags=["Git Version Control"])

class CreateRepoRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    clone_url: Optional[str] = None
    is_clone: bool = False

class CheckoutBranchRequest(BaseModel):
    branch: str = Field(..., min_length=1, max_length=100)

class DeployRepoRequest(BaseModel):
    target_project_id: Optional[int] = None

@router.get("/repositories")
async def list_repositories(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        is_admin = current_user.get("role") == "admin"
        repos = await git_manager.list_user_repos(db, current_user["id"], is_admin=is_admin)
        return {"success": True, "repositories": repos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/repositories")
async def create_repository(
    body: CreateRepoRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        clone_url_param = body.clone_url if body.is_clone else None
        res = await git_manager.create_or_clone_repo(
            db,
            user_id=current_user["id"],
            username=current_user["username"],
            repo_name=body.name,
            clone_url=clone_url_param
        )

        ip = get_client_ip(request)
        action_name = "GIT_CLONE" if body.is_clone else "GIT_INIT"
        await db.execute("""
            INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
            VALUES (?, ?, 'git_version_control', ?, ?)
        """, (current_user["id"], action_name, ip, f"Created repository {body.name} at {res['path']}"))
        await db.commit()

        return {"success": True, "data": res}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/repositories/{repo_id}")
async def get_repository_details(
    repo_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        details = await git_manager.get_repo_details(db, current_user["id"], repo_id)
        return {"success": True, "repository": details}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/repositories/{repo_id}/history")
async def get_repository_history(
    repo_id: int,
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        history = await git_manager.get_commit_history(db, current_user["id"], repo_id, limit=limit)
        return {"success": True, "commits": history}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/repositories/{repo_id}/pull")
async def pull_from_remote(
    repo_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        res = await git_manager.update_from_remote(db, current_user["id"], repo_id)
        ip = get_client_ip(request)
        await db.execute("""
            INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
            VALUES (?, 'GIT_PULL', 'git_version_control', ?, ?)
        """, (current_user["id"], ip, f"Pulled updates for repo ID {repo_id}"))
        await db.commit()
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/repositories/{repo_id}/checkout")
async def checkout_branch(
    repo_id: int,
    body: CheckoutBranchRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        res = await git_manager.checkout_branch(db, current_user["id"], repo_id, body.branch)
        ip = get_client_ip(request)
        await db.execute("""
            INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
            VALUES (?, 'GIT_CHECKOUT', 'git_version_control', ?, ?)
        """, (current_user["id"], ip, f"Checked out branch '{body.branch}' in repo ID {repo_id}"))
        await db.commit()
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/repositories/{repo_id}/deploy")
async def deploy_head(
    repo_id: int,
    body: Optional[DeployRepoRequest] = None,
    request: Request = None,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        target_proj = body.target_project_id if body else None
        res = await git_manager.deploy_head_commit(
            db,
            user_id=current_user["id"],
            username=current_user["username"],
            repo_id=repo_id,
            target_project_id=target_proj
        )
        ip = get_client_ip(request) if request else ""
        await db.execute("""
            INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
            VALUES (?, 'GIT_DEPLOY', 'git_version_control', ?, ?)
        """, (current_user["id"], ip, f"Deployed HEAD commit in repo ID {repo_id} to workspace"))
        await db.commit()
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/repositories/{repo_id}")
async def remove_repository(
    repo_id: int,
    delete_files: bool = Query(False, description="Whether to also delete repository files from disk"),
    request: Request = None,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        res = await git_manager.remove_repository(db, current_user["id"], repo_id, delete_files=delete_files)
        ip = get_client_ip(request) if request else ""
        await db.execute("""
            INSERT INTO audit_logs (actor_id, action, target_resource, ip_address, details)
            VALUES (?, 'GIT_REMOVE', 'git_version_control', ?, ?)
        """, (current_user["id"], ip, f"Removed repo ID {repo_id} (delete_files={delete_files})"))
        await db.commit()
        return res
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =========================================================
# CPANEL-STYLE REPOSITORY FILE MANAGER INTEGRATION
# Memungkinkan Repositori Git Dibuka & Dijelajahi di File Manager
# =========================================================
def get_safe_repo_subpath(repo_root: str, subpath: str = "") -> str:
    if "\x00" in subpath:
        raise HTTPException(status_code=400, detail="Null byte terdeteksi.")
    if not subpath or subpath.strip() in ["/", "\\", "."]:
        return repo_root
    clean_sub = subpath.strip().lstrip("/\\")
    target = os.path.realpath(os.path.join(repo_root, clean_sub))
    try:
        common = os.path.commonpath([repo_root, target])
    except ValueError:
        raise HTTPException(status_code=403, detail="Akses di luar root direktori repositori dilarang.")
    if common != repo_root:
        raise HTTPException(status_code=403, detail="Akses di luar root direktori repositori dilarang.")
    return target

async def get_repo_with_access(repo_id: int, current_user: dict, db: aiosqlite.Connection) -> dict:
    is_admin = current_user.get("role") == "admin"
    if is_admin:
        cur = await db.execute("""
            SELECT r.*, u.username as owner_username, u.name as owner_name, u.role as owner_role
            FROM git_repositories r
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        """, (repo_id,))
    else:
        cur = await db.execute("""
            SELECT r.*, u.username as owner_username, u.name as owner_name, u.role as owner_role
            FROM git_repositories r
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ? AND r.user_id = ?
        """, (repo_id, current_user["id"]))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Repositori Git tidak ditemukan.")
    return dict(row)

@router.get("/repositories/{repo_id}/files")
async def get_repo_files(
    repo_id: int,
    path: str = Query("", description="Subdirectory path within repository"),
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    repo = await get_repo_with_access(repo_id, current_user, db)
    _, repo_root = git_manager.get_repo_paths(repo["owner_username"], repo["name"])
    if not os.path.exists(repo_root):
        raise HTTPException(status_code=404, detail="Direktori repositori belum ada pada disk.")
    target_dir = get_safe_repo_subpath(repo_root, path)
    items = list_directory_contents(target_dir, repo_root)
    clean_current = os.path.relpath(target_dir, repo_root).replace("\\", "/")
    if clean_current == ".":
        clean_current = ""
    return {
        "current_path": clean_current,
        "items": items
    }

@router.get("/repositories/{repo_id}/files/tree")
async def get_repo_files_tree(
    repo_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    repo = await get_repo_with_access(repo_id, current_user, db)
    _, repo_root = git_manager.get_repo_paths(repo["owner_username"], repo["name"])
    if not os.path.exists(repo_root):
        return {"tree": {"name": repo["name"], "path": "", "is_dir": True, "children": []}}
    tree = get_directory_tree(repo_root)
    return {"tree": tree}

@router.get("/repositories/{repo_id}/files/content")
async def get_repo_file_content(
    repo_id: int,
    path: str = Query(..., description="File path relative to repository root"),
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    repo = await get_repo_with_access(repo_id, current_user, db)
    _, repo_root = git_manager.get_repo_paths(repo["owner_username"], repo["name"])
    file_path = get_safe_repo_subpath(repo_root, path)
    if not os.path.exists(file_path) or os.path.isdir(file_path):
        raise HTTPException(status_code=404, detail="File tidak ditemukan.")
    if os.path.getsize(file_path) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File terlalu besar untuk dibuka di editor (Maksimal 2MB).")
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    return {"path": path, "content": content}

@router.post("/repositories/{repo_id}/files/save")
async def save_repo_file_content(
    repo_id: int,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    repo = await get_repo_with_access(repo_id, current_user, db)
    _, repo_root = git_manager.get_repo_paths(repo["owner_username"], repo["name"])
    file_path = get_safe_repo_subpath(repo_root, body.get("path", ""))
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(body.get("content", ""))
    return {"success": True, "message": "File repositori berhasil disimpan."}

@router.get("/repositories/{repo_id}/files/download")
async def download_repo_file(
    repo_id: int,
    path: str = Query(..., description="File path relative to repository root"),
    current_user: dict = Depends(get_current_user_flexible),
    db: aiosqlite.Connection = Depends(get_db)
):
    repo = await get_repo_with_access(repo_id, current_user, db)
    _, repo_root = git_manager.get_repo_paths(repo["owner_username"], repo["name"])
    file_path = get_safe_repo_subpath(repo_root, path)
    if not os.path.exists(file_path) or os.path.isdir(file_path):
        raise HTTPException(status_code=404, detail="File tidak ditemukan.")
    return FileResponse(file_path, filename=os.path.basename(file_path))

@router.post("/repositories/{repo_id}/files/upload")
async def upload_files_to_repo(
    repo_id: int,
    path: str = Form(""),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    repo = await get_repo_with_access(repo_id, current_user, db)
    _, repo_root = git_manager.get_repo_paths(repo["owner_username"], repo["name"])
    target_dir = get_safe_repo_subpath(repo_root, path)
    dest_file = os.path.join(target_dir, file.filename)
    with open(dest_file, "wb") as f:
        shutil.copyfileobj(file.file, f)
    if file.filename.lower().endswith(".zip"):
        extract_zip_archive(dest_file, target_dir, repo_root)
        try:
            os.remove(dest_file)
        except Exception:
            pass
    return {"success": True, "message": f"File '{file.filename}' berhasil di-upload ke repositori."}

@router.post("/repositories/{repo_id}/files/new")
async def create_new_repo_file_or_dir(
    repo_id: int,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    repo = await get_repo_with_access(repo_id, current_user, db)
    _, repo_root = git_manager.get_repo_paths(repo["owner_username"], repo["name"])
    parent_dir = get_safe_repo_subpath(repo_root, body.get("path", ""))
    target = os.path.join(parent_dir, body.get("name", ""))
    get_safe_repo_subpath(repo_root, os.path.relpath(target, repo_root))
    if body.get("is_dir"):
        os.makedirs(target, exist_ok=True)
    else:
        with open(target, "w", encoding="utf-8") as f:
            f.write("")
    return {"success": True, "message": f"Item '{body.get('name')}' berhasil dibuat."}

@router.post("/repositories/{repo_id}/files/rename")
async def rename_repo_file_or_dir(
    repo_id: int,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    repo = await get_repo_with_access(repo_id, current_user, db)
    _, repo_root = git_manager.get_repo_paths(repo["owner_username"], repo["name"])
    old_target = get_safe_repo_subpath(repo_root, body.get("old_path", ""))
    parent = os.path.dirname(old_target)
    new_target = os.path.join(parent, body.get("new_name", ""))
    get_safe_repo_subpath(repo_root, os.path.relpath(new_target, repo_root))
    os.rename(old_target, new_target)
    return {"success": True, "message": "Item berhasil diubah namanya."}

@router.delete("/repositories/{repo_id}/files")
async def delete_repo_file_or_dir(
    repo_id: int,
    path: str = Query(..., description="Path to delete"),
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    repo = await get_repo_with_access(repo_id, current_user, db)
    _, repo_root = git_manager.get_repo_paths(repo["owner_username"], repo["name"])
    target = get_safe_repo_subpath(repo_root, path)
    if not os.path.exists(target):
        raise HTTPException(status_code=404, detail="Item tidak ditemukan.")
    if os.path.isdir(target):
        shutil.rmtree(target)
    else:
        os.remove(target)
    return {"success": True, "message": "Item berhasil dihapus."}

