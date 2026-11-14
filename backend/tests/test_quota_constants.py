import pytest
from app.core.config import settings
from app.models.schemas import UserQuotaUpdateRequest, BulkQuotaUpdateRequest, QuotaResponse
from app.services.template_composer import TemplateComposer

def test_config_quota_constants():
    """Verify backend default quota constants match upgraded specification"""
    assert settings.DEFAULT_MAX_MEMORY_MB == 512, "Default RAM quota must be 512 MB"
    assert settings.DEFAULT_MAX_DISK_MB == 10240, "Default Disk quota must be 10240 MB (10 GB)"
    assert settings.DEFAULT_DB_DISK_MB == 5120, "Default Database Disk quota must be 5120 MB (5 GB)"
    assert settings.DEFAULT_MAX_CPU_CORES == 0.5, "Default CPU cores must be 0.5"

def test_schema_quota_defaults():
    """Verify Pydantic schemas enforce updated quota defaults"""
    user_req = UserQuotaUpdateRequest()
    assert user_req.max_memory_mb == 512
    assert user_req.max_disk_mb == 10240
    assert user_req.max_database_disk_mb == 5120
    assert user_req.max_cpu_cores == 0.5

    bulk_req = BulkQuotaUpdateRequest(user_ids=[1, 2])
    assert bulk_req.max_memory_mb == 512
    assert bulk_req.max_disk_mb == 10240
    assert bulk_req.max_database_disk_mb == 5120
    assert bulk_req.max_cpu_cores == 0.5

def test_template_composer_quota_injection():
    """Verify TemplateComposer defaults to 512M RAM and 0.5 CPU in Compose deploy limits"""
    yaml_str = TemplateComposer.generate_compose(
        nim="test_nim",
        project_name="quota_test",
        language="php",
        version="8.3",
        project_src_dir="/app/data/projects/test",
        allocated_port=8080
    )
    assert "memory: 512M" in yaml_str
    assert "cpus: '0.5'" in yaml_str
    assert "pids: 50" in yaml_str
