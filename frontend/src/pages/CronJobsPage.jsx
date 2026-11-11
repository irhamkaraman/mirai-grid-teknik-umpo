import React, { useState, useEffect, useMemo } from 'react'
import {
  Clock,
  ArrowLeft,
  Plus,
  Play,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Power,
  ChevronLeft,
  ChevronRight,
  Globe,
  Terminal,
  Code2,
  Sliders,
  X,
  Copy,
  Check,
  Send
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import ModalPortal from '../components/ModalPortal'

const COMMON_PRESETS = [
  { label: '-- Pengaturan Cepat (Common Settings) --', value: '' },
  { label: 'Sekali per menit (* * * * *)', value: '* * * * *', minute: '*', hour: '*', day: '*', month: '*', weekday: '*' },
  { label: 'Setiap 5 menit (*/5 * * * *)', value: '*/5 * * * *', minute: '*/5', hour: '*', day: '*', month: '*', weekday: '*' },
  { label: 'Setiap 15 menit (*/15 * * * *)', value: '*/15 * * * *', minute: '*/15', hour: '*', day: '*', month: '*', weekday: '*' },
  { label: 'Sekali per jam (0 * * * *)', value: '0 * * * *', minute: '0', hour: '*', day: '*', month: '*', weekday: '*' },
  { label: 'Dua kali per hari (0 0,12 * * *)', value: '0 0,12 * * *', minute: '0', hour: '0,12', day: '*', month: '*', weekday: '*' },
  { label: 'Sekali per hari jam 00:00 (0 0 * * *)', value: '0 0 * * *', minute: '0', hour: '0', day: '*', month: '*', weekday: '*' },
  { label: 'Sekali per minggu (0 0 * * 0)', value: '0 0 * * 0', minute: '0', hour: '0', day: '*', month: '*', weekday: '0' },
  { label: 'Sekali per bulan tanggal 1 (0 0 1 * *)', value: '0 0 1 * *', minute: '0', hour: '0', day: '1', month: '*', weekday: '*' },
]

const HTTP_METHODS = [
  { method: 'GET', color: 'text-emerald-400 border-emerald-600/50 bg-emerald-950/40' },
  { method: 'POST', color: 'text-amber-400 border-amber-600/50 bg-amber-950/40' },
  { method: 'PUT', color: 'text-sky-400 border-sky-600/50 bg-sky-950/40' },
  { method: 'DELETE', color: 'text-rose-400 border-rose-600/50 bg-rose-950/40' },
  { method: 'PATCH', color: 'text-purple-400 border-purple-600/50 bg-purple-950/40' },
  { method: 'HEAD', color: 'text-zinc-400 border-zinc-600/50 bg-zinc-900/60' }
]

export default function CronJobsPage({ user, onNavigate }) {
  const [cronJobs, setCronJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active', 'inactive'
  const [deleteTarget, setDeleteTarget] = useState(null) // Modal konfirmasi hapus

  // Execution Result Modal State
  const [runResult, setRunResult] = useState(null) // { jobTitle, stdout, stderr, exit_code, status_code, latency_ms, job_type }
  const [copiedResult, setCopiedResult] = useState(false)
  const [executingJobId, setExecutingJobId] = useState(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Form Mode & Common State
  const [jobType, setJobType] = useState('http') // 'http' | 'command'
  const [title, setTitle] = useState('')
  const [selectedPreset, setSelectedPreset] = useState('')
  const [minute, setMinute] = useState('*')
  const [hour, setHour] = useState('*')
  const [day, setDay] = useState('*')
  const [month, setMonth] = useState('*')
  const [weekday, setWeekday] = useState('*')

  // CLI Command Mode State
  const [command, setCommand] = useState('')

  // HTTP/S Webhook Mode State (Postman-style)
  const [httpMethod, setHttpMethod] = useState('GET')
  const [httpUrl, setHttpUrl] = useState('')
  const [httpTab, setHttpTab] = useState('params') // 'params' | 'headers' | 'body'
  const [queryParams, setQueryParams] = useState([{ key: '', value: '' }])
  const [headers, setHeaders] = useState([
    { key: 'Accept', value: 'application/json' }
  ])
  const [bodyContent, setBodyContent] = useState('')

  useEffect(() => {
    fetchCronJobs()
  }, [])

  const fetchCronJobs = async () => {
    try {
      const res = await api.get('/cron-jobs')
      setCronJobs(res.data || [])
    } catch (err) {
      toast.error('Gagal memuat daftar cron jobs.')
    } finally {
      setLoading(false)
    }
  }

  const handlePresetChange = (presetValue) => {
    setSelectedPreset(presetValue)
    const found = COMMON_PRESETS.find((p) => p.value === presetValue)
    if (found && presetValue) {
      setMinute(found.minute)
      setHour(found.hour)
      setDay(found.day)
      setMonth(found.month)
      setWeekday(found.weekday)
    }
  }

  // Query Params Management
  const addQueryParam = () => setQueryParams((prev) => [...prev, { key: '', value: '' }])
  const updateQueryParam = (index, field, val) => {
    setQueryParams((prev) => {
      const copy = [...prev]
      copy[index][field] = val
      return copy
    })
  }
  const removeQueryParam = (index) => {
    setQueryParams((prev) => prev.filter((_, i) => i !== index))
  }

  // Headers Management
  const addHeader = () => setHeaders((prev) => [...prev, { key: '', value: '' }])
  const updateHeader = (index, field, val) => {
    setHeaders((prev) => {
      const copy = [...prev]
      copy[index][field] = val
      return copy
    })
  }
  const removeHeader = (index) => {
    setHeaders((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCreateCron = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Nama Cron Job wajib diisi.')
      return
    }

    if (jobType === 'command' && !command.trim()) {
      toast.error('Perintah (Command) yang akan dijalankan wajib diisi.')
      return
    }

    if (jobType === 'http' && !httpUrl.trim()) {
      toast.error('Target URL HTTP/S wajib diisi.')
      return
    }

    const schedule = `${minute.trim() || '*'} ${hour.trim() || '*'} ${day.trim() || '*'} ${month.trim() || '*'} ${weekday.trim() || '*'}`

    // Parse params dict
    const cleanParams = {}
    queryParams.forEach((p) => {
      if (p.key.trim()) cleanParams[p.key.trim()] = p.value.trim()
    })

    // Parse headers dict
    const cleanHeaders = {}
    headers.forEach((h) => {
      if (h.key.trim()) cleanHeaders[h.key.trim()] = h.value.trim()
    })

    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        schedule: schedule,
        job_type: jobType,
        minute: minute.trim() || '*',
        hour: hour.trim() || '*',
        day: day.trim() || '*',
        month: month.trim() || '*',
        weekday: weekday.trim() || '*'
      }

      if (jobType === 'http') {
        payload.http_method = httpMethod
        payload.http_url = httpUrl.trim()
        payload.http_params = Object.keys(cleanParams).length > 0 ? cleanParams : null
        payload.http_headers = Object.keys(cleanHeaders).length > 0 ? cleanHeaders : null
        payload.http_body = bodyContent.trim() ? bodyContent.trim() : null
        payload.command = `${httpMethod} ${httpUrl.trim()}`
      } else {
        payload.command = command.trim()
      }

      await api.post('/cron-jobs', payload)

      toast.success(`Cron Job "${title}" berhasil ditambahkan.`)
      setTitle('')
      setCommand('')
      setHttpUrl('')
      setBodyContent('')
      setSelectedPreset('')
      setQueryParams([{ key: '', value: '' }])
      setMinute('*')
      setHour('*')
      setDay('*')
      setMonth('*')
      setWeekday('*')
      fetchCronJobs()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menambahkan cron job.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (id, currentStatus) => {
    try {
      await api.post(`/cron-jobs/${id}/toggle`)
      setCronJobs((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_active: !currentStatus } : c))
      )
      toast.success(`Cron Job ${!currentStatus ? 'diaktifkan' : 'dinonaktifkan'}.`)
    } catch (err) {
      toast.error('Gagal mengubah status cron job.')
    }
  }

  const handleRequestDelete = (job) => {
    setDeleteTarget(job)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const { id, title: jobTitle } = deleteTarget
    try {
      await api.delete(`/cron-jobs/${id}`)
      setCronJobs((prev) => prev.filter((c) => c.id !== id))
      toast.success(`Cron job "${jobTitle}" berhasil dihapus.`)
    } catch (err) {
      toast.error('Gagal menghapus cron job.')
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleRunNow = async (job) => {
    setExecutingJobId(job.id)
    toast.info(`Mengeksekusi cron job "${job.title}"...`)
    try {
      const res = await api.post(`/cron-jobs/${job.id}/run`)
      const data = res.data || {}
      setRunResult({
        jobTitle: job.title,
        jobType: data.job_type || job.job_type || 'command',
        success: data.success,
        statusCode: data.status_code,
        latencyMs: data.latency_ms,
        exitCode: data.exit_code,
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        lastRun: data.last_run
      })
      if (data.success) {
        toast.success(`Eksekusi "${job.title}" selesai dengan status sukses.`)
      } else {
        toast.warning(`Eksekusi selesai dengan kode non-zero / error: ${data.stderr || 'Gagal'}`)
      }
      fetchCronJobs()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menjalankan cron job.')
    } finally {
      setExecutingJobId(null)
    }
  }

  const handleCopyResult = () => {
    if (!runResult) return
    const fullText = runResult.stdout || runResult.stderr || ''
    navigator.clipboard.writeText(fullText)
    setCopiedResult(true)
    setTimeout(() => setCopiedResult(false), 2000)
    toast.success('Log hasil eksekusi disalin ke clipboard.')
  }

  // Filtered & Paginated List
  const filteredJobs = useMemo(() => {
    return cronJobs.filter((job) => {
      const searchTarget = `${job.title} ${job.command} ${job.http_url || ''} ${job.schedule}`.toLowerCase()
      const matchesSearch = searchTarget.includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false
      if (statusFilter === 'active') return job.is_active
      if (statusFilter === 'inactive') return !job.is_active
      return true
    })
  }, [cronJobs, searchQuery, statusFilter])

  const totalPages = Math.ceil(filteredJobs.length / pageSize) || 1
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredJobs.slice(start, start + pageSize)
  }, [filteredJobs, currentPage, pageSize])

  const getMethodBadge = (method) => {
    const m = (method || 'GET').toUpperCase()
    const found = HTTP_METHODS.find((item) => item.method === m)
    return found ? found.color : 'text-zinc-400 border-zinc-700 bg-zinc-900/60'
  }

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-200 pb-12 font-sans">
      {/* Top Header Halaman Konsisten */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DECDBD]">
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="p-2.5 rounded-2xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#5A3521] hover:text-[#26160F] transition shadow-sm flex items-center justify-center shrink-0 group"
            title="Kembali ke Dasbor"
          >
            <ArrowLeft className="h-4 w-4 text-[#5A3521] group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-2xl font-serif font-bold text-[#26160F] flex items-center space-x-2.5">
                <Clock className="h-6 w-6 text-[#5A3521]" />
                <span>Cron Jobs™</span>
              </h2>
            </div>
            <p className="text-xs text-[#5C3B29] font-sans mt-0.5">
              Jadwalkan eksekusi perintah sistem atau request HTTP/S otomatis secara berkala untuk mendukung automasi layanan dan background task.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={fetchCronJobs}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] border border-[#BFAB96] text-xs font-semibold transition shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[#5A3521]" />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Form Tambah Cron Job Baru */}
      <section className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 shadow-2xl">
        <div className="border-b border-[#3D2316] pb-4 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-serif font-bold text-[#FAF5EC] tracking-wide flex items-center space-x-2">
              <span>Tambahkan Cron Job Baru</span>
            </h3>
            <p className="text-xs text-[#DFCDB5] mt-1">
              Konfigurasikan interval waktu eksekusi otomatis menggunakan preset umum atau format 5-bintang standar Linux.
            </p>
          </div>

          {/* Mode Switcher: HTTP Request vs CLI Command */}
          <div className="inline-flex p-1 bg-[#1C0F0A] rounded-2xl border border-[#4D2D1E] self-start md:self-auto">
            <button
              type="button"
              onClick={() => setJobType('http')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                jobType === 'http'
                  ? 'bg-[#946132] text-[#FAF5EC] shadow-md'
                  : 'text-[#A47E65] hover:text-[#DFCDB5]'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>HTTP/S Webhook</span>
            </button>
            <button
              type="button"
              onClick={() => setJobType('command')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                jobType === 'command'
                  ? 'bg-[#946132] text-[#FAF5EC] shadow-md'
                  : 'text-[#A47E65] hover:text-[#DFCDB5]'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Perintah CLI / Skrip</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleCreateCron} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nama Job */}
            <div>
              <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">
                Nama / Judul Tugas
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Ping Healthcheck API atau Sinkronisasi Data"
                className="w-full bg-[#1C0F0A] border border-[#4D2D1E] focus:border-[#C49767] rounded-2xl px-4 py-2.5 text-xs text-[#FAF5EC] placeholder-[#A47E65] outline-none transition"
              />
            </div>

            {/* Preset Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">
                Pengaturan Umum (Common Settings)
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full bg-[#1C0F0A] border border-[#4D2D1E] focus:border-[#C49767] rounded-2xl px-4 py-2.5 text-xs text-[#FAF5EC] outline-none transition"
              >
                {COMMON_PRESETS.map((p, idx) => (
                  <option key={idx} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 5 Cron Fields Grid */}
          <div>
            <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">
              Interval Waktu (Menit, Jam, Hari, Bulan, Hari dlm Minggu)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <span className="text-[10px] text-[#A47E65] uppercase font-mono block mb-1">Menit (Minute)</span>
                <input
                  type="text"
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                  placeholder="*"
                  className="w-full bg-[#1C0F0A] border border-[#4D2D1E] rounded-xl px-3 py-2 text-xs font-mono text-center text-[#FAF5EC] focus:border-[#C49767] outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#A47E65] uppercase font-mono block mb-1">Jam (Hour)</span>
                <input
                  type="text"
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                  placeholder="*"
                  className="w-full bg-[#1C0F0A] border border-[#4D2D1E] rounded-xl px-3 py-2 text-xs font-mono text-center text-[#FAF5EC] focus:border-[#C49767] outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#A47E65] uppercase font-mono block mb-1">Hari (Day)</span>
                <input
                  type="text"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  placeholder="*"
                  className="w-full bg-[#1C0F0A] border border-[#4D2D1E] rounded-xl px-3 py-2 text-xs font-mono text-center text-[#FAF5EC] focus:border-[#C49767] outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#A47E65] uppercase font-mono block mb-1">Bulan (Month)</span>
                <input
                  type="text"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="*"
                  className="w-full bg-[#1C0F0A] border border-[#4D2D1E] rounded-xl px-3 py-2 text-xs font-mono text-center text-[#FAF5EC] focus:border-[#C49767] outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#A47E65] uppercase font-mono block mb-1">Hari Kerja (Weekday)</span>
                <input
                  type="text"
                  value={weekday}
                  onChange={(e) => setWeekday(e.target.value)}
                  placeholder="*"
                  className="w-full bg-[#1C0F0A] border border-[#4D2D1E] rounded-xl px-3 py-2 text-xs font-mono text-center text-[#FAF5EC] focus:border-[#C49767] outline-none"
                />
              </div>
            </div>
            <p className="text-[11px] font-mono text-[#A47E65] mt-1.5">
              Ekspresi Aktif:{' '}
              <span className="text-amber-300 font-bold">
                {`${minute || '*'} ${hour || '*'} ${day || '*'} ${month || '*'} ${weekday || '*'}`}
              </span>
            </p>
          </div>

          {/* DYNAMIC FORM AREA: HTTP POSTMAN-STYLE vs CLI */}
          {jobType === 'http' ? (
            <div className="bg-[#1C0F0A] border border-[#4D2D1E] rounded-2xl p-4 space-y-4">
              <div className="flex items-center space-x-2 text-xs font-serif font-bold text-[#FAF5EC]">
                <Globe className="h-4 w-4 text-[#C49767]" />
                <span>Konfigurasi Request HTTP/S (Postman Interface)</span>
              </div>

              {/* URL & Method Bar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={httpMethod}
                  onChange={(e) => setHttpMethod(e.target.value)}
                  className={`bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3 py-2.5 text-xs font-bold font-mono outline-none cursor-pointer ${
                    HTTP_METHODS.find((m) => m.method === httpMethod)?.color || 'text-white'
                  }`}
                >
                  {HTTP_METHODS.map((m) => (
                    <option key={m.method} value={m.method} className="bg-[#1C0F0A] text-white">
                      {m.method}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={httpUrl}
                  onChange={(e) => setHttpUrl(e.target.value)}
                  placeholder="https://web-xxxx-nim.miraigrid.web.id/api/endpoint atau URL eksternal"
                  className="flex-1 bg-[#2B1810] border border-[#4D2D1E] focus:border-[#C49767] rounded-xl px-4 py-2.5 text-xs font-mono text-[#FAF5EC] placeholder-[#A47E65] outline-none transition"
                />
              </div>

              {/* Postman Tabs: Params, Headers, Body */}
              <div className="border-b border-[#3D2316] flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setHttpTab('params')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-xl transition border-b-2 flex items-center space-x-1.5 ${
                    httpTab === 'params'
                      ? 'border-[#C49767] text-[#FAF5EC] bg-[#2B1810]/50'
                      : 'border-transparent text-[#A47E65] hover:text-[#DFCDB5]'
                  }`}
                >
                  <Sliders className="h-3 w-3" />
                  <span>Params</span>
                  {queryParams.filter((p) => p.key).length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#946132] text-white">
                      {queryParams.filter((p) => p.key).length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setHttpTab('headers')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-xl transition border-b-2 flex items-center space-x-1.5 ${
                    httpTab === 'headers'
                      ? 'border-[#C49767] text-[#FAF5EC] bg-[#2B1810]/50'
                      : 'border-transparent text-[#A47E65] hover:text-[#DFCDB5]'
                  }`}
                >
                  <Code2 className="h-3 w-3" />
                  <span>Headers</span>
                  {headers.filter((h) => h.key).length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#946132] text-white">
                      {headers.filter((h) => h.key).length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setHttpTab('body')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-xl transition border-b-2 flex items-center space-x-1.5 ${
                    httpTab === 'body'
                      ? 'border-[#C49767] text-[#FAF5EC] bg-[#2B1810]/50'
                      : 'border-transparent text-[#A47E65] hover:text-[#DFCDB5]'
                  }`}
                >
                  <Send className="h-3 w-3" />
                  <span>Body (JSON / Raw)</span>
                  {bodyContent.trim() && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#946132] text-white">•</span>
                  )}
                </button>
              </div>

              {/* Tab Content: Params */}
              {httpTab === 'params' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-[#A47E65]">
                    Query Parameters akan otomatis di-append ke URL saat request dikirim (?key=value).
                  </p>
                  <div className="space-y-1.5">
                    {queryParams.map((param, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="Key (contoh: status)"
                          value={param.key}
                          onChange={(e) => updateQueryParam(idx, 'key', e.target.value)}
                          className="w-1/2 bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3 py-1.5 text-xs font-mono text-[#FAF5EC] placeholder-[#A47E65] outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Value (contoh: active)"
                          value={param.value}
                          onChange={(e) => updateQueryParam(idx, 'value', e.target.value)}
                          className="w-1/2 bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3 py-1.5 text-xs font-mono text-[#FAF5EC] placeholder-[#A47E65] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeQueryParam(idx)}
                          className="p-1.5 text-[#A47E65] hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition"
                          title="Hapus baris"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addQueryParam}
                    className="text-xs text-[#C49767] hover:text-[#DFCDB5] flex items-center space-x-1 pt-1 font-semibold"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Tambah Parameter</span>
                  </button>
                </div>
              )}

              {/* Tab Content: Headers */}
              {httpTab === 'headers' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-[#A47E65]">
                    Custom Request Headers (contoh: Authorization: Bearer token, X-Api-Key).
                  </p>
                  <div className="space-y-1.5">
                    {headers.map((hdr, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="Header Key (contoh: Authorization)"
                          value={hdr.key}
                          onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                          className="w-1/2 bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3 py-1.5 text-xs font-mono text-[#FAF5EC] placeholder-[#A47E65] outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Header Value"
                          value={hdr.value}
                          onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                          className="w-1/2 bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3 py-1.5 text-xs font-mono text-[#FAF5EC] placeholder-[#A47E65] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeHeader(idx)}
                          className="p-1.5 text-[#A47E65] hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition"
                          title="Hapus header"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addHeader}
                    className="text-xs text-[#C49767] hover:text-[#DFCDB5] flex items-center space-x-1 pt-1 font-semibold"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Tambah Header</span>
                  </button>
                </div>
              )}

              {/* Tab Content: Body */}
              {httpTab === 'body' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-[#A47E65]">
                      Request Body JSON atau Raw Text untuk method POST, PUT, atau PATCH.
                    </p>
                    {['GET', 'HEAD'].includes(httpMethod) && (
                      <span className="text-[10px] text-amber-400/80 italic">
                        Catatan: Method {httpMethod} biasanya tidak menyertakan request body.
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={4}
                    value={bodyContent}
                    onChange={(e) => setBodyContent(e.target.value)}
                    placeholder={`{\n  "action": "trigger_backup",\n  "timestamp": "auto"\n}`}
                    className="w-full bg-[#2B1810] border border-[#4D2D1E] focus:border-[#C49767] rounded-xl p-3 text-xs font-mono text-[#FAF5EC] placeholder-[#A47E65] outline-none resize-y transition"
                  />
                </div>
              )}
            </div>
          ) : (
            /* CLI COMMAND AREA */
            <div>
              <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">
                Perintah (Command) Sistem
              </label>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Contoh: python3 /home/admin/tess/app.py atau php /home/admin/simru-teknik/artisan schedule:run"
                className="w-full bg-[#1C0F0A] border border-[#4D2D1E] focus:border-[#C49767] rounded-2xl px-4 py-2.5 text-xs font-mono text-[#FAF5EC] placeholder-[#A47E65] outline-none transition"
              />
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#946132] to-[#7A4B22] hover:from-[#A8723C] hover:to-[#8C582B] text-xs font-bold text-[#FAF5EC] shadow-lg transition flex items-center space-x-2 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{submitting ? 'Menyimpan...' : 'Tambahkan Cron Job'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Tabel Daftar Cron Jobs Aktif */}
      <section className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#3D2316] pb-4 mb-5">
          <div>
            <h3 className="text-base font-serif font-bold text-[#FAF5EC] tracking-wide">
              Daftar Cron Jobs Aktif
            </h3>
            <p className="text-xs text-[#DFCDB5] mt-0.5">
              Kelola tugas otomatis, status aktif/nonaktif, dan riwayat eksekusi terakhir.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-[#A47E65]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Cari tugas, URL, command..."
                className="bg-[#1C0F0A] border border-[#4D2D1E] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#FAF5EC] placeholder-[#A47E65] outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="bg-[#1C0F0A] border border-[#4D2D1E] rounded-xl px-2.5 py-1.5 text-xs text-[#FAF5EC] outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>

        {/* Tabel */}
        <div className="border border-[#3E2316] rounded-2xl overflow-hidden bg-[#1C0F0A]">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#160C08] border-b border-[#3E2316] text-[#A47E65] font-mono text-[11px]">
                <tr>
                  <th className="p-3.5">Nama & Akun</th>
                  <th className="p-3.5">Tipe & Target</th>
                  <th className="p-3.5">Jadwal (Schedule)</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5">Terakhir Dijalankan</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2F1A10]">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-[#A47E65]">
                      <Spinner className="h-6 w-6 text-[#C49767] mx-auto mb-2" />
                      Memuat daftar cron jobs...
                    </td>
                  </tr>
                ) : paginatedJobs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-[#A47E65]">
                      {searchQuery
                        ? `Tidak ada cron job yang cocok dengan "${searchQuery}".`
                        : 'Belum ada cron job yang dibuat. Tambahkan tugas otomatis di form atas.'}
                    </td>
                  </tr>
                ) : (
                  paginatedJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-[#25150E] transition">
                      <td className="p-3.5 font-semibold text-[#FAF5EC]">
                        <div>{job.title}</div>
                        <div className="text-[10px] font-mono text-[#A47E65]">
                          Akun: {job.username}
                        </div>
                      </td>
                      <td className="p-3.5 max-w-xs">
                        {job.job_type === 'http' ? (
                          <div className="flex items-center space-x-1.5 font-mono">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getMethodBadge(
                                job.http_method
                              )}`}
                            >
                              {job.http_method || 'GET'}
                            </span>
                            <span className="text-[#DFCDB5] truncate text-xs" title={job.http_url || job.command}>
                              {job.http_url || job.command}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5 font-mono">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border text-amber-400 border-amber-600/40 bg-amber-950/30">
                              CLI
                            </span>
                            <span className="text-[#DFCDB5] truncate text-xs" title={job.command}>
                              {job.command}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-lg bg-[#2B1810] border border-[#4D2D1E] text-amber-300 font-mono text-xs font-semibold">
                          {job.schedule}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleToggle(job.id, job.is_active)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition ${
                            job.is_active
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                              : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {job.is_active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="p-3.5 text-[#A47E65] font-mono text-[11px]">
                        {job.last_run || 'Belum pernah'}
                      </td>
                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleRunNow(job)}
                          disabled={executingJobId === job.id}
                          className="px-2.5 py-1 rounded-xl bg-[#2B1810] hover:bg-[#3D2317] border border-[#4D2D1E] text-amber-300 hover:text-amber-200 transition disabled:opacity-50"
                          title="Jalankan sekarang secara manual"
                        >
                          {executingJobId === job.id ? (
                            <RefreshCw className="h-3.5 w-3.5 inline animate-spin mr-1" />
                          ) : (
                            <Play className="h-3.5 w-3.5 inline mr-1" />
                          )}
                          <span>Run</span>
                        </button>
                        <button
                          onClick={() => handleRequestDelete(job)}
                          className="px-2.5 py-1 rounded-xl bg-[#2B1810] hover:bg-rose-950/60 border border-[#4D2D1E] hover:border-rose-800 text-rose-300 hover:text-rose-200 transition"
                          title="Hapus cron job"
                        >
                          <Trash2 className="h-3.5 w-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredJobs.length > pageSize && (
            <div className="flex items-center justify-between p-3.5 bg-[#160C08] border-t border-[#3E2316] text-xs text-[#A47E65]">
              <div>
                Halaman {currentPage} dari {totalPages}
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-xl bg-[#2B1810] border border-[#4D2D1E] text-[#FAF5EC] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#3D2317]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-xl bg-[#2B1810] border border-[#4D2D1E] text-[#FAF5EC] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#3D2317]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Modal Konfirmasi Hapus Bertema MiraiGrid */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Hapus Cron Job"
        message={`Yakin ingin menghapus cron job "${deleteTarget?.title}"? Jadwal otomatis ini akan dihapus permanen dari sistem.`}
        confirmText="Hapus Cron Job"
        danger={true}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Modal Hasil Eksekusi Cron Job (Execution Output Modal) */}
      <ModalPortal isOpen={!!runResult}>
        <div
          onClick={() => setRunResult(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-[#1C0F0A] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 text-[#FAF5EC] animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#3D2316]">
              <div>
                <h3 className="text-base font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-[#C49767]" />
                  <span>Hasil Eksekusi Cron Job</span>
                </h3>
                <p className="text-xs text-[#DFCDB5] mt-0.5">
                  Target: <span className="font-semibold text-amber-300">{runResult?.jobTitle}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRunResult(null)}
                className="p-2 text-[#A47E65] hover:text-[#FAF5EC] hover:bg-[#2B1810] rounded-xl transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Badges / Metrics Bar */}
            <div className="py-3 flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-[#2B1810] border border-[#4D2D1E] text-[#DFCDB5]">
                Tipe: <b className="text-amber-300 uppercase">{runResult?.jobType || 'COMMAND'}</b>
              </span>

              {runResult?.statusCode !== undefined && runResult?.statusCode !== 0 && (
                <span
                  className={`px-2.5 py-1 rounded-lg border font-bold ${
                    runResult?.statusCode >= 200 && runResult?.statusCode < 400
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                      : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                  }`}
                >
                  HTTP Status: {runResult.statusCode}
                </span>
              )}

              {runResult?.latencyMs !== undefined && (
                <span className="px-2.5 py-1 rounded-lg bg-[#2B1810] border border-[#4D2D1E] text-sky-300">
                  Latency: {runResult.latencyMs} ms
                </span>
              )}

              <span
                className={`px-2.5 py-1 rounded-lg border font-bold ${
                  runResult?.success
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                    : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                }`}
              >
                {runResult?.success ? 'Success (Exit 0)' : `Failed (Exit ${runResult?.exitCode ?? 1})`}
              </span>
            </div>

            {/* Terminal / Code Viewer */}
            <div className="flex-1 overflow-hidden flex flex-col bg-[#140A07] border border-[#3E2316] rounded-2xl">
              <div className="bg-[#1C0F0A] border-b border-[#3E2316] px-3.5 py-2 flex items-center justify-between text-[11px] font-mono text-[#A47E65]">
                <span>Execution Logs / Output</span>
                <button
                  type="button"
                  onClick={handleCopyResult}
                  className="flex items-center space-x-1 text-[#DFCDB5] hover:text-[#FAF5EC] bg-[#2B1810] px-2 py-1 rounded-lg border border-[#4D2D1E] transition"
                >
                  {copiedResult ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedResult ? 'Tersalin' : 'Salin Log'}</span>
                </button>
              </div>
              <pre className="flex-1 p-4 overflow-y-auto text-xs font-mono text-[#DFCDB5] whitespace-pre-wrap leading-relaxed select-text">
                {runResult?.stdout || runResult?.stderr || 'Tidak ada output dari eksekusi ini.'}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setRunResult(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#2B1810] hover:bg-[#3D2317] border border-[#4D2D1E] text-[#FAF5EC] transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
    </div>
  )
}