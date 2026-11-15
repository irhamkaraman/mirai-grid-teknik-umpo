import re
from typing import Optional, Tuple
import aiosqlite

PUBLIC_BASE_DOMAIN = "miraigrid.web.id"
MAX_ACTIVE_SUBDOMAINS_PER_ACCOUNT = 2

SUBDOMAIN_LABEL_REGEX = re.compile(r"^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$")

RESERVED_SUBDOMAINS = {
    "api",
    "admin",
    "www",
    "mail",
    "db",
    "cloud",
    "miraigrid",
    "thingsboard",
    "n8n",
    "jupyter",
    "jupyterhub",
    "cloudbeaver",
    "dbeaver",
    "code",
    "tb",
    "ssh",
    "terminal",
    "phpmyadmin",
    "phppgadmin",
    "traefik",
    "portainer",
    "grafana",
    "status",
    "auth",
    "sso",
    "login",
    "app",
}

RESERVED_SUBDOMAIN_PREFIXES = ("n8n-", "code-", "tb-")


def normalize_subdomain_label(raw: str) -> str:
    """Normalize user input into a lowercase subdomain label without base domain."""
    val = (raw or "").strip().lower()
    suffix = f".{PUBLIC_BASE_DOMAIN}"
    if val.endswith(suffix):
        val = val[: -len(suffix)]
    return val.strip(".")


def build_fqdn(label: str) -> str:
    return f"{normalize_subdomain_label(label)}.{PUBLIC_BASE_DOMAIN}"


def validate_subdomain_label(raw: str) -> Tuple[bool, Optional[str]]:
    """Validate format and reserved blacklist for a custom subdomain label."""
    label = normalize_subdomain_label(raw)
    if not label:
        return False, "Subdomain tidak boleh kosong."
    if len(label) < 3 or len(label) > 32:
        return False, "Panjang subdomain harus antara 3 hingga 32 karakter."
    if not SUBDOMAIN_LABEL_REGEX.match(label):
        return (
            False,
            "Subdomain hanya boleh berisi huruf kecil (a-z), angka (0-9), dan tanda hubung (-), serta tidak boleh diawali atau diakhiri tanda hubung.",
        )
    if label in RESERVED_SUBDOMAINS or any(
        label.startswith(prefix) for prefix in RESERVED_SUBDOMAIN_PREFIXES
    ):
        return False, f"Subdomain '{label}' merupakan nama sistem yang dicadangkan."
    return True, None


async def get_user_active_subdomains_count(
    db: aiosqlite.Connection,
    user_id: int,
    exclude_project_id: Optional[int] = None,
) -> int:
    """Count distinct active subdomains owned by a user across deployments and projects."""
    cursor = await db.execute(
        """
        SELECT COUNT(DISTINCT LOWER(sub)) AS cnt
        FROM (
            SELECT d.subdomain AS sub
            FROM web_deployments d
            LEFT JOIN projects p ON d.project_id = p.id
            WHERE d.user_id = ?
              AND d.status = 'active'
              AND d.subdomain IS NOT NULL
              AND TRIM(d.subdomain) != ''
              AND (? IS NULL OR d.project_id IS NULL OR d.project_id != ?)
              AND (p.id IS NULL OR COALESCE(p.status, 'running') != 'deleted')
            UNION
            SELECT p.subdomain AS sub
            FROM projects p
            WHERE p.user_id = ?
              AND COALESCE(p.status, 'running') != 'deleted'
              AND p.subdomain IS NOT NULL
              AND TRIM(p.subdomain) != ''
              AND (? IS NULL OR p.id != ?)
        )
        """,
        (
            user_id,
            exclude_project_id,
            exclude_project_id,
            user_id,
            exclude_project_id,
            exclude_project_id,
        ),
    )
    row = await cursor.fetchone()
    return int(row["cnt"] if row else 0)


async def is_subdomain_available(
    db: aiosqlite.Connection,
    raw_label: str,
    exclude_project_id: Optional[int] = None,
) -> Tuple[bool, Optional[str]]:
    """Check format, blacklist, and database uniqueness for a subdomain label."""
    label = normalize_subdomain_label(raw_label)
    valid, err = validate_subdomain_label(label)
    if not valid:
        return False, err

    fqdn = build_fqdn(label)

    cur_dep = await db.execute(
        """
        SELECT id, project_id
        FROM web_deployments
        WHERE LOWER(subdomain) = ?
          AND status = 'active'
          AND (? IS NULL OR project_id IS NULL OR project_id != ?)
        LIMIT 1
        """,
        (fqdn, exclude_project_id, exclude_project_id),
    )
    if await cur_dep.fetchone():
        return False, f"Subdomain '{fqdn}' sudah digunakan oleh project lain."

    cur_proj = await db.execute(
        """
        SELECT id
        FROM projects
        WHERE LOWER(subdomain) = ?
          AND COALESCE(status, 'running') != 'deleted'
          AND (? IS NULL OR id != ?)
        LIMIT 1
        """,
        (fqdn, exclude_project_id, exclude_project_id),
    )
    if await cur_proj.fetchone():
        return False, f"Subdomain '{fqdn}' sudah terdaftar pada project aktif lain."

    return True, None
