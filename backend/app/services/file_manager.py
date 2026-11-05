import os
import shutil
import pathlib
from typing import List, Dict, Any

def get_safe_project_path(base_projects_dir: str, nim: str, project_name: str, subpath: str = "") -> str:
    """
    Returns the absolute path inside project workspace and strictly verifies
    that the resolved realpath is strictly within the project's sandbox.
    Guards against:
    - Path traversal (../../)
    - Symlink redirection outside sandbox
    - Null-byte injection
    - Absolute path override
    """
    if "\x00" in subpath or "\x00" in nim or "\x00" in project_name:
        raise ValueError("Security Alert: Null byte detected in path parameter.")

    # Sandbox root for this specific student and project
    raw_root = os.path.join(base_projects_dir, f"{nim}_{project_name}")
    os.makedirs(raw_root, exist_ok=True)
    project_root = os.path.realpath(raw_root)

    if not subpath or subpath.strip() in ["/", "\\", "."]:
        return project_root

    # Clean leading slashes and strip whitespace
    clean_sub = subpath.strip().lstrip("/\\")
    combined_path = os.path.join(project_root, clean_sub)
    resolved_target = os.path.realpath(combined_path)

    # Strict sandbox boundary enforcement:
    # 1. Target must start with project_root
    # 2. commonpath between target and project_root must be project_root
    try:
        common = os.path.commonpath([project_root, resolved_target])
    except ValueError:
        # Different drives on Windows
        raise ValueError("Security Violation: Access outside project workspace drive is strictly prohibited.")

    if common != project_root:
        raise ValueError("Security Violation: Access outside your project sandbox is strictly prohibited.")

    return resolved_target

def list_directory_contents(dir_path: str, project_root: str) -> List[Dict[str, Any]]:
    items = []
    try:
        entries = sorted(os.scandir(dir_path), key=lambda e: (not e.is_dir(), e.name.lower()))
        for entry in entries:
            # Check if entry is a symlink pointing outside
            real_entry_path = os.path.realpath(entry.path)
            if os.path.commonpath([project_root, real_entry_path]) != project_root:
                continue # Skip symlinks pointing outside sandbox

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
