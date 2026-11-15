import React, { useEffect, useMemo, useState } from 'react'
import {
  LifeBuoy,
  Send,
  Clock,
  CheckCircle2,
  Phone,
  Mail,
  User,
  RefreshCw,
  MessageSquareText,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner } from '../components/Skeletons'

const ISSUE_CATEGORIES = [
  'Gagal Deploy',
  'Gagal Konek ke Database',
  'Error File Manager / VS Code',
  'Subdomain / Akses Web Bermasalah',
  'Kuota / Performa Kontainer',
  'Lainnya'
]

const HISTORY_PAGE_SIZE = 3

export default function ReportIssuePage({ user }) {
  const [category, setCategory] = useState(ISSUE_CATEGORIES[0])
  const [whatsapp, setWhatsapp] = useState('')
  const [contactEmail, setContactEmail] = useState(user?.email || '')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [myReports, setMyReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [historyFilter, setHistoryFilter] = useState('all')
  const [historySearch, setHistorySearch] = useState('')
  const [historyPage, setHistoryPage] = useState(1)

  const fetchMyReports = async () => {
    try {
      setLoadingReports(true)
      const res = await api.get('/reports/my')
      setMyReports(res.data?.reports || [])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memuat riwayat laporan.')
    } finally {
      setLoadingReports(false)
    }
  }

  useEffect(() => {
    fetchMyReports()
  }, [])

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    return myReports.filter((r) => {
      if (historyFilter !== 'all' && r.status !== historyFilter) return false
      if (!q) return true
      return (
        String(r.category || '').toLowerCase().includes(q) ||
        String(r.description || '').toLowerCase().includes(q) ||
        String(r.admin_note || '').toLowerCase().includes(q)
      )
    })
  }, [myReports, historyFilter, historySearch])

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE))
  const safePage = Math.min(historyPage, totalPages)
  const paginatedHistory = useMemo(() => {
    const start = (safePage - 1) * HISTORY_PAGE_SIZE
    return filteredHistory.slice(start, start + HISTORY_PAGE_SIZE)
  }, [filteredHistory, safePage])

  useEffect(() => {
    setHistoryPage(1)
  }, [historyFilter, historySearch])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!whatsapp.trim()) {
      toast.error('Nomor WhatsApp aktif wajib diisi.')
      return
    }
    if (description.trim().length < 10) {
      toast.error('Ceritakan kendala Anda minimal 10 karakter.')
      return
    }

    try {
      setSubmitting(true)
      const res = await api.post('/reports', {
        category,
        description: description.trim(),
        whatsapp: whatsapp.trim(),
        contact_email: contactEmail.trim()
      })
      toast.success(res.data?.message || 'Laporan berhasil dikirim.')
      setDescription('')
      setHistoryPage(1)
      await fetchMyReports()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengirim laporan kendala.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 shrink-0">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Pusat Bantuan & Laporan Kendala
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Laporkan masalah deployment, database, atau akses workspace langsung ke tim pengembang.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchMyReports}
          disabled={loadingReports}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors w-full sm:w-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingReports ? 'animate-spin' : ''}`} />
          <span>Muat Ulang</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Laporan */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white border border-slate-200/80 rounded-xl p-4 sm:p-6 space-y-5"
        >
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-900">Formulir Laporan Kendala</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Identitas akun Anda tercatat otomatis. Tidak perlu melampirkan file.
            </p>
          </div>

          {/* Reporter Identity Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <User className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  NIM / ID Akun
                </p>
                <p className="text-sm font-semibold text-slate-900 truncate font-mono">
                  {user?.username || '-'}
                </p>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Nama Pelapor
              </p>
              <p className="text-sm font-semibold text-slate-900 truncate">
                {user?.name || '-'}
              </p>
            </div>
          </div>

          {/* Kategori Kendala */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Kategori Kendala
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ISSUE_CATEGORIES.map((item) => {
                const active = category === item
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`text-left px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                      active
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Kontak Balasan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Nomor WhatsApp Aktif <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Contoh: 082338520959"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Digunakan tim pengembang untuk membalas lewat WhatsApp.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Email Aktif (Opsional)
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="email@contoh.ac.id"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Alternatif kontak jika WhatsApp sedang tidak aktif.
              </p>
            </div>
          </div>

          {/* Deskripsi Kustom */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Ceritakan Kendala Anda <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan kendala secara detail, misalnya nama project/database, pesan error yang muncul, dan waktu kejadian..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-y"
            />
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              <Send className="h-4 w-4" />
              <span>{submitting ? 'Mengirim Laporan...' : 'Kirim Laporan'}</span>
            </button>
          </div>
        </form>

        {/* Riwayat Laporan Saya */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-xl p-4 sm:p-6 space-y-4">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Riwayat Laporan Anda</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pantau status penanganan dari tim pengembang.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0">
              {myReports.length} Laporan
            </span>
          </div>

          {/* Filter & Search History */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Cari riwayat laporan..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200/80 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              {[
                { key: 'all', label: 'Semua' },
                { key: 'open', label: 'Menunggu' },
                { key: 'resolved', label: 'Selesai' }
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setHistoryFilter(t.key)}
                  className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    historyFilter === t.key
                      ? 'bg-white text-slate-900 border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {loadingReports ? (
            <div className="py-10 flex items-center justify-center">
              <Spinner />
            </div>
          ) : paginatedHistory.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <MessageSquareText className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-700">
                {myReports.length === 0 ? 'Belum ada laporan dikirim' : 'Tidak ada laporan sesuai filter'}
              </p>
              <p className="text-xs text-slate-500">
                {myReports.length === 0
                  ? 'Jika mengalami kendala pada layanan lab, kirimkan laporan melalui formulir.'
                  : 'Coba ubah filter status atau kata kunci pencarian.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedHistory.map((rep) => {
                const isResolved = rep.status === 'resolved'
                return (
                  <div
                    key={rep.id}
                    className="border border-slate-200/80 rounded-xl p-3.5 sm:p-4 space-y-2.5 bg-slate-50/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">
                        {rep.category}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border shrink-0 ${
                          isResolved
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isResolved ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Selesai</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3" />
                            <span>Menunggu</span>
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {rep.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-1">
                      <span>Dikirim: {rep.created_at} WIB</span>
                      <span>WA: +{rep.whatsapp}</span>
                      {rep.contact_email && <span>Email: {rep.contact_email}</span>}
                    </div>

                    {rep.admin_note && (
                      <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 text-xs text-slate-700">
                        <span className="font-semibold text-slate-900">Catatan Tim Pengembang: </span>
                        {rep.admin_note}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* History Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 disabled:opacity-40 font-medium text-slate-700"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="text-slate-600 font-medium">
                    Hal {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 disabled:opacity-40 font-medium text-slate-700"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
