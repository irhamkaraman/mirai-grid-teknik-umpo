from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.databases import router as db_router
from app.api.projects import router as projects_router
from app.api.quotas import router as quotas_router
from app.api.git import router as git_router
from app.api.terminal import router as terminal_router
from app.api.cron_jobs import router as cron_jobs_router
from app.api.deployments import router as deployments_router
from app.api.redis_router import router as redis_router
from app.api.vscode_router import router as vscode_router
from app.api.onboarding import router as onboarding_router
from app.api.file_manager_router import router as files_router
from app.api.jupyter import router as jupyter_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB and seeds
    await init_db()
    print("🚀 [MiraiGrid API] Database and services initialized.")
    yield
    print("🛑 [MiraiGrid API] Shutting down.")

app = FastAPI(
    title=settings.APP_NAME,
    description="Platform Hosting Mandiri Praktikum Lab Teknik Informatika UMPO (Thin Wrapper Portainer REST API)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|76\.76\.76\.189|100\.122\.201\.18|([a-zA-Z0-9_-]+\.)*miraigrid\.web\.id)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Healthcheck
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV
    }

# Mount Routers
app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(db_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(quotas_router, prefix="/api")
app.include_router(git_router, prefix="/api")
app.include_router(terminal_router, prefix="/api")
app.include_router(cron_jobs_router, prefix="/api")
app.include_router(deployments_router, prefix="/api")
app.include_router(redis_router, prefix="/api")
app.include_router(vscode_router, prefix="/api")
app.include_router(onboarding_router, prefix="/api")
app.include_router(files_router, prefix="/api")
app.include_router(jupyter_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.API_PORT, reload=True)
