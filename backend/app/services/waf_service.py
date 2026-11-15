import hashlib
import hmac
import http.client
import ipaddress
import json
import os
import re
import secrets
import socket
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import aiosqlite
from fastapi import Request

from app.core.config import settings

WAF_NGINX_CONF_PATH = os.environ.get("WAF_NGINX_CONF_PATH", "/app/data/waf_blacklist.conf")
FRONTEND_CONTAINER_NAME = os.environ.get("WAF_NGINX_CONTAINER", "miraigrid_frontend")
LOGIN_SIG_MAX_AGE_SEC = 900  # 15 minutes
BLACKLIST_TTL_DAYS = 7


@asynccontextmanager
async def _open_db():
    conn = await aiosqlite.connect(settings.DATABASE_PATH)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA journal_mode = WAL;")
    await conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        await conn.close()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _fmt_dt(dt: Optional[datetime]) -> Optional[str]:
    return dt.strftime("%Y-%m-%d %H:%M:%S") if dt else None


def _parse_dt(val: Optional[str]) -> Optional[datetime]:
    if not val:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    return None


def sanitize_ip(raw_ip: Optional[str]) -> str:
    if not raw_ip:
        return "127.0.0.1"
    candidate = raw_ip.split(",")[0].strip()
    try:
        ip_obj = ipaddress.ip_address(candidate)
        return str(ip_obj)
    except ValueError:
        return "127.0.0.1"


def extract_client_ip(request: Request) -> str:
    for header in ("CF-Connecting-IP", "X-Forwarded-For", "X-Real-IP"):
        val = request.headers.get(header)
        if val:
            return sanitize_ip(val)
    return sanitize_ip(request.client.host if request.client else "127.0.0.1")


def extract_device_id(request: Request, body_device_id: Optional[str] = None) -> str:
    raw = (body_device_id or request.headers.get("X-Device-ID") or "").strip()
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "", raw)[:128]
    if cleaned:
        return cleaned
    ua = request.headers.get("User-Agent", "")
    lang = request.headers.get("Accept-Language", "")
    fallback_seed = f"{ua}|{lang}"
    return "fp_" + hashlib.sha256(fallback_seed.encode("utf-8")).hexdigest()[:24]


