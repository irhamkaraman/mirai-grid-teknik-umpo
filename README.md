# 🌐 MiraiGrid — Platform Hosting Lab Teknik Informatika UMPO

> **Platform Hosting Mandiri Praktikum Berbasis Thin Wrapper Portainer REST API**  
> Didesain khusus untuk kebutuhan praktikum pemrograman web, basis data, dan rekayasa perangkat lunak di Laboratorium Teknik Informatika Universitas Muhammadiyah Ponorogo.

---

## 🚀 Fitur Utama

- **🛡️ Thin Wrapper Portainer REST API**: Mahasiswa tidak pernah menyentuh atau login ke Portainer secara langsung. Backend MiraiGrid menangani seluruh deployment via token resmi dengan isolasi ketat.
- **👥 Manajemen Akun Massal**: Administrator lab dapat membuat angkatan, kelas, serta meng-generate puluhan akun mahasiswa (atau impor CSV NIM/Nama) secara instan dengan *random initial password* dan kewajiban ganti password saat login perdana.
- **🗄️ Database Mandiri Multi-Tenant**: 
  - Mahasiswa dapat membuat database PostgreSQL 16 atau MariaDB 11 sendiri.
  - Setiap mahasiswa dibuatkan **user DB terisolasi** (`s{nim}`) dengan hak akses strictly hanya ke database miliknya (`s{nim}_{dbname}`).
  - Dilengkapi proteksi *Connection Limit* untuk mencegah DoS / connection exhaustion.
  - Kredensial database eksternal disimpan menggunakan enkripsi **AES-256-GCM**.
- **📦 Deployment Aplikasi Web Aman**:
  - Template siap pakai: **PHP 8.2 (Apache)**, **Python 3.11 (Flask/FastAPI/Gunicorn)**, **Node.js 20 (Express)**, dan **Static HTML/CSS/JS (Nginx)**.
  - Validasi file ZIP anti-eksploitasi (**Anti Zip-Slip Protection**).
  - Isolasi kernel container: `security_opt: [no-new-privileges:true]`, `cap_drop: [ALL]`, `pids_limit: 100`, alokasi RAM & CPU dibatasi per mahasiswa.
  - Alokasi port internal dinamis & live log viewer container.
- **📊 Kuota & Audit Log Terperinci**:
  - Batasan kuota project, database, memori (RAM), dan vCPU yang terpantau real-time.
  - Audit logging seluruh aktivitas penting (login, deploy, buat DB, reset password) lengkap dengan IP address.

---

## 🏗️ Arsitektur Sistem

```
[ Mahasiswa / Dosen / Admin ]
              │
              ▼
    [ MiraiGrid Frontend (Port 3000) ]
              │
              ▼ (REST API)
    [ MiraiGrid Backend (FastAPI - Port 8000) ]
       │                                │
       ▼ (Portainer API Port 9443)      ▼ (Admin SQL Driver)
┌──────────────┐               ┌─────────────────────────────────────┐
│ Portainer CE │               │ Shared DB Engine (database-center)  │
│ REST API     │               │ ├─ PostgreSQL 16 (Port 5432)        │
└──────┬───────┘               │ └─ MariaDB 11 (Port 3306)           │
       ▼                       └─────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────┐
│ Docker Daemon Engine (unix:///var/run/docker.sock)                 │
│ ├─ net_{nim}_{project} (Isolated Bridge Network)                   │
│ ├─ app_{nim}_{project} (Hardened Student Container)                │
│ └─ Volume Sandbox (/data/projects/{nim}_{project})                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Panduan Menjalankan (Development & Server)

### 1. Prasyarat
- Docker Engine & Docker Compose
- Portainer CE (dengan endpoint ID dan API Key/Token)
- Stack `database-center` (PostgreSQL 16 & MariaDB 11)

### 2. Konfigurasi Lingkungan (`.env`)
Salin template konfigurasi dan sesuaikan kredensial Anda:
```bash
cp .env.example .env
```

Pastikan mengisi parameter penting berikut:
```env
APP_SECRET_KEY=kunci-rahasia-jwt-minimal-32-karakter
DATA_ENCRYPTION_KEY=kunci-aes-256-base64-32-bytes
PORTAINER_URL=https://portainer:9443
PORTAINER_API_KEY=token-portainer-anda
POSTGRES_ADMIN_HOST=db_postgres
MARIADB_ADMIN_HOST=db_mariadb
```

### 3. Menjalankan via Docker Compose
```bash
docker compose up -d --build
```

- **Frontend Web UI**: `http://<IP_SERVER>:3000`
- **Backend API**: `http://<IP_SERVER>:8000`
- **API Swagger Docs**: `http://<IP_SERVER>:8000/docs`

---

## 🧪 Pengujian Otomatis

Backend dilengkapi dengan unit test dan *negative security tests* (Zip-Slip exploit attempt, Compose privilege injection rejection):

```bash
cd backend
pip install -r requirements.txt
pytest -v
```

---

## 📜 Lisensi
Dikembangkan untuk Laboratorium Teknik Informatika, Fakultas Teknik, Universitas Muhammadiyah Ponorogo.
