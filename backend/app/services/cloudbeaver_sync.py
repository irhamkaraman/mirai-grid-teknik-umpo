import json
import base64
import aiosqlite
from app.core.security import decrypt_secret
from app.services.portainer import portainer

async def sync_cloudbeaver_datasources(db: aiosqlite.Connection) -> bool:
    """
    Synchronizes Administrator and Mahasiswa databases into CloudBeaver's GlobalConfiguration
    with strict multi-tenant reverse-proxy DAC isolation.
    
    MULTI-TENANT ISOLATION ARCHITECTURE:
    - Administrator databases: Assigned to folder 'Administrator (admin)', permissions: ['admin'].
      Visible strictly to administrative roles.
    - Mahasiswa databases: Assigned to folder 'Mahasiswa (<username>)', permissions: ['<username>', 'admin'].
      Visible strictly to that student owner and administrators.
    - 'user' (anonymous unauthenticated role) is EXCLUDED from all data source permissions so
      unauthenticated visitors cannot see any connection.
    """
    try:
        cursor = await db.execute("""
            SELECT d.*, u.username, u.name as user_name, u.role
            FROM student_databases d
            JOIN users u ON d.user_id = u.id
            ORDER BY u.role DESC, u.username ASC, d.id ASC
        """)
        rows = await cursor.fetchall()
        
        folders = {
            "Administrator (admin)": {
                "description": "Basis Data Praktikum (Administrator (admin))"
            }
        }
        connections = {}
        permissions = {}

        for r in rows:
            db_name = r["db_name"]
            engine = r["engine"]
            db_user = r["db_username"]
            username = str(r["username"])
            role = r["role"]
            is_admin_db = (role == "admin")

            try:
                password = decrypt_secret(r["db_password_enc"])
            except Exception:
                password = ""
            conn_id = f"{engine}-{db_name}"

            if is_admin_db:
                folder_name = "Administrator (admin)"
                permissions[conn_id] = ["admin"]
            else:
                folder_name = f"Mahasiswa ({username})"
                if folder_name not in folders:
                    folders[folder_name] = {
                        "description": f"Basis Data Mahasiswa ({username})"
                    }
                permissions[conn_id] = [username, "admin"]

            if engine == "postgres":
                connections[conn_id] = {
                    "provider": "postgresql",
                    "driver": "postgres-jdbc",
                    "name": f"{db_name} (PostgreSQL 16)",
                    "save-password": True,
                    "read-only": False,
                    "folder": folder_name,
                    "configuration": {
                        "host": "db_postgres",
                        "port": "5432",
                        "database": db_name,
                        "url": f"jdbc:postgresql://db_postgres:5432/{db_name}?user={db_user}&password={password}",
                        "configurationType": "URL",
                        "type": "dev",
                        "auth-model": "native",
                        "properties": {
                            "user": db_user,
                            "password": password
                        }
                    },
                    "auth-properties": {
                        "userName": db_user,
                        "userPassword": password
                    }
                }
            else:
                connections[conn_id] = {
                    "provider": "mysql",
                    "driver": "mariaDB",
                    "name": f"{db_name} (MariaDB 11)",
                    "save-password": True,
                    "read-only": False,
                    "folder": folder_name,
                    "configuration": {
                        "host": "db_mariadb",
                        "port": "3306",
                        "database": db_name,
                        "url": f"jdbc:mariadb://db_mariadb:3306/{db_name}?user={db_user}&password={password}",
                        "configurationType": "URL",
                        "type": "dev",
                        "auth-model": "native",
                        "properties": {
                            "user": db_user,
                            "password": password
                        }
                    },
                    "auth-properties": {
                        "userName": db_user,
                        "userPassword": password
                    }
                }

        ds_obj = {
            "folders": folders,
            "connections": connections,
            "connection-types": {
                "dev": {
                    "name": "Development",
                    "color": "255,255,255",
                    "description": "Development database connections",
                    "auto-commit": True,
                    "confirm-execute": False,
                    "confirm-data-change": False
                }
            }
        }

        ds_json = json.dumps(ds_obj, indent=2)
        perm_json = json.dumps(permissions, indent=2)

        ds_b64 = base64.b64encode(ds_json.encode("utf-8")).decode("ascii")
        perm_b64 = base64.b64encode(perm_json.encode("utf-8")).decode("ascii")

        cmd1 = ["sh", "-c", f"echo {ds_b64} | base64 -d > /opt/cloudbeaver/workspace/GlobalConfiguration/.dbeaver/data-sources.json"]
        await portainer.exec_container_command("db_cloudbeaver", cmd1)

        cmd2 = ["sh", "-c", f"echo {perm_b64} | base64 -d > /opt/cloudbeaver/workspace/GlobalConfiguration/.dbeaver/data-sources-permissions.json"]
        await portainer.exec_container_command("db_cloudbeaver", cmd2)

        # Restart CloudBeaver gracefully to reload datasource pool
        await portainer.restart_container("db_cloudbeaver")
        return True
    except Exception as e:
        print(f"[CloudBeaver Sync Error]: {e}")
        return False
