import os
import shutil
import zipfile
import pathlib
import io
import stat
import mimetypes
import logging
from urllib.parse import unquote
from typing import List, Optional, Union

logger = logging.getLogger("miraigrid.security")
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Body, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
import aiosqlite

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.services.file_manager import (
    list_directory_contents,
    get_directory_tree,
    get_octal_permissions
)
from app.services.user_home import ensure_user_home
from app.services.disk_usage import calculate_account_disk_usage

router = APIRouter(prefix="/files", tags=["User Home File Manager"])

class SaveFileRequest(BaseModel):
    path: str
    content: str

class NewItemRequest(BaseModel):
    path: str = ""
    name: str
    is_dir: Optional[bool] = False
    type: Optional[str] = "file"

class RenameItemRequest(BaseModel):
    old_path: str
    new_name: str

class CopyMoveRequest(BaseModel):
    source_path: str
    dest_dir: Optional[str] = None
    destination_dir: Optional[str] = None

class PermissionsRequest(BaseModel):
    path: str
    permissions: str  # e.g. "0755"

class CompressRequest(BaseModel):
    paths: List[str]
    destination_zip: Optional[str] = None
    archive_name: Optional[str] = None
    destination_dir: Optional[str] = ""

class ExtractRequest(BaseModel):
    zip_path: Optional[str] = None
    archive_path: Optional[str] = None
    extract_to: Optional[str] = None
    destination_dir: Optional[str] = ""

class DeleteFilesRequest(BaseModel):
    paths: Optional[List[str]] = None
    path: Optional[str] = None
    permanent: bool = True


def resolve_safe_user_path(home_dir: str, subpath: str = "") -> str:
    """
    Resolves subpath inside user's isolated home directory.
    Strictly verifies that the resolved path does not escape home_dir or user's isolated repositories.
    Supports relative paths, root ('/'), and absolute virtual paths like '/home/{username}/public_html'.
    """
    user_root = os.path.abspath(os.path.realpath(home_dir))
    if not subpath:
        return user_root

    username = os.path.basename(user_root)
    raw = str(subpath)
    decoded = unquote(raw)
    lower_raw = raw.lower()
    lower_dec = decoded.lower()

    # 1. Block null bytes, parent traversal (..), home tilde (~), and encoded variants
    if (
        "\x00" in raw
        or "\x00" in decoded
        or "%00" in lower_raw
        or "%2e%2e" in lower_raw
        or ".." in raw.replace("\\", "/").split("/")
        or ".." in decoded.replace("\\", "/").split("/")
        or "../" in raw
        or "..\\" in raw
        or "../" in decoded
        or "..\\" in decoded
        or decoded.strip().startswith("~")
        or "/~" in decoded.replace("\\", "/")
    ):
        logger.warning(
            f"[SECURITY ALERT] Path Traversal blocked for user='{username}' | raw_subpath='{raw}'"
        )
        raise HTTPException(
            status_code=403,
            detail="Akses Ditolak: Percobaan pelanggaran batas direktori sandbox (Path Traversal Detected)!"
        )

    s = decoded.strip().replace("\\", "/")

    # 2. Check and strip absolute /home/{username} prefix, or block cross-user /home/{other} & system roots
    if s.startswith(f"/home/{username}/"):
        s = s[len(f"/home/{username}/"):]
    elif s in (f"/home/{username}", f"/home/{username}/"):
        s = ""
    elif s.startswith(f"home/{username}/"):
        s = s[len(f"home/{username}/"):]
    elif s in (f"home/{username}", f"home/{username}/"):
        s = ""
    elif s.startswith("/home/") or s.startswith("home/"):
        logger.warning(
            f"[SECURITY ALERT] Cross-account sandbox access blocked for user='{username}' | target='{raw}'"
        )
        raise HTTPException(
            status_code=403,
            detail="Akses Ditolak: Percobaan pelanggaran batas direktori sandbox (Path Traversal Detected)!"
        )
    elif s.startswith(("/etc/", "/etc", "/root/", "/root", "/proc/", "/sys/", "/var/", "/boot/", "/usr/", "/bin/", "/sbin/")):
        logger.warning(
            f"[SECURITY ALERT] System directory access blocked for user='{username}' | target='{raw}'"
        )
        raise HTTPException(
            status_code=403,
            detail="Akses Ditolak: Percobaan pelanggaran batas direktori sandbox (Path Traversal Detected)!"
        )

    clean_sub = s.strip().lstrip("/")
    if not clean_sub or clean_sub in (".", ""):
        return user_root

    combined = os.path.join(user_root, clean_sub)
    resolved = os.path.abspath(os.path.realpath(combined))

    allowed_roots = [user_root]
    data_base = os.path.dirname(os.path.dirname(user_root))
    user_repo_dir = os.path.abspath(os.path.realpath(os.path.join(data_base, "repositories", username)))
    if os.path.exists(user_repo_dir):
        allowed_roots.append(user_repo_dir)

    is_safe = False
    for root in allowed_roots:
        try:
            if os.path.commonpath([root, resolved]) == root and (
                resolved == root or resolved.startswith(root + os.sep)
            ):
                is_safe = True
                break
        except ValueError:
            pass

    if not is_safe:
        logger.warning(
            f"[SECURITY ALERT] Resolved path escaped sandbox for user='{username}' | resolved='{resolved}' | root='{user_root}'"
        )
        raise HTTPException(
            status_code=403,
            detail="Akses Ditolak: Percobaan pelanggaran batas direktori sandbox (Path Traversal Detected)!"
        )

    return resolved


