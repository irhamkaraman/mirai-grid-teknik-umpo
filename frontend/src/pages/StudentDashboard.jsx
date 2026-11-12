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
  ChevronLeft,
  ChevronRight,
  Search,
  Rocket,
  FileCode,
  Code,
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
  CheckCircle2,
  Sliders,
  Settings,
  AlertCircle,
  Filter,
  Clock
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonCard } from '../components/Skeletons'
import { launchDatabaseSSO } from '../utils/sso'
import CpanelSidepanel from '../components/CpanelSidepanel'

export default function StudentDashboard({
  user,
  onNavigate,
  searchQuery = '',
  setSearchQuery = () => {},
}) {
  const isAdmin = user?.role === 'admin'
  const [quota, setQuota] = useState(null)
  const [projects, setProjects] = useState([])
  const [databases, setDatabases] = useState([])
  const [systemCapacity, setSystemCapacity] = useState(null)
  const [accountSearchQuery, setAccountSearchQuery] = useState('')
  const [accountPage, setAccountPage] = useState(1)
  const [accountPageSize, setAccountPageSize] = useState(10)
  const [accountFilterTab, setAccountFilterTab] = useState('all') // 'all', 'filled', 'near_full'
  const [loading, setLoading] = useState(true)

  // Section collapse state (persisted in localStorage or default all open)
  const [collapsedSections, setCollapsedSections] = useState({
    files: false,
    deployment: false,
    databases: false,
    advanced: false,
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
        {
          id: 'git-version-control',
          title: 'Git™ Version Control',
          description: 'Kelola repositori Git mandiri: cloning repository remote, pull update, checkout branch, dan riwayat commit.',
          logo: '/logos/git.svg',
          iconColor: 'text-[#F05032]',
          bgGradient: 'from-[#422216] to-[#2D160E]',
          action: () => onNavigate('/git'),
        },
        {
          id: 'redis-manager',
          title: 'Redis™ Manager',
          description: 'Kelola in-memory data store, high-performance object cache, dan session broker dengan socket terisolasi.',
          badge: 'In-Memory Cache',
          badgeColor: 'bg-red-950/80 text-red-300 border-red-700/60',
          logo: '/logos/redis.svg',
          iconColor: 'text-[#D82C20]',
          bgGradient: 'from-[#421A1A] to-[#2B1010]',
          action: () => onNavigate('/redis'),
        },
        {
          id: 'web-ide-vscode',
          title: 'Web IDE (VS Code)',
          description: 'Ngoding langsung di browser dengan Visual Studio Code lengkap dengan terminal, extensions, dan live preview.',
          badge: 'Baru • Code Server',
          badgeColor: 'bg-blue-950/80 text-blue-300 border-blue-700/60',
          logo: '/logos/vscode.svg',
          iconColor: 'text-[#007ACC]',
          bgGradient: 'from-[#1A2E40] to-[#121E2B]',
          action: () => onNavigate('/vscode'),
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
          logo: '/logos/php.svg',
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
          logo: '/logos/node.svg',
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
          logo: '/logos/python.svg',
          icon: Terminal,
          iconColor: 'text-amber-300',
          bgGradient: 'from-[#1C2C42] to-[#121E2E]',
          action: () => onNavigate('/deploy?create=true&lang=python'),
        },
        {
          id: 'deploy-config',
          title: 'Konfigurasi Deploy',
          description: 'Kelola seluruh container aplikasi web praktikum, environment variable, port routing, dan status runtime.',
          badge: 'Kelola Container',
          badgeColor: 'bg-[#402616] text-[#E8C58D] border-[#683E24]',
          icon: Sliders,
          iconColor: 'text-[#E8C58D]',
          bgGradient: 'from-[#422A1A] to-[#2B1810]',
          action: () => onNavigate('/deploy'),
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
          logo: '/logos/cloudbeaver.svg',
          icon: Layers,
          iconColor: 'text-cyan-300',
          bgGradient: 'from-[#1B363E] to-[#122328]',
          action: () => {
            const isDomain = window.location.hostname.includes('miraigrid.web.id')
            const token = localStorage.getItem('miraigrid_token') || ''
            if (token && isDomain) {
              try {
                document.cookie = `miraigrid_token=${token}; path=/; domain=.miraigrid.web.id; max-age=86400; SameSite=Lax; Secure`
              } catch (e) {
                console.error(e)
              }
            }
            const target = isDomain
              ? `https://cloudbeaver.miraigrid.web.id/sso?token=${encodeURIComponent(token)}`
              : `http://${window.location.hostname}:8978/#/`
            window.open(target, '_blank', 'noopener,noreferrer')
          },
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
          badge: 'MySQL / MariaDB',
          badgeColor: 'bg-[#402616] text-[#E8C58D] border-[#683E24]',
          logo: '/logos/phpmyadmin.png',
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
          badge: 'PostgreSQL 16',
          badgeColor: 'bg-sky-950/80 text-sky-300 border-sky-700/60',
          logo: '/logos/postgres.svg',
          icon: Database,
          iconColor: 'text-sky-300',
          bgGradient: 'from-[#1E3342] to-[#14232E]',
          action: () => launchDatabaseSSO('postgres'),
          isExternal: true,
        },
      ],
    },
    {
      id: 'advanced',
      title: 'Advanced',
      subtitle: 'Pusat konfigurasi lanjutan: Sandbox SSH dedicated, Web Terminal terisolasi, dan penjadwalan otomatisasi Cron Jobs',
      icon: Settings,
      color: 'from-amber-600/20 to-orange-700/10 border-amber-500/30 text-amber-300',
      tools: [
        {
          id: 'ssh',
          title: 'Akses SSH',
          description: 'Akses remote SSH & SFTP dedicated per akun (ssh-<nim>.miraigrid.web.id) untuk remote terminal, port 22, dan instalasi dependencies terisolasi.',
          icon: ShieldCheck,
          iconColor: 'text-amber-300',
          bgGradient: 'from-[#422216] to-[#2D160E]',
          action: () => onNavigate('/ssh'),
        },
        {
          id: 'terminal',
          title: 'Terminal',
          description: 'Akses command line interface (CLI) terisolasi sandbox per akun untuk eksekusi perintah dan skrip.',
          icon: Terminal,
          iconColor: 'text-[#E8DCB8]',
          bgGradient: 'from-[#422216] to-[#2D160E]',
          action: () => onNavigate('/terminal'),
        },
        {
          id: 'cron-jobs',
          title: 'Cron Jobs',
          description: 'Jadwalkan eksekusi script atau perintah otomatis secara berkala sesuai interval waktu tertentu.',
          icon: Clock,
          iconColor: 'text-amber-300',
          bgGradient: 'from-[#3A2216] to-[#24150E]',
          action: () => onNavigate('/cron'),
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

  // Calculate counts for filters
  const accountCounts = useMemo(() => {
    const list = systemCapacity?.accounts || []
    const filled = list.filter(
      (a) => (a.project_count || 0) > 0 || (a.database_count || 0) > 0 || (a.estimated_disk_mb || 0) > 0
    ).length
    const nearFull = list.filter((a) => {
      const projFull = (a.project_count || 0) >= (a.max_projects || 2) && (a.project_count || 0) > 0
      const dbStorageMb = a.estimated_db_storage_mb || ((a.database_count || 0) * 12.5)
      const maxDbStorage = a.max_database_disk_mb || 100
      const dbFull = dbStorageMb >= (maxDbStorage * 0.8) && (a.database_count || 0) > 0
      const diskHigh = (a.estimated_disk_mb || 0) >= ((a.max_disk_mb || 500) * 0.7)
      return (projFull && dbFull) || diskHigh || (projFull && (a.database_count || 0) > 0)
    }).length
    return { all: list.length, filled, nearFull }
  }, [systemCapacity])

  // Filter and sort accounts:
  // "tampilkan akun yang telah terisi dan paling banyak hingga hampir penuh"
  const sortedAndFilteredAccounts = useMemo(() => {
    if (!systemCapacity?.accounts) return []
    let list = [...systemCapacity.accounts]

    // Search query filter
    if (accountSearchQuery.trim()) {
      const q = accountSearchQuery.toLowerCase().trim()
      list = list.filter(
        (a) =>
          a.username?.toLowerCase().includes(q) ||
          a.name?.toLowerCase().includes(q) ||
          a.class_name?.toLowerCase().includes(q)
      )
    }

    // Filter by tab
    if (accountFilterTab === 'filled') {
      list = list.filter(
        (a) => (a.project_count || 0) > 0 || (a.database_count || 0) > 0 || (a.estimated_disk_mb || 0) > 0
      )
    } else if (accountFilterTab === 'near_full') {
      list = list.filter((a) => {
        const projFull = (a.project_count || 0) >= (a.max_projects || 2) && (a.project_count || 0) > 0
        const dbStorageMb = a.estimated_db_storage_mb || ((a.database_count || 0) * 12.5)
        const maxDbStorage = a.max_database_disk_mb || 100
        const dbFull = dbStorageMb >= (maxDbStorage * 0.8) && (a.database_count || 0) > 0
        const diskHigh = (a.estimated_disk_mb || 0) >= ((a.max_disk_mb || 500) * 0.7)
        return (projFull && dbFull) || diskHigh || (projFull && (a.database_count || 0) > 0)
      })
    }

    // Sort: Akun terisi & paling penuh berada di posisi paling atas!
    list.sort((a, b) => {
      // Admin always at top
      if (a.role === 'admin' && b.role !== 'admin') return -1
      if (b.role === 'admin' && a.role !== 'admin') return 1

      const maxDiskA = a.max_disk_mb || 500
      const maxDiskB = b.max_disk_mb || 500
      const diskPctA = (a.estimated_disk_mb || 0) / maxDiskA
      const diskPctB = (b.estimated_disk_mb || 0) / maxDiskB

      const projA = a.project_count || 0
      const projB = b.project_count || 0
      const dbA = a.database_count || 0
      const dbB = b.database_count || 0

      // Fullness score: prioritize accounts with both slots and DBs used, and high disk usage
      const scoreA = (projA * 100) + (dbA * 50) + (diskPctA * 80)
      const scoreB = (projB * 100) + (dbB * 50) + (diskPctB * 80)

      if (scoreB !== scoreA) {
        return scoreB - scoreA
      }
      return (b.estimated_disk_mb || 0) - (a.estimated_disk_mb || 0)
    })

    return list
  }, [systemCapacity, accountSearchQuery, accountFilterTab])

  const totalAccountPages = Math.ceil(sortedAndFilteredAccounts.length / accountPageSize) || 1
  const paginatedAccounts = useMemo(() => {
    const start = (accountPage - 1) * accountPageSize
    return sortedAndFilteredAccounts.slice(start, start + accountPageSize)
  }, [sortedAndFilteredAccounts, accountPage, accountPageSize])

  // Calculation for Disk Usage Modal / Student meter
  const diskTotalMb = quota?.max_disk_mb || 500
  const diskUsedMb = useMemo(() => {
    if (quota?.disk_used_mb !== undefined && quota?.disk_used_mb !== null) {
      return Math.min(diskTotalMb, parseFloat(quota.disk_used_mb.toFixed(1)))
    }
    return 0.0
  }, [quota?.disk_used_mb, diskTotalMb])
  const diskPercent = Math.min(100, Math.round((diskUsedMb / diskTotalMb) * 100))

  // Storage Database calculation (Berdasarkan kapasitas storage, bukan per instance database):
  const dbStorageMaxMb = quota?.max_database_disk_mb || 100
  const dbStorageUsedMb = quota?.used_database_disk_mb ?? parseFloat((databases.length * 12.5).toFixed(1))
  const dbStoragePercent = Math.min(100, Math.round((dbStorageUsedMb / dbStorageMaxMb) * 100))

  return (
    <div className="space-y-8 animate-in fade-in duration-200 w-full">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Tools & Monitoring Utama */}
        <div className="xl:col-span-8 2xl:col-span-9 space-y-6">
          {/* 1. STATISTIK: MONITOR KAPASITAS SERVER (ADMIN) ATAU KUOTA MAHASISWA */}
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
              <span>Host Server Labdocker | Tanpa Batas Alokasi (Akses Root)</span>
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
                  {systemCapacity?.host?.total_databases_postgres ?? 0} PG + {systemCapacity?.host?.total_databases_mariadb ?? 0} MariaDB
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
                      onChange={(e) => {
                        setAccountSearchQuery(e.target.value)
                        setAccountPage(1)
                      }}
                      placeholder="Cari NIM atau Nama Pengguna..."
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

              {/* Filter Tabs / Pills: Semua, Terisi, Hampir Penuh */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => {
                    setAccountFilterTab('all')
                    setAccountPage(1)
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition ${
                    accountFilterTab === 'all'
                      ? 'bg-[#C49767] text-[#1C0F0A] font-bold shadow'
                      : 'bg-[#1C0F0A] text-[#DFCDB5] hover:bg-[#25150E] border border-[#3E2316]'
                  }`}
                >
                  Semua Akun ({accountCounts.all})
                </button>
                <button
                  onClick={() => {
                    setAccountFilterTab('filled')
                    setAccountPage(1)
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition ${
                    accountFilterTab === 'filled'
                      ? 'bg-[#C49767] text-[#1C0F0A] font-bold shadow'
                      : 'bg-[#1C0F0A] text-[#DFCDB5] hover:bg-[#25150E] border border-[#3E2316]'
                  }`}
                >
                  Terisi / Aktif ({accountCounts.filled})
                </button>
                <button
                  onClick={() => {
                    setAccountFilterTab('near_full')
                    setAccountPage(1)
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition ${
                    accountFilterTab === 'near_full'
                      ? 'bg-amber-600 text-amber-950 font-bold shadow'
                      : 'bg-[#1C0F0A] text-amber-400/90 hover:bg-[#25150E] border border-amber-900/40'
                  }`}
                >
                  <span>Hampir Penuh ({accountCounts.nearFull})</span>
                </button>
              </div>

              {/* Table of Accounts */}
              <div className="border border-[#3E2316] rounded-2xl overflow-hidden bg-[#1C0F0A]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#160C08] border-b border-[#3E2316] text-[#A47E65] font-mono text-[11px]">
                    <tr>
                      <th className="p-3">Akun / NIM</th>
                      <th className="p-3">Nama Pengguna</th>
                      <th className="p-3">Role</th>
                      <th className="p-3 text-center">Deployment</th>
                      <th className="p-3 text-center">Databases</th>
                      <th className="p-3 text-right">Est. Storage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F1A10]">
                    {paginatedAccounts.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-6 text-center text-[#A47E65] font-sans">
                          Tidak ada akun yang sesuai dengan filter atau pencarian "{accountSearchQuery}".
                        </td>
                      </tr>
                    ) : (
                      paginatedAccounts.map((acc) => {
                        const isProjFull = (acc.project_count || 0) >= (acc.max_projects || 2) && (acc.project_count || 0) > 0
                        const dbStorageMb = acc.estimated_db_storage_mb || ((acc.database_count || 0) * 12.5)
                        const maxDbStorage = acc.max_database_disk_mb || (acc.role === 'admin' ? 1000 : 100)
                        const isDbFull = dbStorageMb >= (maxDbStorage * 0.85) && (acc.database_count || 0) > 0
                        const maxDisk = acc.max_disk_mb || (acc.role === 'admin' ? 2000 : 5000)
                        const diskRatio = (acc.estimated_disk_mb || 0) / maxDisk
                        const isNearFull = (isProjFull && isDbFull) || diskRatio >= 0.7

                        return (
                          <tr key={acc.id} className="hover:bg-[#25150E] transition">
                            <td className="p-3 font-mono font-bold text-[#FAF5EC] flex items-center space-x-2">
                              <span>{acc.username}</span>
                              {acc.role === 'admin' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60 font-mono">
                                  Admin
                                </span>
                              )}
                              {isNearFull && acc.role !== 'admin' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-600/50 font-sans font-medium">
                                  Hampir Penuh
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-[#DFCDB5] font-medium">{acc.name}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                                acc.role === 'admin'
                                  ? 'bg-[#5A3521] text-[#E8DCB8] border border-[#7D492F]'
                                  : 'bg-[#2A170F] text-[#DFCDB5] border border-[#3E2316]'
                              }`}>
                                {acc.role || 'student'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-xs ${
                                (acc.project_count > 0)
                                  ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-bold'
                                  : 'text-[#A47E65]'
                              }`}>
                                {acc.project_count || 0} Aktif
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-xs ${
                                isDbFull
                                  ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60 font-bold'
                                  : (acc.database_count > 0)
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold'
                                  : 'text-[#A47E65]'
                              }`}>
                                {acc.database_count} DB ({dbStorageMb.toFixed(1)} / {maxDbStorage} MB)
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-mono text-[#FAF5EC] font-semibold text-xs">
                                  {acc.estimated_disk_mb} MB{' '}
                                  <span className="text-[10px] text-[#A47E65] font-normal">
                                    / {maxDisk >= 1000 ? `${(maxDisk / 1000).toFixed(maxDisk % 1000 === 0 ? 0 : 1)} GB` : `${maxDisk} MB`}
                                  </span>
                                </span>
                                <div className="w-24 bg-[#160C08] h-1.5 rounded-full mt-1 overflow-hidden border border-[#3E2316]">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      diskRatio >= 0.8
                                        ? 'bg-rose-500'
                                        : diskRatio >= 0.4
                                        ? 'bg-amber-400'
                                        : 'bg-emerald-400'
                                    }`}
                                    style={{
                                      width: `${Math.min(100, Math.max(acc.estimated_disk_mb > 0 ? 5 : 0, Math.round(diskRatio * 100)))}%`
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>

                {/* Pagination Controls Footer */}
                {sortedAndFilteredAccounts.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#160C08] border-t border-[#3E2316] text-xs text-[#A47E65]">
                    <div className="flex items-center space-x-2">
                      <span>Tampilkan</span>
                      <select
                        value={accountPageSize}
                        onChange={(e) => {
                          setAccountPageSize(Number(e.target.value))
                          setAccountPage(1)
                        }}
                        className="bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-2.5 py-1 text-xs text-[#FAF5EC] focus:outline-none"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                      <span>akun per halaman</span>
                      <span className="text-[#C49767] ml-2 font-mono">
                        (Menampilkan {(accountPage - 1) * accountPageSize + 1} - {Math.min(accountPage * accountPageSize, sortedAndFilteredAccounts.length)} dari {sortedAndFilteredAccounts.length} akun)
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono mr-1">
                        Halaman {accountPage} dari {totalAccountPages}
                      </span>
                      <button
                        onClick={() => setAccountPage((p) => Math.max(1, p - 1))}
                        disabled={accountPage <= 1}
                        className="p-1.5 rounded-xl bg-[#2B1810] border border-[#4D2D1E] text-[#FAF5EC] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#3D2317] transition"
                        title="Halaman Sebelumnya"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      {/* Numeric page buttons */}
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: totalAccountPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === totalAccountPages || Math.abs(p - accountPage) <= 1)
                          .map((p, idx, arr) => (
                            <React.Fragment key={p}>
                              {idx > 0 && arr[idx - 1] !== p - 1 && (
                                <span className="px-1 text-[#A47E65]">...</span>
                              )}
                              <button
                                onClick={() => setAccountPage(p)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-mono transition ${
                                  accountPage === p
                                    ? 'bg-[#C49767] text-[#1C0F0A] font-bold shadow'
                                    : 'bg-[#2B1810] border border-[#4D2D1E] text-[#DFCDB5] hover:bg-[#3D2317]'
                                }`}
                              >
                                {p}
                              </button>
                            </React.Fragment>
                          ))}
                      </div>

                      <button
                        onClick={() => setAccountPage((p) => Math.min(totalAccountPages, p + 1))}
                        disabled={accountPage >= totalAccountPages}
                        className="p-1.5 rounded-xl bg-[#2B1810] border border-[#4D2D1E] text-[#FAF5EC] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#3D2317] transition"
                        title="Halaman Selanjutnya"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* TAMPILAN MAHASISWA: KUOTA PERSONAL */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Deployment Meter (Sebelumnya Web Projects, batasan adalah storage) */}
            <div
              onClick={() => onNavigate('/deploy')}
              className="bg-[#2B1810] border border-[#4D2D1E] hover:border-[#6D4029] p-5 rounded-3xl shadow-xl text-[#FAF5EC] cursor-pointer transition group"
            >
              <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                <span className="text-xs font-semibold group-hover:text-[#FAF5EC]">Deployment</span>
                <Layers className="h-4 w-4 text-[#E8DCB8] group-hover:scale-110 transition" />
              </div>
              <div className="text-2xl font-black text-[#FAF5EC] font-sans">
                {quota?.used_projects ?? projects.length} <span className="text-xs text-[#DFCDB5]/70 font-normal">Aktif</span>
              </div>
              <p className="text-[11px] text-[#DFCDB5]/70 mt-2 font-mono flex items-center justify-between">
                <span>Dibatasi kuota storage</span>
                <span className="text-emerald-400 font-bold">Uncapped Slot</span>
              </p>
            </div>

            {/* Storage Database Meter (Bukan per instance, tapi per kapasitas storage DB) */}
            <div
              onClick={() => onNavigate('/databases')}
              className="bg-[#2B1810] border border-[#4D2D1E] hover:border-[#6D4029] p-5 rounded-3xl shadow-xl text-[#FAF5EC] cursor-pointer transition group"
            >
              <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                <span className="text-xs font-semibold group-hover:text-[#FAF5EC]">Storage Database</span>
                <Database className="h-4 w-4 text-[#E8DCB8] group-hover:scale-110 transition" />
              </div>
              <div className="text-2xl font-black text-[#FAF5EC] font-sans">
                {dbStorageUsedMb} <span className="text-xs text-[#DFCDB5]/70 font-normal">/ {dbStorageMaxMb} MB</span>
              </div>
              <div className="w-full bg-[#1C0F0A] h-2 rounded-full mt-3 overflow-hidden border border-[#3D2316]">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${dbStoragePercent}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-[#DFCDB5]/70 mt-2 font-mono flex items-center justify-between">
                <span>{databases.length} Database aktif</span>
                <span className="text-amber-400 font-bold">{dbStoragePercent}%</span>
              </p>
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

            {/* Storage File Manager Quick Meter */}
            <div
              onClick={() => onNavigate('/disk-usage')}
              className="bg-[#2B1810] border border-[#4D2D1E] hover:border-[#6D4029] p-5 rounded-3xl shadow-xl text-[#FAF5EC] cursor-pointer transition group"
            >
              <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                <span className="text-xs font-semibold group-hover:text-[#FAF5EC]">Storage File Manager</span>
                <HardDrive className="h-4 w-4 text-[#E8DCB8] group-hover:scale-110 transition" />
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
              <p className="text-[11px] text-[#DFCDB5]/70 mt-2 font-mono flex items-center justify-between">
                <span>Web project & files</span>
                <span className="text-emerald-400 font-bold">{diskPercent}%</span>
              </p>
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

                {/* Grid of Tools ala cPanel Grid (Compact: Icon + Title only) */}
                {!isCollapsed && (
                  <div className="p-5 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {group.tools.map((tool) => {
                        const ToolIcon = tool.icon
                        return (
                          <div
                            key={tool.id}
                            onClick={tool.action}
                            className="flex items-center space-x-3.5 p-3 rounded-2xl bg-[#1C0F0A] hover:bg-[#25150D] border border-[#3E2316] hover:border-[#C49767]/80 hover:shadow-md transition-all duration-150 group cursor-pointer"
                          >
                            <div
                              className={`h-10 w-10 rounded-xl bg-gradient-to-br ${tool.bgGradient} border border-[#5A3521] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-150 p-2 shrink-0 overflow-hidden`}
                            >
                              {tool.logo ? (
                                <img
                                  src={tool.logo}
                                  alt={tool.title}
                                  className="max-h-6 max-w-6 h-auto w-auto object-contain filter drop-shadow group-hover:scale-110 transition-transform duration-150"
                                />
                              ) : (
                                <ToolIcon className={`h-5 w-5 ${tool.iconColor}`} />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <span className="text-xs sm:text-sm font-semibold text-[#FAF5EC] group-hover:text-[#E8DCB8] transition-colors truncate block">
                                {tool.title}
                              </span>
                            </div>

                            {tool.isExternal && (
                              <ExternalLink className="h-3.5 w-3.5 text-[#A47E65] group-hover:text-[#E8DCB8] shrink-0 transition" />
                            )}
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

        {/* Kolom Kanan: Sidepanel Kanan Informasi Akun & Statistik ala cPanel */}
        <div className="xl:col-span-4 2xl:col-span-3 sticky top-6">
          <CpanelSidepanel user={user} />
        </div>
      </div>
    </div>
  )
}
