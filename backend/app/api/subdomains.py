from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
import aiosqlite
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import require_admin
from app.core.config import settings
from app.core.database import get_db
from app.core.security import decrypt_secret, encrypt_secret
from app.services.portainer import portainer

router = APIRouter(prefix="/admin/subdomains", tags=["Admin Subdomains"])

PRIMARY_DOMAIN = (settings.PUBLIC_BASE_DOMAIN or "miraigrid.web.id").strip().lower()
MAX_SUBDOMAINS = int(getattr(settings, "MAX_CLOUDFLARE_SUBDOMAINS", 500) or 500)
WIB_TZ = timezone(timedelta(hours=7))

PROTECTED_LABELS = {
    "@",
    "",
    "*",
    "www",
    "auth",
    "api",
    "pma",
    "phpmyadmin",
    "ppa",
    "phppgadmin",
    "cloudbeaver",
    "dbeaver",
    "jupyter",
    "jupyterhub",
    "n8n",
    "thingsboard",
    "vscode",
    "code",
    "tb",
    "ssh",
    "admin",
    "mail",
    "status",
    "grafana",
    "portainer",
    "traefik",
}

PROTECTED_RECORD_TYPES = {"MX", "TXT", "NS", "CAA", "SRV", "SOA", "PTR", "SPF", "DS", "DNSKEY"}


class CloudflareConfigPayload(BaseModel):
    api_token: str = Field(..., min_length=10, max_length=256)
    zone_id: str = Field(..., min_length=10, max_length=128)


class DeleteOrphanPayload(BaseModel):
    fqdn: str = Field(..., min_length=3, max_length=255)
    cf_record_id: Optional[str] = None


def _extract_label(fqdn: str) -> str:
    clean = (fqdn or "").strip().lower().rstrip(".")
    if clean == PRIMARY_DOMAIN:
        return "@"
    suffix = f".{PRIMARY_DOMAIN}"
    if clean.endswith(suffix):
        return clean[: -len(suffix)]
    return clean


def _is_protected_dns(fqdn: str, record_type: str = "CNAME") -> Tuple[bool, Optional[str]]:
    rtype = (record_type or "CNAME").upper()
    if rtype in PROTECTED_RECORD_TYPES:
        return True, f"Tipe DNS {rtype} dilindungi sistem"
    clean = (fqdn or "").strip().lower().rstrip(".")
    if clean == PRIMARY_DOMAIN or clean == f"*.{PRIMARY_DOMAIN}":
        return True, "Domain utama / wildcard dilindungi sistem"
    label = _extract_label(clean)
    if label in PROTECTED_LABELS or label.startswith("_") or "._" in label:
        return True, "Subdomain infrastruktur / verifikasi DNS dilindungi sistem"
    return False, None


async def _get_cf_credentials(db: aiosqlite.Connection) -> Tuple[str, str, str]:
    """Return (api_token, zone_id, source) without exposing secrets."""
    env_token = (getattr(settings, "CLOUDFLARE_API_TOKEN", "") or "").strip()
    env_zone = (getattr(settings, "CLOUDFLARE_ZONE_ID", "") or "").strip()
    if env_token and env_zone:
        return env_token, env_zone, "env"

    rows = await (
        await db.execute(
            "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('cf_api_token_enc', 'cf_zone_id')"
        )
    ).fetchall()
    kv = {r["setting_key"]: r["setting_value"] for r in rows}
    enc_token = kv.get("cf_api_token_enc", "")
    zone_id = (kv.get("cf_zone_id") or "").strip()
    if enc_token and zone_id:
        try:
            token = decrypt_secret(enc_token)
            if token:
                return token, zone_id, "database"
        except Exception:
            pass
    return "", "", "none"


