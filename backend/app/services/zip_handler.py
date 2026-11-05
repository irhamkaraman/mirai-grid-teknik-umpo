import os
import zipfile
from typing import Tuple

MAX_ZIP_SIZE = 25 * 1024 * 1024       # 25 MB max upload
MAX_UNCOMPRESSED_SIZE = 100 * 1024 * 1024 # 100 MB max uncompressed

def safe_extract_zip(zip_path: str, target_dir: str) -> Tuple[bool, str]:
    """
    Safely extracts a ZIP archive into target_dir.
    Guards against:
    1. Zip-Slip vulnerability (path traversal: ../../)
    2. Zip-Bomb vulnerability (huge uncompressed payload)
    """
    if not os.path.exists(zip_path):
        return False, "ZIP file not found."

    file_size = os.path.getsize(zip_path)
    if file_size > MAX_ZIP_SIZE:
        return False, f"ZIP file exceeds maximum limit of {MAX_ZIP_SIZE // (1024 * 1024)} MB."

    target_dir = os.path.abspath(target_dir)
    os.makedirs(target_dir, exist_ok=True)

    total_uncompressed_bytes = 0

    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            for member in zf.infolist():
                # 1. Zip bomb check
                total_uncompressed_bytes += member.file_size
                if total_uncompressed_bytes > MAX_UNCOMPRESSED_SIZE:
                    return False, f"Total uncompressed size exceeds limit of {MAX_UNCOMPRESSED_SIZE // (1024 * 1024)} MB."

                # 2. Anti-Zip-Slip check
                dest_path = os.path.abspath(os.path.join(target_dir, member.filename))
                if os.path.commonpath([target_dir, dest_path]) != target_dir:
                    return False, f"Security Violation: Zip entry '{member.filename}' attempts path traversal outside target directory!"

            # If all entries are safe, extract
            zf.extractall(target_dir)

        return True, "Extracted successfully."
    except zipfile.BadZipFile:
        return False, "File is not a valid ZIP archive."
    except Exception as e:
        return False, f"Extraction error: {str(e)}"
