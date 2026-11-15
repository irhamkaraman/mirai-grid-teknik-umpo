import React, { useEffect, useState } from 'react'
import {
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Search,
  RefreshCw,
  Trash2,
  Plus,
  Clock,
  MonitorSmartphone,
  Ban,
  CheckCircle2,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import Button from '../components/Button'
import { Spinner } from '../components/Skeletons'

const STATUS_BADGE = {
  blacklisted: 'bg-rose-50 text-rose-700 border-rose-200',
  cooldown: 'bg-amber-50 text-amber-700 border-amber-200',
  whitelisted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  active: 'bg-slate-50 text-slate-600 border-slate-200'
}

const STATUS_LABEL = {
  blacklisted: 'Blacklisted',
  cooldown: 'Cooldown',
  whitelisted: 'Whitelisted',
  active: 'Pantauan'
}

export default function AdminWafPage() {
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({
    total: 0,
    blacklisted: 0,
    cooldown: 0,
    whitelisted: 0,
    active: 0,
    auto_cleanup_days: 7
  })
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [manualIp, setManualIp] = useState('')
  const [manualDevice, setManualDevice] = useState('')
  const [manualReason, setManualReason] = useState('Diblokir manual oleh Administrator')
  const [submittingManual, setSubmittingManual] = useState(false)

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter !== 'all') params.status_filter = statusFilter
      if (search.trim()) params.search = search.trim()
      const res = await api.get('/admin/waf/records', { params })
      setRecords(res.data?.records || [])
      if (res.data?.summary) setSummary(res.data.summary)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memuat data WAF.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [statusFilter])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchRecords()
  }

  const handleWhitelist = async (rec) => {
    setActionId(rec.id)
    try {
      const res = await api.post(`/admin/waf/whitelist/${rec.id}`)
      toast.success(res.data?.message || `IP ${rec.ip_address} berhasil di-whitelist.`)
      await fetchRecords()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memproses whitelist.')
    } finally {
      setActionId(null)
    }
  }

  const handleQuickBlacklist = async (rec) => {
    setActionId(rec.id)
    try {
      const res = await api.post('/admin/waf/blacklist', {
        ip_address: rec.ip_address,
        device_id: rec.device_id || '',
        reason: 'Diblokir manual dari panel WAF Admin'
      })
      toast.success(res.data?.message || `IP ${rec.ip_address} dimasukkan ke blacklist.`)
      await fetchRecords()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memblokir IP.')
    } finally {
      setActionId(null)
    }
  }

  const handleDelete = async (rec) => {
    setActionId(rec.id)
    try {
      const res = await api.delete(`/admin/waf/records/${rec.id}`)
      toast.success(res.data?.message || 'Record WAF berhasil dihapus.')
      await fetchRecords()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus record WAF.')
    } finally {
      setActionId(null)
    }
  }

  const handleManualBlacklist = async (e) => {
    e.preventDefault()
    if (!manualIp.trim()) return
    setSubmittingManual(true)
    try {
      const res = await api.post('/admin/waf/blacklist', {
        ip_address: manualIp.trim(),
        device_id: manualDevice.trim(),
        reason: manualReason.trim() || 'Diblokir manual oleh Administrator'
      })
      toast.success(res.data?.message || 'IP berhasil diblokir.')
      setShowAddModal(false)
      setManualIp('')
      setManualDevice('')
      await fetchRecords()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menambahkan IP blacklist.')
    } finally {
      setSubmittingManual(false)
    }
  }

  const handleRunCleanup = async () => {
    setCleanupLoading(true)
    try {
      const res = await api.post('/admin/waf/cleanup')
      const count = res.data?.result?.cleaned_blacklist ?? 0
      toast.success(`Cleanup 7 hari selesai (${count} blacklist kedaluwarsa dihapus).`)
      await fetchRecords()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menjalankan cleanup WAF.')
    } finally {
      setCleanupLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <span>WAF & Keamanan Login</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pemantauan brute-force terikat IP & Device Fingerprint, sinkronisasi blokir Nginx, dan auto-cleanup 7 hari.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRunCleanup}
            disabled={cleanupLoading}
            icon={cleanupLoading ? Spinner : Clock}
          >
            Cleanup 7 Hari
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            icon={Plus}
          >
            Blokir IP Manual
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Blacklisted (Nginx)
            </span>
            <Ban className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{summary.blacklisted}</p>
          <p className="text-[11px] text-slate-500 mt-1">Diblokir penuh di Nginx & API</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Cooldown Aktif
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{summary.cooldown}</p>
          <p className="text-[11px] text-slate-500 mt-1">Terkunci 1 - 20 menit</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Whitelisted
            </span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{summary.whitelisted}</p>
          <p className="text-[11px] text-slate-500 mt-1">Akses dibuka oleh Admin</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Retensi Cron WAF
            </span>
            <CheckCircle2 className="h-4 w-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{summary.auto_cleanup_days} Hari</p>
          <p className="text-[11px] text-slate-500 mt-1">Total {summary.total} entri tercatat</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari IP address, Device ID, atau alasan..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-400"
          />
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'blacklisted', label: 'Blacklisted' },
            { id: 'cooldown', label: 'Cooldown' },
            { id: 'whitelisted', label: 'Whitelisted' },
            { id: 'active', label: 'Pantauan' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={fetchRecords}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Spinner size="sm" />
            <span className="text-xs">Memuat log keamanan WAF...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">Tidak ada entri WAF yang cocok</p>
            <p className="text-xs text-slate-500 mt-1">
              Percobaan brute-force atau IP yang diblokir akan muncul otomatis di tabel ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">IP Address & Perangkat</th>
                  <th className="py-3 px-4">Gagal</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Alasan / Aktivitas</th>
                  <th className="py-3 px-4">Kedaluwarsa / Update</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 align-top">
                      <div className="font-mono font-semibold text-slate-900">{rec.ip_address}</div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1 font-mono">
                        <MonitorSmartphone className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate max-w-[200px]" title={rec.device_id || '-'}>
                          {rec.device_id || '-'}
                        </span>
                      </div>
                      {rec.user_agent && (
                        <div
                          className="text-[10px] text-slate-400 truncate max-w-[240px] mt-0.5"
                          title={rec.user_agent}
                        >
                          {rec.user_agent}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top font-mono font-semibold text-slate-700">
                      {rec.fail_count}x
                    </td>
                    <td className="py-3 px-4 align-top">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                          STATUS_BADGE[rec.status] || STATUS_BADGE.active
                        }`}
                      >
                        {STATUS_LABEL[rec.status] || rec.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 align-top text-slate-600 max-w-xs">
                      <p className="line-clamp-2">{rec.reason || '-'}</p>
                    </td>
                    <td className="py-3 px-4 align-top text-[11px] text-slate-500 font-mono whitespace-nowrap">
                      {rec.status === 'blacklisted' && rec.expires_at ? (
                        <div>
                          <span className="text-rose-600">Exp: {rec.expires_at}</span>
                        </div>
                      ) : rec.status === 'cooldown' && rec.blocked_until ? (
                        <div>
                          <span className="text-amber-600">Until: {rec.blocked_until}</span>
                        </div>
                      ) : null}
                      <div className="text-slate-400 mt-0.5">Last: {rec.last_attempt_at || rec.updated_at}</div>
                    </td>
                    <td className="py-3 px-4 align-top text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {rec.status !== 'whitelisted' && (
                          <button
                            type="button"
                            disabled={actionId === rec.id}
                            onClick={() => handleWhitelist(rec)}
                            title="Whitelist & Buka Blokir"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>Whitelist</span>
                          </button>
                        )}
                        {rec.status !== 'blacklisted' && (
                          <button
                            type="button"
                            disabled={actionId === rec.id}
                            onClick={() => handleQuickBlacklist(rec)}
                            title="Masukkan ke Blacklist Nginx"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                            <span>Blokir</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={actionId === rec.id}
                          onClick={() => handleDelete(rec)}
                          title="Hapus Record"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Blacklist Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/80 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Ban className="h-4 w-4 text-rose-600" />
                <span>Blokir IP Manual (Blacklist 7 Hari)</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleManualBlacklist} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">IP Address</label>
                <input
                  type="text"
                  required
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  placeholder="Contoh: 203.0.113.45"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Device ID (Opsional)
                </label>
                <input
                  type="text"
                  value={manualDevice}
                  onChange={(e) => setManualDevice(e.target.value)}
                  placeholder="dev_..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Alasan</label>
                <input
                  type="text"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="danger" size="sm" disabled={submittingManual}>
                  {submittingManual ? 'Memproses...' : 'Blokir di Nginx'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
