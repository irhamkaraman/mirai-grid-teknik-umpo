import re
import yaml
from typing import Dict, Any, Optional

FORBIDDEN_PATTERNS = [
    r"privileged:\s*true",
    r"network_mode:\s*[\"']?host[\"']?",
    r"pid:\s*[\"']?host[\"']?",
    r"ipc:\s*[\"']?host[\"']?",
    r"docker\.sock",
    r"cap_add:"
]

def validate_compose_security(compose_text: str):
    """Enforces strict defense-in-depth against container privilege escalation."""
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, compose_text, re.IGNORECASE):
            raise ValueError(f"Security Alert: Forbidden security parameter detected: '{pattern}'")

class TemplateComposer:

    @staticmethod
    def generate_compose(
        nim: str,
        project_name: str,
        template_type: str,
        project_src_dir: str,
        allocated_port: int,
        env_vars: Optional[Dict[str, str]] = None,
        mem_limit_mb: int = 256,
        cpu_cores: float = 0.5
    ) -> str:
        container_name = f"app_{nim}_{project_name}"
        network_name = f"net_{nim}_{project_name}"

        # Base security configuration (compatible with Compose v2 schema)
        security_config = {
            "restart": "unless-stopped",
            "security_opt": ["no-new-privileges:true"],
            "cap_drop": ["ALL"],
            "deploy": {
                "resources": {
                    "limits": {
                        "cpus": str(cpu_cores),
                        "memory": f"{mem_limit_mb}M",
                        "pids": 100
                    }
                }
            },
            "networks": [network_name],
            "ports": [f"{allocated_port}:80"]
        }

        # Environment variables
        environment = env_vars or {}
        environment.update({
            "MIRAIGRID_STUDENT_NIM": nim,
            "MIRAIGRID_PROJECT_NAME": project_name,
            "PORT": "80"
        })

        service_definition: Dict[str, Any] = {
            "container_name": container_name,
            "environment": environment,
            **security_config
        }

        if template_type == "php82":
            service_definition["image"] = "php:8.2-apache"
            service_definition["volumes"] = [f"{project_src_dir}:/var/www/html:ro"]
        elif template_type == "python311":
            service_definition["image"] = "python:3.11-slim"
            service_definition["working_dir"] = "/app"
            service_definition["volumes"] = [f"{project_src_dir}:/app:ro"]
            service_definition["command"] = (
                "sh -c 'if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi && "
                "pip install --no-cache-dir gunicorn uvicorn flask && "
                "if [ -f app.py ]; then gunicorn -w 2 -b 0.0.0.0:80 app:app; "
                "elif [ -f main.py ]; then uvicorn main:app --host 0.0.0.0 --port 80; "
                "else python -m http.server 80; fi'"
            )
        elif template_type == "node20":
            service_definition["image"] = "node:20-alpine"
            service_definition["working_dir"] = "/app"
            service_definition["volumes"] = [f"{project_src_dir}:/app:ro"]
            service_definition["command"] = (
                "sh -c 'if [ -f package.json ]; then npm install --production && npm start; "
                "elif [ -f index.js ]; then node index.js; "
                "else npx serve -l 80 .; fi'"
            )
        elif template_type == "static":
            service_definition["image"] = "nginx:alpine"
            service_definition["volumes"] = [f"{project_src_dir}:/usr/share/nginx/html:ro"]
        else:
            raise ValueError(f"Unsupported template type: {template_type}")

        compose_dict = {
            "version": "3.8",
            "services": {
                "web": service_definition
            },
            "networks": {
                network_name: {
                    "driver": "bridge"
                }
            }
        }

        compose_yaml = yaml.dump(compose_dict, default_flow_style=False, sort_keys=False)
        validate_compose_security(compose_yaml)
        return compose_yaml
