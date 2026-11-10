import React, { useEffect, useState, useMemo } from 'react'
import {
  Folder,
  HardDrive,
  Layers,
  Database,
  Cpu,
  ExternalLink,
  Plus,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  Rocket,
  FileCode,
  Terminal,
  Wand2,
  Globe,
  ShieldCheck,
  Check,
  Copy,
  X,
  Server,
  PieChart,
  Info,
  ArrowRight,
  Lock,
  RefreshCw,
  FileText,
  Users,
  Activity,
  CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonCard } from '../components/Skeletons'
import { launchDatabaseSSO } from '../utils/sso'

export default function StudentDashboard({ user, onNavigate }) {
  const isAdmin = user?.role === 'admin'
  const [quota, setQuota] = useState(null)
  const [projects, setProjects] = useState([])
  const [databases, setDatabases] = useState([])
  const [systemCapacity, setSystemCapacity] = useState(null)
  const [accountSearchQuery, setAccountSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Search filter query ala cPanel Jupiter search bar
  const [searchQuery, setSearchQuery] = useState('')

  // Section collapse state (persisted in localStorage or default all open)
  const [collapsedSections, setCollapsedSections] = useState({
    files: false,
    deployment: false,
    databases: false,
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const promises = [
        api.get('/quotas/my-quota'),
        api.get('/projects'),
        api.get('/databases'),
      ]
      if (isAdmin) {
        promises.push(api.get('/admin/system-capacity'))
      }

      const results = await Promise.allSettled(promises)
      if (results[0].status === 'fulfilled') setQuota(results[0].value.data)
      if (results[1].status === 'fulfilled') setProjects(results[1].value.data || [])
      if (results[2].status === 'fulfilled') setDatabases(results[2].value.data || [])
      if (isAdmin && results[3]?.status === 'fulfilled') {
        setSystemCapacity(results[3].value.data)
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (sectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  // Define All cPanel Tool Groups
  const toolGroups = useMemo(() => [
    {
      id: 'files',
      title: 'Files',
      subtitle: 'Manajemen berkas, direktori sandbox, dan alokasi ruang penyimpanan',
      icon: Folder,
      color: 'from-amber-600/20 to-amber-700/10 border-amber-500/30 text-amber-300',
      tools: [
        {
          id: 'file-manager',
          title: 'File Manager',
          description: 'Kelola seluruh berkas project deployment dalam satu desktop explorer klasik (membuka di tab baru).',
          badge: 'Baru • Tab Terpisah',
          badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
          icon: Folder,
          iconColor: 'text-[#E8DCB8]',
          bgGradient: 'from-[#4A2D1B] to-[#341F14]',
          action: () => window.open('/files', '_blank', 'noopener,noreferrer'),
          isExternal: true,
        },
        {
          id: 'disk-usage',
          title: 'Disk Usage',
          description: 'Pantau penggunaan kuota penyimpanan akun, ukuran direktori project, dan database praktikum.',
          badge: 'Storage Monitor',
          badgeColor: 'bg-[#402616] text-[#E8C58D] border-[#683E24]',
          icon: HardDrive,
          iconColor: 'text-[#E8C58D]',
          bgGradient: 'from-[#422718] to-[#2D1A10]',
          action: () => onNavigate('/disk-usage'),
        },
      ],
    },
    {
      id: 'deployment',
      title: 'Deployment & Software',
      subtitle: 'Pusat deployment aplikasi web mandiri berbasis PHP, Node.js, dan Python',
      icon: Rocket,
      color: 'from-blue-600/20 to-indigo-700/10 border-blue-500/30 text-blue-300',
      tools: [
        {
          id: 'setup-php',
          title: 'Setup PHP',
          description: 'Buat dan deploy aplikasi berbasis PHP 7.4 - 8.3 dengan Apache web server & direktori /var/www/html.',
          badge: 'PHP 7.4 - 8.3',
          badgeColor: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60',
          icon: FileCode,
          iconColor: 'text-indigo-300',
          bgGradient: 'from-[#382845] to-[#23182E]',
          action: () => onNavigate('/deploy?create=true&lang=php'),
        },
        {
          id: 'setup-node',
          title: 'Setup Node.js',
          description: 'Deploy aplikasi JavaScript backend dengan Node.js 16 - 22 LTS, Express server, dan npm packages.',
          badge: 'Node 16 - 22 LTS',
          badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
          icon: Cpu,
          iconColor: 'text-emerald-300',
          bgGradient: 'from-[#1E382B] to-[#14261D]',
          action: () => onNavigate('/deploy?create=true&lang=node'),
        },
        {
          id: 'setup-python',
          title: 'Setup Python',
          description: 'Deploy aplikasi Python 3.9 - 3.12 (Flask/Django/FastAPI) di direktori /app yang terisolasi.',
          badge: 'Python 3.9 - 3.12',
          badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
          icon: Terminal,
          iconColor: 'text-amber-300',
          bgGradient: 'from-[#423419] to-[#2E2411]',
          action: () => onNavigate('/deploy?create=true&lang=python'),
        },
      ],
    },
    {
      id: 'databases',
      title: 'Databases',
      subtitle: 'Pusat manajemen basis data praktikum, Web GUI studio, dan perizinan remote akses',
      icon: Database,
      color: 'from-rose-600/20 to-orange-700/10 border-rose-500/30 text-rose-300',
      tools: [
        {
          id: 'cloudbeaver',
          title: 'CloudBeaver',
          description: 'Web studio database visual interaktif multi-platform ala DBeaver untuk query SQL dan ER diagram.',
          badge: 'Visual SQL Studio',
          badgeColor: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60',
          icon: Layers,
          iconColor: 'text-cyan-300',
          bgGradient: 'from-[#1B363E] to-[#122328]',
          action: () => window.open(`http://${window.location.hostname}:8978/#/`, '_blank', 'noopener,noreferrer'),
          isExternal: true,
        },
        {
          id: 'manage-databases',
          title: 'Manage My Databases',
          description: 'Daftar database mandiri praktikum aktif, detail kredensial user terisolasi, password, dan URI.',
          badge: 'Kredensial & Tabel',
          badgeColor: 'bg-[#402616] text-[#E8C58D] border-[#683E24]',
          icon: Database,
          iconColor: 'text-[#E8DCB8]',
          bgGradient: 'from-[#4A2D1B] to-[#341F14]',
          action: () => onNavigate('/databases'),
        },
        {
          id: 'database-wizard',
          title: 'Database Wizard',
          description: 'Panduan interaktif langkah demi langkah untuk membuat basis data PostgreSQL atau MySQL/MariaDB baru.',
          badge: 'Buat DB Baru',
          badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
          icon: Wand2,
          iconColor: 'text-amber-300',
          bgGradient: 'from-[#452F17] to-[#2C1E0F]',
          action: () => onNavigate('/database-wizard'),
        },
        {
          id: 'remote-database-access',
          title: 'Remote Database Access',
          description: 'Atur perizinan host IP eksternal untuk koneksi langsung via DBeaver, TablePlus, atau script lokal.',
          badge: 'Perizinan IP Host',
          badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
          icon: Globe,
          iconColor: 'text-emerald-300',
          bgGradient: 'from-[#223927] to-[#17271B]',
          action: () => onNavigate('/remote-database'),
        },
        {
          id: 'phpmyadmin',
          title: 'phpMyAdmin',
          description: 'Web GUI resmi pengelolaan database MySQL / MariaDB 11 dengan auto-login & struktur tabel lengkap.',
          badge: 'Port 8080',
          badgeColor: 'bg-[#402616] text-[#E8C58D] border-[#683E24]',
          icon: Server,
          iconColor: 'text-[#E8C58D]',
          bgGradient: 'from-[#3D2516] to-[#2B1810]',
          action: () => launchDatabaseSSO('mariadb'),
          isExternal: true,
        },
        {
          id: 'phppgadmin',
          title: 'phpPgAdmin',
          description: 'Web GUI resmi pengelolaan database PostgreSQL 16 terisolasi dengan akses schema & query lengkap.',
          badge: 'Port 8088',
          badgeColor: 'bg-sky-950/80 text-sky-300 border-sky-700/60',
          icon: Database,
          iconColor: 'text-sky-300',
          bgGradient: 'from-[#1E3342] to-[#14232E]',
          action: () => launchDatabaseSSO('postgres'),
          isExternal: true,
        },
      ],
    },
  ], [onNavigate])

  // Filter tools based on search query ala cPanel Jupiter search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return toolGroups
    const q = searchQuery.toLowerCase().trim()
    return toolGroups
      .map((group) => {
        const matchesGroup = group.title.toLowerCase().includes(q)
        const matchingTools = group.tools.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.badge?.toLowerCase().includes(q)
        )
        if (matchesGroup) return group
        if (matchingTools.length > 0) return { ...group, tools: matchingTools }
        return null
      })
      .filter(Boolean)
  }, [toolGroups, searchQuery])

  // Filter accounts based on accountSearchQuery for Admin
  const filteredAccounts = useMemo(() => {
    if (!systemCapacity?.accounts) return []
    if (!accountSearchQuery.trim()) return systemCapacity.accounts
    const q = accountSearchQuery.toLowerCase().trim()
    return systemCapacity.accounts.filter(
      (a) =>
        a.username?.toLowerCase().includes(q) ||
        a.name?.toLowerCase().includes(q) ||
        a.class_name?.toLowerCase().includes(q)
    )
  }, [systemCapacity, accountSearchQuery])

  // Calculation for Disk Usage Modal / Student meter
  const diskTotalMb = 1024 // 1 GB allocated
  const diskUsedMb = useMemo(() => {
    let base = 24.5
    if (projects.length > 0) base += projects.length * 12.8
    if (databases.length > 0) base += databases.length * 16.4
    return Math.min(diskTotalMb, parseFloat(base.toFixed(1)))
  }, [projects.length, databases.length])
  const diskPercent = Math.min(100, Math.round((diskUsedMb / diskTotalMb) * 100))

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. HERO BANNER & CPANEL QUICK SEARCH */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-[#FAF5EC]">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#5A3521]/25 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            {isAdmin ? (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 mb-3 font-mono">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Hak Akses: Administrator Lab TI • Akses Penuh Tanpa Batasan (Superuser)</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#442718] text-[#E8DCB8] border border-[#5C3825] mb-3">
                <Sparkles className="h-3.5 w-3.5 text-[#E8DCB8]" />
                <span>Praktikum Teknik Informatika UMPO</span>
              </span>
            )}
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#FAF5EC] leading-tight">
              Selamat Datang, {user?.name || 'Administrator Lab TI'}!
            </h2>
            <p className="text-xs sm:text-sm text-[#DFCDB5] mt-2 leading-relaxed font-sans">
              {isAdmin
                ? 'Pusat kendali & monitor infrastruktur MiraiGrid: pantau total kapasitas host server, alokasi container, pemakaian database, dan distribusi resource tiap akun mahasiswa.'
                : 'Pusat kontrol mandiri praktikum MiraiGrid dengan antarmuka cPanel Tools: kelola berkas, inisialisasi deployment multi-engine, dan kontrol database terisolasi.'}
            </p>
          </div>

          {/* cPanel Live Search Tools Input */}
          <div className="w-full md:w-80 shrink-0">
            <label className="block text-[11px] font-semibold text-[#DFCDB5]/80 uppercase tracking-wider mb-1.5 font-mono">
              Cari Tools & Fitur
            </label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3.5 top-3 text-[#A47E65]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari file, php, database, wizard (/)..."
                className="w-full bg-[#1C0F0A] border border-[#4D2D1E] focus:border-[#C49767] rounded-2xl pl-10 pr-9 py-2.5 text-xs text-[#FAF5EC] placeholder-[#A47E65] outline-none transition shadow-inner font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-[#A47E65] hover:text-[#FAF5EC] p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-[#A47E65] mt-1 font-mono">
              {searchQuery ? `Memfilter ${filteredGroups.reduce((acc, g) => acc + g.tools.length, 0)} tools` : 'Ketik untuk filter instan tools di bawah'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. STATISTIK: MONITOR KAPASITAS SERVER (ADMIN) ATAU KUOTA MAHASISWA */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
          <h3 className="text-lg font-serif font-bold text-[#26160F] flex items-center space-x-2">
            {isAdmin ? (
              <>
                <Activity className="h-5 w-5 text-emerald-800" />
                <span>Monitor Kapasitas & Infrastruktur Global Lab</span>
              </>
            ) : (
              <span>Alokasi Kuota & Resource Praktikum</span>
            )}
          </h3>
          <span className="text-xs font-mono text-[#5C3B29] font-medium flex items-center space-x-1.5">
            {isAdmin ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Host Server Labdocker • Tanpa Batas Alokasi (Akses Root)</span>
              </>
            ) : (
              <span>Terisolasi per Mahasiswa</span>
            )}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : isAdmin ? (
          /* TAMPILAN ADMIN: MONITOR SELURUH KAPASITAS INFRASTRUKTUR SERVER */
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Host Server Storage Meter */}
              <div
                onClick={() => onNavigate('/disk-usage')}
                className="bg-[#2B1810] border border-[#4D2D1E] hover:border-emerald-600/50 p-5 rounded-3xl shadow-xl text-[#FAF5EC] cursor-pointer transition group"
              >
                <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                  <span className="text-xs font-semibold group-hover:text-[#FAF5EC]">Total Storage Server</span>
                  <HardDrive className="h-4 w-4 text-[#E8DCB8] group-hover:scale-110 transition" />
                </div>
                <div className="text-2xl font-black text-[#FAF5EC] font-sans">
                  {systemCapacity?.host?.disk_used_gb ?? '8.6'} <span className="text-xs text-[#DFCDB5]/70 font-normal">/ {systemCapacity?.host?.disk_total_gb ?? '116'} GB</span>
                </div>
                <div className="w-full bg-[#1C0F0A] h-2 rounded-full mt-3 overflow-hidden border border-[#3D2316]">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, systemCapacity?.host?.disk_percent ?? 8)}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-[#DFCDB5]/70 mt-2 font-mono flex items-center justify-between">
                  <span>Sisa Free: {systemCapacity?.host?.disk_free_gb ?? '107.4'} GB</span>
                  <span className="text-emerald-400 font-bold">{systemCapacity?.host?.disk_percent ?? 8}%</span>
                </p>
              </div>

              {/* 2. Host RAM Meter */}
              <div className="bg-[#2B1810] border border-[#4D2D1E] p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
                <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                  <span className="text-xs font-semibold">Total RAM Server</span>
                  <Cpu className="h-4 w-4 text-[#E8DCB8]" />
                </div>
                <div className="text-2xl font-black text-[#FAF5EC] font-sans">
                  {((systemCapacity?.host?.mem_used_mb ?? 1638) / 1024).toFixed(1)} <span className="text-xs text-[#DFCDB5]/70 font-normal">/ {((systemCapacity?.host?.mem_total_mb ?? 11264) / 1024).toFixed(1)} GB</span>
                </div>
                <div className="w-full bg-[#1C0F0A] h-2 rounded-full mt-3 overflow-hidden border border-[#3D2316]">
                  <div
                    className="bg-[#C49767] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, systemCapacity?.host?.mem_percent ?? 15)}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-[#DFCDB5]/70 mt-2 font-mono flex items-center justify-between">
                  <span>Host & Containers OS</span>
                  <span className="text-[#E8DCB8] font-bold">{systemCapacity?.host?.mem_percent ?? 15}%</span>
                </p>
              </div>

              {/* 3. Global Containers Meter */}
              <div
                onClick={() => onNavigate('/deploy')}
                className="bg-[#2B1810] border border-[#4D2D1E] hover:border-indigo-500/50 p-5 rounded-3xl shadow-xl text-[#FAF5EC] cursor-pointer transition group"
              >
                <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                  <span className="text-xs font-semibold group-hover:text-[#FAF5EC]">Container Mahasiswa</span>
                  <Layers className="h-4 w-4 text-[#E8DCB8] group-hover:scale-110 transition" />
                </div>
                <div className="text-2xl font-black text-[#FAF5EC] font-sans flex items-baseline space-x-2">
                  <span>{systemCapacity?.host?.total_projects ?? projects.length}</span>
                  <span className="text-xs text-emerald-400 font-mono font-medium">({systemCapacity?.host?.running_projects ?? 0} Running)</span>
                </div>
                <div className="w-full bg-[#1C0F0A] h-2 rounded-full mt-3 overflow-hidden border border-[#3D2316]">
                  <div className="bg-indigo-400 h-full rounded-full w-full"></div>
                </div>
                <p className="text-[11px] text-[#DFCDB5]/70 mt-2 font-mono">
                  {systemCapacity?.host?.total_students ?? 0} Mahasiswa Terdaftar
                </p>
              </div>

              {/* 4. Global Databases Meter */}
              <div
                onClick={() => onNavigate('/databases')}
                className="bg-[#2B1810] border border-[#4D2D1E] hover:border-amber-500/50 p-5 rounded-3xl shadow-xl text-[#FAF5EC] cursor-pointer transition group"
              >
                <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                  <span className="text-xs font-semibold group-hover:text-[#FAF5EC]">Database Server</span>
                  <Database className="h-4 w-4 text-[#E8DCB8] group-hover:scale-110 transition" />
                </div>
                <div className="text-2xl font-black text-[#FAF5EC] font-sans">
                  {systemCapacity?.host?.total_databases ?? databases.length} <span className="text-xs text-[#DFCDB5]/70 font-normal">DB Aktif</span>
                </div>
                <div className="w-full bg-[#1C0F0A] h-2 rounded-full mt-3 overflow-hidden border border-[#3D2316]">
                  <div className="bg-amber-400 h-full rounded-full w-full"></div>
                </div>
                <p className="text-[11px] text-[#DFCDB5]/70 mt-2 font-mono">
                  {systemCapacity?.host?.total_databases_postgres ?? 0} PG • {systemCapacity?.host?.total_databases_mariadb ?? 0} MariaDB
                </p>
              </div>
            </div>

            {/* PEMBAGIAN TIAP AKUN MAHASISWA (PER-ACCOUNT CAPACITY DISTRIBUTION) */}
            <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 shadow-2xl text-[#FAF5EC]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#3D2316]">
                <div>
                  <h4 className="text-base font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
                    <Users className="h-4 w-4 text-[#C49767]" />
                    <span>Pembagian & Penggunaan Tiap Akun Mahasiswa</span>
                  </h4>
                  <p className="text-xs text-[#DFCDB5] mt-0.5 font-sans">
                    Pantau alokasi container, database praktikum, dan estimasi storage per mahasiswa secara transparan.
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="relative w-full sm:w-64">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-[#A47E65]" />
                    <input
                      type="text"
                      value={accountSearchQuery}
                      onChange={(e) => setAccountSearchQuery(e.target.value)}
                      placeholder="Cari NIM, Nama, Kelas..."
                      className="w-full bg-[#1C0F0A] border border-[#3E2316] focus:border-[#C49767] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#FAF5EC] placeholder-[#A47E65] outline-none font-sans"
                    />
                  </div>
                  <button
                    onClick={() => onNavigate('/disk-usage')}
                    className="px-3.5 py-1.5 bg-[#3E2316] hover:bg-[#5A3521] border border-[#5C3825] rounded-xl text-xs text-[#FAF5EC] font-semibold transition shrink-0"
                  >
                    Detail Storage
                  </button>
                </div>
              </div>

              {/* Table of Accounts */}
              <div className="border border-[#3E2316] rounded-2xl overflow-hidden bg-[#1C0F0A]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#160C08] border-b border-[#3E2316] text-[#A47E65] font-mono text-[11px]">
                    <tr>
                      <th className="p-3">Akun / NIM</th>
                      <th className="p-3">Nama Mahasiswa</th>
                      <th className="p-3">Kelas / Angkatan</th>
                      <th className="p-3 text-center">Web Projects</th>
                      <th className="p-3 text-center">Databases</th>
                      <th className="p-3 text-right">Est. Storage</th>
                      <th className="p-3 text-center">Status Akun</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F1A10]">
                    {filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-[#A47E65] font-sans">
                          Tidak ada akun yang sesuai dengan pencarian "{accountSearchQuery}".
                        </td>
                      </tr>
                    ) : (
                      filteredAccounts.map((acc) => (
                        <tr key={acc.id} className="hover:bg-[#25150E] transition">
                          <td className="p-3 font-mono font-bold text-[#FAF5EC] flex items-center space-x-2">
                            <span>{acc.username}</span>
                            {acc.role === 'admin' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60 font-mono">
                                Admin
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-[#DFCDB5] font-medium">{acc.name}</td>
                          <td className="p-3 text-[#A47E65] font-mono text-[11px]">
                            {acc.class_name ? `${acc.class_name} (${acc.cohort_year || 'Aktif'})` : 'Superadmin'}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-xs ${
                              acc.project_count > 0 ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-bold' : 'text-[#A47E65]'
                            }`}>
                              {acc.project_count} slot
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-xs ${
                              acc.database_count > 0 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold' : 'text-[#A47E65]'
                            }`}>
                              {acc.database_count} DB
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-[#E8DCB8] font-semibold">
                            {acc.estimated_disk_mb} MB
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono ${
                              acc.is_active ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60' : 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                            }`}>
                              {acc.is_active ? '● Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* TAMPILAN MAHASISWA: KUOTA PERSONAL */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Projects Meter */}
            <div
              onClick={() => onNavigate('/deploy')}
              className="bg-[#2B1810] border border-[#4D2D1E] hover:border-[#6D4029] p-5 rounded-3xl shadow-xl text-[#FAF5EC] cursor-pointer transition group"
            >
              <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                <span className="text-xs font-semibold group-hover:text-[#FAF5EC]">Web Projects</span>
                <Layers className="h-4 w-4 text-[#E8DCB8] group-hover:scale-110 transition" />
              </div>
              <div className="text-2xl font-black text-[#FAF5EC] font-sans">
                {quota?.used_projects ?? projects.length} <span className="text-xs text-[#DFCDB5]/70 font-normal">/ {quota?.max_projects ?? 2} slot</span>
              </div>
              <div className="w-full bg-[#1C0F0A] h-2 rounded-full mt-3 overflow-hidden border border-[#3D2316]">
                <div
                  className="bg-[#C49767] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (((quota?.used_projects ?? projects.length) || 0) / (quota?.max_projects || 2)) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Databases Meter */}
            <div
              onClick={() => onNavigate('/databases')}
              className="bg-[#2B1810] border border-[#4D2D1E] hover:border-[#6D4029] p-5 rounded-3xl shadow-xl text-[#FAF5EC] cursor-pointer transition group"
            >
              <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                <span className="text-xs font-semibold group-hover:text-[#FAF5EC]">Databases</span>
                <Database className="h-4 w-4 text-[#E8DCB8] group-hover:scale-110 transition" />
              </div>
              <div className="text-2xl font-black text-[#FAF5EC] font-sans">
                {quota?.used_databases ?? databases.length} <span className="text-xs text-[#DFCDB5]/70 font-normal">/ {quota?.max_databases ?? 2} DB</span>
              </div>
              <div className="w-full bg-[#1C0F0A] h-2 rounded-full mt-3 overflow-hidden border border-[#3D2316]">
                <div
                  className="bg-[#C49767] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (((quota?.used_databases ?? databases.length) || 0) / (quota?.max_databases || 2)) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Memory Allocation */}
            <div className="bg-[#2B1810] border border-[#4D2D1E] p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
              <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                <span className="text-xs font-semibold">Limit RAM Container</span>
                <Cpu className="h-4 w-4 text-[#E8DCB8]" />
              </div>
              <div className="text-2xl font-black text-[#FAF5EC] font-sans">
                {quota?.max_memory_mb ?? 256} <span className="text-xs text-[#DFCDB5]/70 font-normal">MB / project</span>
              </div>
              <p className="text-[11px] text-[#DFCDB5]/70 mt-2 font-mono">Isolasi OOM killer aktif.</p>
            </div>

            {/* Disk Storage Quick Meter */}
            <div
              onClick={() => onNavigate('/disk-usage')}
              className="bg-[#2B1810] border border-[#4D2D1E] hover:border-[#6D4029] p-5 rounded-3xl shadow-xl text-[#FAF5EC] cursor-pointer transition group"
            >
              <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                <span className="text-xs font-semibold group-hover:text-[#FAF5EC]">Disk Usage</span>
                <PieChart className="h-4 w-4 text-[#E8DCB8] group-hover:scale-110 transition" />
              </div>
              <div className="text-2xl font-black text-[#FAF5EC] font-sans">
                {diskUsedMb} <span className="text-xs text-[#DFCDB5]/70 font-normal">/ {diskTotalMb} MB</span>
              </div>
              <div className="w-full bg-[#1C0F0A] h-2 rounded-full mt-3 overflow-hidden border border-[#3D2316]">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${diskPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. CPANEL STYLE CARD SECTIONS (Files, Deployment, Databases) */}
      <div className="space-y-6">
        {filteredGroups.length === 0 ? (
          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-8 text-center text-[#DFCDB5]">
            <Search className="h-8 w-8 mx-auto text-[#A47E65] mb-2" />
            <p className="text-sm font-semibold text-[#FAF5EC]">Tidak ada tools yang cocok dengan "{searchQuery}"</p>
            <p className="text-xs text-[#A47E65] mt-1">Coba gunakan kata kunci lain seperti: file, php, python, node, atau database.</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-[#3A2216] hover:bg-[#4D2E1F] text-xs text-[#FAF5EC] rounded-xl transition"
            >
              Reset Pencarian
            </button>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const GroupIcon = group.icon
            const isCollapsed = collapsedSections[group.id]

            return (
              <section
                key={group.id}
                className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl overflow-hidden transition-all duration-200"
              >
                {/* Section Header ala cPanel Jupiter Header Card */}
                <div
                  onClick={() => toggleSection(group.id)}
                  className="flex items-center justify-between px-6 py-4 bg-[#23130C] border-b border-[#3D2316] cursor-pointer hover:bg-[#28160E] transition select-none"
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-xl bg-[#3A2116] border border-[#523120] flex items-center justify-center text-[#E8DCB8]">
                      <GroupIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-base font-serif font-bold text-[#FAF5EC] tracking-wide">
                        {group.title}
                      </h4>
                      <p className="text-[11px] text-[#A47E65] hidden sm:block">
                        {group.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1C0F0A] text-[#DFCDB5]/70 border border-[#3A2216]">
                      {group.tools.length} Tools
                    </span>
                    <button
                      type="button"
                      className="p-1 text-[#A47E65] hover:text-[#FAF5EC] transition"
                    >
                      {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Grid of Tools ala cPanel Grid */}
                {!isCollapsed && (
                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.tools.map((tool) => {
                        const ToolIcon = tool.icon
                        return (
                          <div
                            key={tool.id}
                            onClick={tool.action}
                            className="flex flex-col justify-between p-4 rounded-2xl bg-[#1F110B] border border-[#3E2316] hover:border-[#C49767]/80 hover:bg-[#25150D] hover:shadow-xl transition-all duration-200 group cursor-pointer relative"
                          >
                            <div>
                              {/* Top Bar inside Tool Item */}
                              <div className="flex items-start justify-between mb-3">
                                <div
                                  className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${tool.bgGradient} border border-[#5A3521] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200`}
                                >
                                  <ToolIcon className={`h-5 w-5 ${tool.iconColor}`} />
                                </div>

                                {tool.badge && (
                                  <span
                                    className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border font-mono ${tool.badgeColor}`}
                                  >
                                    {tool.badge}
                                  </span>
                                )}
                              </div>

                              {/* Title & Description */}
                              <h5 className="text-sm font-bold text-[#FAF5EC] group-hover:text-[#E8DCB8] transition-colors flex items-center space-x-1.5 font-sans">
                                <span>{tool.title}</span>
                                {tool.isExternal && (
                                  <ExternalLink className="h-3 w-3 text-[#A47E65] group-hover:text-[#E8DCB8] transition" />
                                )}
                              </h5>
                              <p className="text-xs text-[#DFCDB5]/75 mt-1 leading-relaxed font-sans line-clamp-2">
                                {tool.description}
                              </p>
                            </div>

                            {/* Bottom subtle action indicator */}
                            <div className="mt-4 pt-3 border-t border-[#2F1A10] flex items-center justify-between text-[11px] text-[#A47E65] group-hover:text-[#E8DCB8] font-medium transition-colors">
                              <span>Buka Fitur</span>
                              <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
