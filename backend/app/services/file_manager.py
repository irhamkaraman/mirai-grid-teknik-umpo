import os
import shutil
import pathlib
from typing import List, Dict, Any, Optional

def get_safe_project_path(base_projects_dir: str, nim: str, project_name: str, subpath: str = "") -> str:
    """
    Returns the absolute path inside project workspace and strictly verifies
    that the resolved path is within the project's sandbox (Anti Path Traversal).
    """
    project_root = os.path.abspath(os.path.join(base_projects_dir, f"{nim}_{project_name}"))
    os.makedirs(project_root, exist_ok=True)

    if not subpath or subpath.strip() == "/" or subpath.strip() == ".":
        return project_root

    # Clean leading slashes
    clean_sub = subpath.lstrip("/\\")
    target_path = os.path.abspath(os.path.join(project_root, clean_sub))

    # Strict sandbox boundary enforcement
    if os.path.commonpath([project_root, target_path]) != project_root:
        raise ValueError("Security Violation: Access outside project workspace is strictly prohibited.")

    return target_path

def list_directory_contents(dir_path: str, project_root: str) -> List[Dict[str, Any]]:
    items = []
    try:
        entries = sorted(os.scandir(dir_path), key=lambda e: (not e.is_dir(), e.name.lower()))
        for entry in entries:
            rel_path = os.path.relpath(entry.path, project_root).replace("\\", "/")
            stat = entry.stat()
            items.append({
                "name": entry.name,
                "path": rel_path,
                "is_dir": entry.is_dir(),
                "size": stat.st_size if not entry.is_dir() else 0,
                "modified": int(stat.st_mtime),
                "extension": pathlib.Path(entry.name).suffix.lower() if not entry.is_dir() else ""
            })
    except Exception as e:
        print(f"[FileManager Error]: {e}")
    return items