def resolve_admin_home_path(base_home_root: str, admin_username: str, subpath: str = "") -> str:
    """
    Resolves a path inside /home for Admin Multi-Tenant File Manager while still
    blocking path traversal and OS system directories (/etc, /root, /proc, etc.).
    """
    base_root = os.path.abspath(os.path.realpath(base_home_root))
    raw = str(subpath or "")
    decoded = unquote(unquote(raw))

    if (
        "\x00" in raw
        or "\x00" in decoded
        or ".." in raw.replace("\\", "/").split("/")
        or ".." in decoded.replace("\\", "/").split("/")
        or "../" in raw
        or "..\\" in raw
        or "../" in decoded
        or "..\\" in decoded
        or decoded.strip().startswith("~")
        or "/~" in decoded.replace("\\", "/")
    ):
        logger.warning(f"[SECURITY ALERT] Admin path traversal blocked for user='{admin_username}' | raw='{raw}'")
        raise HTTPException(status_code=403, detail="Akses Ditolak: Path Traversal terdeteksi.")

    s = decoded.strip().replace("\\", "/")
    if s in ("/", "/home", "/home/", "home", "home/", ""):
        return base_root
    if s.startswith("/home/"):
        s = s[len("/home/"):]
    elif s.startswith("home/"):
        s = s[len("home/"):]
    elif s.startswith(("/etc/", "/etc", "/root/", "/root", "/proc/", "/sys/", "/var/", "/boot/", "/usr/", "/bin/", "/sbin/")):
        logger.warning(f"[SECURITY ALERT] Admin system directory access blocked | target='{raw}'")
        raise HTTPException(status_code=403, detail="Akses Ditolak: Direktori sistem tidak dapat diakses dari File Manager.")

    clean_sub = s.strip().lstrip("/")
    if not clean_sub or clean_sub in (".", ""):
        return base_root

    resolved = os.path.abspath(os.path.realpath(os.path.join(base_root, clean_sub)))
    try:
        if os.path.commonpath([base_root, resolved]) != base_root:
            raise HTTPException(status_code=403, detail="Akses Ditolak: Path keluar dari direktori /home.")
    except ValueError:
        raise HTTPException(status_code=403, detail="Akses Ditolak: Path tidak valid.")
    return resolved


