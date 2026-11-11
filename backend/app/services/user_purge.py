import os
import shutil
import re
import aiosqlite
from typing import Dict, Any, List
from app.core.config import settings
from app.services.portainer import portainer
from app.services.vscode_manager import VSCodeManager
from app.services.redis_manager import UserRedisManager
from app.services.db_provisioner import DatabaseProvisioner
from app.services.cloudbeaver_sync import sync_cloudbeaver_datasources

class UserPurgeService:
    @staticmethod
    async def purge_user(db: aiosqlite.Connection, user_id: int, username: str) -> Dict[str, Any]:
        """
        Completely, safely, and permanently purges a student account and ALL its associated resources:
        1. Stop and remove Docker containers & Portainer stacks (app_{nim}_*, miraigrid_{nim}_*, vscode_{nim})
        2. Stop and purge VS Code server instances
        3. Stop and purge isolated Redis instance, sockets, and memory
        4. Terminate connections and DROP all MariaDB/MySQL databases and user (s{nim}_*, s{nim})
        5. Terminate connections and DROP all PostgreSQL databases and user (s{nim}_*, s{nim})
        6. Remove all filesystem directories (/app/data/home/{nim}, /home/{nim}, /app/data/projects/{nim}_*, /app/data/repositories/{nim}, /app/data/uploads/{nim})
        7. Purge all database records (web_deployments, projects, student_databases, external_databases, git_repositories, cron_jobs, user_redis_instances, quotas, audit_logs, users)
        8. Re-sync CloudBeaver datasources
        """
        clean_user = re.sub(r"[^a-zA-Z0-9_-]", "", username)
        report = {
            "username": clean_user,
            "user_id": user_id,
            "docker": {},
            "databases": {},
            "vscode_stopped": False,
            "redis_stopped": False,
            "deleted_paths": [],
            "deleted_db_rows": {}
        }

        # 1. Stop and remove Portainer Stacks and Docker Containers
        try:
            docker_res = await portainer.delete_user_stacks_and_containers(clean_user)
            report["docker"] = docker_res
        except Exception as e:
            report["docker"]["error"] = str(e)

        # 2. Stop and purge VS Code
        try:
            report["vscode_stopped"] = await VSCodeManager.stop(user_id, clean_user)
        except Exception as e:
            report["vscode_error"] = str(e)

        # 3. Stop and purge Redis
        try:
            UserRedisManager.stop_sync(clean_user, "")
            report["redis_stopped"] = True
        except Exception as e:
            report["redis_error"] = str(e)

        # 4. Purge All MariaDB & PostgreSQL Databases and Users
        try:
            db_res = await DatabaseProvisioner.purge_all_user_databases(clean_user)
            report["databases"] = db_res
        except Exception as e:
            report["databases"]["error"] = str(e)

        # 5. Remove Filesystem Directories
        paths_to_clean = [
            os.path.join(settings.DATA_DIR, "home", clean_user),
            os.path.join(settings.DATA_DIR, "repositories", clean_user),
            os.path.join(settings.DATA_DIR, "uploads", clean_user),
            f"/home/{clean_user}"
        ]

        # Scan projects directory for any folder starting with {clean_user}_
        proj_base = settings.PROJECTS_DIR
        if os.path.exists(proj_base):
            try:
                for entry in os.listdir(proj_base):
                    if entry.startswith(f"{clean_user}_") or entry == clean_user:
                        paths_to_clean.append(os.path.join(proj_base, entry))
            except Exception:
                pass

        for p in paths_to_clean:
            if os.path.islink(p):
                try:
                    os.unlink(p)
                    report["deleted_paths"].append(p)
                except Exception:
                    pass
            elif os.path.isdir(p):
                try:
                    shutil.rmtree(p, ignore_errors=True)
                    report["deleted_paths"].append(p)
                except Exception:
                    pass
            elif os.path.isfile(p):
                try:
                    os.remove(p)
                    report["deleted_paths"].append(p)
                except Exception:
                    pass

        # 6. Purge Database Records from SQLite
        tables_to_delete = [
            ("web_deployments", "user_id"),
            ("projects", "user_id"),
            ("student_databases", "user_id"),
            ("external_databases", "user_id"),
            ("git_repositories", "user_id"),
            ("cron_jobs", "user_id"),
            ("user_redis_instances", "user_id"),
            ("quotas", "user_id"),
            ("audit_logs", "actor_id"),
            ("users", "id")
        ]

        for table, col in tables_to_delete:
            try:
                c = await db.execute(f"DELETE FROM {table} WHERE {col} = ?", (user_id,))
                report["deleted_db_rows"][table] = c.rowcount
            except Exception as e:
                report["deleted_db_rows"][table] = f"Error: {e}"

        await db.commit()

        # 7. Re-sync CloudBeaver
        try:
            await sync_cloudbeaver_datasources(db)
            report["cloudbeaver_synced"] = True
        except Exception as e:
            report["cloudbeaver_synced"] = False
            report["cloudbeaver_error"] = str(e)

        return report
