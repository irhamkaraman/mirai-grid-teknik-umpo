import os
import sys
import json
import time
import signal
import socket
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
import urllib.parse

PORT_BASE = 14000
DATA_HOME_BASE = "/var/lib/docker/volumes/miraigrid_miraigrid_data/_data/home"
LOG_DIR = "/var/log/miraigrid-ide"
os.makedirs(LOG_DIR, exist_ok=True)

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

def sanitize_username(name: str) -> str:
    import re
    return re.sub(r"[^a-zA-Z0-9_-]", "", name)

def get_user_port(user_id: int) -> int:
    return PORT_BASE + int(user_id)

def ensure_linux_user(username: str, user_id: int) -> int:
    clean_user = sanitize_username(username)
    uid_base = 10000 + int(user_id)

    try:
        subprocess.check_call(f"id {clean_user}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        try:
            subprocess.run(f"groupadd -g {uid_base} --badname {clean_user}", shell=True, check=False)
        except Exception:
            pass
        subprocess.run(f"useradd --badname -M -d /home/{clean_user} -s /bin/bash -u {uid_base} -g {uid_base} {clean_user}", shell=True, check=False)

    vol_path = os.path.join(DATA_HOME_BASE, clean_user)
    os.makedirs(vol_path, exist_ok=True)
    subprocess.run(f"chown -R {uid_base}:{uid_base} {vol_path}", shell=True, check=False)
    subprocess.run(f"chmod 750 {vol_path}", shell=True, check=False)

    symlink_path = f"/home/{clean_user}"
    if not os.path.exists(symlink_path) and not os.path.islink(symlink_path):
        try:
            os.symlink(vol_path, symlink_path)
        except Exception:
            pass

    return uid_base

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0

def get_pid_by_port(port: int):
    try:
        out = subprocess.check_output(f"ss -tulpn | grep ':{port} '", shell=True, text=True)
        for part in out.split():
            if "pid=" in part:
                pid = part.split("pid=")[1].split(",")[0]
                return int(pid)
    except Exception:
        pass
    return None

def kill_port_processes(port: int):
    try:
        subprocess.run(f"fuser -k -9 {port}/tcp", shell=True, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

def setup_vscode_config(username: str, port: int, uid_base: int):
    clean_user = sanitize_username(username)
    vol_path = os.path.join(DATA_HOME_BASE, clean_user)
    cs_dir = os.path.join(vol_path, ".code-server")
    user_dir = os.path.join(cs_dir, "User")
    ext_dir = os.path.join(cs_dir, "extensions")
    os.makedirs(user_dir, exist_ok=True)
    os.makedirs(ext_dir, exist_ok=True)

    conf_path = os.path.join(cs_dir, "config.yaml")
    conf_content = f"bind-addr: 0.0.0.0:{port}\nauth: none\ncert: false\n"
    with open(conf_path, "w") as f:
        f.write(conf_content)

    settings_path = os.path.join(user_dir, "settings.json")
    settings_data = {
        "workbench.colorTheme": "Default Dark Modern",
        "terminal.integrated.defaultProfile.linux": "bash",
        "terminal.integrated.cwd": f"/home/{clean_user}",
        "security.workspace.trust.enabled": False,
        "telemetry.telemetryLevel": "off",
        "update.mode": "none"
    }
    with open(settings_path, "w") as f:
        json.dump(settings_data, f, indent=2)

    subprocess.run(f"chown -R {uid_base}:{uid_base} {vol_path}", shell=True, check=False)

def list_user_folders(username: str):
    clean_user = sanitize_username(username)
    vol_path = os.path.join(DATA_HOME_BASE, clean_user)
    expected_home = f"/home/{clean_user}"
    folders = [
        {"id": "root", "name": f"Home Root ({expected_home})", "path": expected_home}
    ]
    if os.path.isdir(vol_path):
        for item in sorted(os.listdir(vol_path)):
            if item.startswith("."):
                continue
            item_path = os.path.join(vol_path, item)
            if os.path.isdir(item_path):
                folders.append({
                    "id": item,
                    "name": f"{item}/",
                    "path": f"{expected_home}/{item}"
                })
    return folders

class IDEDaemonHandler(BaseHTTPRequestHandler):
    def _send_json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_OPTIONS(self):
        self._send_json({"status": "ok"})

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)

        if parsed.path == "/health":
            return self._send_json({"status": "ok", "service": "miraigrid-ide-daemon", "hardened": True})

        if parsed.path == "/folders":
            username = qs.get("username", ["admin"])[0]
            folders = list_user_folders(username)
            return self._send_json({"folders": folders})

        if parsed.path == "/status":
            user_id = int(qs.get("user_id", ["1"])[0])
            username = qs.get("username", ["admin"])[0]
            port = get_user_port(user_id)
            running = is_port_in_use(port)
            pid = get_pid_by_port(port) if running else None
            return self._send_json({
                "user_id": user_id,
                "username": username,
                "port": port,
                "running": running,
                "pid": pid,
                "subdomain": f"code-{username}.miraigrid.web.id",
                "local_url": f"http://10.10.10.10:{port}"
            })

        self._send_json({"error": "Not Found"}, 404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        body = {}
        if length > 0:
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception:
                pass

        user_id = int(body.get("user_id", 1))
        username = sanitize_username(body.get("username", "admin"))
        port = get_user_port(user_id)
        
        expected_home = f"/home/{username}"
        target_folder = body.get("folder") or expected_home
        if not target_folder.startswith(expected_home):
            target_folder = expected_home

        uid_base = ensure_linux_user(username, user_id)

        if parsed.path in ["/start", "/restart"]:
            if parsed.path == "/restart":
                kill_port_processes(port)
                time.sleep(0.5)

            setup_vscode_config(username, port, uid_base)

            if is_port_in_use(port):
                return self._send_json({
                    "success": True,
                    "message": "VS Code instance is already running in isolated unprivileged sandbox",
                    "port": port,
                    "subdomain": f"code-{username}.miraigrid.web.id",
                    "folder": target_folder,
                    "uid": uid_base
                })

            log_file = os.path.join(LOG_DIR, f"vscode_{username}.log")
            log_fd = open(log_file, "a")

            cmd = [
                "/usr/local/bin/miraigrid-code-jail",
                username,
                str(port),
                target_folder,
                str(uid_base)
            ]

            proc = subprocess.Popen(cmd, stdout=log_fd, stderr=log_fd, close_fds=True)

            started = False
            for _ in range(40):
                if is_port_in_use(port):
                    started = True
                    break
                time.sleep(0.3)

            return self._send_json({
                "success": started,
                "port": port,
                "pid": proc.pid,
                "subdomain": f"code-{username}.miraigrid.web.id",
                "folder": target_folder,
                "isolated": True,
                "unprivileged": True,
                "uid": uid_base
            })

        if parsed.path == "/stop":
            kill_port_processes(port)
            pid = get_pid_by_port(port)
            if pid:
                try:
                    os.kill(pid, signal.SIGKILL)
                except Exception:
                    pass
            return self._send_json({"success": True, "port": port})

        self._send_json({"error": "Not Found"}, 404)

if __name__ == "__main__":
    server = ThreadedHTTPServer(("0.0.0.0", 13999), IDEDaemonHandler)
    print("MiraiGrid Hardened IDE Daemon listening on 0.0.0.0:13999")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