async def _fetch_cloudflare_records(token: str, zone_id: str) -> Tuple[List[Dict[str, Any]], Optional[str], Optional[str]]:
    """Fetch DNS records from Cloudflare API (safe read-only pagination)."""
    if not token or not zone_id:
        return [], None, None

    records: List[Dict[str, Any]] = []
    zone_name: Optional[str] = None
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            zone_resp = await client.get(
                f"https://api.cloudflare.com/client/v4/zones/{zone_id}",
                headers=headers,
            )
            if zone_resp.status_code == 200:
                zdata = zone_resp.json()
                if zdata.get("success"):
                    zone_name = (zdata.get("result") or {}).get("name")

            page = 1
            while page <= 10:
                resp = await client.get(
                    f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records",
                    headers=headers,
                    params={"per_page": 100, "page": page},
                )
                data = resp.json()
                if resp.status_code != 200 or not data.get("success"):
                    errs = data.get("errors") or []
                    msg = errs[0].get("message") if errs else f"HTTP {resp.status_code}"
                    return records, f"Gagal mengambil DNS Cloudflare: {msg}", zone_name
                batch = data.get("result") or []
                records.extend(batch)
                info = data.get("result_info") or {}
                total_pages = int(info.get("total_pages") or 1)
                if page >= total_pages or not batch:
                    break
                page += 1
        return records, None, zone_name
    except Exception as exc:
        return [], f"Koneksi ke Cloudflare API gagal: {str(exc)}", zone_name


async def _delete_cf_record(token: str, zone_id: str, record_id: str) -> Tuple[bool, Optional[str]]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.delete(
                f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{record_id}",
                headers=headers,
            )
            data = resp.json()
            if resp.status_code == 200 and data.get("success"):
                return True, None
            errs = data.get("errors") or []
            msg = errs[0].get("message") if errs else f"HTTP {resp.status_code}"
            return False, msg
    except Exception as exc:
        return False, str(exc)


