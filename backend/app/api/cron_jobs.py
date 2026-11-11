import os
import json
import time
import subprocess
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import aiosqlite
import httpx

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user

router = APIRouter(prefix="/cron-jobs", tags=["Cron Jobs"])

class CronJobCreate(BaseModel):
    title: str
    schedule: Optional[str] = None
    job_type: Optional[str] = "command"  # "command" or "http"
    command: Optional[str] = None
    # HTTP Fields (Postman-style)
    http_method: Optional[str] = "GET"
    http_url: Optional[str] = None
    http_headers: Optional[Union[Dict[str, str], str]] = None
    http_params: Optional[Union[Dict[str, str], str]] = None
    http_body: Optional[str] = None
    minute: Optional[str] = "*"
    hour: Optional[str] = "*"
    day: Optional[str] = "*"
    month: Optional[str] = "*"
    weekday: Optional[str] = "*"

class CronJobResponse(BaseModel):
    id: int
    user_id: int
    username: str
    title: str
    schedule: str
    job_type: str = "command"
    command: Optional[str] = ""
    http_method: Optional[str] = "GET"
    http_url: Optional[str] = None
    http_headers: Optional[str] = None
    http_params: Optional[str] = None
    http_body: Optional[str] = None
    minute: str
    hour: str
    day: str
    month: str
    weekday: str
    is_active: bool
    last_run: Optional[str] = None
    created_at: str

