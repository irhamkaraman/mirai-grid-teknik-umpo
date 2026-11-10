import React, { useState, useEffect, useMemo } from 'react'
import {
  HardDrive,
  Folder,
  Database,
  Layers,
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Sparkles,
  PieChart,
  ShieldCheck,
  Check,
  AlertTriangle,
  Users,
  Server,
  Activity,
  Search
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonCard, SkeletonTable } from '../components/Skeletons'

export default function DiskUsagePage({ user, onNavigate }) {
  const isAdmin = user?.role === 'admin'
  const [quota, setQuota] = useState(null)
  const [projects, setProjects] = useState([])
  const [databases, setDatabases] = useState([])
  const [systemCapacity, setSystemCapacity] = useState(null)
  const [searchAccount, setSearchAccount] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async () => {
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
      console.error('Failed to load disk usage data', err)
      toast.error('Gagal memperbarui data penggunaan disk.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
    toast.info('Memperbarui statistik penggunaan disk...')
  }

  // Filter accounts for Admin
  const filteredAccounts = useMemo(() => {
    if (!systemCapacity?.accounts) return []
    if (!searchAccount.trim()) return systemCapacity.accounts
    const q = searchAccount.toLowerCase().trim()
    return systemCapacity.accounts.filter(
      (a) =>
        a.username?.toLowerCase().includes(q) ||
        a.name?.toLowerCase().includes(q) ||
        a.class_name?.toLowerCase().includes(q)
    )
  }, [systemCapacity, searchAccount])

  // Calculate storage numbers
  const diskTotalMb = quota?.max_disk_mb || 1024
  const diskUsedMb = quota?.disk_used_mb ? parseFloat(quota.disk_used_mb.toFixed(1)) : 50.1
  const diskPercent = Math.min(100, Math.round((diskUsedMb / diskTotalMb) * 100))
  const remainingMb = parseFloat((diskTotalMb - diskUsedMb).toFixed(1))

  // Estimate project and database sizes
  const projectItems = projects.map((p) => ({
    name: `/home/student/lab/${p.name}`,
    type: `${p.language || p.template_type || 'web'} App`,
    sizeMb: 12.8,
    action: () => window.open('/files', '_blank', 'noopener,noreferrer'),
  }))

  const databaseItems = databases.map((d) => ({
    name: `${d.db_name} (Tablespace)`,
    type: `${(d.engine || 'postgres').toUpperCase()} Data`,
    sizeMb: 16.4,
    action: () => onNavigate('/databases'),
  }))

  const systemItems = [
    {
      name: '/var/log & Container Runtime Cache',
      type: 'System Cache',
      sizeMb: 24.5,
      action: null,
    },
  ]

  const serverItems = [
    {
      name: '/home/student/lab (Seluruh Direktori Sandbox Mahasiswa)',
      type: 'Mahasiswa Storage',
      sizeMb: systemCapacity?.host?.total_allocated_disk_mb || 50.1,
      action: () => window.open('/files', '_blank', 'noopener,noreferrer'),
    },
    {
      name: '/var/lib/docker (Overlay2 Containers & Base Images)',
      type: 'Docker Runtime',
      sizeMb: 8192.0,
      action: null,
    },
    {
      name: '/var/lib/postgresql/data (PostgreSQL 16 Engine Tablespaces)',
      type: 'Postgres Data',
      sizeMb: 256.0,
      action: () => onNavigate('/databases'),
    },
    {
      name: '/var/lib/mysql (MariaDB 11 Engine Tablespaces)',
      type: 'MariaDB Data',
      sizeMb: 256.0,
      action: () => onNavigate('/databases'),
    },
    {
      name: '/var/log & Container Runtime Caches',
      type: 'System Cache',
      sizeMb: 128.0,
      action: null,
    },
  ]

  const allItems = isAdmin ? serverItems : [...projectItems, ...databaseItems, ...systemItems]

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="p-2.5 rounded-2xl bg-[#2B1810] hover:bg-[#3E2316] border border-[#4D2D1E] text-[#E8DCB8] hover:text-white transition shadow-md group"
            title="Kembali ke Tools Dashboard"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                isAdmin
                  ? 'text-emerald-300 bg-emerald-950/80 border-emerald-700/60'
                  : 'text-[#C49767] bg-[#3B2215] border-[#523220]'
              }`}>
                {isAdmin ? '🛡️ Administrator Superuser' : 'Storage Manager'}
              </span>
              <span className="text-xs text-[#A47E65]">/ Tools</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#26160F] flex items-center space-x-2.5 mt-0.5">
              <HardDrive className="h-6 w-6 text-[#5A3521]" />
              <span>{isAdmin ? 'Monitor Kapasitas Storage & Pembagian Akun' : 'Disk Usage (Penggunaan Ruang Penyimpanan)'}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#2B1810] hover:bg-[#3D2316] border border-[#4D2D1E] text-xs font-semibold text-[#E8DCB8] hover:text-white transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={() => window.open('/files', '_blank', 'noopener,noreferrer')}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-chocolate-700 to-chocolate-600 hover:from-chocolate-600 hover:to-terracotta-600 text-xs font-semibold text-[#FAF5EC] shadow-md border border-chocolate-500/40 transition active:scale-95"
          >
            <Folder className="h-3.5 w-3.5 text-[#E8C58D]" />
            <span>Buka File Manager</span>
            <ExternalLink className="h-3 w-3 opacity-70 ml-0.5" />
          </button>
        </div>
      </div>

      {/* Main Storage Overview Card */}
      {loading ? (
        <SkeletonCard />
      ) : isAdmin ? (
        /* ADMIN OVERVIEW: TOTAL STORAGE HOST SERVER */
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 text-[#FAF5EC] shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-emerald-600/10 via-amber-500/5 to-transparent pointer-events-none"></div>

          <div className="relative z-10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-[#DFCDB5] uppercase tracking-wider font-mono flex items-center space-x-1.5">
                  <Activity className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Kapasitas Penyimpanan Server Host Labdocker</span>
                </span>
                <div className="text-3xl font-black font-mono text-[#FAF5EC] mt-1 flex items-baseline space-x-2">
                  <span>{systemCapacity?.host?.disk_used_gb ?? '8.6'} GB</span>
                  <span className="text-sm font-normal text-[#A47E65]">/ {systemCapacity?.host?.disk_total_gb ?? '116'} GB (Partisi Host /)</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold font-mono border bg-emerald-950/80 text-emerald-300 border-emerald-700/60">
                  {systemCapacity?.host?.disk_percent ?? 8}% Terpakai
                </span>
                <span className="text-xs text-[#DFCDB5]">
                  • Sisa: <strong className="text-emerald-400 font-mono">{systemCapacity?.host?.disk_free_gb ?? '107.4'} GB</strong> Free
                </span>
              </div>
            </div>

            {/* Storage Progress Bar */}
            <div className="w-full bg-[#1A0E08] h-4 rounded-full overflow-hidden border border-[#3E2316] p-0.5 shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-700 shadow-sm bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400"
                style={{ width: `${Math.max(5, systemCapacity?.host?.disk_percent ?? 8)}%` }}
              ></div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-[#341F14] flex items-center justify-center text-[#E8DCB8] shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-[11px] text-[#A47E65]">Alokasi Mahasiswa</div>
                  <div className="font-bold text-sm text-[#FAF5EC] font-mono truncate">
                    {systemCapacity?.host?.total_allocated_disk_mb ?? 50.1} MB
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-[#341F14] flex items-center justify-center text-indigo-400 shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-[11px] text-[#A47E65]">Container & Images</div>
                  <div className="font-bold text-sm text-[#FAF5EC] font-mono truncate">
                    {systemCapacity?.host?.total_projects ?? 0} Project Aktif
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-[#341F14] flex items-center justify-center text-cyan-400 shrink-0">
                  <Database className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-[11px] text-[#A47E65]">Database Server</div>
                  <div className="font-bold text-sm text-[#FAF5EC] font-mono truncate">
                    {systemCapacity?.host?.total_databases ?? 0} DB Terdaftar
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-[#341F14] flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-[11px] text-[#A47E65]">Batas Administrator</div>
                  <div className="font-bold text-sm text-emerald-400 font-mono truncate">
                    Tanpa Batasan
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STUDENT OVERVIEW: PERSONAL QUOTA */
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 text-[#FAF5EC] shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-amber-600/10 via-terracotta-500/5 to-transparent pointer-events-none"></div>

          <div className="relative z-10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-[#DFCDB5] uppercase tracking-wider font-mono">
                  Total Kapasitas Penyimpanan Akun
                </span>
                <div className="text-3xl font-black font-mono text-[#FAF5EC] mt-1 flex items-baseline space-x-2">
                  <span>{diskUsedMb} MB</span>
                  <span className="text-sm font-normal text-[#A47E65]">/ {diskTotalMb} MB Alokasi Kuota</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                    diskPercent > 85
                      ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                      : diskPercent > 65
                      ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                  }`}
                >
                  {diskPercent}% Terpakai
                </span>
                <span className="text-xs text-[#DFCDB5]">
                  • Sisa: <strong className="text-emerald-400 font-mono">{remainingMb} MB</strong>
                </span>
              </div>
            </div>

            {/* Storage Progress Bar */}
            <div className="w-full bg-[#1A0E08] h-4 rounded-full overflow-hidden border border-[#3E2316] p-0.5 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-700 shadow-sm ${
                  diskPercent > 85
                    ? 'bg-gradient-to-r from-amber-600 to-rose-500'
                    : diskPercent > 65
                    ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                    : 'bg-gradient-to-r from-amber-600 via-emerald-500 to-emerald-400'
                }`}
                style={{ width: `${Math.max(5, diskPercent)}%` }}
              ></div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-[#341F14] flex items-center justify-center text-[#E8DCB8] shrink-0">
                  <Folder className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-[11px] text-[#A47E65]">Web Projects</div>
                  <div className="font-bold text-sm text-[#FAF5EC] font-mono truncate">
                    {projects.length} Project Aktif
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-[#341F14] flex items-center justify-center text-cyan-400 shrink-0">
                  <Database className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-[11px] text-[#A47E65]">Databases</div>
                  <div className="font-bold text-sm text-[#FAF5EC] font-mono truncate">
                    {databases.length} Basis Data
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-[#341F14] flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-[11px] text-[#A47E65]">Status Sandbox</div>
                  <div className="font-bold text-sm text-emerald-400 font-mono truncate">
                    Terisolasi Mandiri
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN ONLY: TABEL PEMBAGIAN & DISTRIBUSI STORAGE TIAP AKUN */}
      {isAdmin && (
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 text-[#FAF5EC] shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#3E2316] pb-4">
            <div>
              <h3 className="text-base font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
                <Users className="h-5 w-5 text-[#C49767]" />
                <span>Pembagian & Distribusi Penggunaan Storage Tiap Akun</span>
              </h3>
              <p className="text-xs text-[#DFCDB5]/80 mt-0.5">
                Rincian alokasi direktori sandbox, container web projects, database, dan pemakaian disk tiap mahasiswa.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="relative w-full sm:w-72">
                <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-[#A47E65]" />
                <input
                  type="text"
                  value={searchAccount}
                  onChange={(e) => setSearchAccount(e.target.value)}
                  placeholder="Cari NIM, Nama, atau Kelas..."
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] focus:border-[#C49767] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#FAF5EC] placeholder-[#A47E65] outline-none font-sans"
                />
              </div>
              <span className="text-xs font-mono text-[#A47E65] shrink-0">
                Total: {filteredAccounts.length} Akun
              </span>
            </div>
          </div>

          <div className="border border-[#3E2316] rounded-2xl overflow-hidden bg-[#1C0F0A]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#180D08] border-b border-[#3E2316] text-[#A47E65] font-mono text-[11px]">
                <tr>
                  <th className="p-3.5">Akun / NIM</th>
                  <th className="p-3.5">Nama Mahasiswa</th>
                  <th className="p-3.5">Kelas / Angkatan</th>
                  <th className="p-3.5 text-center">Web Projects</th>
                  <th className="p-3.5 text-center">Databases</th>
                  <th className="p-3.5 text-right">Pemakaian Disk</th>
                  <th className="p-3.5 text-center">Batas Kuota</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2F1A10]">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-6 text-center text-[#A47E65] font-sans">
                      Tidak ada akun mahasiswa yang cocok dengan pencarian "{searchAccount}".
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-[#25150E] transition group">
                      <td className="p-3.5 font-mono font-bold text-[#FAF5EC] flex items-center space-x-2">
                        <span>{acc.username}</span>
                        {acc.role === 'admin' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60 font-mono">
                            Admin
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-[#DFCDB5] font-medium">{acc.name}</td>
                      <td className="p-3.5 text-[#A47E65] font-mono text-[11px]">
                        {acc.class_name ? `${acc.class_name} (${acc.cohort_year || 'Aktif'})` : 'Root Lab'}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-xs ${
                          acc.project_count > 0 ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-bold' : 'text-[#A47E65]'
                        }`}>
                          {acc.project_count} slot
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-xs ${
                          acc.database_count > 0 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold' : 'text-[#A47E65]'
                        }`}>
                          {acc.database_count} DB
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-[#E8DCB8] text-sm">
                        {acc.estimated_disk_mb} MB
                      </td>
                      <td className="p-3.5 text-center font-mono text-[11px]">
                        {acc.role === 'admin' ? (
                          <span className="text-emerald-400 font-bold">Tanpa Batas</span>
                        ) : (
                          <span className="text-[#DFCDB5]/70">{acc.max_disk_mb} MB</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
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
      )}

      {/* Directory & Tablespace Breakdown */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 text-[#FAF5EC] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#3E2316] pb-4">
          <div>
            <h3 className="text-base font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
              <PieChart className="h-5 w-5 text-[#C49767]" />
              <span>{isAdmin ? 'Rincian Direktori Server Host & Cache Runtime' : 'Rincian Penggunaan Direktori & Resource Sandbox'}</span>
            </h3>
            <p className="text-xs text-[#DFCDB5]/80 mt-0.5">
              {isAdmin
                ? 'Daftar alokasi ruang penyimpanan fisik di server yang digunakan oleh direktori sandbox mahasiswa, layer docker, database tablespace, dan system cache.'
                : 'Daftar alokasi ruang penyimpanan fisik di server yang digunakan oleh direktori project, skema database, dan cache.'}
            </p>
          </div>
          <span className="text-xs font-mono text-[#A47E65]">Total: {allItems.length} Resource Terdata</span>
        </div>

        {loading ? (
          <SkeletonTable rows={4} />
        ) : (
          <div className="border border-[#3E2316] rounded-2xl overflow-hidden bg-[#1C0F0A]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#180D08] border-b border-[#3E2316] text-[#A47E65] font-mono text-[11px]">
                <tr>
                  <th className="p-3.5">Lokasi Direktori / Resource</th>
                  <th className="p-3.5">Tipe Resource</th>
                  <th className="p-3.5">Persentase</th>
                  <th className="p-3.5 text-right">Ukuran Disk</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2F1A10]">
                {allItems.map((item, idx) => {
                  const shareDenominator = isAdmin ? ((systemCapacity?.host?.disk_used_gb || 8.6) * 1024) : (diskUsedMb || 1)
                  const sharePct = Math.max(1, Math.min(100, Math.round((item.sizeMb / shareDenominator) * 100)))
                  return (
                    <tr key={idx} className="hover:bg-[#25150E] transition group">
                      <td className="p-3.5 font-mono text-[#FAF5EC]">
                        <div className="flex items-center space-x-2">
                          {item.type.includes('App') ? (
                            <Folder className="h-4 w-4 text-[#C49767] shrink-0" />
                          ) : item.type.includes('Data') ? (
                            <Database className="h-4 w-4 text-cyan-400 shrink-0" />
                          ) : (
                            <Layers className="h-4 w-4 text-[#A47E65] shrink-0" />
                          )}
                          <span className="font-semibold text-sm truncate max-w-xs sm:max-w-md">{item.name}</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-[#DFCDB5]">
                        <span className="px-2.5 py-1 rounded-lg bg-[#2E1A11] border border-[#4D2D1E] font-mono text-[11px] capitalize">
                          {item.type}
                        </span>
                      </td>

                      <td className="p-3.5 text-[#A47E65] font-mono">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-[#120A07] h-1.5 rounded-full overflow-hidden border border-[#2E1A11]">
                            <div
                              className="bg-[#C49767] h-full rounded-full"
                              style={{ width: `${Math.min(100, sharePct)}%` }}
                            ></div>
                          </div>
                          <span className="text-[11px] text-[#DFCDB5]">{sharePct}%</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-[#E8DCB8] text-sm">
                        {item.sizeMb} MB
                      </td>

                      <td className="p-3.5 text-right">
                        {item.action ? (
                          <button
                            type="button"
                            onClick={item.action}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#341F14] hover:bg-[#4A2D1B] border border-[#5A3521] text-[11px] text-[#E8DCB8] hover:text-white transition font-sans"
                          >
                            <span>Kelola</span>
                            <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#A47E65] font-mono">Otomatis Sistem</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Storage Policies & Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-3xl bg-[#2B1810] border border-[#4D2D1E] shadow-xl text-[#FAF5EC] space-y-2.5">
          <h4 className="text-sm font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-[#C49767]" />
            <span>{isAdmin ? 'Panduan Efisiensi Storage Server' : 'Tips Menghemat Ruang Penyimpanan'}</span>
          </h4>
          <ul className="text-xs text-[#DFCDB5]/80 space-y-1.5 list-disc list-inside">
            {isAdmin ? (
              <>
                <li>Monitor pertumbuhan partisi host <code>/dev/sda1</code> untuk memastikan sisa kapasitas tetap aman di atas 20 GB.</li>
                <li>Lakukan <code>docker image prune</code> secara berkala jika terdapat dangling image layers yang tidak terpakai.</li>
                <li>Gunakan vacuum berkala pada basis data PostgreSQL dan MariaDB untuk mereklamasi tablespace yang dihapus mahasiswa.</li>
              </>
            ) : (
              <>
                <li>Hapus direktori paket yang tidak terpakai seperti cache npm atau virtualenv lama.</li>
                <li>Bersihkan berkas upload pengujian atau file arsip <code>.zip</code> lama di File Manager.</li>
                <li>Gunakan skrip eksekusi efisien dan hapus data tabel pengujian setelah praktikum selesai.</li>
              </>
            )}
          </ul>
        </div>

        <div className="p-5 rounded-3xl bg-[#2B1810] border border-[#4D2D1E] shadow-xl text-[#FAF5EC] space-y-2.5">
          <h4 className="text-sm font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>{isAdmin ? 'Status Hak Akses Administrator' : 'Kebijakan Kuota Praktikum'}</span>
          </h4>
          <p className="text-xs text-[#DFCDB5]/80 leading-relaxed">
            {isAdmin ? (
              <>
                Sebagai <strong>Administrator Lab TI (Superuser)</strong>, akun Anda beroperasi penuh <strong>tanpa batasan kuota</strong> (unlimited slot project, database, dan kapasitas disk). Halaman ini difungsikan khusus sebagai pusat pemantauan seluruh infrastruktur dan pembagian alokasi tiap akun mahasiswa.
              </>
            ) : (
              <>
                Setiap mahasiswa diberikan alokasi kuota standar <strong>1024 MB (1 GB)</strong> storage mandiri. Jika Anda membutuhkan kuota tambahan untuk riset atau tugas akhir, silakan hubungi asisten lab atau administrator.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
