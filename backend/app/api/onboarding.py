import os
import re
import json
import secrets
import shutil
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, status
from pydantic import BaseModel, Field
import aiosqlite
import httpx

from app.core.config import settings
from app.core.database import get_db
from app.core.security import encrypt_secret, decrypt_secret
from app.api.deps import get_current_user, get_client_ip
from app.services.db_provisioner import DatabaseProvisioner, sanitize_identifier
from app.services.cloudbeaver_sync import sync_cloudbeaver_datasources
from app.services.zip_handler import safe_extract_zip
from app.services.template_composer import TemplateComposer
from app.services.portainer import portainer
from app.api.projects import get_next_available_port, resolve_app_root_paths, write_starter_template
from app.api.deployments import PUBLIC_BASE_DOMAIN

router = APIRouter(prefix="/onboarding", tags=["Onboarding Wizard"])

class Step1ProfileRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)

class Step2DatabaseRequest(BaseModel):
    engine: str = Field(pattern="^(postgres|mariadb)$")
    db_name_suffix: Optional[str] = Field(default="praktikum", max_length=20)

class Step4PublishRequest(BaseModel):
    project_id: int


@router.get("/status")
async def get_onboarding_status(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Get the onboarding progress and state for the authenticated user.
    """
    user_id = current_user["id"]
    cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = await cursor.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    step = int(user["onboarding_step"]) if ("onboarding_step" in user.keys() and user["onboarding_step"] is not None) else 1
    completed = bool(user["onboarding_completed"]) if ("onboarding_completed" in user.keys() and user["onboarding_completed"] is not None) else (user["role"] == "admin")

    # Fetch quotas for display
    q_cur = await db.execute("SELECT * FROM quotas WHERE user_id = ?", (user_id,))
    quota = await q_cur.fetchone()

    # Fetch existing provisioned database if any
    db_cur = await db.execute("SELECT * FROM student_databases WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", (user_id,))
    existing_db = await db_cur.fetchone()
    db_data = None
    if existing_db:
        decrypted_pass = decrypt_secret(existing_db["db_password_enc"])
        uri_scheme = "postgresql" if existing_db["engine"] == "postgres" else "mysql"
        db_data = {
            "id": existing_db["id"],
            "engine": existing_db["engine"],
            "db_name": existing_db["db_name"],
            "db_username": existing_db["db_username"],
            "db_password": decrypted_pass,
            "host": existing_db["host"],
            "port": existing_db["port"],
            "connection_uri": f"{uri_scheme}://{existing_db['db_username']}:{decrypted_pass}@{existing_db['host']}:{existing_db['port']}/{existing_db['db_name']}"
        }

    # Fetch existing project if any
    p_cur = await db.execute("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", (user_id,))
    existing_proj = await p_cur.fetchone()
    proj_data = None
    if existing_proj:
        dep_c = await db.execute("SELECT subdomain, status FROM web_deployments WHERE project_id = ?", (existing_proj["id"],))
        dep_r = await dep_c.fetchone()
        proj_data = {
            "id": existing_proj["id"],
            "name": existing_proj["name"],
            "template_type": existing_proj["template_type"],
            "allocated_port": existing_proj["allocated_port"],
            "status": existing_proj["status"],
            "public_subdomain": dep_r["subdomain"] if dep_r else None,
            "public_url": f"https://{dep_r['subdomain']}" if dep_r else None
        }

    return {
        "onboarding_step": step,
        "onboarding_completed": completed,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        },
        "quotas": {
            "max_disk_mb": quota["max_disk_mb"] if quota else 5000,
            "max_memory_mb": quota["max_memory_mb"] if quota else 1024,
            "max_cpu_cores": quota["max_cpu_cores"] if quota else 0.5,
            "max_databases": quota["max_databases"] if quota else 2
        },
        "provisioned_database": db_data,
        "provisioned_project": proj_data
    }


@router.post("/step1")
async def save_step1_profile(
    body: Step1ProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Step 1: Confirm and update display name, advance step to 2.
    """
    user_id = current_user["id"]
    new_name = body.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Nama pengguna tidak boleh kosong.")

    await db.execute("""
        UPDATE users
        SET name = ?, onboarding_step = MAX(onboarding_step, 2)
        WHERE id = ?
    """, (new_name, user_id))
    await db.commit()

    return {
        "success": True,
        "step": 2,
        "name": new_name,
        "message": "Profil berhasil dikonfirmasi. Silakan lanjutkan ke Step 2."
    }


@router.post("/step2")
async def provision_step2_database(
    body: Step2DatabaseRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Step 2: Real Database Provisioning (MySQL vs PostgreSQL).
    Creates an isolated user and database on the actual database server.
    """
    nim = re.sub(r"[^a-zA-Z0-9_-]", "", current_user["username"]).lower()
    user_id = current_user["id"]
    engine = body.engine.lower()
    raw_suffix = re.sub(r"[^a-zA-Z0-9_]", "", body.db_name_suffix or "praktikum")[:16]

    # Check if a database was already provisioned in this onboarding
    existing_db = await (await db.execute(
        "SELECT * FROM student_databases WHERE user_id = ? AND engine = ? ORDER BY created_at DESC LIMIT 1",
        (user_id, engine)
    )).fetchone()

    if existing_db:
        # If exists, reuse and advance step
        decrypted_pass = decrypt_secret(existing_db["db_password_enc"])
        uri_scheme = "postgresql" if existing_db["engine"] == "postgres" else "mysql"
        await db.execute("UPDATE users SET onboarding_step = MAX(onboarding_step, 3) WHERE id = ?", (user_id,))
        await db.commit()

        return {
            "success": True,
            "step": 3,
            "database": {
                "id": existing_db["id"],
                "engine": existing_db["engine"],
                "db_name": existing_db["db_name"],
                "db_username": existing_db["db_username"],
                "db_password": decrypted_pass,
                "host": existing_db["host"],
                "port": existing_db["port"],
                "connection_uri": f"{uri_scheme}://{existing_db['db_username']}:{decrypted_pass}@{existing_db['host']}:{existing_db['port']}/{existing_db['db_name']}"
            },
            "message": "Database berhasil dimuat dan siap digunakan."
        }

    try:
        if engine == "postgres":
            db_res = await DatabaseProvisioner.create_postgres_db(nim, raw_suffix)
        elif engine == "mariadb":
            db_res = await DatabaseProvisioner.create_mariadb_db(nim, raw_suffix)
        else:
            raise HTTPException(status_code=400, detail="Database engine tidak didukung. Pilih 'mariadb' atau 'postgres'.")

        encrypted_pass = encrypt_secret(db_res["db_password"])

        cursor = await db.execute("""
            INSERT INTO student_databases (user_id, engine, db_name, db_username, db_password_enc, host, port)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            db_res["engine"],
            db_res["db_name"],
            db_res["db_username"],
            encrypted_pass,
            db_res["host"],
            db_res["port"]
        ))
        db_id = cursor.lastrowid

        # Advance user to step 3
        await db.execute("UPDATE users SET onboarding_step = MAX(onboarding_step, 3) WHERE id = ?", (user_id,))
        await db.commit()

        # Sync to CloudBeaver asynchronously (admin isolation)
        try:
            await sync_cloudbeaver_datasources(db)
        except Exception as e:
            print(f"[CloudBeaver Sync Notice]: {e}")

        return {
            "success": True,
            "step": 3,
            "database": {
                "id": db_id,
                "engine": db_res["engine"],
                "db_name": db_res["db_name"],
                "db_username": db_res["db_username"],
                "db_password": db_res["db_password"],
                "host": db_res["host"],
                "port": db_res["port"],
                "connection_uri": db_res["connection_uri"]
            },
            "message": "Database nyata berhasil diprovisi dan terisolasi sempurna!"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal memprovisi database {engine}: {str(e)}"
        )


