import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Box,
  Cpu,
  HardDrive,
  Play,
  RotateCw,
  Square,
  Terminal,
  RefreshCw,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import Button from '../components/Button'
import { formatMBSize } from '../utils/formatters'

export default function AdminContainerDetailPage() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState(null)
  const [logModal, setLogModal] = useState({ open: false, containerName: '', logs: '', loading: false })

  const fetchDetail = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get(`/admin/fleet/users/${encodeURIComponent(username)}/containers`)
      setAccount(res.data?.account || null)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal memuat detail kontainer akun.')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => {
    fetchDetail(false)
  }, [fetchDetail])

  const handleControl = async (containerName, action) => {
    setBusyAction(`${containerName}:${action}`)
    try {
      const res = await api.post(`/admin/containers/${encodeURIComponent(containerName)}/${action}`)
      toast.success(res.data?.message || `Berhasil ${action} ${containerName}.`)
      await fetchDetail(true)
    } catch (err) {
      toast.error(err?.response?.data?.detail || `Gagal ${action} ${containerName}.`)
    } finally {
      setBusyAction(null)
    }
  }

  const handleInspectLog = async (containerName) => {
    setLogModal({ open: true, containerName, logs: '', loading: true })
    try {
      const res = await api.get(`/admin/containers/${encodeURIComponent(containerName)}/logs?tail=150`)
      setLogModal({
        open: true,
        containerName,
        logs: res.data?.logs || '(Tidak ada output log)',
        loading: false,
      })
    } catch (err) {
      setLogModal({
        open: true,
        containerName,
        logs: err?.response?.data?.detail || 'Gagal mengambil log container.',
        loading: false,
      })
    }
  }

  const containers = account?.containers || []

  return (
    <div className="space-y-6 w-full pb-6">
      {/* Header & Breadcrumb */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Workspace</span>
            <span>&gt;</span>
            <button
              type="button"
              onClick={() => navigate('/admin/dashboard')}
              className="hover:text-emerald-700 font-medium"
            >
              Dashboard
            </button>
            <span>&gt;</span>
            <span className="text-emerald-700 font-semibold">Detail Kontainer ({username})</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            Detail Kontainer: {account?.name || username}
          </h1>
          <p className="text-xs text-slate-500">
            NIM / Username: <span className="font-mono font-semibold text-slate-700">{username}</span> • Role:{' '}
            <span className="font-semibold text-slate-700">{account?.role_label || '-'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/dashboard')}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            <span>Kembali</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fetchDetail(false)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Muat Ulang</span>
          </Button>
        </div>
      </div>

      {/* Account Pool Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Box className="h-4 w-4 text-emerald-600" />
            <span>Kontainer Akun</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {account ? `${account.running_count} / ${account.container_count} Aktif` : '...'}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Cpu className="h-4 w-4 text-emerald-600" />
            <span>Total RAM / Batas Akun</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {account
              ? `${formatMBSize(account.total_ram_used_mb)} / ${
                  account.ram_limit_mb ? formatMBSize(account.ram_limit_mb) : 'Tanpa Batas'
                }`
              : '...'}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <HardDrive className="h-4 w-4 text-emerald-600" />
            <span>Total Disk / Kuota Akun</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {account && account.disk_used_mb !== null
              ? `${formatMBSize(account.disk_used_mb)} / ${
                  account.is_uncapped_disk
                    ? `Kapasitas Host (${formatMBSize(account.disk_limit_mb)})`
                    : formatMBSize(account.disk_limit_mb)
                }`
              : '-'}
          </div>
        </div>
      </div>

      {/* Sub-Containers Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200/80">
          <h2 className="text-sm font-bold text-slate-900">Daftar Sub-Container & Kontrol Admin</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Rincian kontainer terisolasi beserta port internal, penggunaan RAM individual, dan inspeksi log.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Nama Sub-Container</th>
                <th className="py-3 px-4">Runtime & Port Internal</th>
                <th className="py-3 px-4">RAM Individual</th>
                <th className="py-3 px-4">CPU</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Kontrol Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Memuat daftar kontainer...
                  </td>
                </tr>
              ) : containers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Tidak ada kontainer ditemukan untuk akun ini.
                  </td>
                </tr>
              ) : (
                containers.map((c) => (
                  <tr key={c.id + c.name} className="hover:bg-slate-50/70 text-slate-700">
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-slate-900">{c.name}</div>
                      {c.project_slug && (
                        <div className="text-[11px] text-slate-500 mt-0.5">Project: {c.project_slug}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div className="text-slate-800">{c.image}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {c.port ? `Port ${c.port}` : 'Internal / No Host Port'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div className="font-semibold text-slate-900">{formatMBSize(c.ram_used_mb)}</div>
                      <div className="text-[11px] text-slate-500">
                        Limit: {c.ram_limit_mb ? formatMBSize(c.ram_limit_mb) : 'Shared'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div>{c.cpu_pct}%</div>
                      <div className="text-[11px] text-slate-500">
                        {c.cpu_quota_cores ? `${c.cpu_quota_cores} Cores` : 'Shared'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          c.state === 'running'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            : 'bg-slate-100 text-slate-600 border-slate-200/80'
                        }`}
                      >
                        {c.health_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          title="Restart Container"
                          aria-label="Restart Container"
                          onClick={() => handleControl(c.name, 'restart')}
                          disabled={busyAction !== null}
                        >
                          <RotateCw className={`h-4 w-4 ${busyAction === `${c.name}:restart` ? 'animate-spin' : ''}`} />
                        </Button>
                        {c.state === 'running' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            title="Stop Container"
                            aria-label="Stop Container"
                            onClick={() => handleControl(c.name, 'stop')}
                            disabled={busyAction !== null}
                          >
                            <Square className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          title="Inspect Log"
                          aria-label="Inspect Log"
                          onClick={() => handleInspectLog(c.name)}
                        >
                          <Terminal className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Log Modal */}
      {logModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/80 rounded-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-bold text-slate-900 font-mono">{logModal.containerName}</span>
              </div>
              <button
                type="button"
                onClick={() => setLogModal({ open: false, containerName: '', logs: '', loading: false })}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-950 text-slate-100 font-mono text-xs overflow-y-auto flex-1 whitespace-pre-wrap leading-relaxed">
              {logModal.loading ? 'Mengambil log container...' : logModal.logs}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
