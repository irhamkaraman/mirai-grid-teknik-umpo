import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useInView, useReducedMotion } from 'motion/react'
import { Menu, X, Plus, ArrowLeft, ArrowUpRight, FolderOpen } from 'lucide-react'

const PROJECTS = [
  {
    id: 'toko-buku',
    name: 'toko-buku',
    runtime: 'PHP 8.3',
    database: 'MariaDB 11',
    status: 'Online',
    url: 'toko-buku-23533740.miraigrid.web.id',
    ram: '142 / 512 MB',
    cpu: '0.18 / 0.5 Core',
    storage: '340 MB / 10 GB',
    dbUsage: '24 MB / 5 GB',
    logs: [
      '$ miraigrid deploy --runtime php8.3 --dir /home/23533740/toko-buku',
      '[1/4] Memverifikasi arsip dan pemindaian keamanan berkas... bersih',
      '[2/4] Menyiapkan skema MariaDB 11 dan variabel lingkungan...',
      '[3/4] Menerapkan batas cgroup v2 (RAM 512 MB, CPU 0.5 Core)...',
      '[4/4] Nginx ingress aktif pada https://toko-buku-23533740.miraigrid.web.id',
    ],
  },
  {
    id: 'iot-monitoring',
    name: 'iot-monitoring',
    runtime: 'Node.js 20',
    database: 'PostgreSQL 16',
    status: 'Online',
    url: 'iot-monitoring-23533740.miraigrid.web.id',
    ram: '196 / 512 MB',
    cpu: '0.22 / 0.5 Core',
    storage: '512 MB / 10 GB',
    dbUsage: '68 MB / 5 GB',
    logs: [
      '$ miraigrid deploy --runtime node20 --dir /home/23533740/iot-monitoring',
      '[1/4] Memasang dependensi produksi (npm ci --omit=dev)...',
      '[2/4] Menghubungkan pool PostgreSQL 16 dan telemetri MQTT...',
      '[3/4] Menjalankan proses worker dengan proteksi OOM cgroup v2...',
      '[4/4] Layanan aktif pada https://iot-monitoring-23533740.miraigrid.web.id',
    ],
  },
  {
    id: 'api-presensi',
    name: 'api-presensi',
    runtime: 'Python 3.12',
    database: 'PostgreSQL 16',
    status: 'Online',
    url: 'api-presensi-23533740.miraigrid.web.id',
    ram: '118 / 512 MB',
    cpu: '0.12 / 0.5 Core',
    storage: '280 MB / 10 GB',
    dbUsage: '42 MB / 5 GB',
    logs: [
      '$ miraigrid deploy --runtime python3.12 --dir /home/23533740/api-presensi',
      '[1/4] Menyiapkan virtual environment Python 3.12...',
      '[2/4] Menjalankan migrasi skema PostgreSQL 16...',
      '[3/4] Menjalankan worker Uvicorn pada port internal terisolasi...',
      '[4/4] Endpoint aktif pada https://api-presensi-23533740.miraigrid.web.id',
    ],
  },
  {
    id: 'portal-krs',
    name: 'portal-krs',
    runtime: 'PHP 8.3',
    database: 'MariaDB 11',
    status: 'Standby',
    url: 'portal-krs-23533740.miraigrid.web.id',
    ram: '64 / 512 MB',
    cpu: '0.04 / 0.5 Core',
    storage: '190 MB / 10 GB',
    dbUsage: '18 MB / 5 GB',
    logs: [
      '$ miraigrid deploy --runtime php8.3 --dir /home/23533740/portal-krs',
      '[1/4] Memverifikasi konfigurasi php.ini dan ekstensi mysqli...',
      '[2/4] Mengikat database MariaDB 11 milik akun 23533740...',
      '[3/4] Kontainer dalam mode siaga hemat memori...',
      '[4/4] Siap menerima trafik pada https://portal-krs-23533740.miraigrid.web.id',
    ],
  },
  {
    id: 'landing-himati',
    name: 'landing-himati',
    runtime: 'OpenLiteSpeed',
    database: 'Tanpa DB',
    status: 'Online',
    url: 'landing-himati-23533740.miraigrid.web.id',
    ram: '48 / 512 MB',
    cpu: '0.02 / 0.5 Core',
    storage: '95 MB / 10 GB',
    dbUsage: '0 MB / 5 GB',
    logs: [
      '$ miraigrid deploy --runtime openlitespeed --dir /home/23533740/landing-himati',
      '[1/4] Memeriksa aset statis HTML, CSS, dan bundle JavaScript...',
      '[2/4] Mengaktifkan kompresi Brotli dan cache header...',
      '[3/4] Memetakan rute virtual host pada Nginx ingress...',
      '[4/4] Situs aktif pada https://landing-himati-23533740.miraigrid.web.id',
    ],
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Masuk dengan akun SIMTIK',
    desc: 'Mahasiswa dan dosen langsung terautentikasi menggunakan kredensial kampus Universitas Muhammadiyah Ponorogo tanpa registrasi terpisah.',
  },
  {
    num: '02',
    title: 'Pilih runtime dan database',
    desc: 'Tentukan stack praktikum mulai dari PHP 8.3, Node.js 20, Python 3.12, hingga OpenLiteSpeed, lalu hubungkan dengan MariaDB 11 atau PostgreSQL 16.',
  },
  {
    num: '03',
    title: 'Unggah proyek dan publikasikan',
    desc: 'Unggah arsip kode atau sunting langsung melalui editor web. Sistem mengekstrak berkas ke ruang terisolasi dan menerbitkan alamat *.miraigrid.web.id.',
  },
]