def generate_login_signature() -> Dict[str, Any]:
    ts = int(time.time())
    nonce = secrets.token_hex(8)
    payload = f"mirai_login:{ts}:{nonce}".encode("utf-8")
    sig = hmac.new(settings.APP_SECRET_KEY.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return {"t": ts, "n": nonce, "sig": sig, "expires_in": LOGIN_SIG_MAX_AGE_SEC}


def verify_login_signature(ts: Optional[int], nonce: Optional[str], sig: Optional[str]) -> Tuple[bool, str]:
    if not ts or not nonce or not sig:
        return False, "Signature login tidak ditemukan. Gunakan halaman /login resmi."
    now = int(time.time())
    if now - int(ts) > LOGIN_SIG_MAX_AGE_SEC or int(ts) - now > 60:
        return False, "Signature login sudah kedaluwarsa. Silakan muat ulang halaman /login."
    payload = f"mirai_login:{int(ts)}:{nonce}".encode("utf-8")
    expected = hmac.new(settings.APP_SECRET_KEY.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, str(sig)):
        return False, "Signature login tidak valid."
    return True, "OK"


def _compute_cooldown_seconds(fail_count: int) -> int:
    if fail_count >= 12:
        return 1200  # 20 menit (maksimal)
    if fail_count >= 9:
        return 600   # 10 menit
    if fail_count >= 6:
        return 300   # 5 menit
    if fail_count >= 3:
        return 60    # 1 menit
    return 0


class _UnixSocketHTTPConnection(http.client.HTTPConnection):
    def __init__(self, socket_path: str):
        super().__init__("localhost")
        self.socket_path = socket_path

    def connect(self):
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.connect(self.socket_path)
        self.sock = sock


def _reload_nginx_container() -> Dict[str, Any]:
    """Triggers `nginx -s reload` inside miraigrid_frontend via /var/run/docker.sock."""
    docker_sock = "/var/run/docker.sock"
    if not os.path.exists(docker_sock):
        return {"reloaded": False, "reason": "docker.sock unavailable"}
    try:
        conn = _UnixSocketHTTPConnection(docker_sock)
        exec_payload = json.dumps({
            "AttachStdout": True,
            "AttachStderr": True,
            "Cmd": ["nginx", "-s", "reload"],
        })
        conn.request(
            "POST",
            f"/containers/{FRONTEND_CONTAINER_NAME}/exec",
            body=exec_payload,
            headers={"Content-Type": "application/json"},
        )
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", errors="replace")
        if resp.status not in (200, 201):
            return {"reloaded": False, "status": resp.status, "detail": body}
        exec_id = json.loads(body).get("Id")
        if not exec_id:
            return {"reloaded": False, "detail": "missing exec id"}

        conn2 = _UnixSocketHTTPConnection(docker_sock)
        conn2.request(
            "POST",
            f"/exec/{exec_id}/start",
            body=json.dumps({"Detach": False, "Tty": False}),
            headers={"Content-Type": "application/json"},
        )
        resp2 = conn2.getresponse()
        out2 = resp2.read().decode("utf-8", errors="replace")
        time.sleep(0.25)
        return {"reloaded": resp2.status in (200, 204), "status": resp2.status, "output": out2.strip()}
    except Exception as e:
        return {"reloaded": False, "error": str(e)}


async def sync_nginx_blacklist(db) -> Dict[str, Any]:
    """Writes blacklisted IPs to waf_blacklist.conf and reloads frontend Nginx."""
    cursor = await db.execute(
        "SELECT DISTINCT ip_address FROM waf_records WHERE status = 'blacklisted' ORDER BY ip_address ASC"
    )
    rows = await cursor.fetchall()
    valid_ips: List[str] = []
    for r in rows:
        raw_ip = r["ip_address"] if isinstance(r, dict) or hasattr(r, "keys") else r[0]
        try:
            ip_obj = ipaddress.ip_address(str(raw_ip).strip())
            if not ip_obj.is_loopback:
                valid_ips.append(str(ip_obj))
        except ValueError:
            continue

    cf_lines = ["map $http_cf_connecting_ip $waf_cf_blocked {", "    default 0;"]
    xff_lines = ["map $http_x_forwarded_for $waf_xff_blocked {", "    default 0;"]
    geo_lines = ["geo $remote_addr $waf_direct_blocked {", "    default 0;"]

    for ip in valid_ips:
        cf_lines.append(f"    {ip} 1;")
        escaped = re.escape(ip)
        xff_lines.append(f"    ~^{escaped}(,|$) 1;")
        geo_lines.append(f"    {ip} 1;")

    cf_lines.append("}")
    xff_lines.append("}")
    geo_lines.append("}")

    content = "\n".join([
        "# Auto-generated by MiraiGrid WAF Service - DO NOT EDIT MANUALLY",
        f"# Updated at {_fmt_dt(_utcnow())} UTC | Active Blacklist IPs: {len(valid_ips)}",
        "",
        *cf_lines,
        "",
        *xff_lines,
        "",
        *geo_lines,
        "",
    ])

    conf_dir = os.path.dirname(WAF_NGINX_CONF_PATH)
    if conf_dir:
        os.makedirs(conf_dir, exist_ok=True)
    with open(WAF_NGINX_CONF_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    reload_res = _reload_nginx_container()
    return {"blacklisted_ips": valid_ips, "nginx_reload": reload_res}


async def _find_matching_records(db, ip: str, device_id: str) -> List[Dict[str, Any]]:
    if device_id:
        cursor = await db.execute(
            """
            SELECT * FROM waf_records
            WHERE ip_address = ? OR (device_id != '' AND device_id = ?)
            ORDER BY CASE WHEN status = 'blacklisted' THEN 0 WHEN status = 'whitelisted' THEN 1 ELSE 2 END,
                     fail_count DESC, id DESC
            """,
            (ip, device_id),
        )
    else:
        cursor = await db.execute(
            "SELECT * FROM waf_records WHERE ip_address = ? ORDER BY fail_count DESC, id DESC",
            (ip,),
        )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def check_waf_access(ip: str, device_id: str) -> Dict[str, Any]:
    """
    Checks whether an IP or device_id is currently blacklisted or in cooldown.
    Returns dict: { allowed: bool, status: str, retry_after: int, reason: str }
    """
    async with _open_db() as db:
        records = await _find_matching_records(db, ip, device_id)
        if not records:
            return {"allowed": True, "status": "clean", "retry_after": 0, "reason": ""}

        now = _utcnow()

        # Explicit blacklist takes highest precedence unless whitelisted
        for rec in records:
            if rec["status"] == "blacklisted":
                exp = _parse_dt(rec.get("expires_at"))
                if exp and exp <= now:
                    # Expired > 7 days: clean up automatically
                    await db.execute("DELETE FROM waf_records WHERE id = ?", (rec["id"],))
                    await db.commit()
                    await sync_nginx_blacklist(db)
                    continue
                return {
                    "allowed": False,
                    "status": "blacklisted",
                    "retry_after": 0,
                    "reason": "Akses ditolak. Terlalu banyak aksi mencurigakan.",
                }

        # Check active cooldown bound to IP or device_id (survives cache/cookie clear)
        max_retry = 0
        cooldown_reason = ""
        for rec in records:
            if rec["status"] == "whitelisted":
                continue
            blocked_until = _parse_dt(rec.get("blocked_until"))
            if blocked_until and blocked_until > now:
                remaining = int((blocked_until - now).total_seconds()) + 1
                if remaining > max_retry:
                    max_retry = remaining
                    cooldown_reason = "Terlalu banyak aksi, mohon coba lagi beberapa saat."

        if max_retry > 0:
            return {
                "allowed": False,
                "status": "cooldown",
                "retry_after": max_retry,
                "reason": cooldown_reason,
            }

        return {"allowed": True, "status": "active", "retry_after": 0, "reason": ""}


async def record_failed_attempt(
    ip: str,
    device_id: str,
    user_agent: str,
    reason: str = "Login gagal (kredensial salah)",
) -> Dict[str, Any]:
    """Records a failed login attempt, applies progressive lockout (1m -> 5m -> 10m -> 20m -> Blacklist)."""
    now = _utcnow()
    now_str = _fmt_dt(now)
    ua_short = (user_agent or "")[:250]

    async with _open_db() as db:
        records = await _find_matching_records(db, ip, device_id)

        # If explicitly whitelisted, do not auto-lock unless admin removes whitelist
        if records and all(r["status"] == "whitelisted" for r in records):
            return {"status": "whitelisted", "fail_count": 0, "retry_after": 0, "blacklisted": False}

        # Pick the primary record (prefer non-whitelisted highest fail_count)
        non_wl = [r for r in records if r["status"] != "whitelisted"]
        target = non_wl[0] if non_wl else None

        if target:
            new_fail = int(target.get("fail_count") or 0) + 1
            rec_id = target["id"]
        else:
            new_fail = 1
            rec_id = None

        cooldown_sec = _compute_cooldown_seconds(new_fail)
        blacklisted = new_fail >= 15

        if blacklisted:
            new_status = "blacklisted"
            blocked_until_str = None
            expires_at_str = _fmt_dt(now + timedelta(days=BLACKLIST_TTL_DAYS))
            full_reason = f"{reason} (Brute-force >=15x: Blacklist 7 hari + Blokir Nginx)"
        elif cooldown_sec > 0:
            new_status = "cooldown"
            blocked_until_str = _fmt_dt(now + timedelta(seconds=cooldown_sec))
            expires_at_str = None
            mins = cooldown_sec // 60
            full_reason = f"{reason} ({new_fail}x gagal -> Cooldown {mins} menit)"
        else:
            new_status = "active"
            blocked_until_str = None
            expires_at_str = None
            full_reason = reason

        if rec_id is not None:
            await db.execute(
                """
                UPDATE waf_records
                SET ip_address = ?,
                    device_id = CASE WHEN ? != '' THEN ? ELSE device_id END,
                    user_agent = ?,
                    fail_count = ?,
                    status = ?,
                    blocked_until = ?,
                    expires_at = ?,
                    last_attempt_at = ?,
                    reason = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (ip, device_id, device_id, ua_short, new_fail, new_status, blocked_until_str, expires_at_str, now_str, full_reason, now_str, rec_id),
            )
        else:
            await db.execute(
                """
                INSERT INTO waf_records (ip_address, device_id, user_agent, fail_count, status, blocked_until, expires_at, last_attempt_at, reason, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (ip, device_id, ua_short, new_fail, new_status, blocked_until_str, expires_at_str, now_str, full_reason, now_str, now_str),
            )
        await db.commit()

        if blacklisted:
            await sync_nginx_blacklist(db)

        return {
            "status": new_status,
            "fail_count": new_fail,
            "retry_after": cooldown_sec,
            "blacklisted": blacklisted,
            "reason": full_reason,
        }


async def reset_attempts_on_success(ip: str, device_id: str) -> None:
    """Resets fail_count and cooldown for non-blacklisted, non-whitelisted records upon valid login."""
    async with _open_db() as db:
        now_str = _fmt_dt(_utcnow())
        await db.execute(
            """
            UPDATE waf_records
            SET fail_count = 0, status = 'active', blocked_until = NULL, updated_at = ?
            WHERE (ip_address = ? OR (device_id != '' AND device_id = ?))
              AND status IN ('active', 'cooldown')
            """,
            (now_str, ip, device_id),
        )
        await db.commit()


async def cleanup_expired_waf_entries() -> Dict[str, Any]:
    """Cron job: Removes blacklisted WAF records after 7 days and reloads Nginx."""
    now_str = _fmt_dt(_utcnow())
    async with _open_db() as db:
        cursor = await db.execute(
            "SELECT COUNT(*) FROM waf_records WHERE status = 'blacklisted' AND expires_at IS NOT NULL AND expires_at <= ?",
            (now_str,),
        )
        row = await cursor.fetchone()
        expired_count = int(row[0] if row else 0)

        if expired_count > 0:
            await db.execute(
                "DELETE FROM waf_records WHERE status = 'blacklisted' AND expires_at IS NOT NULL AND expires_at <= ?",
                (now_str,),
            )
            await db.commit()
            sync_res = await sync_nginx_blacklist(db)
            return {"cleaned_blacklist": expired_count, "sync": sync_res}

        # Ensure Nginx conf file always exists even when empty
        if not os.path.exists(WAF_NGINX_CONF_PATH):
            await sync_nginx_blacklist(db)

        return {"cleaned_blacklist": 0}
