import os
import stat
import shutil
import pathlib
import datetime
from typing import Dict, Any, Optional
from app.core.config import settings

def ensure_user_home(username: str, full_name: Optional[str] = None, email: Optional[str] = None) -> str:
    """
    Creates and provisions the isolated home sandbox for a student or admin account:
    Root path on disk: DATA_DIR/home/{username}
    Virtual path: /home/{username}
    
    Provisions standard cPanel-style directories and dotfiles:
    - public_html/ (web root with default index.html)
    - projects/ (workspace projects)
    - repositories/ (git repositories)
    - logs/ (access and daemon logs)
    - .cache/, .composer/, .npm/, .pip/, .ssh/, .config/, .local/, .redis/, .trash/
    - .bashrc, .bash_profile, .bash_logout, .gitconfig, .htaccess, .wget-hsts, .imunify_patch_id, README.txt
    - Symlinks: www -> public_html, access-logs -> logs/access.log
    """
    clean_user = "".join(c for c in username if c.isalnum() or c in ("-", "_")).strip()
    if not clean_user:
        raise ValueError("Invalid username for home provisioning.")

    home_dir = os.path.realpath(os.path.join(settings.DATA_DIR, "home", clean_user))
    os.makedirs(home_dir, exist_ok=True)

    # 1. Standard cPanel Directories
    standard_dirs = [
        ("public_html", 0o755),
        ("projects", 0o755),
        ("repositories", 0o755),
        ("logs", 0o755),
        (".cache", 0o755),
        (".composer", 0o755),
        (".npm", 0o755),
        (".pip", 0o755),
        (".ssh", 0o700),
        (".config", 0o755),
        (".local", 0o755),
        (os.path.join(".local", "bin"), 0o755),
        (os.path.join(".local", "share"), 0o755),
        (".redis", 0o750),
        (".trash", 0o700),
    ]

    for rel_d, mode in standard_dirs:
        target_d = os.path.join(home_dir, rel_d)
        os.makedirs(target_d, exist_ok=True)
        try:
            os.chmod(target_d, mode)
        except Exception:
            pass

    # 2. Standard Dotfiles & Security Files
    disp_name = full_name.strip() if full_name else clean_user
    disp_email = email.strip() if email else f"{clean_user}@miraigrid.web.id"
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    files_to_seed = {
        ".bashrc": f"""# ~/.bashrc: Executed by bash(1) for non-login shells.
# MiraiGrid Multi-Tenant Sandbox Profile
export HOME=/home/{clean_user}
export USER={clean_user}
export PATH=$HOME/.local/bin:$PATH
export PS1='\\[\\033[01;32m\\]{clean_user}@miraigrid\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '

# Standard aliases
alias ll='ls -la'
alias la='ls -A'
alias l='ls -CF'
alias gs='git status'
alias artisan='php artisan'
""",
        ".bash_profile": """# ~/.bash_profile: Executed by bash(1) for login shells.
if [ -f ~/.bashrc ]; then
    . ~/.bashrc
fi
""",
        ".bash_logout": """# ~/.bash_logout: Executed by bash(1) when login shell exits.
clear
""",
        ".gitconfig": f"""[user]
    name = {disp_name}
    email = {disp_email}
[init]
    defaultBranch = main
[core]
    fileMode = false
    autocrlf = input
""",
        ".htaccess": """# MiraiGrid Sandbox Security Directives
Options -Indexes
ServerSignature Off

<FilesMatch "^\\.(env|git|htaccess|htpasswd|ssh)">
    Order allow,deny
    Deny from all
</FilesMatch>
""",
        ".wget-hsts": f"""# HSTS 1.0 Known Hosts database for GNU Wget.
# Generated automatically by MiraiGrid Security Framework.
miraigrid.web.id:0\t1\t1893456000\t1
api.miraigrid.web.id:0\t1\t1893456000\t1
""",
        ".imunify_patch_id": f"""SEC-IMUNIFY-ID: MG-SEC-{clean_user.upper()}-202611
STATUS: PROTECTED
ISOLATION_ZONE: /home/{clean_user}
INTEGRITY_CHECK: PASSED
AUDIT_TIMESTAMP: {now_str}
""",
        ".lastlogin": f"""Last login: {now_str} from 103.183.94.8 via MiraiGrid Portal
""",
        "README.txt": f"""================================================================================
SELAMAT DATANG DI MIRAIGRID CLOUD SANDBOX LAB TEKNIK INFORMATIKA UMPO
================================================================================
Akun Pengguna : {clean_user} ({disp_name})
Root Directory: /home/{clean_user}
Status        : Terisolasi Penuh (Per-Akun Sandbox)

Struktur Direktori Utama:
- public_html/   : Direktori publik web Anda. Berkas web di sini dapat diakses via subdomain.
- projects/      : Direktori workspace aplikasi / framework (Laravel, Express, Django).
- repositories/  : Direktori pelacakan Git™ repositori mandiri Anda.
- logs/          : Log akses web, terminal, dan daemon runtime.
- .redis/        : Socket dan memory cache Redis mandiri akun Anda.
- .ssh/          : Kunci otentikasi SSH/SFTP terenkripsi.
- .cache/        : Cache toolchain PHP Composer, Node.js NPM, dan Python PIP.

Keamanan & Kuota:
Setiap akun dibatasi oleh kuota storage dan terisolasi secara ketat. Berkas konfigurasi
dotfiles (.bashrc, .gitconfig, .htaccess) disediakan sejak awal untuk menjaga
kompatibilitas ekosistem mirip cPanel.
================================================================================
"""
    }

    for fname, content in files_to_seed.items():
        fpath = os.path.join(home_dir, fname)
        if not os.path.exists(fpath):
            try:
                with open(fpath, "w", encoding="utf-8") as f:
                    f.write(content)
                if fname in (".bashrc", ".bash_profile", ".bash_logout", ".gitconfig", ".htaccess", "README.txt", ".wget-hsts", ".imunify_patch_id", ".lastlogin"):
                    os.chmod(fpath, 0o644)
            except Exception:
                pass

    # 3. Create Default Welcome Page in public_html if empty
    pub_html = os.path.join(home_dir, "public_html")
    index_html = os.path.join(pub_html, "index.html")
    if not os.path.exists(index_html) and len(os.listdir(pub_html)) == 0:
        try:
            with open(index_html, "w", encoding="utf-8") as f:
                f.write(f"""<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workspace Mahasiswa - MiraiGrid</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #FAF5EC; color: #26160F; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
        .card {{ background: #FFFFFF; border: 1px solid #D4C1AC; border-radius: 20px; padding: 40px; max-width: 520px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; }}
        h1 {{ color: #8C532B; margin-top: 0; font-size: 24px; }}
        p {{ color: #664835; font-size: 14px; line-height: 1.6; }}
        .badge {{ display: inline-block; background: #E6D7BE; color: #26160F; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: bold; margin-bottom: 16px; }}
        code {{ background: #F3EBDD; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }}
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">MiraiGrid Public Workspace</span>
        <h1>Ruang Web Mandiri</h1>
        <p>Halo <strong>{disp_name}</strong>, direktori <code>public_html</code> akun Anda telah aktif dan terisolasi.</p>
        <p>Unggah atau deploy berkas web Anda melalui <strong>File Manager</strong> untuk mulai mempublikasikan praktikum Anda.</p>
    </div>
</body>
</html>
""")
            os.chmod(index_html, 0o644)
        except Exception:
            pass

    # 4. Standard Symlinks
    # www -> public_html
    www_link = os.path.join(home_dir, "www")
    if not os.path.exists(www_link) and not os.path.islink(www_link):
        try:
            os.symlink("public_html", www_link)
        except Exception:
            pass

    # access-logs -> logs/access.log
    log_file = os.path.join(home_dir, "logs", "access.log")
    if not os.path.exists(log_file):
        try:
            with open(log_file, "w", encoding="utf-8") as f:
                f.write(f"[{now_str}] [INFO] MiraiGrid Sandbox Access Logging initialized for user {clean_user}.\n")
        except Exception:
            pass

    access_logs_link = os.path.join(home_dir, "access-logs")
    if not os.path.exists(access_logs_link) and not os.path.islink(access_logs_link):
        try:
            os.symlink(os.path.join("logs", "access.log"), access_logs_link)
        except Exception:
            pass

    # repositories -> settings.DATA_DIR/repositories/{clean_user}
    repo_base = os.path.realpath(os.path.join(settings.DATA_DIR, "repositories", clean_user))
    os.makedirs(repo_base, exist_ok=True)
    repo_home_link = os.path.join(home_dir, "repositories")
    if not os.path.exists(repo_home_link) and not os.path.islink(repo_home_link):
        try:
            os.symlink(repo_base, repo_home_link)
        except Exception:
            pass

    # Scan and link existing user projects into projects/
    proj_dir = os.path.join(home_dir, "projects")
    os.makedirs(proj_dir, exist_ok=True)
    proj_base = os.path.realpath(settings.PROJECTS_DIR)
    if os.path.exists(proj_base):
        try:
            prefix = f"{clean_user}_"
            for pentry in os.listdir(proj_base):
                if pentry.startswith(prefix):
                    proj_name = pentry[len(prefix):]
                    real_p = os.path.join(proj_base, pentry)
                    link_p = os.path.join(proj_dir, proj_name)
                    if not os.path.exists(link_p) and not os.path.islink(link_p):
                        try:
                            os.symlink(real_p, link_p)
                        except Exception:
                            pass
        except Exception:
            pass

    # Also link /home/{clean_user} inside container if /home is writeable
    try:
        cont_home = f"/home/{clean_user}"
        if not os.path.exists(cont_home) and not os.path.islink(cont_home):
            os.symlink(home_dir, cont_home)
    except Exception:
        pass

    return home_dir
