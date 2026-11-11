import os
from typing import Tuple
from app.core.config import settings

def calculate_account_disk_usage(username: str, db_count: int = 0) -> Tuple[float, float]:
    """
    Menghitung ukuran penggunaan disk fisik aktual per akun mahasiswa/admin:
    1. Folder Projects: /app/data/projects/{username}_* dan /app/data/projects/{username}
    2. Folder Repositories Git: /app/data/repositories/{username}/*
    3. Estimasi Database Praktikum (db_count * 12.5 MB)
    Returns: (total_disk_used_mb, db_storage_used_mb)
    """
    total_bytes = 0
    clean_user = (username or "").strip()
    if not clean_user:
        return 0.0, 0.0

    # 1. Projects folder scan
    projects_dir = settings.PROJECTS_DIR
    user_prefix = f"{clean_user}_"

    if os.path.exists(projects_dir):
        try:
            for entry in os.scandir(projects_dir):
                if entry.is_dir() and (entry.name == clean_user or entry.name.startswith(user_prefix)):
                    for root, dirs, files in os.walk(entry.path):
                        for f in files:
                            try:
                                fp = os.path.join(root, f)
                                total_bytes += os.path.getsize(fp)
                            except OSError:
                                pass
        except Exception:
            pass

    # 2. Repositories Git scan
    repo_user_dir = os.path.join(settings.DATA_DIR, "repositories", clean_user)
    if os.path.exists(repo_user_dir):
        try:
            for root, dirs, files in os.walk(repo_user_dir):
                for f in files:
                    try:
                        fp = os.path.join(root, f)
                        total_bytes += os.path.getsize(fp)
                    except OSError:
                        pass
        except Exception:
            pass

    file_bytes_mb = total_bytes / (1024 * 1024)
    base_overhead = 2.4 if file_bytes_mb > 0 else 0.0
    total_files_mb = round(file_bytes_mb + base_overhead, 1)

    db_storage_mb = round(db_count * 12.5, 1)
    total_disk_mb = round(total_files_mb + db_storage_mb, 1)

    return total_disk_mb, db_storage_mb
