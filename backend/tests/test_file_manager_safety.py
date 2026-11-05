import os
import pytest
from app.services.file_manager import get_safe_project_path, list_directory_contents

def test_safe_project_path_within_sandbox(tmp_path):
    base_dir = str(tmp_path)
    safe_path = get_safe_project_path(base_dir, "23533001", "my-project", "app/controllers/index.php")
    assert "23533001_my-project" in safe_path
    assert safe_path.endswith(os.path.join("app", "controllers", "index.php"))

def test_anti_path_traversal_violation(tmp_path):
    """Negative Security Test: Attempting to access ../../other_student_dir must raise ValueError"""
    base_dir = str(tmp_path)
    with pytest.raises(ValueError) as excinfo:
        get_safe_project_path(base_dir, "23533001", "my-project", "../../23533002_victim_project/secret.env")
    assert "Security Violation" in str(excinfo.value)

def test_null_byte_injection_blocked(tmp_path):
    """Negative Security Test: Null byte injection must be blocked"""
    base_dir = str(tmp_path)
    with pytest.raises(ValueError) as excinfo:
        get_safe_project_path(base_dir, "23533001", "my-project", "index.php\x00/../../etc/passwd")
    assert "Null byte" in str(excinfo.value)