def resolve_workspace_root_and_path(current_user: dict, subpath: str = "") -> tuple[str, str, bool]:
    """
    Returns (workspace_root, resolved_target_path, is_admin_mode).
    For admin: workspace_root is /home (multi-tenant).
    For non-admin: workspace_root is /home/{username} (strict sandbox).
    """
    username = current_user["username"]
    home_dir = ensure_user_home(username, current_user.get("name"), current_user.get("email"))
    is_admin = current_user.get("role") == "admin"
    if is_admin:
        base_home_root = os.path.abspath(os.path.realpath(os.path.dirname(home_dir)))
        target = resolve_admin_home_path(base_home_root, username, subpath)
        return base_home_root, target, True
    target = resolve_safe_user_path(home_dir, subpath)
    return os.path.abspath(os.path.realpath(home_dir)), target, False


async def _get_users_role_map() -> dict:
    role_map = {}
    try:
        async with aiosqlite.connect(settings.DATABASE_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT username, name, role FROM users")
            for r in await cursor.fetchall():
                role_map[r["username"]] = {"name": r["name"], "role": r["role"]}
    except Exception:
        pass
    return role_map


def _format_owner_meta(target_username: str, users_map: dict) -> dict:
    info = users_map.get(target_username)
    if not info:
        return {
            "owner_username": target_username,
            "owner_role": "system",
            "owner_label": f"Sistem ({target_username})" if target_username else "Sistem",
        }
    role = (info.get("role") or "student").lower()
    if role == "dosen":
        label = f"Dosen ({target_username})"
    elif role == "admin":
        label = f"Administrator ({target_username})"
    else:
        label = f"Mahasiswa ({target_username})"
    return {
        "owner_username": target_username,
        "owner_role": role,
        "owner_label": label,
    }


def _extract_target_username_from_admin_path(resolved_path: str, base_home_root: str) -> Optional[str]:
    rel = os.path.relpath(resolved_path, base_home_root).replace("\\", "/")
    if rel in (".", ""):
        return None
    first_seg = rel.split("/", 1)[0]
    if not first_seg or first_seg in (".", ".."):
        return None
    return first_seg


def _chown_to_target_home(target_path: str, base_home_root: str, target_username: Optional[str], recursive: bool = False) -> None:
    if not target_username or not hasattr(os, "chown"):
        return
    owner_home = os.path.join(base_home_root, target_username)
    if not os.path.exists(owner_home):
        return
    try:
        st = os.stat(owner_home)
        uid, gid = st.st_uid, st.st_gid
        os.chown(target_path, uid, gid)
        if recursive and os.path.isdir(target_path):
            for root, dirs, files in os.walk(target_path):
                for d in dirs:
                    try:
                        os.chown(os.path.join(root, d), uid, gid)
                    except Exception:
                        pass
                for f in files:
                    try:
                        os.chown(os.path.join(root, f), uid, gid)
                    except Exception:
                        pass
    except Exception:
        pass


async def _enforce_target_disk_quota(target_username: str, incoming_bytes: int, is_admin_fallback: bool = False) -> None:
    if not target_username:
        return
    max_disk_mb = 20000.0 if is_admin_fallback else 10240.0
    try:
        async with aiosqlite.connect(settings.DATABASE_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT u.role, q.max_disk_mb
                FROM users u
                LEFT JOIN quotas q ON q.user_id = u.id
                WHERE u.username = ?
            """, (target_username,))
            row = await cursor.fetchone()
            if row:
                if row["max_disk_mb"]:
                    max_disk_mb = float(row["max_disk_mb"])
                elif row["role"] == "dosen":
                    max_disk_mb = 20480.0
                elif row["role"] == "admin":
                    max_disk_mb = 20000.0
    except Exception:
        pass

    disk_used_mb, _ = calculate_account_disk_usage(target_username)
    if disk_used_mb + (incoming_bytes / (1024 * 1024)) > max_disk_mb:
        raise HTTPException(
            status_code=413,
            detail=f"Kapasitas penyimpanan '{target_username}' telah mencapai batas kuota ({int(max_disk_mb)} MB). Sisa kuota: {max(0.0, round(max_disk_mb - disk_used_mb, 1))} MB."
        )


@router.get("")
async def get_user_files(
    path: str = Query("", description="Subdirectory path within /home/{username} or /home for admin"),
    current_user: dict = Depends(get_current_user)
):
    """
    Lists directory contents of the user's isolated home directory (/home/{username}),
    or multi-tenant /home explorer when logged in as admin.
    """
    username = current_user["username"]
    ws_root, target_dir, is_admin_mode = resolve_workspace_root_and_path(current_user, path)

    if not os.path.exists(target_dir):
        raise HTTPException(status_code=404, detail="Direktori tidak ditemukan.")
    if not os.path.isdir(target_dir):
        raise HTTPException(status_code=400, detail="Path bukan merupakan direktori.")

    items = list_directory_contents(target_dir, ws_root)
    if is_admin_mode:
        users_map = await _get_users_role_map()
        for item in items:
            first_seg = (item.get("path") or "").split("/", 1)[0]
            meta = _format_owner_meta(first_seg, users_map)
            item.update(meta)

    rel_path = os.path.relpath(target_dir, ws_root).replace("\\", "/")
    if rel_path == ".":
        rel_path = ""

    root_label = "/home" if is_admin_mode else f"/home/{username}"
    return {
        "root": root_label,
        "current_path": rel_path,
        "virtual_path": f"{root_label}/{rel_path}".rstrip("/") if rel_path else root_label,
        "is_admin_root": is_admin_mode,
        "items": items
    }


@router.get("/tree")
async def get_user_files_tree(
    current_user: dict = Depends(get_current_user)
):
    """
    Returns directory tree for cPanel-style left sidebar folder explorer.
    Root node is (/home/{username}) or (/home) for admin.
    """
    username = current_user["username"]
    ws_root, _, is_admin_mode = resolve_workspace_root_and_path(current_user, "")

    tree = get_directory_tree(ws_root, max_depth=2 if is_admin_mode else 3)
    tree["name"] = "(/home)" if is_admin_mode else f"(/home/{username})"
    tree["virtual_path"] = "/home" if is_admin_mode else f"/home/{username}"
    tree["is_root"] = True

    return {"tree": tree}


@router.get("/content")
async def get_user_file_content(
    path: str = Query(..., description="File path relative to workspace root"),
    current_user: dict = Depends(get_current_user)
):
    """
    Reads file content for preview or editing in code editor.
    """
    _, target_file, _ = resolve_workspace_root_and_path(current_user, path)

    if not os.path.exists(target_file) or os.path.isdir(target_file):
        raise HTTPException(status_code=404, detail="File tidak ditemukan.")

    file_size = os.path.getsize(target_file)
    if file_size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file terlalu besar untuk editor teks (maks 5 MB).")

    try:
        with open(target_file, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return {
            "path": path,
            "content": content,
            "size": file_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal membaca file: {e}")


@router.post("/save")
async def save_user_file_content(
    req: SaveFileRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Saves edited text/code file. For admin in /home/<target_user>, enforces target quota & chown.
    """
    ws_root, target_file, is_admin_mode = resolve_workspace_root_and_path(current_user, req.path)

    if os.path.isdir(target_file):
        raise HTTPException(status_code=400, detail="Target merupakan direktori, bukan file.")

    target_username = _extract_target_username_from_admin_path(target_file, ws_root) if is_admin_mode else current_user["username"]
    if is_admin_mode and not target_username:
        raise HTTPException(status_code=400, detail="Admin harus menyimpan file di dalam folder akun pengguna (/home/<username>/...).")

    new_bytes = len((req.content or "").encode("utf-8"))
    old_bytes = os.path.getsize(target_file) if os.path.isfile(target_file) else 0
    delta_bytes = max(0, new_bytes - old_bytes)
    if delta_bytes > 0 and target_username:
        await _enforce_target_disk_quota(target_username, delta_bytes, is_admin_fallback=(target_username == current_user["username"] and is_admin_mode))

    try:
        os.makedirs(os.path.dirname(target_file), exist_ok=True)
        with open(target_file, "w", encoding="utf-8") as f:
            f.write(req.content)
        if is_admin_mode and target_username:
            _chown_to_target_home(target_file, ws_root, target_username, recursive=False)
        return {"success": True, "message": "File berhasil disimpan."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan file: {e}")


@router.post("/new")
async def create_new_user_item(
    req: NewItemRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Creates a new file or folder inside /home/{username}/<path> or /home/<target>/<path> (admin).
    """
    ws_root, parent_dir, is_admin_mode = resolve_workspace_root_and_path(current_user, req.path)

    clean_name = os.path.basename(req.name.strip())
    if not clean_name or clean_name in (".", ".."):
        raise HTTPException(status_code=400, detail="Nama file atau folder tidak valid.")

    target_path = os.path.join(parent_dir, clean_name)
    if os.path.exists(target_path):
        raise HTTPException(status_code=400, detail="File atau folder dengan nama tersebut sudah ada.")

    is_folder = bool(req.is_dir or req.type == "folder")
    target_username = _extract_target_username_from_admin_path(target_path, ws_root) if is_admin_mode else current_user["username"]
    if is_admin_mode and not is_folder and parent_dir == ws_root:
        raise HTTPException(status_code=400, detail="File baru harus dibuat di dalam folder akun pengguna (/home/<username>).")

    try:
        if is_folder:
            os.makedirs(target_path, exist_ok=True)
            os.chmod(target_path, 0o755)
        else:
            with open(target_path, "w", encoding="utf-8") as f:
                f.write("")
            os.chmod(target_path, 0o644)
        if is_admin_mode and target_username and parent_dir != ws_root:
            _chown_to_target_home(target_path, ws_root, target_username, recursive=False)
        item_label = "Folder" if is_folder else "File"
        return {"success": True, "message": f"{item_label} '{clean_name}' berhasil dibuat."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal membuat item: {e}")


@router.post("/rename")
async def rename_user_item(
    req: RenameItemRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Renames an existing file or folder.
    """
    ws_root, old_target, is_admin_mode = resolve_workspace_root_and_path(current_user, req.old_path)

    if not os.path.exists(old_target):
        raise HTTPException(status_code=404, detail="Item sumber tidak ditemukan.")
    if is_admin_mode and os.path.dirname(old_target) == ws_root:
        raise HTTPException(status_code=403, detail="Folder root akun pengguna di /home tidak dapat diubah nama.")

    clean_name = os.path.basename(req.new_name.strip())
    if not clean_name or clean_name in (".", ".."):
        raise HTTPException(status_code=400, detail="Nama baru tidak valid.")

    new_target = os.path.join(os.path.dirname(old_target), clean_name)
    if os.path.exists(new_target):
        raise HTTPException(status_code=400, detail="Item dengan nama baru tersebut sudah ada.")

    try:
        os.rename(old_target, new_target)
        return {"success": True, "message": "Item berhasil diubah nama."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengubah nama: {e}")


@router.post("/copy")
async def copy_user_item(
    req: CopyMoveRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Copies a file or folder into destination directory within workspace storage.
    """
    ws_root, src, is_admin_mode = resolve_workspace_root_and_path(current_user, req.source_path)
    dest_param = req.dest_dir if req.dest_dir is not None else (req.destination_dir or "")
    _, dst_dir, _ = resolve_workspace_root_and_path(current_user, dest_param)

    if not os.path.exists(src):
        raise HTTPException(status_code=404, detail=f"Item sumber '{req.source_path}' tidak ditemukan.")
    if not os.path.exists(dst_dir) or not os.path.isdir(dst_dir):
        raise HTTPException(status_code=400, detail=f"Direktori tujuan '{dest_param or '/'}' tidak valid atau tidak ditemukan.")

    base_name = os.path.basename(src)
    dst = os.path.join(dst_dir, base_name)
    if os.path.exists(dst):
        raise HTTPException(status_code=400, detail=f"Item dengan nama '{base_name}' sudah ada di direktori tujuan.")

    target_username = _extract_target_username_from_admin_path(dst, ws_root) if is_admin_mode else current_user["username"]
    if is_admin_mode and not target_username:
        raise HTTPException(status_code=400, detail="Tujuan salin harus di dalam folder akun pengguna (/home/<username>).")

    try:
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
        try:
            os.chmod(dst, 0o755 if os.path.isdir(dst) else 0o644)
        except Exception:
            pass
        if is_admin_mode and target_username:
            _chown_to_target_home(dst, ws_root, target_username, recursive=os.path.isdir(dst))
        return {"success": True, "message": f"Item '{base_name}' berhasil disalin ke '{dest_param or '/'}'."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menyalin item: {e}")


@router.post("/move")
async def move_user_item(
    req: CopyMoveRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Moves a file or folder into destination directory within workspace storage.
    """
    ws_root, src, is_admin_mode = resolve_workspace_root_and_path(current_user, req.source_path)
    dest_param = req.dest_dir if req.dest_dir is not None else (req.destination_dir or "")
    _, dst_dir, _ = resolve_workspace_root_and_path(current_user, dest_param)

    if not os.path.exists(src):
        raise HTTPException(status_code=404, detail=f"Item sumber '{req.source_path}' tidak ditemukan.")
    if not os.path.exists(dst_dir) or not os.path.isdir(dst_dir):
        raise HTTPException(status_code=400, detail=f"Direktori tujuan '{dest_param or '/'}' tidak valid atau tidak ditemukan.")

    base_name = os.path.basename(src)
    dst = os.path.join(dst_dir, base_name)
    if os.path.exists(dst):
        raise HTTPException(status_code=400, detail=f"Item dengan nama '{base_name}' sudah ada di direktori tujuan.")

    target_username = _extract_target_username_from_admin_path(dst, ws_root) if is_admin_mode else current_user["username"]
    try:
        shutil.move(src, dst)
        try:
            os.chmod(dst, 0o755 if os.path.isdir(dst) else 0o644)
        except Exception:
            pass
        if is_admin_mode and target_username:
            _chown_to_target_home(dst, ws_root, target_username, recursive=os.path.isdir(dst))
        return {"success": True, "message": f"Item '{base_name}' berhasil dipindahkan ke '{dest_param or '/'}'."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memindahkan item: {e}")


@router.post("/permissions")
async def update_user_item_permissions(
    req: PermissionsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Updates chmod octal permissions (e.g. 0755, 0644).
    """
    _, target, _ = resolve_workspace_root_and_path(current_user, req.path)

    if not os.path.exists(target):
        raise HTTPException(status_code=404, detail="Item tidak ditemukan.")

    try:
        mode = int(req.permissions, 8)
        os.chmod(target, mode)
        return {"success": True, "message": f"Hak akses berhasil diperbarui ke {req.permissions}."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Format permission tidak valid: {e}")


@router.post("/compress")
async def compress_user_items(
    req: CompressRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Compresses files/folders into a .zip archive.
    """
    ws_root, _, is_admin_mode = resolve_workspace_root_and_path(current_user, "")

    raw_zip = req.destination_zip or req.archive_name or "archive.zip"
    if "/" in raw_zip or "\\" in raw_zip:
        dst_dir_path = os.path.dirname(raw_zip)
        zip_fname = os.path.basename(raw_zip)
    else:
        dst_dir_path = req.destination_dir or ""
        zip_fname = raw_zip

    if not zip_fname.endswith(".zip"):
        zip_fname += ".zip"

    _, dst_dir, _ = resolve_workspace_root_and_path(current_user, dst_dir_path)
    zip_path = os.path.join(dst_dir, zip_fname)

    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for item_rel in req.paths:
                _, item_full, _ = resolve_workspace_root_and_path(current_user, item_rel)
                if os.path.isdir(item_full):
                    for root, _, files in os.walk(item_full):
                        for f in files:
                            abs_f = os.path.join(root, f)
                            arc_name = os.path.relpath(abs_f, os.path.dirname(item_full))
                            zf.write(abs_f, arc_name)
                elif os.path.isfile(item_full):
                    zf.write(item_full, os.path.basename(item_full))
        if is_admin_mode:
            target_username = _extract_target_username_from_admin_path(zip_path, ws_root)
            if target_username:
                _chown_to_target_home(zip_path, ws_root, target_username, recursive=False)
        return {"success": True, "message": f"Arsip '{zip_fname}' berhasil dibuat."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengompresi file: {e}")


@router.post("/extract")
async def extract_user_archive(
    req: ExtractRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Extracts a .zip archive safely preventing Zip Slip and enforcing storage quota.
    """
    archive_rel = req.zip_path or req.archive_path or ""
    dest_rel = req.extract_to or req.destination_dir or ""

    ws_root, archive_file, is_admin_mode = resolve_workspace_root_and_path(current_user, archive_rel)
    _, dst_dir, _ = resolve_workspace_root_and_path(current_user, dest_rel)

    if not os.path.exists(archive_file) or not zipfile.is_zipfile(archive_file):
        raise HTTPException(status_code=400, detail="File bukan merupakan arsip zip yang valid.")

    target_username = _extract_target_username_from_admin_path(dst_dir, ws_root) if is_admin_mode else current_user["username"]
    if is_admin_mode and not target_username:
        raise HTTPException(status_code=400, detail="Ekstraksi oleh admin harus dilakukan di dalam folder akun pengguna (/home/<username>).")

    try:
        with zipfile.ZipFile(archive_file, "r") as zf:
            total_uncompressed_bytes = sum(info.file_size for info in zf.infolist() if not info.is_dir())
            if target_username:
                await _enforce_target_disk_quota(
                    target_username,
                    total_uncompressed_bytes,
                    is_admin_fallback=(target_username == current_user["username"] and is_admin_mode)
                )

            for member in zf.namelist():
                extracted_path = os.path.realpath(os.path.join(dst_dir, member))
                if os.path.commonpath([dst_dir, extracted_path]) != dst_dir:
                    raise HTTPException(status_code=400, detail="Zip Slip terdeteksi pada arsip!")
            zf.extractall(dst_dir)
            if is_admin_mode and target_username:
                for member in zf.namelist():
                    extracted_path = os.path.realpath(os.path.join(dst_dir, member))
                    if os.path.exists(extracted_path):
                        _chown_to_target_home(extracted_path, ws_root, target_username, recursive=False)
        return {"success": True, "message": "Arsip berhasil diekstrak."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengekstrak arsip: {e}")


@router.get("/download")
async def download_user_file(
    path: str = Query(..., description="File path relative to workspace root"),
    inline: bool = Query(False, description="Serve file inline for in-browser preview (PDF, images, media)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Downloads a single file (or serves inline for browser preview) or compresses a directory on-the-fly for download.
    """
    _, target, _ = resolve_workspace_root_and_path(current_user, path)

    if not os.path.exists(target):
        raise HTTPException(status_code=404, detail="File atau folder tidak ditemukan.")

    if os.path.isfile(target):
        guessed_mime, _ = mimetypes.guess_type(target)
        media_type = guessed_mime or "application/octet-stream"
        fname = os.path.basename(target)
        if inline:
            return FileResponse(
                target,
                media_type=media_type,
                headers={"Content-Disposition": f'inline; filename="{fname}"'}
            )
        return FileResponse(target, media_type=media_type, filename=fname)

    # If directory, stream on-the-fly zip
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(target):
            for file in files:
                abs_f = os.path.join(root, file)
                rel_f = os.path.relpath(abs_f, target)
                zf.write(abs_f, rel_f)
    zip_buffer.seek(0)
    zip_name = f"{os.path.basename(target) or 'files'}.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={zip_name}"}
    )


@router.post("/upload")
async def upload_user_files(
    path: Optional[str] = Form(""),
    destination: Optional[str] = Form(""),
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Uploads one or more files into /home/{username}/<path> or /home/<target>/<path> (admin)
    with target user quota validation and automatic UID/GID ownership preservation.
    """
    dest_param = path if path else (destination or "")
    ws_root, dst_dir, is_admin_mode = resolve_workspace_root_and_path(current_user, dest_param)

    if not os.path.isdir(dst_dir):
        raise HTTPException(status_code=400, detail="Direktori tujuan tidak valid.")

    target_username = _extract_target_username_from_admin_path(dst_dir, ws_root) if is_admin_mode else current_user["username"]
    if is_admin_mode and not target_username:
        raise HTTPException(status_code=400, detail="Admin harus mengunggah file ke dalam folder akun pengguna (/home/<username>).")

    file_list = []
    if file is not None:
        file_list.append(file)
    if files is not None:
        file_list.extend(files)

    if not file_list:
        raise HTTPException(status_code=400, detail="Tidak ada file yang diunggah.")

    # Stream-friendly size inspection without loading large files (1GB+) into RAM
    incoming_files = []
    total_incoming_bytes = 0
    for upload in file_list:
        clean_fname = os.path.basename(upload.filename or "")
        if not clean_fname:
            continue
        try:
            upload.file.seek(0, os.SEEK_END)
            fsize = upload.file.tell()
            upload.file.seek(0)
        except Exception:
            fsize = 0
        total_incoming_bytes += fsize
        incoming_files.append((clean_fname, upload, fsize))

    try:
        if target_username:
            await _enforce_target_disk_quota(
                target_username,
                total_incoming_bytes,
                is_admin_fallback=(target_username == current_user["username"] and is_admin_mode)
            )
    except HTTPException:
        for _, up, _ in incoming_files:
            try:
                await up.close()
            except Exception:
                pass
        raise

    saved_count = 0
    for clean_fname, upload, fsize in incoming_files:
        dest_file = os.path.join(dst_dir, clean_fname)
        temp_dest = f"{dest_file}.uploading.part"
        try:
            upload.file.seek(0)
            with open(temp_dest, "wb") as f:
                shutil.copyfileobj(upload.file, f, length=1024 * 1024)
            os.replace(temp_dest, dest_file)
            os.chmod(dest_file, 0o644)
            if is_admin_mode and target_username:
                _chown_to_target_home(dest_file, ws_root, target_username, recursive=False)
            saved_count += 1
        except Exception as e:
            if os.path.exists(temp_dest):
                try:
                    os.remove(temp_dest)
                except Exception:
                    pass
            raise HTTPException(status_code=500, detail=f"Gagal mengunggah {clean_fname}: {e}")
        finally:
            try:
                await upload.close()
            except Exception:
                pass

    return {"success": True, "message": f"{saved_count} file berhasil diunggah.", "bytes_written": total_incoming_bytes}


@router.delete("")
async def delete_user_files(
    path: Optional[str] = Query(None),
    req: Optional[DeleteFilesRequest] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Deletes one or more files/folders in workspace.
    Supports both ?path=... query and JSON body {paths: [...]}.
    """
    ws_root, _, is_admin_mode = resolve_workspace_root_and_path(current_user, "")

    targets_to_delete = []
    if path:
        targets_to_delete.append(path)
    if req and req.paths:
        targets_to_delete.extend(req.paths)
    if req and req.path:
        targets_to_delete.append(req.path)

    if not targets_to_delete:
        raise HTTPException(status_code=400, detail="Parameter path wajib disertakan.")

    deleted_items = []
    for p in targets_to_delete:
        _, target, _ = resolve_workspace_root_and_path(current_user, p)
        # Protect root /home and root user account folders from accidental deletion
        if target == ws_root or (is_admin_mode and os.path.dirname(target) == ws_root):
            continue

        try:
            if req and not req.permanent:
                target_owner = _extract_target_username_from_admin_path(target, ws_root) if is_admin_mode else None
                trash_base = os.path.join(ws_root, target_owner) if target_owner else ws_root
                trash_dir = os.path.join(trash_base, ".trash")
                os.makedirs(trash_dir, exist_ok=True)
                base_name = os.path.basename(target)
                dst_trash = os.path.join(trash_dir, f"{base_name}_{int(os.path.getmtime(target))}")
                shutil.move(target, dst_trash)
            else:
                if os.path.islink(target) or os.path.isfile(target):
                    os.remove(target)
                elif os.path.isdir(target):
                    shutil.rmtree(target)
            deleted_items.append(p)
        except Exception as e:
            print(f"[File Delete Warn]: {e}")

    return {"success": True, "message": f"{len(deleted_items)} item berhasil dihapus.", "deleted": deleted_items}
