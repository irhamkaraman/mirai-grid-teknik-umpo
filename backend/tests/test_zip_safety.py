import os
import zipfile
import tempfile
import pytest
from app.services.zip_handler import safe_extract_zip

def test_safe_zip_extraction(tmp_path):
    zip_path = tmp_path / "valid.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("index.php", "<?php echo 'Hello MiraiGrid'; ?>")
        zf.writestr("assets/style.css", "body { color: blue; }")

    extract_target = tmp_path / "extracted"
    success, msg = safe_extract_zip(str(zip_path), str(extract_target))
    assert success is True
    assert (extract_target / "index.php").exists()
    assert (extract_target / "assets" / "style.css").exists()

def test_anti_zip_slip_malicious_rejection(tmp_path):
    """
    Negative Security Test: Attempting Path Traversal via ZIP Slip (../../etc/passwd)
    Must be blocked immediately.
    """
    malicious_zip = tmp_path / "exploit.zip"
    with zipfile.ZipFile(malicious_zip, "w") as zf:
        # Malicious relative path
        zf.writestr("../../escape_sandbox.txt", "MALICIOUS PAYLOAD")

    extract_target = tmp_path / "sandbox"
    success, msg = safe_extract_zip(str(malicious_zip), str(extract_target))
    assert success is False
    assert "Security Violation" in msg
    assert not (tmp_path / "escape_sandbox.txt").exists()
