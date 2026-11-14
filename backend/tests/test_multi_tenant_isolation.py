import os
import tempfile
import urllib.parse
import pytest
from fastapi import HTTPException
from app.api.file_manager_router import resolve_safe_user_path
from app.services.file_manager import get_safe_project_path, extract_zip_archive
import zipfile

def test_resolve_safe_user_path_valid(tmp_path):
    """Verify legitimate paths within /home/<nim> are resolved correctly."""
    home_dir = tmp_path / "home" / "23533740"
    home_dir.mkdir(parents=True)
    pub_html = home_dir / "public_html"
    pub_html.mkdir()
    test_file = pub_html / "index.php"
    test_file.write_text("<?php echo 'ok'; ?>")

    # Access root
    res_root = resolve_safe_user_path(str(home_dir), "")
    assert res_root == str(home_dir.resolve())

    # Access subpath
    res_sub = resolve_safe_user_path(str(home_dir), "public_html/index.php")
    assert res_sub == str(test_file.resolve())

    # Access virtual full path e.g. /home/23533740/public_html
    res_virt = resolve_safe_user_path(str(home_dir), "/home/23533740/public_html")
    assert res_virt == str(pub_html.resolve())

def test_directory_traversal_etc_passwd(tmp_path):
    """Payload: ../../../../etc/passwd must be blocked with HTTP 403."""
    home_dir = tmp_path / "home" / "23533740"
    home_dir.mkdir(parents=True)

    with pytest.raises(HTTPException) as excinfo:
        resolve_safe_user_path(str(home_dir), "../../../../etc/passwd")
    assert excinfo.value.status_code == 403
    assert "Akses di luar root sandbox" in excinfo.value.detail

def test_directory_traversal_var_lib_docker(tmp_path):
    """Payload: ../../../var/lib/docker must be blocked with HTTP 403."""
    home_dir = tmp_path / "home" / "23533740"
    home_dir.mkdir(parents=True)

    with pytest.raises(HTTPException) as excinfo:
        resolve_safe_user_path(str(home_dir), "../../../var/lib/docker")
    assert excinfo.value.status_code == 403

def test_directory_traversal_miraigrid_db(tmp_path):
    """Payload: ../../miraigrid.db attempting to escape to central DB must be blocked with HTTP 403."""
    app_data = tmp_path / "app" / "data"
    app_data.mkdir(parents=True)
    db_file = app_data / "miraigrid.db"
    db_file.write_text("sqlite format 3")

    home_dir = app_data / "home" / "23533740"
    home_dir.mkdir(parents=True)

    with pytest.raises(HTTPException) as excinfo:
        resolve_safe_user_path(str(home_dir), "../../miraigrid.db")
    assert excinfo.value.status_code == 403

def test_cross_tenant_access_blocked(tmp_path):
    """Accessing another student's directory must be blocked with HTTP 403."""
    home_base = tmp_path / "home"
    student1 = home_base / "23533740"
    student2 = home_base / "23533816"
    student1.mkdir(parents=True)
    student2.mkdir(parents=True)
    secret2 = student2 / "secret.env"
    secret2.write_text("DB_PASS=supersecret")

    # Student 1 attempts to access student 2's folder via relative path
    with pytest.raises(HTTPException) as excinfo:
        resolve_safe_user_path(str(student1), "../23533816/secret.env")
    assert excinfo.value.status_code == 403

    # Student 1 attempts via absolute-style virtual path
    res_abs = resolve_safe_user_path(str(student1), "/home/23533816/secret.env")
    # Verify the resolved path is strictly confined to student 1's home, never leaking student 2
    assert str(student1.resolve()) in res_abs
    assert not os.path.exists(res_abs)  # Does not reach student 2's secret.env


def test_null_byte_injection_blocked(tmp_path):
    """Payload: Null byte in subpath must be rejected with HTTP 400."""
    home_dir = tmp_path / "home" / "23533740"
    home_dir.mkdir(parents=True)

    with pytest.raises(HTTPException) as excinfo:
        resolve_safe_user_path(str(home_dir), "public_html/index.php\x00../../etc/passwd")
    assert excinfo.value.status_code == 400
    assert "Null byte" in excinfo.value.detail

def test_url_encoded_traversal_blocked(tmp_path):
    """Payload: URL-encoded %2e%2e%2f traversal must be blocked when decoded or handled."""
    home_dir = tmp_path / "home" / "23533740"
    home_dir.mkdir(parents=True)

    payload = "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd"
    decoded = urllib.parse.unquote(payload)
    with pytest.raises(HTTPException) as excinfo:
        resolve_safe_user_path(str(home_dir), decoded)
    assert excinfo.value.status_code == 403

def test_symlink_escape_blocked(tmp_path):
    """Symlink pointing outside /home/<nim> must be resolved and blocked with HTTP 403."""
    home_dir = tmp_path / "home" / "23533740"
    home_dir.mkdir(parents=True)

    target_outside = tmp_path / "outside_dir"
    target_outside.mkdir(parents=True)
    outside_file = target_outside / "sensitive.txt"
    outside_file.write_text("SENSITIVE DATA")

    symlink_path = home_dir / "link_to_outside"
    try:
        os.symlink(str(target_outside), str(symlink_path))
    except (OSError, NotImplementedError):
        pytest.skip("Symlink creation not supported in current test context")

    with pytest.raises(HTTPException) as excinfo:
        resolve_safe_user_path(str(home_dir), "link_to_outside/sensitive.txt")
    assert excinfo.value.status_code == 403

def test_zip_slip_extraction_blocked(tmp_path):
    """Zip slip attempt with ../../ payload inside archive must be rejected."""
    sandbox_dir = tmp_path / "sandbox"
    sandbox_dir.mkdir()
    zip_file = tmp_path / "malicious.zip"

    with zipfile.ZipFile(str(zip_file), "w") as zf:
        zf.writestr("../../escape.txt", "MALICIOUS")

    with pytest.raises(ValueError) as excinfo:
        extract_zip_archive(str(zip_file), str(sandbox_dir), str(sandbox_dir))
    assert "Zip entry attempts path traversal" in str(excinfo.value)
