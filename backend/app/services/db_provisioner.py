import re
import secrets
import string
import asyncpg
import aiomysql
from typing import Dict, Any
from app.core.config import settings

def sanitize_identifier(name: str) -> str:
    """Ensure identifier only contains alphanumeric and underscore (strict anti-SQLi)"""
    if not re.match(r"^[a-zA-Z0-9_]{3,32}$", name):
        raise ValueError(f"Invalid identifier: '{name}'. Must be 3-32 chars alphanumeric or underscore.")
    return name

def generate_strong_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))

class DatabaseProvisioner:

    @staticmethod
    async def create_postgres_db(nim: str, raw_db_name: str) -> Dict[str, Any]:
        """
        Creates an isolated PostgreSQL user and database.
        User: s{nim}
        Database: s{nim}_{raw_db_name}
        """
        db_username = sanitize_identifier(f"s{nim}")
        db_name = sanitize_identifier(f"s{nim}_{raw_db_name}")
        db_password = generate_strong_password(16)

        conn = await asyncpg.connect(
            host=settings.POSTGRES_ADMIN_HOST,
            port=settings.POSTGRES_ADMIN_PORT,
            user=settings.POSTGRES_ADMIN_USER,
            password=settings.POSTGRES_ADMIN_PASSWORD,
            database=settings.POSTGRES_DEFAULT_DB,
            timeout=10
        )

        try:
            # 1. Create or update user with connection limit
            user_exists = await conn.fetchval("SELECT 1 FROM pg_roles WHERE rolname = $1", db_username)
            if not user_exists:
                await conn.execute(f'CREATE USER "{db_username}" WITH ENCRYPTED PASSWORD \'{db_password}\' CONNECTION LIMIT 5;')
            else:
                await conn.execute(f'ALTER USER "{db_username}" WITH ENCRYPTED PASSWORD \'{db_password}\' CONNECTION LIMIT 5;')

            # 2. Create database if not exists
            db_exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", db_name)
            if not db_exists:
                await conn.execute(f'CREATE DATABASE "{db_name}" OWNER "{db_username}";')

            # 3. Grant privileges strictly to this database with high-level user isolation
            await conn.execute(f'REVOKE CONNECT ON DATABASE "{db_name}" FROM PUBLIC;')
            await conn.execute(f'GRANT CONNECT, TEMPORARY ON DATABASE "{db_name}" TO "{db_username}";')
            await conn.execute(f'GRANT ALL PRIVILEGES ON DATABASE "{db_name}" TO "{db_username}";')
            await conn.execute(f'REVOKE ALL ON DATABASE postgres FROM "{db_username}";')
            await conn.execute(f'REVOKE CONNECT ON DATABASE postgres FROM "{db_username}";')

            return {
                "success": True,
                "engine": "postgres",
                "db_name": db_name,
                "db_username": db_username,
                "db_password": db_password,
                "host": settings.BASE_DOMAIN,
                "port": settings.POSTGRES_ADMIN_PORT,
                "connection_uri": f"postgresql://{db_username}:{db_password}@{settings.BASE_DOMAIN}:{settings.POSTGRES_ADMIN_PORT}/{db_name}"
            }
        finally:
            await conn.close()

    @staticmethod
    async def delete_postgres_db(nim: str, raw_db_name: str) -> bool:
        db_name = sanitize_identifier(f"s{nim}_{raw_db_name}")
        conn = await asyncpg.connect(
            host=settings.POSTGRES_ADMIN_HOST,
            port=settings.POSTGRES_ADMIN_PORT,
            user=settings.POSTGRES_ADMIN_USER,
            password=settings.POSTGRES_ADMIN_PASSWORD,
            database=settings.POSTGRES_DEFAULT_DB,
            timeout=10
        )
        try:
            # Terminate active connections first
            await conn.execute("""
                SELECT pg_terminate_backend(pg_stat_activity.pid)
                FROM pg_stat_activity
                WHERE pg_stat_activity.datname = $1
                  AND pid <> pg_backend_pid();
            """, db_name)
            await conn.execute(f'DROP DATABASE IF EXISTS "{db_name}";')
            return True
        finally:
            await conn.close()

    @staticmethod
    async def create_mariadb_db(nim: str, raw_db_name: str) -> Dict[str, Any]:
        """
        Creates an isolated MariaDB/MySQL user and database.
        User: s{nim}
        Database: s{nim}_{raw_db_name}
        """
        db_username = sanitize_identifier(f"s{nim}")
        db_name = sanitize_identifier(f"s{nim}_{raw_db_name}")
        db_password = generate_strong_password(16)

        conn = await aiomysql.connect(
            host=settings.MARIADB_ADMIN_HOST,
            port=settings.MARIADB_ADMIN_PORT,
            user=settings.MARIADB_ADMIN_USER,
            password=settings.MARIADB_ADMIN_PASSWORD,
            autocommit=True,
            connect_timeout=10
        )

        try:
            async with conn.cursor() as cursor:
                # 1. Create database
                await cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")

                # 2. Create user with resource limit (max 5 user connections)
                await cursor.execute(f"CREATE USER IF NOT EXISTS '{db_username}'@'%' IDENTIFIED BY '{db_password}';")
                await cursor.execute(f"ALTER USER '{db_username}'@'%' IDENTIFIED BY '{db_password}' WITH MAX_USER_CONNECTIONS 5;")
                try:
                    await cursor.execute(f"REVOKE ALL PRIVILEGES, GRANT OPTION FROM '{db_username}'@'%';")
                except Exception:
                    pass

                # 3. Grant privileges strictly on student's database (strict isolation)
                await cursor.execute(f"GRANT ALL PRIVILEGES ON `{db_name}`.* TO '{db_username}'@'%';")
                await cursor.execute("FLUSH PRIVILEGES;")

            return {
                "success": True,
                "engine": "mariadb",
                "db_name": db_name,
                "db_username": db_username,
                "db_password": db_password,
                "host": settings.BASE_DOMAIN,
                "port": settings.MARIADB_ADMIN_PORT,
                "connection_uri": f"mysql://{db_username}:{db_password}@{settings.BASE_DOMAIN}:{settings.MARIADB_ADMIN_PORT}/{db_name}"
            }
        finally:
            conn.close()

    @staticmethod
    async def delete_mariadb_db(nim: str, raw_db_name: str) -> bool:
        db_name = sanitize_identifier(f"s{nim}_{raw_db_name}")
        conn = await aiomysql.connect(
            host=settings.MARIADB_ADMIN_HOST,
            port=settings.MARIADB_ADMIN_PORT,
            user=settings.MARIADB_ADMIN_USER,
            password=settings.MARIADB_ADMIN_PASSWORD,
            autocommit=True,
            connect_timeout=10
        )
        try:
            async with conn.cursor() as cursor:
                await cursor.execute(f"DROP DATABASE IF EXISTS `{db_name}`;")
                await cursor.execute("FLUSH PRIVILEGES;")
            return True
        finally:
            conn.close()
