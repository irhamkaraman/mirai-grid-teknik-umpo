import os
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
    def generate_php_ini_content(directives: Dict[str, Any]) -> str:
        """Generates custom php.ini content based on cPanel PHP directives."""
        lines = ["; Auto-generated MiraiGrid PHP configuration"]
        for key, val in directives.items():
            if isinstance(val, bool):
                lines.append(f"{key} = {'On' if val else 'Off'}")
            elif str(val).lower() in ['enabled', 'disabled']:
                lines.append(f"{key} = {'On' if str(val).lower() == 'enabled' else 'Off'}")
            else:
                lines.append(f"{key} = {val}")
        return "\n".join(lines) + "\n"

    @staticmethod
    def generate_compose(
        nim: str,
        project_name: str,
        language: str,
        version: str,
        project_src_dir: str,
        allocated_port: int,
        app_config: Optional[Dict[str, Any]] = None,
        env_vars: Optional[Dict[str, str]] = None,
        mem_limit_mb: int = 256,
        cpu_cores: float = 0.5,
        pids_limit: int = 50
    ) -> str:
        container_name = f"app_{nim}_{project_name}"
        network_name = f"net_{nim}_{project_name}"
        cfg = app_config or {}

        # Base security configuration (compatible with Compose v2 schema)
        security_config = {
            "restart": "unless-stopped",
            "security_opt": ["no-new-privileges:true"],
            "cap_drop": [
                "SYS_ADMIN",
                "NET_ADMIN",
                "SYS_RAWIO",
                "SYS_PTRACE",
                "SYS_MODULE",
                "SYS_BOOT",
                "MAC_ADMIN",
                "MAC_OVERRIDE",
                "AUDIT_CONTROL",
                "AUDIT_WRITE",
            ],
            "deploy": {
                "resources": {
                    "limits": {
                        "cpus": str(cpu_cores),
                        "memory": f"{mem_limit_mb}M",
                        "pids": pids_limit
                    }
                }
            },
            "networks": [network_name, "database-center_db_network"],
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

        # Subpath extraction for container execution
        raw_root = str(cfg.get("app_root_subpath") or cfg.get("app_root") or "").strip()
        app_subpath = ""
        if raw_root and not raw_root.startswith("/"):
            app_subpath = raw_root.strip("/")
        elif cfg.get("app_root_subpath"):
            app_subpath = str(cfg.get("app_root_subpath")).strip("/")

        # 1. PHP Engine (8.3, 8.2, 8.1, 8.0, 7.4)
        if language == "php":
            v = version if version in ["8.3", "8.2", "8.1", "8.0", "7.4"] else "8.3"
            # php:8.3-apache is built with ext-intl, ext-zip, pdo_mysql, pdo_pgsql, composer, etc.
            service_definition["image"] = f"php:{v}-apache"
            volumes = [
                f"{project_src_dir}:/var/www/html",
                "/usr/local/bin/composer:/usr/local/bin/composer:ro"
            ]
            # Mount custom php.ini if exists
            php_ini_host_path = f"{project_src_dir}/.miraigrid_php.ini"
            volumes.append(f"{php_ini_host_path}:/usr/local/etc/php/conf.d/99-miraigrid.ini:ro")
            service_definition["volumes"] = volumes
            if app_subpath:
                service_definition["command"] = (
                    f"sh -c 'mkdir -p /var/www/html/{app_subpath} 2>/dev/null; "
                    f"if [ ! -f /var/www/html/{app_subpath}/index.php ] && [ ! -f /var/www/html/{app_subpath}/index.html ]; then "
                    f"if [ -f /var/www/html/index.php ]; then cp /var/www/html/index.php /var/www/html/{app_subpath}/index.php 2>/dev/null; fi; "
                    "fi; "
                    f"sed -ri -e \"s!DocumentRoot /var/www/html.*!DocumentRoot /var/www/html/{app_subpath}!g\" /etc/apache2/sites-available/*.conf; "
                    f"sed -ri -e \"s!<Directory /var/www/html.*>!<Directory /var/www/html/{app_subpath}>!g\" /etc/apache2/apache2.conf /etc/apache2/sites-available/*.conf /etc/apache2/conf-available/*.conf; "
                    "a2enmod rewrite headers 2>/dev/null; "
                    "sed -ri -e \"s!AllowOverride None!AllowOverride All!g\" /etc/apache2/apache2.conf 2>/dev/null; "
                    "chown -R www-data:www-data /var/www/html 2>/dev/null; "
                    "chmod -R 755 /var/www/html 2>/dev/null; "
                    "exec apache2-foreground'"
                )
            else:
                service_definition["command"] = (
                    "sh -c 'a2enmod rewrite headers 2>/dev/null; "
                    "sed -ri -e \"s!AllowOverride None!AllowOverride All!g\" /etc/apache2/apache2.conf 2>/dev/null; "
                    "chown -R www-data:www-data /var/www/html 2>/dev/null; "
                    "chmod -R 755 /var/www/html 2>/dev/null; "
                    "exec apache2-foreground'"
                )

        # 2. Python Engine (3.12, 3.11, 3.10, 3.9)
        elif language == "python":
            v = version if version in ["3.12", "3.11", "3.10", "3.9"] else "3.11"
            service_definition["image"] = f"python:{v}-slim"
            startup_file = cfg.get("startup_file", "app.py").strip()

            service_definition["working_dir"] = f"/app/{app_subpath}" if app_subpath else "/app"
            service_definition["volumes"] = [f"{project_src_dir}:/app"]

            # Starts with smart auto-installer and fallback chain
            command = (
                f"sh -c 'if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt 2>/dev/null; fi; "
                f"if [ -f {startup_file} ]; then python {startup_file}; "
                "elif [ -f main.py ]; then python main.py; "
                "elif [ -f passenger_wsgi.py ]; then python passenger_wsgi.py; "
                "elif [ -f app.py ]; then python app.py; "
                "else python -m http.server 80; fi'"
            )
            service_definition["command"] = command

        # 3. Node.js Engine (22, 20, 18, 16)
        elif language == "node":
            v = version if version in ["22", "20", "18", "16"] else "20"
            service_definition["image"] = f"node:{v}-alpine"
            startup_file = cfg.get("startup_file", "server.js").strip()
            app_mode = cfg.get("app_mode", "development")

            service_definition["environment"]["NODE_ENV"] = app_mode
            service_definition["working_dir"] = f"/app/{app_subpath}" if app_subpath else "/app"
            service_definition["volumes"] = [f"{project_src_dir}:/app"]

            # Starts with smart package installer and build runner
            command = (
                f"sh -c 'if [ -f package.json ] && [ ! -d node_modules ]; then npm install --production=false 2>/dev/null; fi; "
                f"if [ -f {startup_file} ]; then node {startup_file}; "
                "elif [ -f index.js ]; then node index.js; "
                "elif [ -f app.js ]; then node app.js; "
                "elif [ -f server.js ]; then node server.js; "
                "elif grep -q '\"start\":' package.json 2>/dev/null; then npm start; "
                "else npx serve -l 80 .; fi'"
            )
            service_definition["command"] = command

        else:
            raise ValueError(f"Unsupported language: {language}")

        compose_dict = {
            "version": "3.8",
            "services": {
                "web": service_definition
            },
            "networks": {
                network_name: {
                    "driver": "bridge"
                },
                "database-center_db_network": {
                    "external": True
                }
            }
        }

        compose_yaml = yaml.dump(compose_dict, default_flow_style=False, sort_keys=False)
        validate_compose_security(compose_yaml)
        return compose_yaml