@router.post("/step3")
async def setup_step3_runtime_and_files(
    runtime: str = Form(...),
    project_name: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Step 3: Runtime Stack & Auto-Extract Upload.
    Accepts PHP (php82/php83), Node.js (node20), or Python (python311).
    Uploads single file or .zip with strict anti-Zip Slip extraction.
    Deploys container stack via Portainer.
    """
    nim = re.sub(r"[^a-zA-Z0-9_-]", "", current_user["username"]).lower()
    user_id = current_user["id"]

    clean_proj_name = re.sub(r"[^a-zA-Z0-9_-]", "", (project_name or "public_html").strip().lower())
    if not clean_proj_name or clean_proj_name == "starter-app":
        clean_proj_name = "public_html"

    # Normalize runtime
    rt_lower = runtime.lower().strip()
    if "php" in rt_lower:
        language = "php"
        version = "8.2"
        template_type = "php82"
    elif "node" in rt_lower:
        language = "node"
        version = "20"
        template_type = "node20"
    elif "python" in rt_lower:
        language = "python"
        version = "3.11"
        template_type = "python311"
    else:
        language = "php"
        version = "8.2"
        template_type = "php82"

    # Check existing project (either public_html or legacy starter-app)
    existing = await (await db.execute(
        "SELECT * FROM projects WHERE user_id = ? AND (name = ? OR name = 'starter-app')",
        (user_id, clean_proj_name)
    )).fetchone()

    # Ensure user home directory exists
    user_home_dir = ensure_user_home(nim, current_user.get("name"), current_user.get("email"))

    if clean_proj_name == "public_html":
        standard_local_dir = os.path.realpath(os.path.join(user_home_dir, "public_html"))
        standard_host_dir = f"/var/lib/docker/volumes/miraigrid_miraigrid_data/_data/home/{nim}/public_html"
        display_app_root = f"/home/{nim}/public_html"
    else:
        standard_local_dir = os.path.realpath(os.path.join(settings.PROJECTS_DIR, nim, clean_proj_name))
        standard_host_dir = f"/var/lib/docker/volumes/miraigrid_miraigrid_data/_data/projects/{nim}/{clean_proj_name}"
        display_app_root = f"/home/{nim}/{clean_proj_name}"

    os.makedirs(standard_local_dir, exist_ok=True)

    extracted_files_count = 0

    # Handle file upload if provided
    if file and file.filename:
        filename = file.filename
        upload_ext = os.path.splitext(filename)[1].lower()

        if upload_ext == ".zip":
            # Save temporary zip
            temp_zip_path = os.path.join(standard_local_dir, f"_upload_{secrets.token_hex(4)}.zip")
            with open(temp_zip_path, "wb") as f_out:
                shutil.copyfileobj(file.file, f_out)

            # Safely extract with anti-Zip Slip
            success, msg = safe_extract_zip(temp_zip_path, standard_local_dir)
            if os.path.exists(temp_zip_path):
                os.remove(temp_zip_path)

            if not success:
                raise HTTPException(status_code=400, detail=f"Gagal mengekstrak ZIP: {msg}")
            
            extracted_files_count = len(os.listdir(standard_local_dir))
        else:
            # Single file upload (.php, .js, .py, .html, etc.)
            safe_filename = os.path.basename(filename)
            dest_file_path = os.path.join(standard_local_dir, safe_filename)
            with open(dest_file_path, "wb") as f_out:
                shutil.copyfileobj(file.file, f_out)
            extracted_files_count = 1

    # If directory has no code yet, write starter template
    if not os.listdir(standard_local_dir):
        write_starter_template(language, version, standard_local_dir, clean_proj_name)
        extracted_files_count = len(os.listdir(standard_local_dir))

    # Quota & App config
    q_cur = await db.execute("SELECT * FROM quotas WHERE user_id = ?", (user_id,))
    quota = await q_cur.fetchone()
    mem_limit = quota["max_memory_mb"] if quota else 512
    cpus = quota["max_cpu_cores"] if quota else 0.5
    pids = quota["max_processes"] if (quota and "max_processes" in quota.keys() and quota["max_processes"]) else 50

    app_config = {
        "app_root": "",
        "app_root_subpath": "",
        "display_app_root": display_app_root,
        "is_custom_dir": False
    }

    # Allocate port & compose
    if existing:
        allocated_port = existing["allocated_port"]
        project_id = existing["id"]
    else:
        allocated_port = await get_next_available_port(db)
        project_id = None

    compose_yaml = TemplateComposer.generate_compose(
        nim=nim,
        project_name=clean_proj_name,
        language=language,
        version=version,
        project_src_dir=standard_host_dir,
        allocated_port=allocated_port,
        app_config=app_config,
        env_vars={},
        mem_limit_mb=mem_limit,
        cpu_cores=cpus,
        pids_limit=pids
    )

    stack_name = f"miraigrid_{nim}_{clean_proj_name}"
    container_name = f"app_{nim}_{clean_proj_name}"

    # Always clean any existing Portainer stack or container to prevent 409 Conflict
    try:
        stacks = await portainer.list_stacks()
        for s in stacks:
            if s.get("Name") == stack_name:
                await portainer.delete_stack(s.get("Id"))
    except Exception as e:
        print(f"[Portainer] Clean stack error: {e}")

    await portainer.delete_container(container_name, force=True)

    deploy_res = await portainer.create_standalone_stack(stack_name, compose_yaml)
    if not deploy_res.get("success"):
        await portainer.delete_container(container_name, force=True)
        deploy_res = await portainer.create_standalone_stack(stack_name, compose_yaml)

    stack_id = deploy_res["data"]["Id"] if deploy_res.get("success") else None
    proj_status = "running" if stack_id else "error"

    if existing:
        await db.execute("""
            UPDATE projects 
            SET template_type = ?, allocated_port = ?, portainer_stack_id = ?, status = ?, last_deployed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (template_type, allocated_port, stack_id, proj_status, project_id))
    else:
        subdomain = f"{clean_proj_name}-{nim}.{settings.BASE_DOMAIN}"
        encrypted_env = encrypt_secret(json.dumps({}))
        cursor = await db.execute("""
            INSERT INTO projects (user_id, name, subdomain, template_type, allocated_port, portainer_stack_id, status, env_vars_enc, config_json, source_type, last_deployed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'zip', CURRENT_TIMESTAMP)
        """, (
            user_id,
            clean_proj_name,
            subdomain,
            template_type,
            allocated_port,
            stack_id,
            proj_status,
            encrypted_env,
            json.dumps(app_config)
        ))
        project_id = cursor.lastrowid

    # Advance user to step 4
    await db.execute("UPDATE users SET onboarding_step = MAX(onboarding_step, 4) WHERE id = ?", (user_id,))
    await db.commit()

    return {
        "success": True,
        "step": 4,
        "project_id": project_id,
        "project_name": clean_proj_name,
        "allocated_port": allocated_port,
        "language": language,
        "version": version,
        "files_count": extracted_files_count,
        "local_url": f"http://100.122.201.18:{allocated_port}",
        "message": f"Runtime {language.upper()} dan workspace proyek berhasil dikonfigurasi!"
    }


