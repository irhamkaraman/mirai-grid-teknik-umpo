import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Box,
  ChevronLeft,
  ChevronRight,
  Cpu,
  ExternalLink,
  Globe,
  HardDrive,
  Play,
  RefreshCw,
  RotateCw,
  Search,
  Server,
  Settings,
  Square,
  Workflow,
  Code2,
  Database,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import Button from '../components/Button'
import { formatMBSize } from '../utils/formatters'

function getTypeIcon(type) {
  switch (type) {
    case 'deployment':
      return Globe
    case 'n8n':
      return Workflow
    case 'thingsboard':
      return Cpu
    case 'vscode':
      return Code2
    case 'database':
      return Database
    default:
      return Box
  }
}

export default function UserDashboardPage({ user: propUser }) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyAction, setBusyAction] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const fetchSummary = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await api.get('/user/dashboard-summary')
      setSummary(res.data)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal memuat ringkasan dashboard personal.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary(false)
  }, [fetchSummary])

  const handleContainerAction = async (containerName, action) => {
    setBusyAction(`${containerName}:${action}`)
    const toastId = toast.loading(`Menjalankan ${action} pada ${containerName}...`)
    try {
      const res = await api.post(`/user/containers/${encodeURIComponent(containerName)}/${action}`)
      toast.success(res.data?.message || `Container ${containerName} berhasil di-${action}.`, { id: toastId })
      await fetchSummary(true)
    } catch (err) {
      toast.error(err?.response?.data?.detail || `Gagal melakukan ${action} pada ${containerName}.`, { id: toastId })
    } finally {
      setBusyAction(null)
    }
  }

  const userInfo = summary?.user || {
    username: propUser?.username || '-',
    name: propUser?.name || propUser?.username || '-',
    role: propUser?.role || 'student',
    role_label: propUser?.role === 'dosen' ? 'Dosen' : 'Mahasiswa',
    ram_quota_limit_mb: propUser?.role === 'dosen' ? 1024 : 512,
    ram_used_mb: 0,
    ram_pct: 0,
    disk_used_mb: 0,
    disk_limit_mb: propUser?.role === 'dosen' ? 20480 : 10240,
    disk_pct: 0,
    running_count: 0,
    total_count: 0,
  }

  const containers = summary?.containers || []

  const ramPct = Math.min(100, Number(userInfo.ram_pct || 0))
  const ramBarColor =
    ramPct >= 90 ? 'bg-rose-500' : ramPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'

  const diskPct = Math.min(100, Number(userInfo.disk_pct || 0))
  const diskBarColor =
    diskPct >= 90 ? 'bg-rose-500' : diskPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'

  const activeTotal = Number(userInfo.total_count || 0)
  const activeRunning = Number(userInfo.running_count || 0)
  const activePct = activeTotal > 0 ? Math.min(100, (activeRunning / activeTotal) * 100) : 0

  const runningContainersCount = useMemo(
    () => containers.filter((c) => c.status === 'running').length,
    [containers]
  )
  const stoppedContainersCount = useMemo(
    () => containers.filter((c) => c.status !== 'running').length,
    [containers]
  )

  const typeOptions = useMemo(() => {
    const map = new Map()
    containers.forEach((c) => {
      if (c.type && !map.has(c.type)) {
        map.set(c.type, c.type_label || c.type)
      }
    })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [containers])

  const filteredContainers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return containers.filter((c) => {
      if (statusFilter === 'running' && c.status !== 'running') return false
      if (statusFilter === 'stopped' && c.status === 'running') return false
      if (typeFilter !== 'all' && c.type !== typeFilter) return false
      if (q) {
        const haystack = [c.display_name, c.name, c.subdomain, c.type_label]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [containers, searchQuery, statusFilter, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredContainers.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedContainers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize
    return filteredContainers.slice(start, start + pageSize)
  }, [filteredContainers, safeCurrentPage, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, typeFilter, pageSize])

  return (
    <div className="space-y-6 w-full pb-6 font-sans">
      {/* Header Workspace */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard Workspace Personal
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pemantauan telemetri komputasi, kuota memori terintegrasi, dan pengelolaan kontainer mandiri untuk NIM/NIDN:{' '}
            <span className="font-mono font-semibold text-slate-700">{userInfo.username}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchSummary(true)}
            loading={refreshing}
            icon={RefreshCw}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* 3 Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Alokasi RAM Terpakai */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-700">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Alokasi RAM Terpakai
                </p>
                <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                  {loading ? '...' : `${Number(userInfo.ram_used_mb || 0).toFixed(1)} MB / ${Math.round(userInfo.ram_quota_limit_mb || 512)} MB`}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 tabular-nums">
              {ramPct.toFixed(1)}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${ramBarColor}`}
                style={{ width: `${ramPct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Batas aman cgroup v2 Linux multi-container.
            </p>
          </div>
        </div>

        {/* Card 2: Penyimpanan Disk */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-700">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Penyimpanan Disk
                </p>
                <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                  {loading
                    ? '...'
                    : `${formatMBSize(userInfo.disk_used_mb || 0)} / ${formatMBSize(userInfo.disk_limit_mb || 10240)}`}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 tabular-nums">
              {diskPct.toFixed(1)}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${diskBarColor}`}
                style={{ width: `${diskPct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 font-mono truncate">
              Direktori /home/{userInfo.username}
            </p>
          </div>
        </div>

        {/* Card 3: Kontainer Aktif */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-700">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Kontainer Aktif
                </p>
                <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                  {loading
                    ? '...'
                    : `${userInfo.running_count} Berjalan / ${userInfo.total_count} Kontainer`}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 tabular-nums">
              {activePct.toFixed(0)}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 bg-emerald-500"
                style={{ width: `${activePct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {loading
                ? 'Memeriksa status kontainer...'
                : `${Math.max(0, activeTotal - activeRunning)} kontainer berhenti · sinkronisasi host.`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabel Pemantauan Kontainer & Service Pribadi */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Pemantauan Kontainer & Service Pribadi
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar seluruh kontainer terisolasi milik akun {userInfo.username} yang tersinkronisasi langsung dengan telemetry host.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500 tabular-nums shrink-0">
              {filteredContainers.length === containers.length
                ? `Total ${containers.length} kontainer`
                : `Menampilkan ${filteredContainers.length} dari ${containers.length} kontainer`}
            </span>
          </div>

          {!loading && containers.length > 0 && (
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pt-1">
              {/* Pencarian */}
              <div className="relative w-full lg:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari layanan, kontainer, atau domain..."
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    title="Hapus pencarian"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Status & Tipe */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center bg-slate-100/80 border border-slate-200/80 rounded-lg p-0.5">
                  {[
                    { key: 'all', label: `Semua (${containers.length})` },
                    { key: 'running', label: `Berjalan (${runningContainersCount})` },
                    { key: 'stopped', label: `Berhenti (${stoppedContainersCount})` },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setStatusFilter(opt.key)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition whitespace-nowrap ${
                        statusFilter === opt.key
                          ? 'bg-white text-slate-900 border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {typeOptions.length > 1 && (
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    aria-label="Filter tipe layanan"
                    className="bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-500 transition"
                  >
                    <option value="all">Semua Tipe</option>
                    {typeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Memuat telemetri kontainer pribadi...
          </div>
        ) : containers.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Belum Ada Kontainer Terdaftar</p>
              <p className="text-xs text-slate-500 mt-1">
                Buat project web di Tools & Deployment atau aktifkan layanan n8n / ThingsBoard untuk melihat metrik di sini.
              </p>
            </div>
            <div>
              <Button size="sm" onClick={() => navigate('/deploy')}>
                Buka Tools & Deployment
              </Button>
            </div>
          </div>
        ) : filteredContainers.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Tidak Ada Kontainer yang Cocok</p>
              <p className="text-xs text-slate-500 mt-1">
                Coba ubah kata kunci pencarian atau reset filter status dan tipe layanan.
              </p>
            </div>
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                  setTypeFilter('all')
                }}
              >
                Reset Filter
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Nama Layanan</th>
                    <th className="py-3 px-4">Tipe</th>
                    <th className="py-3 px-4">RAM Digunakan</th>
                    <th className="py-3 px-4">CPU</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs">
                  {paginatedContainers.map((c) => {
                  const IconComp = getTypeIcon(c.type)
                  const isRunning = c.status === 'running'
                  const ramLimit = Number(c.ram_limit_mb || userInfo.ram_quota_limit_mb || 512)
                  const ramUsed = Number(c.ram_usage_mb || 0)
                  const ramMiniPct = ramLimit > 0 ? Math.min(100, (ramUsed / ramLimit) * 100) : 0
                  const isBusy = busyAction && busyAction.startsWith(`${c.name}:`)

                  return (
                    <tr key={c.name} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {c.display_name}
                            </p>
                            <p className="text-[11px] font-mono text-slate-500 truncate">
                              {c.name}
                            </p>
                            {c.subdomain && (
                              <a
                                href={c.service_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline mt-0.5"
                              >
                                <span>{c.subdomain}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {c.type_label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 min-w-[150px]">
                        <div className="space-y-1">
                          <span className="font-medium text-slate-800 tabular-nums">
                            {ramUsed.toFixed(1)} MB / {Math.round(ramLimit)} MB
                          </span>
                          <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                ramMiniPct >= 90 ? 'bg-rose-500' : ramMiniPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${ramMiniPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-700 tabular-nums">
                        {Number(c.cpu_usage_pct || 0).toFixed(1)}%
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
                            isRunning
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                              : 'bg-slate-100 text-slate-600 border-slate-200/80'
                          }`}
                        >
                          {isRunning ? 'Running' : 'Stopped'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {isRunning ? (
                            <button
                              type="button"
                              disabled={Boolean(isBusy)}
                              onClick={() => handleContainerAction(c.name, 'stop')}
                              title="Hentikan Container"
                              className="p-1.5 rounded-lg border border-slate-200/80 text-slate-600 hover:text-amber-600 hover:bg-slate-100 transition disabled:opacity-50"
                            >
                              <Square className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={Boolean(isBusy)}
                              onClick={() => handleContainerAction(c.name, 'start')}
                              title="Jalankan Container"
                              className="p-1.5 rounded-lg border border-slate-200/80 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition disabled:opacity-50"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={Boolean(isBusy)}
                            onClick={() => handleContainerAction(c.name, 'restart')}
                            title="Restart Container"
                            className="p-1.5 rounded-lg border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition disabled:opacity-50"
                          >
                            <RotateCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                          </button>

                          {c.service_url && (
                            <a
                              href={c.service_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Buka Layanan"
                              className="p-1.5 rounded-lg border border-slate-200/80 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => navigate(c.manage_route || '/deploy')}
                            title="Kelola Layanan"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200/80 text-slate-700 hover:bg-slate-100 font-medium transition"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span>Kelola</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Navigasi Pagination */}
          <div className="px-5 py-3 border-t border-slate-200/80 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
              <span>
                Menampilkan {(safeCurrentPage - 1) * pageSize + 1}–
                {Math.min(safeCurrentPage * pageSize, filteredContainers.length)} dari{' '}
                {filteredContainers.length} kontainer
              </span>
              <span className="text-slate-300">|</span>
              <label className="inline-flex items-center gap-1.5">
                <span>Baris:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  aria-label="Jumlah baris per halaman"
                  className="bg-white border border-slate-200/80 rounded-md px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-1.5">
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200/80 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>

              <span className="px-2.5 py-1 text-xs font-medium text-slate-600 tabular-nums">
                Hal {safeCurrentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200/80 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
        )}
      </div>
    </div>
  )
}
