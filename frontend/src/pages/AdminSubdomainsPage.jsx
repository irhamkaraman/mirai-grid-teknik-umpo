import React, { useState, useEffect, useCallback } from 'react'
import {
  Globe,
  RefreshCw,
  Search,
  ShieldCheck,
  Lock,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  PowerOff,
  ExternalLink,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'

const STATUS_BADGE = {
  active: {
    label: 'Aktif',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  inactive: {
    label: 'Mati / Nonaktif',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  orphan: {
    label: 'Tidak Terpakai (Orphan)',
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
  },
}

export default function AdminSubdomainsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 15

  const [showCfForm, setShowCfForm] = useState(false)
  const [cfZoneId, setCfZoneId] = useState('')
  const [cfApiToken, setCfApiToken] = useState('')
  const [savingCf, setSavingCf] = useState(false)
  const [cleaningAll, setCleaningAll] = useState(false)
  const [deletingFqdn, setDeletingFqdn] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchSubdomains = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await api.get('/admin/subdomains', {
        params: {
          status: statusFilter,
          category: categoryFilter,
          search: debouncedSearch,
          page,
          limit,
        },
      })
      setData(res.data)
      if (res.data?.cloudflare?.zone_id && !cfZoneId) {
        setCfZoneId(res.data.cloudflare.zone_id)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memuat daftar subdomain.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter, categoryFilter, debouncedSearch, page])

  useEffect(() => {
    fetchSubdomains()
  }, [fetchSubdomains])

  const handleSaveCloudflare = async (e) => {
    e.preventDefault()
    if (!cfZoneId.trim() || !cfApiToken.trim()) {
      toast.error('Zone ID dan API Token Cloudflare wajib diisi.')
      return
    }
    setSavingCf(true)
    try {
      const res = await api.post('/admin/subdomains/cloudflare-config', {
        zone_id: cfZoneId.trim(),
        api_token: cfApiToken.trim(),
      })
      toast.success(res.data?.message || 'Konfigurasi Cloudflare berhasil disimpan.')
      setCfApiToken('')
      setShowCfForm(false)
      fetchSubdomains(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memverifikasi kredensial Cloudflare.')
    } finally {
      setSavingCf(false)
    }
  }

  const handleDeleteOrphan = async (item) => {
    if (item.protected || item.status !== 'orphan') return
    setDeletingFqdn(item.fqdn)
    try {
      const res = await api.delete('/admin/subdomains/orphan', {
        data: {
          fqdn: item.fqdn,
          cf_record_id: item.cf_record_id || null,
        },
      })
      toast.success(res.data?.message || `Subdomain ${item.fqdn} berhasil dibersihkan.`)
      fetchSubdomains(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus subdomain orphan.')
    } finally {
      setDeletingFqdn(null)
    }
  }

  const handleCleanupAllOrphans = async () => {
    if (!data?.cleanable_orphan_count) return
    const ok = window.confirm(
      `Bersihkan ${data.cleanable_orphan_count} subdomain tidak terpakai (orphan)?\n\nCatatan DNS sistem, wildcard, TXT, dan MX dilindungi dan tidak akan disentuh.`
    )
    if (!ok) return
    setCleaningAll(true)
    try {
      const res = await api.post('/admin/subdomains/cleanup-orphans')
      toast.success(res.data?.message || 'Pembersihan subdomain orphan selesai.')
      fetchSubdomains(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membersihkan subdomain orphan.')
    } finally {
      setCleaningAll(false)
    }
  }

  const primaryDomain = data?.primary_domain || 'miraigrid.web.id'
  const maxSubdomains = data?.max_subdomains || 500
  const totalCount = data?.total_count ?? 0
  const quotaPct = data?.quota_percent ?? 0
  const cf = data?.cloudflare || {}
  const items = data?.items || []
  const pagination = data?.pagination || { page: 1, total_pages: 1, total: 0 }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-emerald-600">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">List Sub Domain</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Inventarisasi subdomain pada domain utama{' '}
              <span className="font-semibold text-slate-800">{primaryDomain}</span> (Batas Cloudflare Free Tier: {maxSubdomains} subdomain).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCfForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <KeyRound className="h-3.5 w-3.5 text-slate-500" />
            <span>{cf.configured ? 'Pengaturan Cloudflare' : 'Hubungkan Cloudflare'}</span>
          </button>
          <button
            type="button"
            onClick={() => fetchSubdomains(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sinkronkan</span>
          </button>
        </div>
      </div>

      {/* Primary Domain & Cloudflare Free Tier 500 Quota Banner */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Domain Primary
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <ShieldCheck className="h-3 w-3" />
                DNS Sistem Dilindungi
              </span>
              {cf.configured ? (
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  Cloudflare Terhubung ({cf.token_hint})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  Mode Lokal DB + Docker (API Cloudflare belum diisi)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-bold text-slate-900 font-mono">{primaryDomain}</span>
              <span className="text-xs text-slate-500">
                ({data?.cloudflare_dns_count ?? 0} DNS record di Cloudflare)
              </span>
            </div>
          </div>

          <div className="w-full lg:w-80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">Kuota Maksimum Subdomain</span>
              <span className={`font-bold ${data?.is_limit_reached ? 'text-rose-600' : data?.is_near_limit ? 'text-amber-600' : 'text-slate-900'}`}>
                {totalCount} / {maxSubdomains} ({quotaPct}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  data?.is_limit_reached ? 'bg-rose-500' : data?.is_near_limit ? 'bg-amber-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.min(100, quotaPct)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Sisa kapasitas aman: <span className="font-semibold text-slate-700">{data?.remaining_quota ?? maxSubdomains}</span> subdomain.
            </p>
          </div>
        </div>

        {cf.error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{cf.error}</span>
          </div>
        )}

        {showCfForm && (
          <form onSubmit={handleSaveCloudflare} className="border-t border-slate-100 pt-4 grid grid-cols-1 gap-3 md:grid-cols-3 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cloudflare Zone ID</label>
              <input
                type="text"
                value={cfZoneId}
                onChange={(e) => setCfZoneId(e.target.value)}
                placeholder="Contoh: 023e105f4ecef8ad9ca31a8372d0c353"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Cloudflare API Token (Zone:DNS:Edit)
              </label>
              <input
                type="password"
                value={cfApiToken}
                onChange={(e) => setCfApiToken(e.target.value)}
                placeholder="Token disimpan terenkripsi AES-256-GCM"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingCf}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition"
              >
                {savingCf ? 'Memverifikasi...' : 'Simpan & Verifikasi'}
              </button>
              <button
                type="button"
                onClick={() => setShowCfForm(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 4 Summary Cards (Click to filter) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => { setStatusFilter('all'); setPage(1) }}
          className={`rounded-xl border p-4 text-left transition ${
            statusFilter === 'all' ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-200/80 bg-white hover:bg-slate-50/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Di-generate</span>
            <Layers className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{totalCount}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">Maksimal {maxSubdomains}</div>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('active'); setPage(1) }}
          className={`rounded-xl border p-4 text-left transition ${
            statusFilter === 'active' ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-200/80 bg-white hover:bg-slate-50/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Subdomain Aktif</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{data?.active_count ?? 0}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">Berjalan & terhubung</div>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('inactive'); setPage(1) }}
          className={`rounded-xl border p-4 text-left transition ${
            statusFilter === 'inactive' ? 'border-amber-500 bg-amber-50/40' : 'border-slate-200/80 bg-white hover:bg-slate-50/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Subdomain Mati</span>
            <PowerOff className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{data?.inactive_count ?? 0}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">Container / layanan berhenti</div>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('orphan'); setPage(1) }}
          className={`rounded-xl border p-4 text-left transition ${
            statusFilter === 'orphan' ? 'border-rose-500 bg-rose-50/40' : 'border-slate-200/80 bg-white hover:bg-slate-50/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Tidak Terpakai (Orphan)</span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700">{data?.orphan_count ?? 0}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">Akun / container terhapus</div>
        </button>
      </div>

      {/* Toolbar: Search + Filter + Bulk Cleanup Orphan */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari subdomain, NIM/username, container, atau keterangan..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['all', 'active', 'inactive', 'orphan'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => { setStatusFilter(key); setPage(1) }}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                  statusFilter === key
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {key === 'all' ? 'Semua' : key === 'active' ? 'Aktif' : key === 'inactive' ? 'Mati' : 'Orphan'}
              </button>
            ))}

            <button
              type="button"
              onClick={handleCleanupAllOrphans}
              disabled={cleaningAll || !(data?.cleanable_orphan_count > 0)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>
                {cleaningAll ? 'Membersihkan...' : `Bersihkan Orphan (${data?.cleanable_orphan_count ?? 0})`}
              </span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">Kategori:</span>
          {[
            { id: 'all', label: 'Semua Kategori' },
            { id: 'system', label: 'Sistem & Database (auth, api, pma, ppa, cloudbeaver, jupyter)' },
            { id: 'service', label: 'Layanan Akun (code-*, n8n-*, tb-*, ssh-*)' },
            { id: 'deployment', label: 'Web Deployment (web-*)' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => { setCategoryFilter(cat.id); setPage(1) }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition ${
                categoryFilter === cat.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Table (Desktop) & Cards (Mobile) */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Memuat data subdomain...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Tidak ada subdomain yang sesuai dengan filter saat ini.
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 pr-4">Subdomain</th>
                    <th className="py-2.5 pr-4">Tipe / Target</th>
                    <th className="py-2.5 pr-4">Pemilik / Container</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Keterangan</th>
                    <th className="py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const badge = STATUS_BADGE[item.status] || STATUS_BADGE.inactive
                    return (
                      <tr key={`${item.fqdn}-${item.record_type}`} className="hover:bg-slate-50/70">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-900">
                            <span>{item.fqdn}</span>
                            {item.status === 'active' && !item.fqdn.startsWith('*') && (
                              <a
                                href={`https://${item.fqdn}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-emerald-600"
                                title="Buka Subdomain"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span>{item.in_cloudflare ? 'Cloudflare DNS' : 'Router Wildcard MiraiGrid'}</span>
                            {item.protected && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                <Lock className="h-2.5 w-2.5" />
                                Dilindungi
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-mono text-[11px] font-semibold text-slate-700">{item.record_type}</div>
                          <div className="text-[11px] text-slate-500 max-w-[180px] truncate" title={item.content}>
                            {item.content}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          {item.owner_username ? (
                            <div>
                              <div className="font-semibold text-slate-800">{item.owner_username}</div>
                              <div className="text-[11px] text-slate-500">{item.owner_name || item.container_name || '-'}</div>
                            </div>
                          ) : (
                            <span className="text-[11px] italic text-rose-600">Akun tidak ditemukan</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-[11px] text-slate-600 max-w-[220px]">
                          {item.status_reason}
                        </td>
                        <td className="py-3 text-right">
                          {item.protected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                              <Lock className="h-3 w-3" />
                              Aman
                            </span>
                          ) : item.status === 'orphan' ? (
                            <button
                              type="button"
                              disabled={deletingFqdn === item.fqdn}
                              onClick={() => handleDeleteOrphan(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>{deletingFqdn === item.fqdn ? 'Menghapus...' : 'Hapus'}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {items.map((item) => {
                const badge = STATUS_BADGE[item.status] || STATUS_BADGE.inactive
                return (
                  <div key={`${item.fqdn}-${item.record_type}-m`} className="rounded-xl border border-slate-200/80 p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-mono text-xs font-bold text-slate-900 break-all">{item.fqdn}</div>
                      <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">{item.status_reason}</div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                      <span>{item.owner_username || 'Akun terhapus'} · {item.record_type}</span>
                      {!item.protected && item.status === 'orphan' && (
                        <button
                          type="button"
                          disabled={deletingFqdn === item.fqdn}
                          onClick={() => handleDeleteOrphan(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>
                Menampilkan halaman {pagination.page} dari {pagination.total_pages} ({pagination.total} subdomain)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.total_pages}
                  onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