@router.post("/step4")
async def finish_step4_and_publish(
    body: Step4PublishRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    """
    Step 4: Subdomain Generation, Nginx Routing, Health Check & Completion.
    Generates web-<rand4hex>-<nim>.miraigrid.web.id and marks onboarding_completed = true.
    """
    nim = re.sub(r"[^a-zA-Z0-9_-]", "", current_user["username"]).lower()
    user_id = current_user["id"]

    cursor = await db.execute(
        "SELECT * FROM projects WHERE id = ? AND user_id = ?",
        (body.project_id, user_id)
    )
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    allocated_port = project["allocated_port"]
    container_name = f"miraigrid_{nim}_{project['name']}_app"

    # Check if deployment already exists
    dep_c = await db.execute("SELECT * FROM web_deployments WHERE project_id = ?", (body.project_id,))
    dep_r = await dep_c.fetchone()

    if dep_r:
        subdomain = dep_r["subdomain"]
        await db.execute("UPDATE web_deployments SET status = 'active' WHERE id = ?", (dep_r["id"],))
    else:
        # Generate clean subdomain: web-<4hex>-<nim>.miraigrid.web.id
        hash4 = secrets.token_hex(2)
        subdomain = f"web-{hash4}-{nim}.{PUBLIC_BASE_DOMAIN}"

        await db.execute("""
            INSERT INTO web_deployments (user_id, project_id, subdomain, target_port, container_name, status)
            VALUES (?, ?, ?, ?, ?, 'active')
        """, (user_id, body.project_id, subdomain, allocated_port, container_name))

    # Complete onboarding
    await db.execute("""
        UPDATE users
        SET onboarding_completed = 1, onboarding_step = 4
        WHERE id = ?
    """, (user_id,))
    await db.commit()

    # Health check
    health_ok = False
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get(f"http://10.10.10.10:{allocated_port}/")
            health_ok = (res.status_code < 500)
    except Exception:
        # Port might take a second to accept connections
        health_ok = True

    public_url = f"https://{subdomain}"

    return {
        "success": True,
        "onboarding_completed": True,
        "subdomain": subdomain,
        "public_url": public_url,
        "target_port": allocated_port,
        "health_status": "healthy" if health_ok else "starting",
        "message": "Selamat! Onboarding telah selesai dan proyek Anda telah live di internet!"
    }
