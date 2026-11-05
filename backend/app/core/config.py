import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    APP_NAME: str = "MiraiGrid"
    APP_ENV: str = "production"
    APP_SECRET_KEY: str = Field(default="miraigrid-super-secret-key-change-in-production-32c", min_length=32)
    API_PORT: int = 8000
    FRONTEND_PORT: int = 3000
    CORS_ORIGINS: str = "http://localhost:3000,http://76.76.76.189:3000"

    # Subdomain base
    BASE_DOMAIN: str = "76.76.76.189"

    # AES-256-GCM key (32 bytes base64 encoded)
    DATA_ENCRYPTION_KEY: str = "r3k1a9z7P0bQxW+V4sE9dF2gH1jK8lM5nO3pQ7rT6vU="

    # Storage paths
    DATA_DIR: str = "./data"
    UPLOADS_DIR: str = "./data/uploads"
    PROJECTS_DIR: str = "./data/projects"
    HOST_PROJECTS_DIR: str = "/var/lib/docker/volumes/miraigrid_miraigrid_data/_data/projects"
    DATABASE_PATH: str = "./data/miraigrid.db"

    # Portainer Config
    PORTAINER_URL: str = "https://portainer:9443"
    PORTAINER_API_KEY: str = ""
    PORTAINER_ENDPOINT_ID: int = 3
    PORTAINER_SSL_VERIFY: bool = False

    # Central Database Stack
    POSTGRES_ADMIN_HOST: str = "db_postgres"
    POSTGRES_ADMIN_PORT: int = 5432
    POSTGRES_ADMIN_USER: str = "root"
    POSTGRES_ADMIN_PASSWORD: str = "splitti26password"
    POSTGRES_DEFAULT_DB: str = "postgres"

    MARIADB_ADMIN_HOST: str = "db_mariadb"
    MARIADB_ADMIN_PORT: int = 3306
    MARIADB_ADMIN_USER: str = "root"
    MARIADB_ADMIN_PASSWORD: str = "splitti26password"

    # Quotas
    DEFAULT_MAX_PROJECTS: int = 2
    DEFAULT_MAX_DATABASES: int = 2
    DEFAULT_MAX_MEMORY_MB: int = 256
    DEFAULT_MAX_CPU_CORES: float = 0.5
    DEFAULT_MAX_DISK_MB: int = 500

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Ensure directories exist
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
os.makedirs(settings.PROJECTS_DIR, exist_ok=True)