async def _build_inventory(db: aiosqlite.Connection) -> Dict[str, Any]:
    users_rows = await (await db.execute("SELECT id, username, name, role, is_active FROM users")).fetchall()
    users_by_id = {r["id"]: dict(r) for r in users_rows}
    users_by_username = {str(r["username"]).strip().lower(): dict(r) for r in users_rows}

    projects_rows_raw = await (
        await db.execute("SELECT id, user_id, name, subdomain, template_type, status, created_at FROM projects")
    ).fetchall()
    projects_rows = [dict(r) for r in projects_rows_raw]
    projects_by_id = {r["id"]: r for r in projects_rows}

    deploy_rows = await (
        await db.execute(
            "SELECT id, user_id, project_id, subdomain, target_port, container_name, status, created_at, updated_at FROM web_deployments"
        )
    ).fetchall()

    # Live Docker containers via Portainer
    docker_map: Dict[str, str] = {}
    portainer_available = False
    try:
        containers = await portainer.list_containers(all_containers=True)
        if isinstance(containers, list):
            portainer_available = True
            for ct in containers:
                state = str(ct.get("State") or "").lower()
                for cname in ct.get("Names") or []:
                    clean_name = str(cname).lstrip("/").strip().lower()
                    if clean_name:
                        docker_map[clean_name] = state
    except Exception:
        portainer_available = False

    cf_token, cf_zone_id, cf_source = await _get_cf_credentials(db)
    cf_records, cf_error, cf_zone_name = await _fetch_cloudflare_records(cf_token, cf_zone_id)

    items_by_key: Dict[str, Dict[str, Any]] = {}

    def _register_miraigrid_entry(
        fqdn: str,
        user_id: Optional[int],
        container_name: Optional[str],
        db_status: str,
        source: str,
        project_name: Optional[str] = None,
        created_at: Optional[str] = None,
        deployment_id: Optional[int] = None,
        project_id: Optional[int] = None,
    ) -> None:
        clean_fqdn = (fqdn or "").strip().lower().rstrip(".")
        if not clean_fqdn:
            return
        if "." not in clean_fqdn:
            clean_fqdn = f"{clean_fqdn}.{PRIMARY_DOMAIN}"

        owner = users_by_id.get(user_id) if user_id is not None else None
        cname = (container_name or "").strip().lower()
        docker_state = docker_map.get(cname) if (portainer_available and cname) else None
        protected, protected_reason = _is_protected_dns(clean_fqdn, "CNAME")

        orphan_reason: Optional[str] = None
        if owner is None:
            status = "orphan"
            orphan_reason = "Akun MiraiGrid sudah dihapus"
        elif (db_status or "").lower() == "deleted":
            status = "orphan"
            orphan_reason = "Deployment / proyek telah dihapus"
        elif portainer_available and cname and docker_state is None:
            status = "orphan"
            orphan_reason = f"Container '{container_name}' sudah dihapus dari Docker"
        elif (db_status or "").lower() in ("active", "running") and (
            not portainer_available or not cname or docker_state == "running"
        ):
            status = "active"
        else:
            status = "inactive"
            if docker_state and docker_state != "running":
                orphan_reason = f"Container berstatus {docker_state}"
            else:
                orphan_reason = "Deployment dinonaktifkan (mati)"

        existing = items_by_key.get(clean_fqdn)
        if existing and existing.get("status") == "active" and status != "active":
            return

        items_by_key[clean_fqdn] = {
            "fqdn": clean_fqdn,
            "label": _extract_label(clean_fqdn),
            "record_type": "WILDCARD/APP",
            "content": f"10.10.10.10 ({container_name})" if container_name else "10.10.10.10",
            "proxied": True,
            "status": status,
            "status_reason": orphan_reason or "Berjalan normal",
            "source": source,
            "in_cloudflare": False,
            "cf_record_id": None,
            "protected": protected,
            "protected_reason": protected_reason,
            "owner_username": owner.get("username") if owner else None,
            "owner_name": owner.get("name") if owner else None,
            "owner_active": bool(owner.get("is_active", 1)) if owner else False,
            "container_name": container_name or None,
            "container_state": docker_state,
            "project_name": project_name,
            "deployment_id": deployment_id,
            "project_id": project_id,
            "created_at": created_at,
        }

    # 1. From web_deployments
    for d in deploy_rows:
        proj = projects_by_id.get(d["project_id"]) if d["project_id"] else None
        effective_status = "deleted" if (proj and str(proj.get("status") or "").lower() == "deleted") else str(d["status"] or "active")
        _register_miraigrid_entry(
            fqdn=d["subdomain"],
            user_id=d["user_id"],
            container_name=d["container_name"] or (proj.get("container_name") if proj else ""),
            db_status=effective_status,
            source="web_deployment",
            project_name=proj.get("name") if proj else None,
            created_at=str(d["created_at"] or ""),
            deployment_id=d["id"],
            project_id=d["project_id"],
        )

    # 2. From projects that have custom subdomain not yet in web_deployments
    for p in projects_rows:
        sub = (p.get("subdomain") or "").strip().lower()
        if not sub:
            continue
        fqdn = sub if "." in sub else f"{sub}.{PRIMARY_DOMAIN}"
        if fqdn not in items_by_key:
            _register_miraigrid_entry(
                fqdn=fqdn,
                user_id=p["user_id"],
                container_name=p.get("container_name"),
                db_status=str(p.get("status") or "running"),
                source="project",
                project_name=p.get("name"),
                created_at=str(p.get("created_at") or ""),
                project_id=p["id"],
            )

    # 3. Merge Cloudflare DNS records
    cf_dns_count = len(cf_records)
    for rec in cf_records:
        rec_name = str(rec.get("name") or "").strip().lower().rstrip(".")
        rec_type = str(rec.get("type") or "").upper()
        rec_id = str(rec.get("id") or "")
        rec_content = str(rec.get("content") or "")
        rec_proxied = bool(rec.get("proxied"))
        rec_created = str(rec.get("created_on") or "")

        protected, protected_reason = _is_protected_dns(rec_name, rec_type)
        label = _extract_label(rec_name)

        if rec_name in items_by_key and rec_type in ("A", "AAAA", "CNAME"):
            items_by_key[rec_name]["in_cloudflare"] = True
            items_by_key[rec_name]["cf_record_id"] = rec_id
            items_by_key[rec_name]["record_type"] = rec_type
            items_by_key[rec_name]["content"] = rec_content
            items_by_key[rec_name]["proxied"] = rec_proxied
            continue

        # Unique key for non-A/CNAME records (TXT/MX/etc.) so they don't overwrite web entries
        key = rec_name if rec_type in ("A", "AAAA", "CNAME") else f"{rec_name}::{rec_type}::{rec_id}"

        if protected:
            status = "active"
            reason = protected_reason or "Catatan DNS sistem aktif"
            owner_username = "system"
            owner_name = "Infrastruktur MiraiGrid"
            source = "cloudflare_system"
        elif any(label.startswith(prefix) for prefix in ("code-", "ssh-", "tb-", "n8n-")):
            uname = label.split("-", 1)[1]
            owner = users_by_username.get(uname)
            if not owner:
                status = "orphan"
                reason = f"Akun '{uname}' sudah dihapus dari MiraiGrid"
                owner_username = uname
                owner_name = None
            elif not bool(owner.get("is_active", 1)):
                status = "inactive"
                reason = "Akun mahasiswa dinonaktifkan"
                owner_username = owner["username"]
                owner_name = owner["name"]
            else:
                status = "active"
                reason = "Subdomain layanan akun aktif"
                owner_username = owner["username"]
                owner_name = owner["name"]
            source = "cloudflare_service"
        else:
            status = "orphan"
            reason = "DNS Cloudflare tidak terdaftar di proyek/akun MiraiGrid (akun/container terhapus)"
            owner_username = None
            owner_name = None
            source = "cloudflare_orphan"

        items_by_key[key] = {
            "fqdn": rec_name,
            "label": label,
            "record_type": rec_type,
            "content": rec_content,
            "proxied": rec_proxied,
            "status": status,
            "status_reason": reason,
            "source": source,
            "in_cloudflare": True,
            "cf_record_id": rec_id,
            "protected": protected,
            "protected_reason": protected_reason,
            "owner_username": owner_username,
            "owner_name": owner_name,
            "owner_active": status == "active",
            "container_name": None,
            "container_state": None,
            "project_name": None,
            "deployment_id": None,
            "project_id": None,
            "created_at": rec_created,
        }

    all_items = list(items_by_key.values())
    status_order = {"orphan": 0, "inactive": 1, "active": 2}
    all_items.sort(key=lambda x: (status_order.get(x["status"], 9), 1 if x["protected"] else 0, x["fqdn"]))

    total_count = len(all_items)
    active_count = sum(1 for x in all_items if x["status"] == "active")
    inactive_count = sum(1 for x in all_items if x["status"] == "inactive")
    orphan_count = sum(1 for x in all_items if x["status"] == "orphan")
    protected_count = sum(1 for x in all_items if x["protected"])
    cleanable_orphan_count = sum(1 for x in all_items if x["status"] == "orphan" and not x["protected"])

    token_hint = f"••••{cf_token[-4:]}" if len(cf_token) >= 4 else ("••••" if cf_token else "")

    return {
        "primary_domain": PRIMARY_DOMAIN,
        "max_subdomains": MAX_SUBDOMAINS,
        "total_count": total_count,
        "cloudflare_dns_count": cf_dns_count,
        "active_count": active_count,
        "inactive_count": inactive_count,
        "orphan_count": orphan_count,
        "cleanable_orphan_count": cleanable_orphan_count,
        "protected_count": protected_count,
        "remaining_quota": max(0, MAX_SUBDOMAINS - total_count),
        "quota_percent": round(min(100.0, (total_count / MAX_SUBDOMAINS) * 100), 1) if MAX_SUBDOMAINS else 0.0,
        "is_near_limit": total_count >= int(MAX_SUBDOMAINS * 0.9),
        "is_limit_reached": total_count >= MAX_SUBDOMAINS,
        "portainer_available": portainer_available,
        "cloudflare": {
            "configured": bool(cf_token and cf_zone_id),
            "source": cf_source,
            "zone_id": cf_zone_id if cf_zone_id else "",
            "zone_name": cf_zone_name or PRIMARY_DOMAIN,
            "token_hint": token_hint,
            "error": cf_error,
            "free_tier_note": "Cloudflare Free Tier: Lindungi record sistem/wildcard/TXT/MX agar routing utama dan SSL tetap aman.",
        },
        "items": all_items,
    }


