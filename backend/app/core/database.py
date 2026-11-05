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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 4. Quotas
        await db.execute("""
        CREATE TABLE IF NOT EXISTS quotas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            max_projects INTEGER DEFAULT 2,
            max_databases INTEGER DEFAULT 2,
            max_memory_mb INTEGER DEFAULT 256,
            max_cpu_cores REAL DEFAULT 0.5,
            max_disk_mb INTEGER DEFAULT 500,
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

        # Check if config_json column exists, if not add it
        try:
            await db.execute("ALTER TABLE projects ADD COLUMN config_json TEXT;")
        except Exception:
            pass

        # Seed default Administrator if not exists
        cursor = await db.execute("SELECT id FROM users WHERE username = 'admin'")
        admin = await cursor.fetchone()
        if not admin:
            admin_pass_hash = hash_password("splitti26nakama")
            await db.execute("""
            INSERT INTO users (username, name, email, password_hash, role, must_change_password, is_active)
            VALUES ('admin', 'Administrator Lab TI', 'admin.labit@umpo.ac.id', ?, 'admin', 0, 1)
            """, (admin_pass_hash,))
            await db.commit()
            print("Default admin user seeded: admin / splitti26nakama")

        await db.commit()
