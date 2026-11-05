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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.API_PORT, reload=True)