const INFRA_LAYERS = [
  {
    layer: '01 · EDGE & TLS',
    name: 'Cloudflare Zero Trust Edge',
    detail: 'Terminasi HTTPS otomatis dan perlindungan trafik untuk seluruh subdomain *.miraigrid.web.id.',
  },
  {
    layer: '02 · INGRESS',
    name: 'Nginx Reverse Proxy Dinamis',
    detail: 'Mengarahkan permintaan HTTP/2 secara presisi ke port internal kontainer masing-masing mahasiswa.',
  },
  {
    layer: '03 · ISOLASI',
    name: 'LXC & Docker Sandbox (cgroup v2)',
    detail: 'Membatasi memori 512 MB dan CPU 0.5 Core per akun dengan proteksi OOM agar beban kerja tetap stabil.',
  },
  {
    layer: '04 · EKSEKUSI & DATA',
    name: 'Runtime & Database Terkelola',
    detail: 'Menjalankan PHP 8.2/8.3, Node.js 20, Python 3.11/3.12, OpenLiteSpeed, MariaDB 11, dan PostgreSQL 16.',
  },
]

const SECURITY_RULES = [
  'Isolasi direktori /home/<nim> dan jail terminal untuk setiap akun mahasiswa.',
  'Pembatasan resource cgroup v2 agar lonjakan satu aplikasi tidak mengganggu praktikum lain.',
  'Validasi arsip unggahan dan pemindaian pola webshell sebelum proses ekstraksi dijalankan.',
  'Autentikasi Single Sign-On terintegrasi SIMTIK tanpa menyimpan kata sandi mentah.',
  'Skema database terpisah dengan kredensial unik untuk setiap akun mahasiswa.',
]

const FAQS = [
  {
    q: 'Apakah mahasiswa harus membuat akun baru?',
    a: 'Tidak. Mahasiswa dan dosen masuk langsung menggunakan akun SIMTIK Universitas Muhammadiyah Ponorogo.',
  },
  {
    q: 'Runtime dan database apa saja yang tersedia?',
    a: 'MiraiGrid menyediakan PHP 8.2 dan 8.3, Node.js 20, Python 3.11 dan 3.12, OpenLiteSpeed, serta database MariaDB 11 dan PostgreSQL 16.',
  },
  {
    q: 'Berapa kuota resource yang diberikan untuk setiap akun?',
    a: 'Setiap akun mahasiswa mendapat alokasi penyimpanan berkas 10 GB, database 5 GB, memori RAM 512 MB, dan 0.5 Core CPU dengan proteksi cgroup v2.',
  },
  {
    q: 'Bagaimana cara mengakses aplikasi yang sudah diunggah?',
    a: 'Setiap proyek yang dipublikasikan otomatis mendapat alamat subdomain *.miraigrid.web.id yang dapat diakses langsung melalui HTTPS.',
  },
  {
    q: 'Apakah file praktikum aman dari mahasiswa lain?',
    a: 'Ya. Setiap akun berjalan di ruang kerja terisolasi pada direktori /home/<nim> dan tidak dapat mengakses berkas atau database milik mahasiswa lain.',
  },
]

