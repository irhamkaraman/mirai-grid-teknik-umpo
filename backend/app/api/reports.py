from datetime import datetime, timedelta, timezone
import re
from typing import Optional
from urllib.parse import quote

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db

router = APIRouter(prefix="/reports", tags=["Issue Reports"])

WIB_TZ = timezone(timedelta(hours=7))


def _now_wib_str() -> str:
    return datetime.now(WIB_TZ).strftime("%Y-%m-%d %H:%M:%S")


def normalize_whatsapp(raw: str) -> str:
    """Normalize Indonesian / international phone numbers to digits starting with 62."""
    digits = re.sub(r"\D+", "", (raw or "").strip())
    if not digits:
        raise HTTPException(status_code=400, detail="Nomor WhatsApp aktif wajib diisi.")
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("8"):
        digits = "62" + digits
    if len(digits) < 10 or len(digits) > 15:
        raise HTTPException(
            status_code=400,
            detail="Format nomor WhatsApp tidak valid. Gunakan format seperti 081234567890 atau 6281234567890.",
        )
    return digits


def build_wa_link(
    wa_number: str,
    reporter_name: str,
    username: str,
    category: str,
    created_at: str,
) -> str:
    msg = (
        f"Halo {reporter_name} (ID/NIM: {username}), kami dari Tim Pengembang MiraiGrid Lab TI "
        f"menindaklanjuti laporan kendala Anda terkait \"{category}\" yang dikirimkan pada {created_at} WIB."
    )
    return f"https://wa.me/{wa_number}?text={quote(msg)}"


def _serialize_report(row: aiosqlite.Row) -> dict:
    item = dict(row)
    item["wa_link"] = build_wa_link(
        item.get("whatsapp", ""),
        item.get("reporter_name", ""),
        item.get("username", ""),
        item.get("category", ""),
        item.get("created_at", ""),
    )
    return item


class CreateReportRequest(BaseModel):
    category: str = Field(..., min_length=2, max_length=100)
    description: str = Field(..., min_length=10, max_length=4000)
    whatsapp: str = Field(..., min_length=8, max_length=30)
    contact_email: Optional[str] = Field(default="", max_length=160)


class ResolveReportRequest(BaseModel):
    status: str = Field(default="resolved")
    admin_note: Optional[str] = Field(default="", max_length=1000)


@router.post("")
async def create_issue_report(
    payload: CreateReportRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    category = payload.category.strip()
    description = payload.description.strip()
    contact_email = (payload.contact_email or "").strip()

    if len(description) < 10:
        raise HTTPException(status_code=400, detail="Deskripsi kendala minimal 10 karakter.")

    if contact_email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", contact_email):
        raise HTTPException(status_code=400, detail="Format email aktif tidak valid.")

    wa_normalized = normalize_whatsapp(payload.whatsapp)
    now_wib = _now_wib_str()

    cursor = await db.execute(
        """
        INSERT INTO issue_reports (
            user_id, username, reporter_name, category, description,
            whatsapp, contact_email, status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
        """,
        (
            current_user["id"],
            current_user["username"],
            current_user["name"],
            category,
            description,
            wa_normalized,
            contact_email,
            now_wib,
            now_wib,
        ),
    )
    await db.commit()
    report_id = cursor.lastrowid

    async with db.execute("SELECT * FROM issue_reports WHERE id = ?", (report_id,)) as cur:
        row = await cur.fetchone()

    return {
        "status": "success",
        "message": "Laporan kendala berhasil dikirim ke tim pengembang.",
        "report": _serialize_report(row),
    }


@router.get("/my")
async def get_my_reports(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute(
        "SELECT * FROM issue_reports WHERE user_id = ? ORDER BY id DESC LIMIT 50",
        (current_user["id"],),
    ) as cur:
        rows = await cur.fetchall()

    return {
        "reports": [_serialize_report(r) for r in rows],
    }


@router.get("/admin")
async def list_admin_reports(
    status: str = Query(default="all"),
    q: str = Query(default=""),
    admin_user: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    clauses = []
    params = []

    status_clean = (status or "all").strip().lower()
    if status_clean in ("open", "resolved"):
        clauses.append("status = ?")
        params.append(status_clean)

    q_clean = (q or "").strip()
    if q_clean:
        like_val = f"%{q_clean}%"
        clauses.append(
            "(username LIKE ? OR reporter_name LIKE ? OR category LIKE ? OR description LIKE ? OR whatsapp LIKE ?)"
        )
        params.extend([like_val, like_val, like_val, like_val, like_val])

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    async with db.execute(
        f"SELECT * FROM issue_reports {where_sql} ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, id DESC LIMIT 200",
        tuple(params),
    ) as cur:
        rows = await cur.fetchall()

    async with db.execute(
        """
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count
        FROM issue_reports
        """
    ) as cur:
        stats_row = await cur.fetchone()

    return {
        "reports": [_serialize_report(r) for r in rows],
        "summary": {
            "total": int(stats_row["total"] or 0),
            "open": int(stats_row["open_count"] or 0),
            "resolved": int(stats_row["resolved_count"] or 0),
        },
    }


@router.patch("/admin/{report_id}/resolve")
async def update_report_status(
    report_id: int,
    payload: ResolveReportRequest,
    admin_user: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    target_status = (payload.status or "resolved").strip().lower()
    if target_status not in ("open", "resolved"):
        raise HTTPException(status_code=400, detail="Status harus 'open' atau 'resolved'.")

    async with db.execute("SELECT * FROM issue_reports WHERE id = ?", (report_id,)) as cur:
        existing = await cur.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")

    now_wib = _now_wib_str()
    admin_note = (payload.admin_note or "").strip()
    resolved_by = admin_user["username"] if target_status == "resolved" else ""
    resolved_at = now_wib if target_status == "resolved" else None

    await db.execute(
        """
        UPDATE issue_reports
        SET status = ?, admin_note = ?, resolved_by = ?, resolved_at = ?, updated_at = ?
        WHERE id = ?
        """,
        (target_status, admin_note, resolved_by, resolved_at, now_wib, report_id),
    )
    await db.commit()

    async with db.execute("SELECT * FROM issue_reports WHERE id = ?", (report_id,)) as cur:
        updated = await cur.fetchone()

    return {
        "status": "success",
        "message": "Laporan ditandai selesai." if target_status == "resolved" else "Laporan dibuka kembali.",
        "report": _serialize_report(updated),
    }


@router.delete("/admin/{report_id}")
async def delete_report(
    report_id: int,
    admin_user: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute("SELECT id FROM issue_reports WHERE id = ?", (report_id,)) as cur:
        existing = await cur.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")

    await db.execute("DELETE FROM issue_reports WHERE id = ?", (report_id,))
    await db.commit()
    return {"status": "success", "message": "Laporan berhasil dihapus."}
