from fastapi import APIRouter, Depends
import aiosqlite
from app.core.database import get_db
from app.models.schemas import QuotaResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/quotas", tags=["Quotas"])

@router.get("/my-quota", response_model=QuotaResponse)
async def get_my_quota(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM quotas WHERE user_id = ?", (current_user["id"],))
    quota = await cursor.fetchone()

    c_proj = await (await db.execute("SELECT COUNT(*) FROM projects WHERE user_id = ?", (current_user["id"],))).fetchone()
    c_dbs = await (await db.execute("SELECT COUNT(*) FROM student_databases WHERE user_id = ?", (current_user["id"],))).fetchone()

    isAdmin = current_user.get("role") == "admin"
    return {
        "max_projects": 99 if isAdmin else (quota["max_projects"] if quota else 2),
        "max_databases": 99 if isAdmin else (quota["max_databases"] if quota else 2),
        "max_memory_mb": 1024 if isAdmin else (quota["max_memory_mb"] if quota else 256),
        "max_cpu_cores": 2.0 if isAdmin else (quota["max_cpu_cores"] if quota else 0.5),
        "max_disk_mb": 2000 if isAdmin else (quota["max_disk_mb"] if quota else 500),
        "used_projects": c_proj[0],
        "used_databases": c_dbs[0]
    }
