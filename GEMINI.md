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

2. **STANDAR DESAIN TUNGGAL V2 (MIRAIGRID CLOUD WORKSPACE)**:
   - **Tema resmi tunggal adalah V2 (MiraiGrid Cloud Workspace: putih, slate, emerald). Tema V1 sudah dihapus permanen. Dilarang mengembalikan warna cokelat/krem (`#2b1d14`, `#f5efe6`, `#eaddcf`) ke mana pun.**
   - Standar UI V2: Flat Clean Minimalist tanpa shadow (`border border-slate-200/80`), `rounded-xl`, tanpa emoji, ikon dari `lucide-react`, tanpa pulse dot/badge dekoratif.

3. **VERIFIKASI FILE BACKUP SEBELUM DAN SESUDAH EDIT**:
   - Selalu buat snapshot/backup sebelum modifikasi (`.bak` atau commit git lokal).
   - Pastikan build frontend (`npm run build` / `vite build`) dan backend FastAPI syntax check berhasil tanpa error sebelum menyatakan selesai.

---

## 🏛️ ARSITEKTUR SISTEM MIRAIGRID YANG SUDAH JALAN (EXISTING WORKING STATE)

### 1. Frontend (`MiraiGrid/frontend/`)
- **Framework**: React / Vite architecture dengan Tailwind CSS (Tema Tunggal V2).
- **Komponen Utama**:
  - `DashboardV2` & `NavigationV2`: Workspace Cloud File Manager V2 (putih-slate, dual-scroll layout, sidepanel info statis / bottom sheet mobile, fullscreen code/text editor, media preview, Google Drive style Floating Upload Manager).
  - `LoginPage`: Halaman Login V2 (SSO SIMTIK + login lokal, card putih bersih `rounded-xl`).
  - `Onboarding Wizard` (Gated 4-Step Flow V2):
    * Step 1: Profiling & Alokasi Kuota (Storage 10 GB, DB 5 GB, RAM 512 MB, CPU 0.5 Cores dengan `formatMBSize`).
    * Step 2: Database Provisioning (Pilihan MySQL/MariaDB atau PostgreSQL).
    * Step 3: Runtime Deployment & File Upload (PHP, Node.js, Python, OpenLiteSpeed - Drag & Drop ZIP auto-extract).
    * Step 4: Subdomain Assignment (`*.miraigrid.web.id`) & Dashboard Unlock.
  - `ProjectsView`, `CreateProjectPage`, `ProjectDetailPage`, `ConsolePage`: Manajemen deploy multi-runtime, `php.ini` editor, Composer build engine, dan console kontainer.
  - `DatabasesView`, `StudentResourcesPage`, `ThingsBoardView`, `AdminView`, `AccountConfigPage`, `AboutPage`: Seluruh halaman terstandarisasi V2.
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
