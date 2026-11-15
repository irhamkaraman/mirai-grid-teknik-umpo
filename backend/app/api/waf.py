from datetime import timedelta
from typing import Optional

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.deps import require_admin
from app.core.database import get_db
from app.services.waf_service import (
    BLACKLIST_TTL_DAYS,
    _fmt_dt,
    _utcnow,
    cleanup_expired_waf_entries,
    sanitize_ip,
    sync_nginx_blacklist,
)

router = APIRouter(prefix="/admin/waf", tags=["Admin WAF Security"])


class ManualBlacklistRequest(BaseModel):
    ip_address: str
    device_id: Optional[str] = ""
    reason: Optional[str] = "Diblokir manual oleh Administrator"


@router.get("/records")
async def list_waf_records(
    status_filter: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    admin=Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    query = "SELECT * FROM waf_records WHERE 1=1"
    params = []

    if status_filter and status_filter != "all":
        query += " AND status = ?"
        params.append(status_filter)

    if search and search.strip():
        q = f"%{search.strip()}%"
        query += " AND (ip_address LIKE ? OR device_id LIKE ? OR user_agent LIKE ? OR reason LIKE ?)"
        params.extend([q, q, q, q])

    query += " ORDER BY CASE status WHEN 'blacklisted' THEN 0 WHEN 'cooldown' THEN 1 WHEN 'active' THEN 2 ELSE 3 END, updated_at DESC"
    cursor = await db.execute(query, params)
    rows = [dict(r) for r in await cursor.fetchall()]

    counts_cur = await db.execute("SELECT status, COUNT(*) as cnt FROM waf_records GROUP BY status")
    counts_raw = {r["status"]: r["cnt"] for r in await counts_cur.fetchall()}

    return {
        "records": rows,
        "summary": {
            "total": sum(counts_raw.values()),
            "blacklisted": counts_raw.get("blacklisted", 0),
            "cooldown": counts_raw.get("cooldown", 0),
            "whitelisted": counts_raw.get("whitelisted", 0),
            "active": counts_raw.get("active", 0),
            "auto_cleanup_days": BLACKLIST_TTL_DAYS,
        },
    }


@router.post("/whitelist/{record_id}")
async def whitelist_waf_record(
    record_id: int,
    admin=Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute("SELECT * FROM waf_records WHERE id = ?", (record_id,))
    rec = await cursor.fetchone()
    if not rec:
        raise HTTPException(status_code=404, detail="Record WAF tidak ditemukan.")

    now_str = _fmt_dt(_utcnow())
    await db.execute(
        """
        UPDATE waf_records
        SET status = 'whitelisted',
            fail_count = 0,
            blocked_until = NULL,
            expires_at = NULL,
            reason = 'Di-whitelist oleh Administrator',
            updated_at = ?
        WHERE id = ?
        """,
        (now_str, record_id),
    )
    await db.commit()
    sync_res = await sync_nginx_blacklist(db)
    return {"message": f"IP {rec['ip_address']} berhasil di-whitelist dan dibuka blokirnya.", "sync": sync_res}


@router.post("/blacklist")
async def manual_blacklist_ip(
    payload: ManualBlacklistRequest,
    admin=Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    ip = sanitize_ip(payload.ip_address)
    if ip == "127.0.0.1" and payload.ip_address.strip() != "127.0.0.1":
        raise HTTPException(status_code=400, detail="Format IP address tidak valid.")

    now = _utcnow()
    now_str = _fmt_dt(now)
    expires_str = _fmt_dt(now + timedelta(days=BLACKLIST_TTL_DAYS))
    device_id = (payload.device_id or "").strip()[:128]
    reason = (payload.reason or "Diblokir manual oleh Administrator")[:250]

    cursor = await db.execute("SELECT id FROM waf_records WHERE ip_address = ? ORDER BY id DESC LIMIT 1", (ip,))
    existing = await cursor.fetchone()
    if existing:
        await db.execute(
            """
            UPDATE waf_records
            SET status = 'blacklisted',
                device_id = CASE WHEN ? != '' THEN ? ELSE device_id END,
                blocked_until = NULL,
                expires_at = ?,
                reason = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (device_id, device_id, expires_str, reason, now_str, existing["id"]),
        )
    else:
        await db.execute(
            """
            INSERT INTO waf_records (ip_address, device_id, user_agent, fail_count, status, blocked_until, expires_at, last_attempt_at, reason, created_at, updated_at)
            VALUES (?, ?, 'Manual Admin Block', 15, 'blacklisted', NULL, ?, ?, ?, ?, ?)
            """,
            (ip, device_id, expires_str, now_str, reason, now_str, now_str),
        )
    await db.commit()
    sync_res = await sync_nginx_blacklist(db)
    return {"message": f"IP {ip} berhasil dimasukkan ke daftar blacklist (7 hari) & Nginx.", "sync": sync_res}


@router.delete("/records/{record_id}")
async def delete_waf_record(
    record_id: int,
    admin=Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute("SELECT * FROM waf_records WHERE id = ?", (record_id,))
    rec = await cursor.fetchone()
    if not rec:
        raise HTTPException(status_code=404, detail="Record WAF tidak ditemukan.")

    was_blacklisted = rec["status"] == "blacklisted"
    await db.execute("DELETE FROM waf_records WHERE id = ?", (record_id,))
    await db.commit()

    sync_res = None
    if was_blacklisted:
        sync_res = await sync_nginx_blacklist(db)

    return {"message": f"Record WAF untuk IP {rec['ip_address']} berhasil dihapus.", "sync": sync_res}


@router.post("/cleanup")
async def trigger_waf_cleanup(admin=Depends(require_admin)):
    res = await cleanup_expired_waf_entries()
    return {"message": "Pembersihan blacklist WAF > 7 hari selesai.", "result": res}
