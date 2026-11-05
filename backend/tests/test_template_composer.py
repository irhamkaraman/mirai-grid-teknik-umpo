import pytest
from app.services.template_composer import TemplateComposer, validate_compose_security

def test_template_composer_php():
    compose = TemplateComposer.generate_compose(
        nim="23533001",
        project_name="web-praktikum",
        template_type="php82",
        project_src_dir="/data/projects/23533001_web-praktikum",
        allocated_port=10001,
        env_vars={"APP_ENV": "development"}
    )
    assert "image: php:8.2-apache" in compose
    assert "no-new-privileges:true" in compose
    assert "cap_drop:" in compose
    assert "10001:80" in compose

def test_template_composer_security_rejection():
    """Negative Security Test: Malicious compose injection must be rejected"""
    malicious_compose = """
    version: '3.8'
    services:
      app:
        image: alpine
        privileged: true
    """
    with pytest.raises(ValueError) as excinfo:
        validate_compose_security(malicious_compose)
    assert "Forbidden security parameter" in str(excinfo.value)