@router.get("")
async def list_subdomains(
    status_filter: str = Query("all", alias="status"),
    search: str = Query("", max_length=120),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    inventory = await _build_inventory(db)
    items = inventory["items"]

    sf = (status_filter or "all").strip().lower()
    if sf in ("active", "inactive", "orphan"):
        items = [x for x in items if x["status"] == sf]

    q = (search or "").strip().lower()
    if q:
        items = [
            x for x in items
            if q in (x.get("fqdn") or "").lower()
            or q in (x.get("owner_username") or "").lower()
            or q in (x.get("owner_name") or "").lower()
            or q in (x.get("container_name") or "").lower()
            or q in (x.get("project_name") or "").lower()
            or q in (x.get("status_reason") or "").lower()
        ]

    filtered_total = len(items)
    total_pages = max(1, (filtered_total + limit - 1) // limit)
    safe_page = min(page, total_pages)
    start = (safe_page - 1) * limit
    paged = items[start : start + limit]

    return {
        "primary_domain": inventory["primary_domain"],
        "max_subdomains": inventory["max_subdomains"],
        "total_count": inventory["total_count"],
        "cloudflare_dns_count": inventory["cloudflare_dns_count"],
        "active_count": inventory["active_count"],
        "inactive_count": inventory["inactive_count"],
        "orphan_count": inventory["orphan_count"],
        "cleanable_orphan_count": inventory["cleanable_orphan_count"],
        "protected_count": inventory["protected_count"],
        "remaining_quota": inventory["remaining_quota"],
        "quota_percent": inventory["quota_percent"],
        "is_near_limit": inventory["is_near_limit"],
        "is_limit_reached": inventory["is_limit_reached"],
        "portainer_available": inventory["portainer_available"],
        "cloudflare": inventory["cloudflare"],
        "pagination": {
            "page": safe_page,
            "limit": limit,
            "total": filtered_total,
            "total_pages": total_pages,
        },
        "items": paged,
    }


@router.post("/cloudflare-config")
async def save_cloudflare_config(
    payload: CloudflareConfigPayload,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    token = payload.api_token.strip()
    zone_id = payload.zone_id.strip()

    records, err, zone_name = await _fetch_cloudflare_records(token, zone_id)
    if err:
        raise HTTPException(status_code=400, detail=f"Verifikasi Cloudflare gagal: {err}")

    now_str = datetime.now(WIB_TZ).strftime("%Y-%m-%d %H:%M:%S")
    enc_token = encrypt_secret(token)

    await db.execute(
        """
        INSERT INTO system_settings (setting_key, setting_value, updated_at)
        VALUES ('cf_api_token_enc', ?, ?)
        ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at
        """,
        (enc_token, now_str),
    )
    await db.execute(
        """
        INSERT INTO system_settings (setting_key, setting_value, updated_at)
        VALUES ('cf_zone_id', ?, ?)
        ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at
        """,
        (zone_id, now_str),
    )
    await db.execute(
        "INSERT INTO audit_logs (actor_id, action, target_resource, details) VALUES (?, ?, ?, ?)",
        (admin["id"], "CLOUDFLARE_CONFIG_UPDATE", zone_id, f"Zone: {zone_name or PRIMARY_DOMAIN}, Records: {len(records)}"),
    )
    await db.commit()
    return {
        "status": "success",
        "message": f"Cloudflare terhubung untuk zone {zone_name or PRIMARY_DOMAIN} ({len(records)} DNS records ditemukan).",
        "zone_name": zone_name or PRIMARY_DOMAIN,
        "records_count": len(records),
    }


@router.delete("/orphan")
async def delete_single_orphan(
    payload: DeleteOrphanPayload,
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    fqdn = payload.fqdn.strip().lower().rstrip(".")
    inventory = await _build_inventory(db)
    target = next((x for x in inventory["items"] if x["fqdn"] == fqdn), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Subdomain {fqdn} tidak ditemukan.")
    if target.get("protected"):
        raise HTTPException(
            status_code=403,
            detail=f"Ditolak demi keamanan DNS: {fqdn} ({target.get('protected_reason')}).",
        )
    if target.get("status") != "orphan":
        raise HTTPException(
            status_code=400,
            detail=f"Subdomain {fqdn} bukan berstatus tidak terpakai (orphan). Hanya subdomain orphan yang aman dihapus.",
        )

    cf_deleted = False
    cf_record_id = payload.cf_record_id or target.get("cf_record_id")
    if cf_record_id:
        cf_token, cf_zone_id, _ = await _get_cf_credentials(db)
        if not cf_token or not cf_zone_id:
            raise HTTPException(status_code=400, detail="Kredensial Cloudflare belum dikonfigurasi.")
        ok, err = await _delete_cf_record(cf_token, cf_zone_id, cf_record_id)
        if not ok:
            raise HTTPException(status_code=502, detail=f"Gagal menghapus DNS record Cloudflare: {err}")
        cf_deleted = True

    if target.get("deployment_id"):
        await db.execute("DELETE FROM web_deployments WHERE id = ?", (target["deployment_id"],))
    if target.get("project_id") and target.get("owner_username") is None:
        await db.execute("DELETE FROM projects WHERE id = ?", (target["project_id"],))

    await db.execute(
        "INSERT INTO audit_logs (actor_id, action, target_resource, details) VALUES (?, ?, ?, ?)",
        (admin["id"], "SUBDOMAIN_ORPHAN_DELETE", fqdn, f"cf_deleted={cf_deleted}"),
    )
    await db.commit()
    return {"status": "success", "message": f"Subdomain orphan {fqdn} berhasil dibersihkan.", "cf_deleted": cf_deleted}


@router.post("/cleanup-orphans")
async def cleanup_all_orphans(
    admin: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    inventory = await _build_inventory(db)
    orphans = [x for x in inventory["items"] if x["status"] == "orphan" and not x["protected"]]
    if not orphans:
        return {"status": "success", "deleted_count": 0, "skipped_count": 0, "message": "Tidak ada subdomain orphan yang perlu dibersihkan."}

    cf_token, cf_zone_id, _ = await _get_cf_credentials(db)
    deleted_count = 0
    skipped_count = 0
    errors: List[str] = []

    for item in orphans:
        fqdn = item["fqdn"]
        cf_record_id = item.get("cf_record_id")
        if cf_record_id:
            if not cf_token or not cf_zone_id:
                skipped_count += 1
                continue
            ok, err = await _delete_cf_record(cf_token, cf_zone_id, cf_record_id)
            if not ok:
                skipped_count += 1
                errors.append(f"{fqdn}: {err}")
                continue

        if item.get("deployment_id"):
            await db.execute("DELETE FROM web_deployments WHERE id = ?", (item["deployment_id"],))
        if item.get("project_id") and item.get("owner_username") is None:
            await db.execute("DELETE FROM projects WHERE id = ?", (item["project_id"],))
        deleted_count += 1

    await db.execute(
        "INSERT INTO audit_logs (actor_id, action, target_resource, details) VALUES (?, ?, ?, ?)",
        (admin["id"], "SUBDOMAIN_ORPHAN_BULK_CLEANUP", PRIMARY_DOMAIN, f"deleted={deleted_count}, skipped={skipped_count}"),
    )
    await db.commit()

    return {
        "status": "success",
        "deleted_count": deleted_count,
        "skipped_count": skipped_count,
        "errors": errors[:10],
        "message": f"Berhasil membersihkan {deleted_count} subdomain orphan" + (f" ({skipped_count} dilewati)" if skipped_count else "."),
    }
