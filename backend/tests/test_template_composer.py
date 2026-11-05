import pytest
from app.services.template_composer import TemplateComposer, validate_compose_security

def test_template_composer_php():
    compose = TemplateComposer.generate_compose(
        nim="23533001",
        project_name="web-praktikum",
        language="php",
        version="8.2",
        project_src_dir="/data/projects/23533001_web-praktikum",
        allocated_port=10001,
        env_vars={"APP_ENV": "development"}
    )
    assert "image: php:8.2-apache" in compose
    assert "no-new-privileges:true" in compose
    assert "cap_drop:" in compose
    assert "10001:80" in compose

def test_template_composer_python():
    compose = TemplateComposer.generate_compose(
        nim="23533001",
        project_name="python-app",
        language="python",
        version="3.11",
        project_src_dir="/data/projects/23533001_python-app",
        allocated_port=10002,
        app_config={"startup_file": "passenger_wsgi.py", "entry_point": "application"}
    )
    assert "image: python:3.11-slim" in compose
    assert "passenger_wsgi" in compose

def test_template_composer_node():
    compose = TemplateComposer.generate_compose(
        nim="23533001",
        project_name="node-app",
        language="node",
        version="20",
        project_src_dir="/data/projects/23533001_node-app",
        allocated_port=10003,
        app_config={"app_mode": "production", "startup_file": "server.js"}
    )
    assert "image: node:20-alpine" in compose
    assert "NODE_ENV: production" in compose

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