export default function LandingPage({ onLogin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(PROJECTS[0].id)
  const [mobileView, setMobileView] = useState('list')
  const [openFaq, setOpenFaq] = useState(0)

  const prefersReducedMotion = useReducedMotion()
  const mockupRef = useRef(null)
  const isMockupInView = useInView(mockupRef, { once: true, amount: 0.25 })

  const activeProject = PROJECTS.find((p) => p.id === selectedId) || PROJECTS[0]

  // One-time 2.4s typing animation for the initial project log when mockup enters viewport
  const initialFullText = PROJECTS[0].logs.join('\n')
  const [typedCount, setTypedCount] = useState(0)
  const [hasFinishedInitialTyping, setHasFinishedInitialTyping] = useState(false)

  useEffect(() => {
    if (prefersReducedMotion) {
      setTypedCount(initialFullText.length)
      setHasFinishedInitialTyping(true)
      return
    }
    if (!isMockupInView || hasFinishedInitialTyping) return

    const totalChars = initialFullText.length
    const durationMs = 2400
    const startTime = performance.now()
    let rafId = null

    const tick = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      setTypedCount(Math.floor(progress * totalChars))
      if (progress < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        setHasFinishedInitialTyping(true)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isMockupInView, prefersReducedMotion, hasFinishedInitialTyping, initialFullText])

  const displayedLog =
    selectedId === PROJECTS[0].id && !hasFinishedInitialTyping && !prefersReducedMotion
      ? initialFullText.slice(0, typedCount)
      : activeProject.logs.join('\n')

  const handleSelectProject = (id) => {
    setSelectedId(id)
    setMobileView('detail')
    if (!hasFinishedInitialTyping) {
      setHasFinishedInitialTyping(true)
    }
  }

  const handleSmoothScroll = (e, targetId) => {
    e.preventDefault()
    setMobileMenuOpen(false)
    const el = document.getElementById(targetId)
    if (el) {
      el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })
    }
  }

  return (
    <div
      className="miraigrid-landing min-h-screen bg-[#0A0B0D] text-[#EDEDEA] selection:bg-[#D4FF3A] selection:text-[#0A0B0D]"
      style={{
        fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
        '--paper': '#0A0B0D',
        '--ink': '#EDEDEA',
        '--accent': '#D4FF3A',
        '--on-accent': '#0A0B0D',
        '--surface': '#141519',
        '--surface-2': '#1C1E23',
        '--muted': '#8E9096',
        '--line': '#26282E',
      }}
    >
      {/* 1. NAVBAR (64px) */}
      <header className="sticky top-0 z-40 h-16 border-b border-[#26282E] bg-[#0A0B0D]/95">
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-5 md:px-8">
          <a href="#top" className="flex items-center gap-2.5 text-[15px] font-medium tracking-tight text-[#EDEDEA]">
            <span className="inline-block h-2 w-2 bg-[#D4FF3A]" aria-hidden="true" />
            <span>MiraiGrid</span>
            <span
              className="hidden text-[14px] text-[#8E9096] sm:inline"
              style={{ fontFamily: "'Geist Mono', monospace" }}
            >
              / Lab TI UMPO
            </span>
          </a>

          <nav className="hidden items-center gap-7 md:flex">
            <a
              href="#cara-kerja"
              onClick={(e) => handleSmoothScroll(e, 'cara-kerja')}
              className="text-[14px] text-[#8E9096] transition-colors hover:text-[#EDEDEA]"
            >
              Cara Kerja
            </a>
            <a
              href="#infrastruktur"
              onClick={(e) => handleSmoothScroll(e, 'infrastruktur')}
              className="text-[14px] text-[#8E9096] transition-colors hover:text-[#EDEDEA]"
            >
              Infrastruktur
            </a>
            <a
              href="#keamanan"
              onClick={(e) => handleSmoothScroll(e, 'keamanan')}
              className="text-[14px] text-[#8E9096] transition-colors hover:text-[#EDEDEA]"
            >
              Keamanan
            </a>
            <a
              href="#faq"
              onClick={(e) => handleSmoothScroll(e, 'faq')}
              className="text-[14px] text-[#8E9096] transition-colors hover:text-[#EDEDEA]"
            >
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onLogin}
              className="hidden rounded-[2px] bg-[#D4FF3A] px-4 py-2 text-[14px] font-medium text-[#0A0B0D] transition-opacity hover:opacity-90 md:inline-flex"
            >
              Masuk dengan SIMTIK
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[2px] border border-[#26282E] text-[#EDEDEA] md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen && (
          <div className="border-b border-[#26282E] bg-[#0A0B0D] px-5 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              <a
                href="#cara-kerja"
                onClick={(e) => handleSmoothScroll(e, 'cara-kerja')}
                className="py-1.5 text-[15px] text-[#EDEDEA]"
              >
                Cara Kerja
              </a>
              <a
                href="#infrastruktur"
                onClick={(e) => handleSmoothScroll(e, 'infrastruktur')}
                className="py-1.5 text-[15px] text-[#EDEDEA]"
              >
                Infrastruktur
              </a>
              <a
                href="#keamanan"
                onClick={(e) => handleSmoothScroll(e, 'keamanan')}
                className="py-1.5 text-[15px] text-[#EDEDEA]"
              >
                Keamanan
              </a>
              <a
                href="#faq"
                onClick={(e) => handleSmoothScroll(e, 'faq')}
                className="py-1.5 text-[15px] text-[#EDEDEA]"
              >
                FAQ
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  onLogin()
                }}
                className="mt-2 w-full rounded-[2px] bg-[#D4FF3A] px-4 py-2.5 text-[14px] font-medium text-[#0A0B0D]"
              >
                Masuk dengan SIMTIK
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="top">
        {/* 2. HERO + WORKSPACE MOCKUP */}
        <section className="border-b border-[#26282E] py-14 md:py-20">
          <div className="mx-auto max-w-[1200px] px-5 md:px-8">
            <div className="max-w-3xl">
              <p
                className="mb-4 text-[14px] uppercase tracking-[0.06em] text-[#8E9096]"
                style={{ fontFamily: "'Geist Mono', monospace" }}
              >
                LABORATORIUM TEKNIK INFORMATIKA · UNIVERSITAS MUHAMMADIYAH PONOROGO
              </p>
              <h1
                className="font-medium tracking-[-0.025em] text-[#EDEDEA]"
                style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)', lineHeight: 1.08 }}
              >
                Ruang cloud terisolasi untuk <span className="text-[#D4FF3A]">setiap</span> mahasiswa.
              </h1>
              <p className="mt-5 max-w-2xl text-[18px] leading-[1.6] text-[#8E9096]">
                Deploy web, database, dan proyek praktikum ke subdomain *.miraigrid.web.id tanpa konfigurasi server dari nol.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onLogin}
                  className="rounded-[2px] bg-[#D4FF3A] px-5 py-3 text-[15px] font-medium text-[#0A0B0D] transition-opacity hover:opacity-90"
                >
                  Masuk dengan SIMTIK
                </button>
                <a
                  href="#cara-kerja"
                  onClick={(e) => handleSmoothScroll(e, 'cara-kerja')}
                  className="rounded-[2px] border border-[#26282E] bg-[#141519] px-5 py-3 text-[15px] font-medium text-[#EDEDEA] transition-colors hover:bg-[#1C1E23]"
                >
                  Lihat cara kerjanya
                </a>
              </div>
            </div>

            {/* Interactive Workspace Mockup */}
            <div
              ref={mockupRef}
              className="mt-12 overflow-hidden rounded-[4px] border border-[#26282E] bg-[#141519]"
            >
              {/* Mockup Top Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#26282E] bg-[#0A0B0D] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="text-[14px] text-[#EDEDEA]"
                    style={{ fontFamily: "'Geist Mono', monospace" }}
                  >
                    workspace / 23533740
                  </span>
                </div>
                <div
                  className="flex items-center gap-2 text-[14px] text-[#8E9096]"
                  style={{ fontFamily: "'Geist Mono', monospace" }}
                >
                  <span className="inline-block h-2 w-2 bg-[#D4FF3A]" aria-hidden="true" />
                  <span>LXC · 10.10.10.10</span>
                </div>
              </div>

              {/* Mockup Split Pane */}
              <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
                {/* Left Sidebar: Project List */}
                <div
                  className={`border-b border-[#26282E] md:border-b-0 md:border-r ${
                    mobileView === 'detail' ? 'hidden md:block' : 'block'
                  }`}
                >
                  <div className="border-b border-[#26282E] px-4 py-3">
                    <span
                      className="text-[14px] uppercase tracking-[0.06em] text-[#8E9096]"
                      style={{ fontFamily: "'Geist Mono', monospace" }}
                    >
                      PROYEK (5)
                    </span>
                  </div>
                  <div className="divide-y divide-[#26282E]">
                    {PROJECTS.map((project) => {
                      const isActive = project.id === selectedId
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => handleSelectProject(project.id)}
                          className={`flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors ${
                            isActive
                              ? 'border-l-2 border-[#D4FF3A] bg-[#1C1E23] text-[#EDEDEA]'
                              : 'border-l-2 border-transparent text-[#8E9096] hover:bg-[#1C1E23]/60 hover:text-[#EDEDEA]'
                          }`}
                        >
                          <div>
                            <div
                              className="text-[14px] font-medium text-[#EDEDEA]"
                              style={{ fontFamily: "'Geist Mono', monospace" }}
                            >
                              {project.name}
                            </div>
                            <div className="mt-0.5 text-[14px] text-[#8E9096]">
                              {project.runtime} · {project.database}
                            </div>
                          </div>
                          <span
                            className={`text-[14px] ${
                              project.status === 'Online' ? 'text-[#EDEDEA]' : 'text-[#8E9096]'
                            }`}
                            style={{ fontFamily: "'Geist Mono', monospace" }}
                          >
                            {project.status}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Right Detail Pane */}
                <div className={`${mobileView === 'list' ? 'hidden md:block' : 'block'} p-5 md:p-6`}>
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="mb-4 inline-flex items-center gap-2 rounded-[2px] border border-[#26282E] bg-[#1C1E23] px-3 py-1.5 text-[14px] text-[#EDEDEA] md:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Proyek</span>
                  </button>

                  {/* Project Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#26282E] pb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2
                          className="text-[20px] font-medium text-[#EDEDEA]"
                          style={{ fontFamily: "'Geist Mono', monospace" }}
                        >
                          {activeProject.name}
                        </h2>
                        <span
                          className="border border-[#26282E] bg-[#1C1E23] px-2.5 py-0.5 text-[14px] text-[#EDEDEA]"
                          style={{ fontFamily: "'Geist Mono', monospace" }}
                        >
                          {activeProject.runtime}
                        </span>
                      </div>
                      <p
                        className="mt-1.5 text-[14px] text-[#8E9096]"
                        style={{ fontFamily: "'Geist Mono', monospace" }}
                      >
                        https://{activeProject.url}
                      </p>
                    </div>

                    <div
                      className="text-[14px] text-[#8E9096]"
                      style={{ fontFamily: "'Geist Mono', monospace" }}
                    >
                      DB: <span className="text-[#EDEDEA]">{activeProject.database}</span>
                    </div>
                  </div>

                  {/* Deploy Log */}
                  <div className="mt-5">
                    <div
                      className="mb-2 text-[14px] uppercase tracking-[0.06em] text-[#8E9096]"
                      style={{ fontFamily: "'Geist Mono', monospace" }}
                    >
                      LOG DEPLOY
                    </div>
                    <div className="min-h-[168px] overflow-x-auto rounded-[2px] border border-[#26282E] bg-[#0A0B0D] p-4">
                      <pre
                        className="whitespace-pre-wrap text-[14px] leading-[1.65] text-[#EDEDEA]"
                        style={{ fontFamily: "'Geist Mono', monospace" }}
                      >
                        {displayedLog}
                        {!hasFinishedInitialTyping &&
                          selectedId === PROJECTS[0].id &&
                          !prefersReducedMotion && (
                            <span
                              className="ml-0.5 inline-block h-4 w-2 align-middle bg-[#D4FF3A]"
                              aria-hidden="true"
                            />
                          )}
                      </pre>
                    </div>
                  </div>

                  {/* Quota Row */}
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#26282E] pt-5 sm:grid-cols-4">
                    <div className="rounded-[2px] border border-[#26282E] bg-[#0A0B0D] p-3">
                      <div className="text-[14px] text-[#8E9096]">Memori RAM</div>
                      <div
                        className="mt-1 text-[14px] font-medium tabular-nums text-[#EDEDEA]"
                        style={{ fontFamily: "'Geist Mono', monospace" }}
                      >
                        {activeProject.ram}
                      </div>
                    </div>
                    <div className="rounded-[2px] border border-[#26282E] bg-[#0A0B0D] p-3">
                      <div className="text-[14px] text-[#8E9096]">Alokasi CPU</div>
                      <div
                        className="mt-1 text-[14px] font-medium tabular-nums text-[#EDEDEA]"
                        style={{ fontFamily: "'Geist Mono', monospace" }}
                      >
                        {activeProject.cpu}
                      </div>
                    </div>
                    <div className="rounded-[2px] border border-[#26282E] bg-[#0A0B0D] p-3">
                      <div className="text-[14px] text-[#8E9096]">Storage</div>
                      <div
                        className="mt-1 text-[14px] font-medium tabular-nums text-[#EDEDEA]"
                        style={{ fontFamily: "'Geist Mono', monospace" }}
                      >
                        {activeProject.storage}
                      </div>
                    </div>
                    <div className="rounded-[2px] border border-[#26282E] bg-[#0A0B0D] p-3">
                      <div className="text-[14px] text-[#8E9096]">Database</div>
                      <div
                        className="mt-1 text-[14px] font-medium tabular-nums text-[#EDEDEA]"
                        style={{ fontFamily: "'Geist Mono', monospace" }}
                      >
                        {activeProject.dbUsage}
                      </div>
                    </div>
                  </div>

                  {/* Footer Bar */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#26282E] pt-4">
                    <div
                      className="flex items-center gap-2 text-[14px] text-[#EDEDEA]"
                      style={{ fontFamily: "'Geist Mono', monospace" }}
                    >
                      <span
                        className={`inline-block h-2 w-2 ${
                          activeProject.status === 'Online' ? 'bg-[#D4FF3A]' : 'bg-[#8E9096]'
                        }`}
                        aria-hidden="true"
                      />
                      <span>{activeProject.status}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={onLogin}
                        className="inline-flex items-center gap-1.5 rounded-[2px] border border-[#26282E] bg-[#1C1E23] px-3.5 py-2 text-[14px] text-[#EDEDEA] transition-colors hover:border-[#8E9096]"
                      >
                        <FolderOpen className="h-4 w-4" />
                        <span>Buka File</span>
                      </button>
                      <button
                        type="button"
                        onClick={onLogin}
                        className="inline-flex items-center gap-1.5 rounded-[2px] border border-[#26282E] bg-[#1C1E23] px-3.5 py-2 text-[14px] text-[#EDEDEA] transition-colors hover:border-[#8E9096]"
                      >
                        <span>Buka Situs</span>
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. SATU PERTANYAAN NYATA */}
        <section className="border-b border-[#26282E] py-16 md:py-24">
          <div className="mx-auto max-w-[1200px] px-5 md:px-8">
            <p
              className="text-[14px] uppercase tracking-[0.06em] text-[#8E9096]"
              style={{ fontFamily: "'Geist Mono', monospace" }}
            >
              SATU PERTANYAAN NYATA
            </p>
            <h2
              className="mt-3 max-w-3xl font-medium tracking-[-0.02em] text-[#EDEDEA]"
              style={{ fontSize: 'clamp(1.65rem, 3.2vw, 2.5rem)', lineHeight: 1.15 }}
            >
              Kenapa praktikum web sering terhenti di masalah konfigurasi lokal?
            </h2>
            <p className="mt-5 max-w-2xl text-[16px] leading-[1.7] text-[#8E9096]">
              Di awal semester, separuh waktu praktikum habis hanya untuk menyamakan versi PHP, memperbaiki port yang bentrok, atau memindahkan database yang hanya berjalan di satu laptop. Ketika asisten dosen memeriksa tugas, lingkungan uji sering tidak cocok.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-px border border-[#26282E] bg-[#26282E] md:grid-cols-2">
              <div className="bg-[#141519] p-6 md:p-8">
                <div
                  className="text-[14px] uppercase tracking-[0.06em] text-[#8E9096]"
                  style={{ fontFamily: "'Geist Mono', monospace" }}
                >
                  DI LAPTOP MASING-MASING
                </div>
                <ul className="mt-4 space-y-3 text-[15px] leading-[1.6] text-[#8E9096]">
                  <li>Versi runtime berbeda antar mahasiswa sehingga kode gagal dijalankan saat evaluasi.</li>
                  <li>Aplikasi hanya dapat diakses di localhost dan sulit diuji melalui jaringan kampus atau publik.</li>
                  <li>Konfigurasi web server dan database harus diulang setiap kali berpindah perangkat.</li>
                </ul>
              </div>

              <div className="bg-[#141519] p-6 md:p-8">
                <div
                  className="flex items-center gap-2 text-[14px] uppercase tracking-[0.06em] text-[#EDEDEA]"
                  style={{ fontFamily: "'Geist Mono', monospace" }}
                >
                  <span className="inline-block h-2 w-2 bg-[#D4FF3A]" aria-hidden="true" />
                  <span>DI WORKSPACE MIRAIGRID</span>
                </div>
                <ul className="mt-4 space-y-3 text-[15px] leading-[1.6] text-[#EDEDEA]">
                  <li>Lingkungan PHP 8.3, Node.js 20, Python 3.12, dan OpenLiteSpeed sudah siap pakai untuk semua akun.</li>
                  <li>Setiap proyek langsung mendapat subdomain *.miraigrid.web.id dengan sertifikat HTTPS aktif.</li>
                  <li>Pengelolaan berkas, terminal jail, editor web, dan database terpusat dalam satu ruang kerja.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 4. CARA KERJA */}
        <section id="cara-kerja" className="scroll-mt-16 border-b border-[#26282E] py-16 md:py-24">
          <div className="mx-auto max-w-[1200px] px-5 md:px-8">
            <p
              className="text-[14px] uppercase tracking-[0.06em] text-[#8E9096]"
              style={{ fontFamily: "'Geist Mono', monospace" }}
            >
              CARA KERJA
            </p>
            <h2
              className="mt-3 max-w-3xl font-medium tracking-[-0.02em] text-[#EDEDEA]"
              style={{ fontSize: 'clamp(1.65rem, 3.2vw, 2.5rem)', lineHeight: 1.15 }}
            >
              Tiga langkah dari akun kampus hingga aplikasi berjalan publik.
            </h2>

            <div className="mt-10 divide-y divide-[#26282E] border-y border-[#26282E]">
              {STEPS.map((step) => (
                <div
                  key={step.num}
                  className="grid grid-cols-1 gap-4 py-7 md:grid-cols-[120px_320px_1fr] md:items-baseline md:gap-8"
                >
                  <div
                    className="flex items-center gap-2.5 text-[15px] font-medium tabular-nums text-[#EDEDEA]"
                    style={{ fontFamily: "'Geist Mono', monospace" }}
                  >
                    <span className="inline-block h-1.5 w-1.5 bg-[#D4FF3A]" aria-hidden="true" />
                    <span>{step.num}</span>
                  </div>
                  <h3 className="text-[18px] font-medium text-[#EDEDEA]">{step.title}</h3>
                  <p className="text-[15px] leading-[1.65] text-[#8E9096]">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. INFRASTRUKTUR */}
        <section id="infrastruktur" className="scroll-mt-16 border-b border-[#26282E] py-16 md:py-24">
          <div className="mx-auto max-w-[1200px] px-5 md:px-8">
            <p
              className="text-[14px] uppercase tracking-[0.06em] text-[#8E9096]"
              style={{ fontFamily: "'Geist Mono', monospace" }}
            >
              INFRASTRUKTUR
            </p>
            <h2
              className="mt-3 max-w-3xl font-medium tracking-[-0.02em] text-[#EDEDEA]"
              style={{ fontSize: 'clamp(1.65rem, 3.2vw, 2.5rem)', lineHeight: 1.15 }}
            >
              Empat lapisan dari edge hingga kontainer mahasiswa.
            </h2>

            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
              {INFRA_LAYERS.map((item) => (
                <div
                  key={item.layer}
                  className="rounded-[2px] border border-[#26282E] bg-[#141519] p-6"
                >
                  <div
                    className="text-[14px] text-[#8E9096]"
                    style={{ fontFamily: "'Geist Mono', monospace" }}
                  >
                    {item.layer}
                  </div>
                  <h3 className="mt-2 text-[18px] font-medium text-[#EDEDEA]">{item.name}</h3>
                  <p className="mt-2 text-[15px] leading-[1.6] text-[#8E9096]">{item.detail}</p>
                </div>
              ))}
            </div>

            <div
              className="mt-6 flex flex-wrap items-center gap-3 rounded-[2px] border border-[#26282E] bg-[#141519] px-5 py-4 text-[14px] text-[#8E9096]"
              style={{ fontFamily: "'Geist Mono', monospace" }}
            >
              <span className="text-[#EDEDEA]">Alur Permintaan:</span>
              <span>Browser Mahasiswa</span>
              <span className="text-[#EDEDEA]">-&gt;</span>
              <span>Cloudflare Edge</span>
              <span className="text-[#EDEDEA]">-&gt;</span>
              <span>Nginx Ingress</span>
              <span className="text-[#EDEDEA]">-&gt;</span>
              <span className="text-[#EDEDEA]">Kontainer NIM (10.10.10.10)</span>
            </div>
          </div>
        </section>

        {/* 6. KEAMANAN BERLAPIS */}
        <section id="keamanan" className="scroll-mt-16 border-b border-[#26282E] py-16 md:py-24">
          <div className="mx-auto max-w-[1200px] px-5 md:px-8">
            <p
              className="text-[14px] uppercase tracking-[0.06em] text-[#8E9096]"
              style={{ fontFamily: "'Geist Mono', monospace" }}
            >
              KEAMANAN BERLAPIS
            </p>
            <h2
              className="mt-3 max-w-3xl font-medium tracking-[-0.02em] text-[#EDEDEA]"
              style={{ fontSize: 'clamp(1.65rem, 3.2vw, 2.5rem)', lineHeight: 1.15 }}
            >
              Terisolasi per NIM, diawasi sejak unggahan pertama.
            </h2>

            <div className="mt-10 divide-y divide-[#26282E] border-y border-[#26282E]">
              {SECURITY_RULES.map((rule, idx) => (
                <div key={idx} className="flex items-start gap-4 py-5">
                  <span
                    className="mt-2 inline-block h-2 w-2 shrink-0 bg-[#D4FF3A]"
                    aria-hidden="true"
                  />
                  <p className="text-[16px] leading-[1.6] text-[#EDEDEA]">{rule}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. FAQ ACCORDION */}
        <section id="faq" className="scroll-mt-16 border-b border-[#26282E] py-16 md:py-24">
          <div className="mx-auto max-w-[1200px] px-5 md:px-8">
            <p
              className="text-[14px] uppercase tracking-[0.06em] text-[#8E9096]"
              style={{ fontFamily: "'Geist Mono', monospace" }}
            >
              PERTANYAAN UMUM
            </p>
            <h2
              className="mt-3 max-w-3xl font-medium tracking-[-0.02em] text-[#EDEDEA]"
              style={{ fontSize: 'clamp(1.65rem, 3.2vw, 2.5rem)', lineHeight: 1.15 }}
            >
              Hal yang sering ditanyakan sebelum praktikum dimulai.
            </h2>

            <div className="mt-10 divide-y divide-[#26282E] border-y border-[#26282E]">
              {FAQS.map((item, idx) => {
                const isOpen = openFaq === idx
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 py-5 text-left"
                    >
                      <span className="text-[17px] font-medium text-[#EDEDEA]">{item.q}</span>
                      <Plus
                        className={`h-5 w-5 shrink-0 text-[#8E9096] transition-transform duration-200 ${
                          isOpen ? 'rotate-45 text-[#EDEDEA]' : 'rotate-0'
                        }`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <p className="pb-6 pr-8 text-[15px] leading-[1.65] text-[#8E9096]">
                            {item.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* 8. CATATAN DARI LABORATORIUM */}
        <section className="border-b border-[#26282E] py-16 md:py-24">
          <div className="mx-auto max-w-[1200px] px-5 md:px-8">
            <p
              className="text-[14px] uppercase tracking-[0.06em] text-[#8E9096]"
              style={{ fontFamily: "'Geist Mono', monospace" }}
            >
              CATATAN DARI LABORATORIUM
            </p>
            <h2
              className="mt-3 max-w-3xl font-medium tracking-[-0.02em] text-[#EDEDEA]"
              style={{ fontSize: 'clamp(1.65rem, 3.2vw, 2.5rem)', lineHeight: 1.15 }}
            >
              Dibangun untuk kebutuhan praktikum nyata, bukan sekadar simulasi.
            </h2>
            <p className="mt-5 max-w-2xl text-[16px] leading-[1.7] text-[#8E9096]">
              MiraiGrid dikelola langsung oleh Laboratorium Teknik Informatika, Fakultas Teknik, Universitas Muhammadiyah Ponorogo sebagai fasilitas pembelajaran pengembangan web, basis data, jaringan, dan Internet of Things. Seluruh akun aktif mengikuti jadwal perkuliahan dan tata tertib laboratorium.
            </p>

            <div className="mt-8">
              <button
                type="button"
                onClick={onLogin}
                className="rounded-[2px] bg-[#D4FF3A] px-5 py-3 text-[15px] font-medium text-[#0A0B0D] transition-opacity hover:opacity-90"
              >
                Masuk dengan SIMTIK
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* 9. FOOTER */}
      <footer className="py-12">
        <div className="mx-auto flex max-w-[1200px] flex-col justify-between gap-6 px-5 md:flex-row md:items-center md:px-8">
          <div>
            <div className="flex items-center gap-2 text-[15px] font-medium text-[#EDEDEA]">
              <span className="inline-block h-2 w-2 bg-[#D4FF3A]" aria-hidden="true" />
              <span>MiraiGrid</span>
            </div>
            <p className="mt-1.5 text-[14px] text-[#8E9096]">
              Laboratorium Teknik Informatika, Fakultas Teknik, Universitas Muhammadiyah Ponorogo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-[14px] text-[#8E9096]">
            <a
              href="#cara-kerja"
              onClick={(e) => handleSmoothScroll(e, 'cara-kerja')}
              className="transition-colors hover:text-[#EDEDEA]"
            >
              Panduan
            </a>
            <a
              href="#keamanan"
              onClick={(e) => handleSmoothScroll(e, 'keamanan')}
              className="transition-colors hover:text-[#EDEDEA]"
            >
              Keamanan
            </a>
            <a
              href="#infrastruktur"
              onClick={(e) => handleSmoothScroll(e, 'infrastruktur')}
              className="transition-colors hover:text-[#EDEDEA]"
            >
              Status Layanan
            </a>
            <a
              href="mailto:labti@umpo.ac.id"
              className="transition-colors hover:text-[#EDEDEA]"
            >
              Kontak Lab
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