@router.get("", response_model=List[CronJobResponse])
async def list_cron_jobs(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    if current_user["role"] == "admin":
        query = """
        SELECT c.*, u.username 
        FROM cron_jobs c
        JOIN users u ON c.user_id = u.id
        ORDER BY c.created_at DESC
        """
        cursor = await db.execute(query)
    else:
        query = """
        SELECT c.*, u.username 
        FROM cron_jobs c
        JOIN users u ON c.user_id = u.id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
        """
        cursor = await db.execute(query, (current_user["id"],))

    rows = await cursor.fetchall()
    results = []
    for r in rows:
        keys = r.keys()
        job_type = r["job_type"] if "job_type" in keys and r["job_type"] else "command"
        http_method = r["http_method"] if "http_method" in keys and r["http_method"] else "GET"
        http_url = r["http_url"] if "http_url" in keys else None
        http_headers = r["http_headers"] if "http_headers" in keys else None
        http_params = r["http_params"] if "http_params" in keys else None
        http_body = r["http_body"] if "http_body" in keys else None

        results.append(CronJobResponse(
            id=r["id"],
            user_id=r["user_id"],
            username=r["username"],
            title=r["title"],
            schedule=r["schedule"],
            job_type=job_type,
            command=r["command"],
            http_method=http_method,
            http_url=http_url,
            http_headers=http_headers,
            http_params=http_params,
            http_body=http_body,
            minute=r["minute"] or "*",
            hour=r["hour"] or "*",
            day=r["day"] or "*",
            month=r["month"] or "*",
            weekday=r["weekday"] or "*",
            is_active=bool(r["is_active"]),
            last_run=str(r["last_run"]) if r["last_run"] else None,
            created_at=str(r["created_at"])
        ))
    return results

@router.post("", response_model=CronJobResponse)
async def create_cron_job(
    body: CronJobCreate,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    title = body.title.strip()
    job_type = (body.job_type or "command").lower()
    schedule = (body.schedule or "").strip()

    if not title:
        raise HTTPException(status_code=400, detail="Nama Cron Job wajib diisi.")

    if not schedule:
        schedule = f"{body.minute or '*'} {body.hour or '*'} {body.day or '*'} {body.month or '*'} {body.weekday or '*'}"

    command_to_store = ""
    http_method = (body.http_method or "GET").upper()
    http_url = (body.http_url or "").strip()
    headers_str = None
    params_str = None
    body_str = body.http_body

    if job_type == "http":
        if not http_url:
            raise HTTPException(status_code=400, detail="Target URL HTTP/S wajib diisi.")
        if not (http_url.startswith("http://") or http_url.startswith("https://")):
            http_url = f"https://{http_url}"

        allowed_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"]
        if http_method not in allowed_methods:
            raise HTTPException(status_code=400, detail=f"HTTP Method tidak didukung. Pilihan: {', '.join(allowed_methods)}")

        # Serialize headers
        if body.http_headers:
            if isinstance(body.http_headers, dict):
                headers_str = json.dumps(body.http_headers)
            else:
                headers_str = str(body.http_headers).strip()

        # Serialize params
        if body.http_params:
            if isinstance(body.http_params, dict):
                params_str = json.dumps(body.http_params)
            else:
                params_str = str(body.http_params).strip()

        command_to_store = f"{http_method} {http_url}"
    else:
        job_type = "command"
        command_to_store = (body.command or "").strip()
        if not command_to_store:
            raise HTTPException(status_code=400, detail="Perintah (Command) yang akan dijalankan wajib diisi.")

        # Safety checks on CLI command
        lower_cmd = command_to_store.lower()
        if any(k in lower_cmd for k in ["rm -rf /", "mkfs", "dd if=", "reboot", "shutdown", "poweroff"]):
            raise HTTPException(status_code=400, detail="Perintah mengandung instruksi destruktif terlarang.")

    cursor = await db.execute("""
    INSERT INTO cron_jobs (
        user_id, title, command, schedule, minute, hour, day, month, weekday, is_active,
        job_type, http_method, http_url, http_headers, http_params, http_body
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
    """, (
        current_user["id"],
        title,
        command_to_store,
        schedule,
        body.minute or "*",
        body.hour or "*",
        body.day or "*",
        body.month or "*",
        body.weekday or "*",
        job_type,
        http_method if job_type == "http" else "GET",
        http_url if job_type == "http" else None,
        headers_str if job_type == "http" else None,
        params_str if job_type == "http" else None,
        body_str if job_type == "http" else None
    ))
    await db.commit()
    new_id = cursor.lastrowid

    return CronJobResponse(
        id=new_id,
        user_id=current_user["id"],
        username=current_user["username"],
        title=title,
        schedule=schedule,
        job_type=job_type,
        command=command_to_store,
        http_method=http_method if job_type == "http" else "GET",
        http_url=http_url if job_type == "http" else None,
        http_headers=headers_str if job_type == "http" else None,
        http_params=params_str if job_type == "http" else None,
        http_body=body_str if job_type == "http" else None,
        minute=body.minute or "*",
        hour=body.hour or "*",
        day=body.day or "*",
        month=body.month or "*",
        weekday=body.weekday or "*",
        is_active=True,
        last_run=None,
        created_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    )

@router.post("/{job_id}/toggle")
async def toggle_cron_job(
    job_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    if current_user["role"] == "admin":
        cursor = await db.execute("SELECT id, is_active FROM cron_jobs WHERE id = ?", (job_id,))
    else:
        cursor = await db.execute("SELECT id, is_active FROM cron_jobs WHERE id = ? AND user_id = ?", (job_id, current_user["id"]))
    
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Cron job tidak ditemukan.")

    new_status = 0 if row["is_active"] else 1
    await db.execute("UPDATE cron_jobs SET is_active = ? WHERE id = ?", (new_status, job_id))
    await db.commit()

    return {"success": True, "is_active": bool(new_status)}

@router.delete("/{job_id}")
async def delete_cron_job(
    job_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    if current_user["role"] == "admin":
        cursor = await db.execute("SELECT id FROM cron_jobs WHERE id = ?", (job_id,))
    else:
        cursor = await db.execute("SELECT id FROM cron_jobs WHERE id = ? AND user_id = ?", (job_id, current_user["id"]))
    
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Cron job tidak ditemukan.")

    await db.execute("DELETE FROM cron_jobs WHERE id = ?", (job_id,))
    await db.commit()
    return {"success": True, "message": "Cron job berhasil dihapus."}

@router.post("/{job_id}/run")
async def run_cron_job_now(
    job_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    if current_user["role"] == "admin":
        cursor = await db.execute("SELECT * FROM cron_jobs WHERE id = ?", (job_id,))
    else:
        cursor = await db.execute("SELECT * FROM cron_jobs WHERE id = ? AND user_id = ?", (job_id, current_user["id"]))
    
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Cron job tidak ditemukan.")

    keys = row.keys()
    job_type = row["job_type"] if "job_type" in keys and row["job_type"] else "command"
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    # 1. HTTP/S Webhook Execution (Postman-style)
    if job_type == "http":
        method = (row["http_method"] if "http_method" in keys and row["http_method"] else "GET").upper()
        url = row["http_url"] if "http_url" in keys else None
        if not url:
            # Fallback to parse from command
            parts = row["command"].split(" ", 1)
            method = parts[0] if len(parts) > 1 else "GET"
            url = parts[1] if len(parts) > 1 else parts[0]

        headers = {}
        if "http_headers" in keys and row["http_headers"]:
            try:
                headers = json.loads(row["http_headers"])
            except Exception:
                for line in row["http_headers"].splitlines():
                    if ":" in line:
                        k, v = line.split(":", 1)
                        headers[k.strip()] = v.strip()

        params = {}
        if "http_params" in keys and row["http_params"]:
            try:
                params = json.loads(row["http_params"])
            except Exception:
                for line in row["http_params"].splitlines():
                    if "=" in line:
                        k, v = line.split("=", 1)
                        params[k.strip()] = v.strip()

        body_data = row["http_body"] if "http_body" in keys else None

        if "User-Agent" not in headers:
            headers["User-Agent"] = "MiraiGrid-CronEngine/2.4 (Cloud Lab UMPO)"

        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, verify=False) as client:
                req_kwargs = {"headers": headers, "params": params}
                if body_data and method in ["POST", "PUT", "PATCH"]:
                    try:
                        parsed_json = json.loads(body_data)
                        req_kwargs["json"] = parsed_json
                    except Exception:
                        req_kwargs["content"] = body_data.encode("utf-8")

                resp = await client.request(method, url, **req_kwargs)
                latency_ms = int((time.time() - start_time) * 1000)

                resp_body = resp.text
                if len(resp_body) > 3000:
                    resp_body = resp_body[:3000] + "\n... [Output Truncated by MiraiGrid]"

                output_log = (
                    f"> {method} {resp.url}\n"
                    f"> Request Headers: {json.dumps(headers, indent=2)}\n"
                )
                if body_data:
                    output_log += f"> Request Body:\n{body_data}\n"

                output_log += (
                    f"\n< HTTP Status: {resp.status_code} {resp.reason_phrase}\n"
                    f"< Latency: {latency_ms} ms\n"
                    f"< Response Content-Type: {resp.headers.get('content-type', '-')}\n"
                    f"\n=== RESPONSE BODY ===\n{resp_body}"
                )

                is_ok = 200 <= resp.status_code < 400
                await db.execute("UPDATE cron_jobs SET last_run = ? WHERE id = ?", (now_str, job_id))
                await db.commit()

                return {
                    "success": is_ok,
                    "job_type": "http",
                    "status_code": resp.status_code,
                    "latency_ms": latency_ms,
                    "stdout": output_log,
                    "stderr": "" if is_ok else f"HTTP Status {resp.status_code} {resp.reason_phrase}",
                    "exit_code": 0 if is_ok else 1,
                    "last_run": now_str
                }
        except Exception as e:
            await db.execute("UPDATE cron_jobs SET last_run = ? WHERE id = ?", (now_str, job_id))
            await db.commit()
            return {
                "success": False,
                "job_type": "http",
                "status_code": 0,
                "latency_ms": int((time.time() - start_time) * 1000),
                "stdout": f"> {method} {url}\n> Error: {str(e)}",
                "stderr": f"Connection/Execution Error: {str(e)}",
                "exit_code": 1,
                "last_run": now_str
            }

    # 2. CLI Command Execution (Existing Sandbox)
    command = row["command"]
    username = current_user["username"]
    user_home = os.path.realpath(os.path.join(settings.DATA_DIR, "home", username))
    os.makedirs(user_home, exist_ok=True)

    env = os.environ.copy()
    env["HOME"] = user_home
    env["USER"] = username

    try:
        proc = subprocess.run(
            ["/bin/bash", "-c", command] if os.path.exists("/bin/bash") else ["sh", "-c", command],
            cwd=user_home,
            capture_output=True,
            text=True,
            timeout=30,
            env=env
        )
        await db.execute("UPDATE cron_jobs SET last_run = ? WHERE id = ?", (now_str, job_id))
        await db.commit()
        return {
            "success": proc.returncode == 0,
            "job_type": "command",
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "exit_code": proc.returncode,
            "last_run": now_str
        }
    except Exception as e:
        await db.execute("UPDATE cron_jobs SET last_run = ? WHERE id = ?", (now_str, job_id))
        await db.commit()
        return {
            "success": False,
            "job_type": "command",
            "stdout": "",
            "stderr": str(e),
            "exit_code": 1,
            "last_run": now_str
        }
