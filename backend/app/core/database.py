import aiosqlite
import os
from app.core.config import settings
from app.core.security import hash_password

async def get_db():
    conn = await aiosqlite.connect(settings.DATABASE_PATH)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA journal_mode = WAL;")
    await conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        await conn.close()

async def init_db():
    os.makedirs(os.path.dirname(os.path.abspath(settings.DATABASE_PATH)), exist_ok=True)
    async with aiosqlite.connect(settings.DATABASE_PATH) as db:
        await db.execute("PRAGMA journal_mode = WAL;")
        await db.execute("PRAGMA foreign_keys = ON;")

        # 1. Cohorts (Angkatan)
        await db.execute("""
        CREATE TABLE IF NOT EXISTS cohorts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 2. Classes (Kelas)
        await db.execute("""
        CREATE TABLE IF NOT EXISTS classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cohort_id INTEGER REFERENCES cohorts(id) ON DELETE CASCADE,
            name VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(cohort_id, name)
        );
        """)

        # 3. Users
        await db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL, -- NIM for students, 'admin' for admin
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100),
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'student',   -- 'admin', 'student'
            class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
            must_change_password BOOLEAN DEFAULT 1,
            is_active BOOLEAN DEFAULT 1,
            onboarding_step INTEGER DEFAULT 1,
            onboarding_completed BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 4. Quotas
        await db.execute("""
        CREATE TABLE IF NOT EXISTS quotas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            max_projects INTEGER DEFAULT 2,
            max_databases INTEGER DEFAULT 99,
            max_memory_mb INTEGER DEFAULT 256,
            max_cpu_cores REAL DEFAULT 0.5,
            max_disk_mb INTEGER DEFAULT 500,
            max_database_disk_mb INTEGER DEFAULT 100,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 5. Student Databases
        await db.execute("""
        CREATE TABLE IF NOT EXISTS student_databases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            engine VARCHAR(20) NOT NULL,          -- 'postgres' or 'mariadb'
            db_name VARCHAR(64) NOT NULL,         -- s{nim}_{dbname}
            db_username VARCHAR(64) NOT NULL,     -- s{nim}
            db_password_enc TEXT NOT NULL,
            host VARCHAR(100) NOT NULL,
            port INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 6. External Databases
        await db.execute("""
        CREATE TABLE IF NOT EXISTS external_databases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            alias_name VARCHAR(50) NOT NULL,
            engine VARCHAR(20) NOT NULL,
            host VARCHAR(255) NOT NULL,
            port INTEGER NOT NULL,
            db_name VARCHAR(100) NOT NULL,
            username VARCHAR(100) NOT NULL,
            password_enc TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 7. Projects
        await db.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(50) NOT NULL,
            subdomain VARCHAR(100) UNIQUE NOT NULL,
            template_type VARCHAR(30) NOT NULL,    -- 'php82', 'python311', 'node20', 'static'
            portainer_stack_id INTEGER,
            allocated_port INTEGER,
            status VARCHAR(20) DEFAULT 'created',  -- 'created', 'running', 'stopped', 'error'
            env_vars_enc TEXT,
            source_type VARCHAR(20) DEFAULT 'zip', -- 'zip' or 'git'
            git_url TEXT,
            last_deployed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 8. Audit Logs
        await db.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(50) NOT NULL,
            target_resource VARCHAR(100),
            ip_address VARCHAR(45),
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 9. Git Version Control Repositories
        await db.execute("""
        CREATE TABLE IF NOT EXISTS git_repositories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            path VARCHAR(255) NOT NULL,
            filesystem_path VARCHAR(255) NOT NULL,
            remote_url TEXT,
            default_branch VARCHAR(100) DEFAULT 'main',
            target_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
            last_deployed_at TIMESTAMP,
            last_deployed_commit VARCHAR(40),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, name)
        );
        """)

        # 10. Cron Jobs
        await db.execute("""
        CREATE TABLE IF NOT EXISTS cron_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(100) NOT NULL,
            command TEXT NOT NULL,
            schedule VARCHAR(100) NOT NULL,
            minute VARCHAR(20) DEFAULT '*',
            hour VARCHAR(20) DEFAULT '*',
            day VARCHAR(20) DEFAULT '*',
            month VARCHAR(20) DEFAULT '*',
            weekday VARCHAR(20) DEFAULT '*',
            is_active INTEGER DEFAULT 1,
            last_run TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Migration: Add HTTP/S Webhook fields if not present
        cursor = await db.execute("PRAGMA table_info(cron_jobs)")
        columns = [row[1] for row in await cursor.fetchall()]
        if "job_type" not in columns:
            await db.execute("ALTER TABLE cron_jobs ADD COLUMN job_type VARCHAR(20) DEFAULT 'command'")
        if "http_method" not in columns:
            await db.execute("ALTER TABLE cron_jobs ADD COLUMN http_method VARCHAR(10) DEFAULT 'GET'")
        if "http_url" not in columns:
            await db.execute("ALTER TABLE cron_jobs ADD COLUMN http_url TEXT")
        if "http_headers" not in columns:
            await db.execute("ALTER TABLE cron_jobs ADD COLUMN http_headers TEXT")
        if "http_params" not in columns:
            await db.execute("ALTER TABLE cron_jobs ADD COLUMN http_params TEXT")
        if "http_body" not in columns:
            await db.execute("ALTER TABLE cron_jobs ADD COLUMN http_body TEXT")

        # 11. Web Deployments (Public Subdomain Router)
        await db.execute("""
        CREATE TABLE IF NOT EXISTS web_deployments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
            subdomain VARCHAR(120) UNIQUE NOT NULL,
            target_port INTEGER NOT NULL,
            container_name VARCHAR(100) NOT NULL,
            status VARCHAR(20) DEFAULT 'active', -- 'active', 'stopped'
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_web_deployments_subdomain ON web_deployments(subdomain);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_web_deployments_user ON web_deployments(user_id);")

        # 12. Isolated Per-User Redis Instances (Multi-Tenant & Anti-Bocor)
        await db.execute("""
        CREATE TABLE IF NOT EXISTS user_redis_instances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            is_active INTEGER DEFAULT 0,
            port INTEGER NOT NULL,
            socket_path TEXT NOT NULL,
            password TEXT NOT NULL,
            max_memory_mb INTEGER DEFAULT 32,
            eviction_policy VARCHAR(50) DEFAULT 'allkeys-lru',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_user_redis_user_id ON user_redis_instances(user_id);")

        # Check if config_json column exists, if not add it
        try:
            await db.execute("ALTER TABLE projects ADD COLUMN config_json TEXT;")
        except Exception:
            pass

        # Ensure database permission columns exist in quotas table
        for col, col_def in [
            ("allow_postgres", "INTEGER DEFAULT 1"),
            ("allow_mariadb", "INTEGER DEFAULT 1"),
            ("allow_remote_db", "INTEGER DEFAULT 1"),
            ("max_database_disk_mb", "INTEGER DEFAULT 100"),
        ]:
            try:
                await db.execute(f"ALTER TABLE quotas ADD COLUMN {col} {col_def};")
            except Exception:
                pass

        # Ensure onboarding columns exist in users table
        for col, col_def in [
            ("onboarding_step", "INTEGER DEFAULT 1"),
            ("onboarding_completed", "BOOLEAN DEFAULT 0"),
        ]:
            try:
                await db.execute(f"ALTER TABLE users ADD COLUMN {col} {col_def};")
            except Exception:
                pass

        # Ensure admin accounts always have onboarding completed
        try:
            await db.execute("UPDATE users SET onboarding_completed = 1, onboarding_step = 4 WHERE role = 'admin';")
        except Exception:
            pass

        # Seed default Administrator if not exists
        cursor = await db.execute("SELECT id FROM users WHERE username = 'admin'")
        admin = await cursor.fetchone()
        if not admin:
            admin_pass_hash = hash_password("splitti26nakama")
            await db.execute("""
            INSERT INTO users (username, name, email, password_hash, role, must_change_password, is_active, onboarding_step, onboarding_completed)
            VALUES ('admin', 'Administrator Lab TI', 'admin.labit@umpo.ac.id', ?, 'admin', 0, 1, 4, 1)
            """, (admin_pass_hash,))
            await db.commit()
            print("Default admin user seeded: admin / splitti26nakama")
            cursor = await db.execute("SELECT id FROM users WHERE username = 'admin'")
            admin = await cursor.fetchone()

        # Ensure admin always has a definitive, synchronized quota record (Single Source of Truth)
        if admin:
            admin_id = admin[0] if isinstance(admin, (tuple, list)) else admin["id"]
            admin_q = await (await db.execute("SELECT id FROM quotas WHERE user_id = ?", (admin_id,))).fetchone()
            if not admin_q:
                await db.execute("""
                    INSERT INTO quotas (user_id, max_projects, max_databases, max_memory_mb, max_cpu_cores, max_disk_mb, max_database_disk_mb, allow_postgres, allow_mariadb, allow_remote_db)
                    VALUES (?, 99, 99, 1024, 2.0, 2000, 1000, 1, 1, 1)
                """, (admin_id,))
                await db.commit()
            else:
                # Synchronize admin quota if needed
                await db.execute("""
                    UPDATE quotas 
                    SET max_projects = 99, max_databases = 99, max_memory_mb = 1024, max_cpu_cores = 2.0, max_disk_mb = 2000, max_database_disk_mb = 1000
                    WHERE user_id = ?
                """, (admin_id,))
                await db.commit()

        # Ensure admin home sandbox is fully provisioned with cPanel dotfiles and directories
        try:
            from app.services.user_home import ensure_user_home
            ensure_user_home("admin", "Administrator Lab TI", "admin.labit@umpo.ac.id")
        except Exception as e:
            print(f"[Warning] Admin home provisioning: {e}")

        await db.commit()
