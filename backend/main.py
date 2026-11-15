import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import init_db
from app.services.waf_service import (
    _open_db,
    check_waf_access,
    cleanup_expired_waf_entries,
    extract_client_ip,
    extract_device_id,
    sync_nginx_blacklist,
)
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.databases import router as db_router
from app.api.projects import router as projects_router, deploy_router
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
from app.api.thingsboard import router as thingsboard_router
from app.api.n8n_router import router as n8n_router, platform_n8n_router
from app.api.ssh_router import router as ssh_router
from app.api.resources import router as resources_router
from app.api.user_dashboard import router as user_dashboard_router
from app.api.waf import router as waf_router
from app.api.reports import router as reports_router
from app.api.subdomains import router as subdomains_router


async def _waf_cleanup_loop():
    while True:
        try:
            await asyncio.sleep(3600)
            await cleanup_expired_waf_entries()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[WAF Cron] Error during 7-day cleanup: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB and seeds
    await init_db()
    try:
        await cleanup_expired_waf_entries()
        async with _open_db() as db:
            await sync_nginx_blacklist(db)
    except Exception as e:
        print(f"[WAF Startup] Sync warning: {e}")
    waf_task = asyncio.create_task(_waf_cleanup_loop())
    print("🚀 [MiraiGrid API] Database and services initialized.")
    yield
    waf_task.cancel()
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


@app.middleware("http")
async def waf_blacklist_middleware(request: Request, call_next):
    path = request.url.path
    if request.method != "OPTIONS" and not path.startswith("/api/health") and not path.endswith("/resolve"):
        if not (path.startswith("/api/admin/waf") and request.headers.get("Authorization")):
            ip = extract_client_ip(request)
            device_id = extract_device_id(request)
            waf_res = await check_waf_access(ip, device_id)
            if not waf_res["allowed"] and waf_res["status"] == "blacklisted":
                return JSONResponse(
                    status_code=403,
                    content={"detail": waf_res["reason"]},
                )
    return await call_next(request)

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
app.include_router(deploy_router, prefix="/api")
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
app.include_router(thingsboard_router, prefix="/api")
app.include_router(n8n_router, prefix="/api")
app.include_router(platform_n8n_router, prefix="/api")
app.include_router(ssh_router, prefix="/api")
app.include_router(resources_router, prefix="/api")
app.include_router(user_dashboard_router, prefix="/api")
app.include_router(waf_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(subdomains_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.API_PORT, reload=True)
