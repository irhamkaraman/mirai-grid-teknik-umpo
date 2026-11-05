import os
import stat
import shutil
import pathlib
import zipfile
from typing import List, Dict, Any, Optional

def get_safe_project_path(base_projects_dir: str, nim: str, project_name: str, subpath: str = "") -> str:
    """
    Returns the absolute path inside project workspace and strictly verifies
    that the resolved realpath is strictly within the project's sandbox.
    """
    if "\x00" in subpath or "\x00" in nim or "\x00" in project_name:
        raise ValueError("Security Alert: Null byte detected in path parameter.")

    raw_root = os.path.join(base_projects_dir, f"{nim}_{project_name}")
    os.makedirs(raw_root, exist_ok=True)
    project_root = os.path.realpath(raw_root)

    if not subpath or subpath.strip() in ["/", "\\", "."]:
        return project_root

    clean_sub = subpath.strip().lstrip("/\\")
    combined_path = os.path.join(project_root, clean_sub)
    resolved_target = os.path.realpath(combined_path)

    try:
        common = os.path.commonpath([project_root, resolved_target])
    except ValueError:
        raise ValueError("Security Violation: Access outside project workspace drive is strictly prohibited.")

    if common != project_root:
        raise ValueError("Security Violation: Access outside your project sandbox is strictly prohibited.")

    return resolved_target

def get_octal_permissions(st_mode: int) -> str:
    """Returns permission in cPanel octal format e.g. 0755, 0644."""
    return f"0{oct(stat.S_IMODE(st_mode))[2:].zfill(3)}"

def get_mime_type_description(entry: os.DirEntry) -> str:
    if entry.is_dir():
        return "httpd/unix-directory"
    ext = pathlib.Path(entry.name).suffix.lower()
    types = {
        ".php": "text/x-php",
        ".py": "text/x-python",
        ".js": "application/javascript",
        ".json": "application/json",
        ".html": "text/html",
        ".css": "text/css",
        ".sql": "text/x-sql",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".zip": "application/zip",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".xml": "application/xml",
        ".env": "text/plain",
        ".ini": "text/plain"
    }
    return types.get(ext, "application/octet-stream")

def list_directory_contents(dir_path: str, project_root: str) -> List[Dict[str, Any]]:
    items = []
    try:
        entries = sorted(os.scandir(dir_path), key=lambda e: (not e.is_dir(), e.name.lower()))
        for entry in entries:
            real_entry_path = os.path.realpath(entry.path)
            if os.path.commonpath([project_root, real_entry_path]) != project_root:
                continue

            rel_path = os.path.relpath(entry.path, project_root).replace("\\", "/")
            stat_res = entry.stat()
            items.append({
                "name": entry.name,
                "path": rel_path,
                "is_dir": entry.is_dir(),
                "size": stat_res.st_size if not entry.is_dir() else 4096,
                "modified": int(stat_res.st_mtime),
                "type": get_mime_type_description(entry),
                "permissions": get_octal_permissions(stat_res.st_mode),
                "extension": pathlib.Path(entry.name).suffix.lower() if not entry.is_dir() else ""
            })
    except Exception as e:
        print(f"[FileManager Error]: {e}")
    return items

def get_directory_tree(project_root: str, current_dir: str = "", max_depth: int = 3) -> Dict[str, Any]:
    """Generates tree structure of directories for cPanel left sidebar folder tree."""
    dir_path = os.path.join(project_root, current_dir) if current_dir else project_root
    rel_path = os.path.relpath(dir_path, project_root).replace("\\", "/")
    if rel_path == ".":
        rel_path = ""

    node = {
        "name": os.path.basename(dir_path) or "/",
        "path": rel_path,
        "children": []
    }

    if max_depth <= 0:
        return node

    try:
        for entry in sorted(os.scandir(dir_path), key=lambda e: e.name.lower()):
            if entry.is_dir():
                sub_rel = os.path.relpath(entry.path, project_root).replace("\\", "/")
                child = get_directory_tree(project_root, sub_rel, max_depth - 1)
                node["children"].append(child)
    except Exception:
        pass

    return node

def compress_items_to_zip(source_paths: List[str], destination_zip_path: str, project_root: str) -> bool:
    """Compresses selected files or directories into a ZIP archive."""
    with zipfile.ZipFile(destination_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for src in source_paths:
            if not os.path.exists(src):
                continue
            if os.path.isdir(src):
                for root, dirs, files in os.walk(src):
                    for file in files:
                        full_p = os.path.join(root, file)
                        # Relative to project_root or parent of src
                        arcname = os.path.relpath(full_p, os.path.dirname(src))
                        zf.write(full_p, arcname)
            else:
                arcname = os.path.basename(src)
                zf.write(src, arcname)
    return True

def extract_zip_archive(zip_path: str, extract_to_dir: str, project_root: str) -> bool:
    """Extracts a ZIP archive securely with anti-zip-slip validation."""
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for member in zf.infolist():
            dest_path = os.path.abspath(os.path.join(extract_to_dir, member.filename))
            if os.path.commonpath([project_root, dest_path]) != project_root:
                raise ValueError("Security Violation: Zip entry attempts path traversal outside project sandbox.")
        zf.extractall(extract_to_dir)
    return True
