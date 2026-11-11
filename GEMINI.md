# 🛡️ SYSTEM ARCHITECTURE & IMMUTABLE GUARDRAILS (GEMINI.md)
# Project: Miraigrid PaaS Cloud Lab (Universitas Muhammadiyah Ponorogo)
# Author: Bos Irham Karaman & Aila Engineering Core

---

## ⛔ CRITICAL DIRECTIVES: STRICT FORBIDDEN ACTIONS (ANTI-REGRESSION RULES)
Setiap AI Assistant / Agent (Gemini Antigravity) yang bekerja pada repositori ini WAJIB mematuhi instruksi ini tanpa pengecualian:

1. **DILARANG KERAS RESET / FALLBACK KE KODE AWAL (NO REWRITING / NO BLANK SLATE REBUILDS)**:
   - Jangan pernah menimpa file komponen yang sudah bekerja dengan template dasar atau boilerplates lama.
   - Jangan pernah menghapus fitur yang sudah dibangun (Onboarding Wizard, CPanel File Manager, VS Code standalone jail, Database Web SSO, Wildcard subdomains, Tech Stack grid).
   - Selalu lakukan **surgical / incremental patch** (hanya edit baris atau fungsi yang ditargetkan).

2. **DILARANG MENGHAPUS ELEMEN DESAIN UI / BRANDING CREAM-DARK VINTAGE**:
   - Skema warna: Warm Cream background (`#f5efe6` / `#eaddcf` / `#2b1d14` palette), dark brown/bronze cards, clean rounded borders (`rounded-2xl` / `rounded-3xl`), font inter/sans-serif berkelas.
   - Jangan pernah fallback ke template Tailwind generic putih-biru polos.

3. **VERIFIKASI FILE BACKUP SEBELUM DAN SESUDAH EDIT**:
   - Selalu buat snapshot/backup sebelum modifikasi (`.bak` atau commit git lokal).
   - Pastikan build frontend (`npm run build` / `vite build`) dan backend FastAPI syntax check berhasil tanpa error sebelum menyatakan selesai.

---

## 🏛️ ARSITEKTUR SISTEM MIRAIGRID YANG SUDAH JALAN (EXISTING WORKING STATE)

### 1. Frontend (`MiraiGrid/frontend/`)
- **Framework**: React / Vite / Next.js architecture dengan Tailwind CSS.
- **Komponen Utama**:
  - `About`: Menampilkan 12-16 kartu Arsitektur & Tech Stack Modern (Docker, LXC, MinIO, Redis, Portainer, Nginx/Cloudflare, PostgreSQL/MariaDB, MikroTik, Git, Ubuntu, Security Stack).
  - `Onboarding Wizard` (Gated 4-Step Flow):
    * Step 1: Profiling & Alokasi Kuota (Storage 500MB, RAM 256MB, CPU 0.5 Cores).
    * Step 2: Database Provisioning (Pilihan MySQL/MariaDB atau PostgreSQL).
    * Step 3: Runtime Deployment & File Upload (PHP, Node.js, Python, OpenLiteSpeed - Drag & Drop ZIP auto-extract).
    * Step 4: Subdomain Assignment (`*.miraigrid.web.id`) & Celebration Dashboard Unlock.
  - `File Manager (cPanel Style)`: Cream theme, tree explorer, live editor, upload zip with auto-extraction.
  - `Terminal & Web VS Code`: Jail sandbox per mahasiswa di port dinamis.

### 2. Backend (`MiraiGrid/backend/`)
- **Framework**: FastAPI (Python 3.11/3.12 Asynchronous Core) di port `8000`.
- **Integrasi**:
  - LXC Management via `lxd` API / CLI.
  - Docker API & Portainer REST API (`10.10.10.10`).
  - Nginx dynamic configuration builder untuk wildcard `*.miraigrid.web.id`.
  - Database provisioning engine (MariaDB 11 & PostgreSQL 16).
  - Storage & Quota enforcement per NIM (`/home/<nim>`).

### 3. Server & Network Topology
- **Host Utama**: Ubuntu Linux Enterprise (`labit`), IP Tailscale `100.122.201.18`.
- **Virtualisasi LXC**: `labdocker` (IP `10.10.10.10`).
- **Cloudflare Zero Trust**:
  - `miraigrid.web.id` -> Frontend (`10.10.10.10:3000`).
  - `api.miraigrid.web.id` -> Backend FastAPI (`10.10.10.10:8000`).
  - `*.miraigrid.web.id` -> Ingress HTTP Reverse Proxy (`10.10.10.10:80`).

---

## 📋 DAFTAR FITUR & INTEGRASI TERKINI (JANGAN DIHILANGKAN / DIUBAH POLANYA)
- [x] Multi-runtime support: PHP 8.2/8.3, Node.js 20, Python 3.11, OpenLiteSpeed.
- [x] Database Web Studio Single Sign-On (phpMyAdmin, phpPgAdmin, Adminer, CloudBeaver).
- [x] Dedicated cgroup v2 limits (RAM 256MB, CPU 0.5 Cores per student app).
- [x] Gated Onboarding State Machine (Tidak bisa lompati step onboarding).
- [x] Anti-Webshell & upload validation logic.

---

## 🛠️ INSTRUKSI PROSEDURAL UNTUK AGENT
Saat bosss meminta penambahan fitur baru atau perbaikan bug:
1. **Analisis file eksisting terlebih dahulu** menggunakan `read_file` atau `grep`.
2. **Identifikasi letak injeksi kode** yang tepat tanpa mengacak-acak baris lain.
3. Gunakan `edit_file` dengan target blok yang presisi (hindari rewrite 1 file utuh dari baris 1 sampai akhir jika file tersebut sangat panjang).
4. Jika menemui error, **baca error log secara detail**, cari akar penyebabnya (Root Cause), dan perbaiki secara lokal. **JANGAN MERESET KE VERSI DEFAULT KETIKA BINGUNG!**
