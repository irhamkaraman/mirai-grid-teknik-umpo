import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Activity,
  AlertTriangle,
  Cpu,
  HardDrive,
  Monitor,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Box,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import Button from '../components/Button'
import { formatMBSize } from '../utils/formatters'

export default function AdminDashboardPage({ user }) {
  const [hostMetrics, setHostMetrics] = useState(null)
  const [containers, setContainers] = useState([])
  const [loadingHost, setLoadingHost] = useState(true)
  const [loadingFleet, setLoadingFleet] = useState(true)
  const [syncingContainer, setSyncingContainer] = useState(null)

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingHost(true)
      setLoadingFleet(true)
    }
    try {
      const [hostRes, fleetRes] = await Promise.all([
        api.get('/admin/host-metrics'),
        api.get('/admin/containers/tracking'),
      ])
      setHostMetrics(hostRes.data)
      setContainers(fleetRes.data?.containers || [])
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal memuat telemetri infrastruktur.')
    } finally {
      setLoadingHost(false)
      setLoadingFleet(false)
    }
  }, [])

  useEffect(() => {
    fetchAll(false)
  }, [fetchAll])

  const handleSyncLimit = async (containerName) => {
    setSyncingContainer(containerName)
    try {
      const res = await api.post(`/admin/containers/${encodeURIComponent(containerName)}/sync-limit`)
      toast.success(res.data?.message || `Limit ${containerName} berhasil disinkronkan.`)
      await fetchAll(true)
    } catch (err) {
      toast.error(err?.response?.data?.detail || `Gagal menyinkronkan limit ${containerName}.`)
    } finally {
      setSyncingContainer(null)
    }
  }

  const filteredContainers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return containers.filter((c) => {
      if (roleFilter !== 'all' && c.role !== roleFilter) return false
      if (statusFilter === 'warning' && !c.is_alert && !c.has_drift) return false
      if (statusFilter === 'normal' && (c.is_alert || c.state !== 'running')) return false
      if (statusFilter === 'exited' && c.state === 'running') return false
      if (q) {
        const hay = `${c.name} ${c.owner_username || ''} ${c.owner_name || ''} ${c.image || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [containers, roleFilter, statusFilter, searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [roleFilter, statusFilter, searchQuery, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredContainers.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedContainers = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredContainers.slice(start, start + pageSize)
  }, [filteredContainers, safePage, pageSize])

  const alertCount = useMemo(() => containers.filter((c) => c.is_alert).length, [containers])
  const driftCount = useMemo(() => containers.filter((c) => c.has_drift).length, [containers])

  const ram = hostMetrics?.ram
  const cpu = hostMetrics?.cpu
  const gpu = hostMetrics?.gpu
  const disks = hostMetrics?.disk || []
  const summary = hostMetrics?.containers_summary

  return (
    <div className="flex-1 min-h-0 h-full overflow-y-auto p-6 sm:p-8 space-y-6 pb-12">
      {/* A. Header langsung di atas kanvas putih (Zero Double-Box) */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2 text-xs font-medium text-slate-400 mb-1">
            <span>Workspace</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-600 font-semibold">Dashboard Infrastruktur</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Admin Infrastructure & Docker Fleet Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Telemetri resource node host, pemantauan kontainer multi-tenant, dan rekonsiliasi kuota DB vs Docker.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {alertCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200/80">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
              <span>{alertCount} Peringatan Resource</span>
            </span>
          )}
          {driftCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
              <SlidersHorizontal className="h-3.5 w-3.5 text-amber-600" />
              <span>{driftCount} Quota Drift</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchAll(false)}
            disabled={loadingHost || loadingFleet}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${(loadingHost || loadingFleet) ? 'animate-spin' : ''}`} />
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>

      {/* Memory Overcommitment Alert Banner */}
      {ram?.overcommitment_alert && (
        <div className="bg-rose-50/70 border border-rose-200/80 border-l-4 border-l-rose-500 rounded-xl p-4 flex items-start gap-3 text-rose-900">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-sm">Peringatan Overcommitment Memori RAM</p>
            <p className="text-rose-800">
              Total limit memori kontainer aktif ({formatMBSize(ram.allocated_container_mb)}) melebihi kapasitas RAM node ({formatMBSize(ram.total_mb)}) sebesar{' '}
              <span className="font-mono font-bold">{ram.overcommitment_percent}%</span>. Pertimbangkan penyesuaian kuota atau penghentian kontainer tidak aktif.
            </p>
          </div>
        </div>
      )}

      {/* B. Host Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* RAM Card */}
        <div className="bg-slate-50/50 border border-slate-200/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Server className="h-4 w-4 text-emerald-600" />
              <span>Memori RAM Node</span>
            </div>
            <span className="font-mono text-xs font-bold text-slate-900">
              {ram ? `${ram.percent}%` : '-'}
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {ram ? formatMBSize(ram.used_mb) : '...'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              dari {ram ? formatMBSize(ram.total_mb) : '...'} (Tersedia {ram ? formatMBSize(ram.available_mb) : '...'})
            </div>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (ram?.percent || 0) > 85 ? 'bg-rose-500' : 'bg-emerald-600'
              }`}
              style={{ width: `${Math.min(100, ram?.percent || 0)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Alokasi Kontainer</span>
            <span className="font-mono font-semibold text-slate-700">
              {ram ? formatMBSize(ram.allocated_container_mb) : '-'}
            </span>
          </div>
        </div>

        {/* CPU Card */}
        <div className="bg-slate-50/50 border border-slate-200/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Cpu className="h-4 w-4 text-emerald-600" />
              <span>CPU & Beban Komputasi</span>
            </div>
            <span className="font-mono text-xs font-bold text-slate-900">
              {cpu ? `${cpu.usage_percent}%` : '-'}
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {cpu ? `${cpu.cores} Cores` : '...'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 truncate" title={cpu?.model}>
              {cpu?.model || 'Memuat informasi CPU...'}
            </div>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (cpu?.usage_percent || 0) > 85 ? 'bg-rose-500' : 'bg-emerald-600'
              }`}
              style={{ width: `${Math.min(100, cpu?.usage_percent || 0)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Utilisasi Live</span>
            <span className="font-mono font-semibold text-slate-700">
              {cpu ? `${cpu.usage_percent}%` : '-'}
            </span>
          </div>
        </div>

        {/* Disk Partitions Card */}
        <div className="bg-slate-50/50 border border-slate-200/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <HardDrive className="h-4 w-4 text-emerald-600" />
              <span>Partisi Penyimpanan</span>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-500">
              {disks.length} Mount
            </span>
          </div>
          <div className="space-y-2.5">
            {disks.length === 0 ? (
              <div className="text-xs text-slate-400">Memuat partisi...</div>
            ) : (
              disks.slice(0, 2).map((d) => (
                <div key={d.mount} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-slate-800">{d.mount}</span>
                    <span className="font-mono text-slate-600">
                      {d.used_gb} / {d.total_gb} GB ({d.percent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        d.percent > 90 ? 'bg-rose-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.min(100, d.percent)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* GPU & Container Summary Card */}
        <div className="bg-slate-50/50 border border-slate-200/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Monitor className="h-4 w-4 text-emerald-600" />
              <span>GPU & Status Kontainer</span>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
              {gpu?.status || '-'}
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 truncate" title={gpu?.name}>
              {gpu?.name || 'Memeriksa perangkat grafis...'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {gpu?.has_dedicated_gpu ? 'Akselerasi GPU Terdedikasi Aktif' : 'Grafis Terintegrasi / Virtual'}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 rounded-lg py-1.5 px-2 border border-slate-200/60">
              <div className="font-mono text-sm font-bold text-slate-900">{summary?.total ?? '-'}</div>
              <div className="text-[10px] text-slate-500">Total</div>
            </div>
            <div className="bg-emerald-50/70 rounded-lg py-1.5 px-2 border border-emerald-200/70">
              <div className="font-mono text-sm font-bold text-emerald-700">{summary?.running ?? '-'}</div>
              <div className="text-[10px] text-emerald-700">Running</div>
            </div>
            <div className="bg-slate-50 rounded-lg py-1.5 px-2 border border-slate-200/60">
              <div className="font-mono text-sm font-bold text-slate-600">{summary?.stopped ?? '-'}</div>
              <div className="text-[10px] text-slate-500">Stopped</div>
            </div>
          </div>
        </div>
      </div>

      {/* B. Docker Fleet Tracking Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Box className="h-4 w-4 text-emerald-600" />
              <span>Pemantauan Fleet Kontainer & Rekonsiliasi Kuota</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Baris ditandai merah otomatis jika RAM &gt; 85% atau Disk &gt; 90% dari kuota.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari container / NIM / user..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200/80 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 w-56"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200/80 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Semua Role</option>
              <option value="student">Mahasiswa</option>
              <option value="dosen">Dosen</option>
              <option value="admin">Admin</option>
              <option value="system">Sistem</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200/80 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Semua Status</option>
              <option value="normal">Normal</option>
              <option value="warning">Hampir Penuh / Warning / Drift</option>
              <option value="exited">Exited / Stopped</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Kontainer & Pemilik</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">RAM / Limit</th>
                <th className="py-3 px-4">Disk / Kuota</th>
                <th className="py-3 px-4">CPU Quota</th>
                <th className="py-3 px-4">Status Health</th>
                <th className="py-3 px-4 text-right">Rekonsiliasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {loadingFleet ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Memuat telemetri kontainer Docker...
                  </td>
                </tr>
              ) : paginatedContainers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Tidak ada kontainer yang sesuai filter.
                  </td>
                </tr>
              ) : (
                paginatedContainers.map((c) => (
                  <tr
                    key={c.id + c.name}
                    className={
                      c.is_alert
                        ? 'bg-rose-50/70 text-rose-900 border-l-4 border-rose-500'
                        : 'hover:bg-slate-50/70 text-slate-700'
                    }
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-slate-900">{c.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {c.owner_username ? `${c.owner_name} (${c.owner_username})` : c.image}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          c.role === 'dosen'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            : c.role === 'student'
                            ? 'bg-slate-100 text-slate-700 border-slate-200/80'
                            : c.role === 'admin'
                            ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                            : 'bg-slate-50 text-slate-500 border-slate-200/80'
                        }`}
                      >
                        {c.role_label}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div>
                        {formatMBSize(c.ram_used_mb)} / {c.ram_limit_mb ? formatMBSize(c.ram_limit_mb) : 'Tanpa Batas'}
                      </div>
                      {c.ram_pct !== null && (
                        <div className="w-24 h-1.5 bg-slate-200/70 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              c.ram_pct > 85 ? 'bg-rose-600' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(100, c.ram_pct)}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {c.disk_used_mb !== null ? (
                        <div>
                          {c.is_pool_storage ? (
                            <>
                              <div className="text-slate-900 font-semibold">
                                {formatMBSize(c.disk_used_mb)}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Pool Akun: {formatMBSize(c.account_disk_used_mb ?? c.disk_used_mb)} /{' '}
                                {c.is_uncapped_disk
                                  ? `Kapasitas Host (${formatMBSize(c.disk_limit_mb)})`
                                  : formatMBSize(c.disk_limit_mb)}{' '}
                                ({c.disk_pct ?? 0}%)
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                {formatMBSize(c.disk_used_mb)} /{' '}
                                {c.is_uncapped_disk
                                  ? `Kapasitas Host (${formatMBSize(c.disk_limit_mb)})`
                                  : formatMBSize(c.disk_limit_mb)}
                              </div>
                              <div className="text-[11px] text-slate-500">{c.disk_pct}% terpakai</div>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div>{c.cpu_pct}%</div>
                      <div className="text-[11px] text-slate-500">
                        {c.cpu_quota_cores ? `${c.cpu_quota_cores} Cores` : 'Shared'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                            c.health_status === 'Running'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                              : c.health_status === 'Exited'
                              ? 'bg-slate-100 text-slate-600 border-slate-200/80'
                              : 'bg-rose-100 text-rose-800 border-rose-200/80'
                          }`}
                        >
                          {c.health_status}
                        </span>
                        {c.has_drift && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                            Drift: DB {c.db_quota_memory_mb}MB / {c.db_quota_cpu_cores}c
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {c.has_drift ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSyncLimit(c.name)}
                          disabled={syncingContainer === c.name}
                        >
                          {syncingContainer === c.name ? 'Menyinkronkan...' : 'Sinkronkan Limit'}
                        </Button>
                      ) : c.owner_username && (c.name.startsWith('app_') || c.name.startsWith('miraigrid_')) ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Selaras</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Tampilkan</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>
              dari <span className="font-semibold text-slate-900">{filteredContainers.length}</span> kontainer
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Sebelumnya</span>
            </button>
            <span className="font-mono text-xs px-2">
              Hal {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition disabled:opacity-40"
            >
              <span>Berikutnya</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
