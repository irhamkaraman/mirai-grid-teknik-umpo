import React, { useEffect, useMemo, useState } from 'react'
import {
  MessageSquareWarning,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  Phone,
  User,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner } from '../components/Skeletons'

const CATEGORY_OPTIONS = [
  'Semua Kategori',
  'Gagal Deploy',
  'Gagal Konek ke Database',
  'Error File Manager / VS Code',
  'Subdomain / Akses Web Bermasalah',
  'Kuota / Performa Kontainer',
  'Lainnya'
]

export default function AdminReportsPage() {
  const [reports, setReports] = useState([])
  const [summary, setSummary] = useState({ total: 0, open: 0, resolved: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('Semua Kategori')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [noteDrafts, setNoteDrafts] = useState({})
  const [actingId, setActingId] = useState(null)

  const fetchReports = async (statusOverride = statusFilter, qOverride = searchQuery) => {
    try {
      setLoading(true)
      const res = await api.get('/reports/admin', {
        params: {
          status: statusOverride,
          q: qOverride
        }
      })
      const list = res.data?.reports || []
      setReports(list)
      setSummary(res.data?.summary || { total: 0, open: 0, resolved: 0 })
      setNoteDrafts((prev) => {
        const next = { ...prev }
        for (const r of list) {
          if (next[r.id] === undefined) {
            next[r.id] = r.admin_note || ''
          }
        }
        return next
      })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memuat daftar laporan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1)
    fetchReports(statusFilter, searchQuery)
  }, [statusFilter])

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return reports.filter((r) => {
      if (categoryFilter !== 'Semua Kategori' && r.category !== categoryFilter) {
        return false
      }
      if (!q) return true
      return (
        String(r.username || '').toLowerCase().includes(q) ||
        String(r.reporter_name || '').toLowerCase().includes(q) ||
        String(r.category || '').toLowerCase().includes(q) ||
        String(r.description || '').toLowerCase().includes(q) ||
        String(r.whatsapp || '').toLowerCase().includes(q)
      )
    })
  }, [reports, categoryFilter, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedReports = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredReports.slice(start, start + pageSize)
  }, [filteredReports, safePage, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [categoryFilter, searchQuery, pageSize])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchReports(statusFilter, searchQuery)
  }

  const handleResolveToggle = async (rep, targetStatus) => {
    try {
      setActingId(rep.id)
      const res = await api.patch(`/reports/admin/${rep.id}/resolve`, {
        status: targetStatus,
        admin_note: noteDrafts[rep.id] ?? rep.admin_note ?? ''
      })
      toast.success(res.data?.message || 'Status laporan diperbarui.')
      await fetchReports(statusFilter, searchQuery)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memperbarui status laporan.')
    } finally {
      setActingId(null)
    }
  }

  const handleDelete = async (rep) => {
    try {
      setActingId(rep.id)
      await api.delete(`/reports/admin/${rep.id}`)
      toast.success('Laporan berhasil dihapus.')
      await fetchReports(statusFilter, searchQuery)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus laporan.')
    } finally {
      setActingId(null)
    }
  }

  const startIdx = filteredReports.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endIdx = Math.min(safePage * pageSize, filteredReports.length)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 shrink-0">
            <MessageSquareWarning className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Laporan Kendala Pengguna
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Tindak lanjuti laporan mahasiswa & dosen melalui WhatsApp atau email, lalu tandai selesai.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchReports(statusFilter, searchQuery)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors w-full sm:w-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Laporan</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">Menunggu Tindak Lanjut</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{summary.open}</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-xl p-4">
          <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Selesai (Resolved)</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.resolved}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Status Tabs + Category Select */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-full sm:w-auto">
              {[
                { key: 'all', label: 'Semua' },
                { key: 'open', label: 'Menunggu' },
                { key: 'resolved', label: 'Selesai' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === tab.key
                      ? 'bg-white text-slate-900 border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Filter className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200/80 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full lg:w-96">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari NIM, nama, kategori, atau WA..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200/80 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shrink-0"
            >
              Cari
            </button>
          </form>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="bg-white border border-slate-200/80 rounded-xl py-16 flex items-center justify-center">
          <Spinner />
        </div>
      ) : paginatedReports.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-xl py-16 px-4 text-center space-y-2">
          <MessageSquareWarning className="h-9 w-9 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">Tidak ada laporan ditemukan</p>
          <p className="text-xs text-slate-500">
            Ubah kata kunci pencarian atau filter status/kategori untuk melihat laporan lainnya.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedReports.map((rep) => {
            const isResolved = rep.status === 'resolved'
            const isBusy = actingId === rep.id

            return (
              <div
                key={rep.id}
                className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 space-y-4"
              >
                {/* Top Row: Identity, Time, Category, Status */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/80 text-xs font-mono font-bold text-slate-900">
                      <User className="h-3.5 w-3.5 text-slate-500" />
                      {rep.username}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {rep.reporter_name}
                    </span>
                    <span className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg">
                      {rep.category}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5">
                    <span className="text-xs text-slate-500">
                      Dilaporkan: <strong className="text-slate-700">{rep.created_at} WIB</strong>
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                        isResolved
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {isResolved ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Selesai</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-3.5 w-3.5" />
                          <span>Menunggu</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 sm:p-4">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Detail Kendala
                  </p>
                  <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {rep.description}
                  </p>
                </div>

                {/* Contact & Admin Action Row */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-end">
                  {/* Direct Contact Buttons */}
                  <div className="lg:col-span-5 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                    <a
                      href={rep.wa_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>Hubungi WhatsApp (+{rep.whatsapp})</span>
                      <ExternalLink className="h-3 w-3 opacity-80 shrink-0" />
                    </a>

                    {rep.contact_email && (
                      <a
                        href={`mailto:${rep.contact_email}?subject=${encodeURIComponent(
                          `[MiraiGrid Lab TI] Tindak Lanjut Laporan: ${rep.category}`
                        )}`}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors truncate"
                      >
                        <Mail className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{rep.contact_email}</span>
                      </a>
                    )}
                  </div>

                  {/* Admin Note + Resolve/Reopen */}
                  <div className="lg:col-span-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      value={noteDrafts[rep.id] ?? ''}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({ ...prev, [rep.id]: e.target.value }))
                      }
                      placeholder="Catatan tindak lanjut tim pengembang (opsional)..."
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200/80 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />

                    <div className="flex items-center gap-2">
                      {isResolved ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleResolveToggle(rep, 'open')}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shrink-0 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Buka Kembali</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleResolveToggle(rep, 'resolved')}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shrink-0 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Tandai Selesai</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(rep)}
                        title="Hapus laporan"
                        className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-200/80 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 transition-colors shrink-0 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {isResolved && rep.resolved_at && (
                  <p className="text-[11px] text-emerald-700">
                    Diselesaikan oleh <strong>{rep.resolved_by || 'admin'}</strong> pada {rep.resolved_at} WIB.
                  </p>
                )}
              </div>
            )
          })}

          {/* Pagination Footer */}
          <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3 text-xs text-slate-600">
              <span>
                Menampilkan <strong>{startIdx}–{endIdx}</strong> dari <strong>{filteredReports.length}</strong> laporan
              </span>
              <div className="flex items-center gap-1.5">
                <span>Baris:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg border border-slate-200/80 bg-white text-xs font-medium text-slate-700 focus:outline-none"
                >
                  {[5, 10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-medium text-slate-700 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Sebelumnya</span>
              </button>

              <span className="text-xs font-medium text-slate-600 px-2">
                Hal {safePage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-medium text-slate-700 transition-colors"
              >
                <span>Berikutnya</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
