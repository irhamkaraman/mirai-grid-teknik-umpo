import React, { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Database,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Server,
  ExternalLink,
  AlertCircle,
  Wand2,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonTable, SkeletonCard, Spinner } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import ModalPortal from '../components/ModalPortal'
import { launchDatabaseSSO } from '../utils/sso'
import Button from '../components/Button'
import Card from '../components/Card'

// Robust clipboard copy supporting both Secure Contexts (HTTPS/localhost) and HTTP fallback
function safeCopy(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
      return
    }
  } catch (e) {}
  fallbackCopy(text)
}

function fallbackCopy(text) {
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.top = '-9999px'
    textArea.style.left = '-9999px'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  } catch (err) {
    console.warn('Fallback copy error:', err)
  }
}

export default function DatabasesView({ user: propUser }) {
  const navigate = useNavigate()

  const currentUser =
    propUser ||
    (() => {
      try {
        return JSON.parse(localStorage.getItem('miraigrid_user') || '{}')
      } catch {
        return {}
      }
    })()
  const isAdmin = currentUser?.role === 'admin'

  const [databases, setDatabases] = useState([])
  const [quota, setQuota] = useState(null)
  const [externalDbs, setExternalDbs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showExternalModal, setShowExternalModal] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [visiblePasswords, setVisiblePasswords] = useState({})

  // Confirmation modal
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '', type: 'internal' })

  // Form states
  const [engine, setEngine] = useState('postgres')
  const [dbName, setDbName] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  // External DB form states
  const [extAlias, setExtAlias] = useState('')
  const [extEngine, setExtEngine] = useState('postgres')
  const [extHost, setExtHost] = useState('')
  const [extPort, setExtPort] = useState(5432)
  const [extDbName, setExtDbName] = useState('')
  const [extUser, setExtUser] = useState('')
  const [extPass, setExtPass] = useState('')

  // Search, Filter & Pagination for Databases
  const [searchDb, setSearchDb] = useState('')
  const [engineFilter, setEngineFilter] = useState('all') // 'all', 'postgres', 'mariadb'
  const [dbPage, setDbPage] = useState(1)
  const dbPageSize = 10

  useEffect(() => {
    fetchDatabases()
    fetchQuota()
    fetchExternalDbs()
  }, [])

  const fetchQuota = async () => {
    try {
      const res = await api.get('/quotas/my-quota')
      setQuota(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchDatabases = async () => {
    try {
      const res = await api.get('/databases')
      setDatabases(res.data)
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat database internal.')
    } finally {
      setLoading(false)
    }
  }

  const fetchExternalDbs = async () => {
    try {
      const res = await api.get('/external-databases')
      setExternalDbs(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  // Filtered & Paginated Internal Databases
  const filteredDatabases = useMemo(() => {
    return databases.filter((db) => {
      const q = searchDb.toLowerCase().trim()
      const matchesSearch =
        !q ||
        db.db_name?.toLowerCase().includes(q) ||
        db.db_username?.toLowerCase().includes(q) ||
        db.host?.toLowerCase().includes(q) ||
        db.engine?.toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (engineFilter === 'all') return true
      if (engineFilter === 'postgres') return db.engine === 'postgres'
      if (engineFilter === 'mariadb') return db.engine === 'mariadb' || db.engine === 'mysql'
      return true
    })
  }, [databases, searchDb, engineFilter])

  // Reset page when filter or search changes
  useEffect(() => {
    setDbPage(1)
  }, [searchDb, engineFilter])

  const paginatedDatabases = useMemo(() => {
    const start = (dbPage - 1) * dbPageSize
    return filteredDatabases.slice(start, start + dbPageSize)
  }, [filteredDatabases, dbPage, dbPageSize])

  const totalDbPages = Math.ceil(filteredDatabases.length / dbPageSize) || 1

  const dbCounts = useMemo(() => {
    return {
      all: databases.length,
      postgres: databases.filter((d) => d.engine === 'postgres').length,
      mariadb: databases.filter((d) => d.engine === 'mariadb' || d.engine === 'mysql').length,
    }
  }, [databases])

  const handleCreateDatabase = async (e) => {
    e.preventDefault()
    setError('')
    setActionLoading(true)
    const toastId = toast.loading('Membuat database mandiri...')

    try {
      await api.post('/databases', {
        engine,
        name: dbName,
      })

      toast.success(`Database ${dbName} berhasil dibuat!`, { id: toastId })
      setShowCreateModal(false)
      setDbName('')
      fetchDatabases()
      fetchQuota()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Gagal membuat database.'
      setError(msg)
      toast.error(msg, { id: toastId })
    } finally {
      setActionLoading(false)
    }
  }

  const triggerDelete = (id, name, type = 'internal') => {
    setConfirmDelete({ open: true, id, name, type })
  }

  const executeDelete = async () => {
    const { id, name, type } = confirmDelete
    const toastId = toast.loading(`Menghapus database ${name}...`)

    try {
      if (type === 'internal') {
        await api.delete(`/databases/${id}`)
        toast.success(`Database '${name}' berhasil dihapus!`, { id: toastId })
        fetchDatabases()
        fetchQuota()
      } else {
        await api.delete(`/external-databases/${id}`)
        toast.success(`Koneksi database eksternal '${name}' berhasil dihapus!`, { id: toastId })
        fetchExternalDbs()
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus database.', { id: toastId })
    }
  }

  const handleAddExternalDb = async (e) => {
    e.preventDefault()
    setError('')
    setActionLoading(true)
    const toastId = toast.loading('Menyimpan database eksternal...')

    try {
      await api.post('/external-databases', {
        alias_name: extAlias,
        engine: extEngine,
        host: extHost,
        port: parseInt(extPort, 10),
        db_name: extDbName,
        username: extUser,
        password: extPass,
      })

      toast.success('Database eksternal berhasil disimpan!', { id: toastId })
      setShowExternalModal(false)
      setExtAlias('')
      setExtHost('')
      setExtDbName('')
      setExtUser('')
      setExtPass('')
      fetchExternalDbs()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Gagal menyimpan database eksternal.'
      setError(msg)
      toast.error(msg, { id: toastId })
    } finally {
      setActionLoading(false)
    }
  }

  const copyToClipboard = (text, id, label = 'Teks') => {
    safeCopy(text)
    setCopiedId(id)
    toast.success(`${label} berhasil disalin ke clipboard!`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const dbStorageMaxMb = quota?.max_database_disk_mb || 5120
  const dbStorageUsedMb =
    quota?.used_database_disk_mb ?? parseFloat((databases.length * 12.5).toFixed(1))
  const dbStoragePercent = Math.min(100, Math.round((dbStorageUsedMb / dbStorageMaxMb) * 100))

  // ----------------------------------------------------
  // V2 CLEAN WHITE & SOFT SLATE THEME
  // ----------------------------------------------------
    return (
      <div className="space-y-6 w-full font-sans animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-sans font-bold text-slate-900 tracking-tight">
              Database Mandiri Praktikum
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-sans">
              Buat dan kelola database terisolasi Anda di PostgreSQL 16 (phpPgAdmin) atau MySQL / MariaDB 11 (phpMyAdmin).
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setError('')
                setShowExternalModal(true)
              }}
            >
              + Simpan DB Eksternal
            </Button>

            <Button
              variant="primary"
              size="md"
              icon={Wand2}
              onClick={() => navigate('/database-wizard')}
            >
              Database Wizard (Buat DB Baru)
            </Button>
          </div>
        </div>

        {/* STORAGE DATABASE QUOTA BANNER */}
        <Card className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-900">Storage Database Mandiri</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                  Sandboxed
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-sans">
                Alokasi database dibatasi berdasarkan kapasitas storage akun Anda. Anda bebas membuat dan mengelola beberapa database praktikum selama kuota penyimpanan mencukupi.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
            <div className="min-w-[180px]">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-500">Terpakai:</span>
                <span className="font-bold text-slate-900">
                  {dbStorageUsedMb} / {dbStorageMaxMb} MB
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    dbStoragePercent >= 90
                      ? 'bg-rose-500'
                      : dbStoragePercent >= 70
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${dbStoragePercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        </Card>

        {/* Internal Databases Table */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Server className="h-4 w-4 text-slate-600" />
              <span>Database Server Lab Anda</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              {databases.length} Database Terdaftar • Terisolasi Penuh
            </span>
          </div>

          {/* Search, Filter & Control Toolbar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
              {/* Search Box */}
              <div className="relative w-full sm:w-72">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama database, user, engine..."
                  value={searchDb}
                  onChange={(e) => setSearchDb(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition font-sans"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setEngineFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    engineFilter === 'all'
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  Semua ({dbCounts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setEngineFilter('postgres')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    engineFilter === 'postgres'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-white text-indigo-700 hover:bg-indigo-50/60 border border-slate-200'
                  }`}
                >
                  PostgreSQL ({dbCounts.postgres})
                </button>
                <button
                  type="button"
                  onClick={() => setEngineFilter('mariadb')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    engineFilter === 'mariadb'
                      ? 'bg-amber-600 text-white font-semibold'
                      : 'bg-white text-amber-700 hover:bg-amber-50/60 border border-slate-200'
                  }`}
                >
                  MariaDB / MySQL ({dbCounts.mariadb})
                </button>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={() => fetchDatabases()}
              title="Muat Ulang Database"
              className={loading ? 'animate-spin' : ''}
            />
          </div>

          {loading ? (
            <SkeletonTable rows={3} />
          ) : databases.length === 0 ? (
            <Card className="text-center py-14 p-6">
              <Database className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Belum ada database dibuat.</p>
            </Card>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-4 font-semibold">Database & Engine</th>
                      <th className="p-4 font-semibold">Kredensial User</th>
                      <th className="p-4 font-semibold">Host & Port</th>
                      <th className="p-4 font-semibold">Connection URI</th>
                      <th className="p-4 font-semibold">Web GUI (Isolasi)</th>
                      <th className="p-4 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDatabases.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-slate-400">
                          Tidak ada database yang cocok dengan pencarian atau filter yang dipilih.
                        </td>
                      </tr>
                    ) : (
                      paginatedDatabases.map((db) => {
                        const isPg = db.engine === 'postgres'
                        const showPass = visiblePasswords[db.id]

                        return (
                          <tr key={db.id} className="hover:bg-slate-50/70 border-b border-slate-100 transition group">
                            {/* 1. Database & Engine */}
                            <td className="p-4">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider font-mono ${
                                    isPg
                                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {isPg ? 'PostgreSQL 16' : 'MySQL / MariaDB 11'}
                                </span>
                              </div>
                              <div className="font-bold text-sm text-slate-900 font-mono mt-1">
                                {db.db_name}
                              </div>
                            </td>

                            {/* 2. User & Password */}
                            <td className="p-4 font-mono text-xs">
                              <div className="text-slate-500 text-[10px]">
                                User: <span className="text-slate-900 font-semibold">{db.db_username}</span>
                              </div>
                              <div className="flex items-center space-x-1.5 mt-1">
                                <span className="text-slate-800">{showPass ? db.db_password : '••••••••••••'}</span>
                                <button
                                  type="button"
                                  onClick={() => togglePasswordVisibility(db.id)}
                                  className="text-slate-400 hover:text-slate-700 p-0.5 transition"
                                  title={showPass ? 'Sembunyikan' : 'Lihat password'}
                                >
                                  {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(db.db_password, `pass-${db.id}`, 'Password database')}
                                  className="text-slate-400 hover:text-slate-700 p-0.5 transition"
                                  title="Salin password"
                                >
                                  {copiedId === `pass-${db.id}` ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* 3. Host & Port */}
                            <td className="p-4 font-mono text-xs text-slate-700">
                              <div>{db.host}</div>
                              <div className="text-slate-400 text-[11px]">Port: {db.port}</div>
                            </td>

                            {/* 4. Connection URI */}
                            <td className="p-4">
                              <button
                                type="button"
                                onClick={() => copyToClipboard(db.connection_uri, `uri-${db.id}`, 'URI koneksi database')}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700 transition"
                                title="Salin URI koneksi"
                              >
                                {copiedId === `uri-${db.id}` ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-600" />
                                    <span className="text-emerald-700 font-semibold">Tersalin!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3 text-slate-400" />
                                    <span>Salin URI</span>
                                  </>
                                )}
                              </button>
                            </td>

                            {/* 5. Web GUI */}
                            <td className="p-4">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                <a
                                  href={
                                    window.location.hostname.includes('miraigrid.web.id')
                                      ? `https://cloudbeaver.miraigrid.web.id/sso?token=${encodeURIComponent(
                                          localStorage.getItem('miraigrid_token') || ''
                                        )}`
                                      : `http://${window.location.hostname}:8978/#/`
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => {
                                    const token = localStorage.getItem('miraigrid_token')
                                    if (token && window.location.hostname.includes('miraigrid.web.id')) {
                                      try {
                                        document.cookie = `miraigrid_token=${token}; path=/; domain=.miraigrid.web.id; max-age=86400; SameSite=Lax; Secure`
                                      } catch (e) {
                                        console.error(e)
                                      }
                                    }
                                    safeCopy(db.db_password)
                                    toast.success(
                                      `Membuka CloudBeaver! Database '${db.db_name}' terhubung. Password disalin ke clipboard.`,
                                      { duration: 5000 }
                                    )
                                  }}
                                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs text-slate-700 hover:text-slate-900 transition-colors font-medium"
                                  title="Buka CloudBeaver Visual SQL Studio"
                                >
                                  <Database className="h-3.5 w-3.5 text-slate-500" />
                                  <span>CloudBeaver</span>
                                  <ExternalLink className="h-3 w-3 text-slate-400" />
                                </a>

                                {isPg ? (
                                  <button
                                    type="button"
                                    onClick={() => launchDatabaseSSO('postgres', db.id)}
                                    className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs text-slate-700 hover:text-slate-900 transition-colors font-medium"
                                    title="Auto-Login ke phpPgAdmin"
                                  >
                                    {!isAdmin && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                                    <span>phpPgAdmin</span>
                                    <ExternalLink className="h-3 w-3 text-slate-400" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => launchDatabaseSSO('mariadb', db.id)}
                                    className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs text-slate-700 hover:text-slate-900 transition-colors font-medium"
                                    title="Auto-Login ke phpMyAdmin"
                                  >
                                    {!isAdmin && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                                    <Server className="h-3.5 w-3.5 text-slate-500" />
                                    <span>phpMyAdmin</span>
                                    <ExternalLink className="h-3 w-3 text-slate-400" />
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* 6. Aksi */}
                            <td className="p-4 text-right">
                              <button
                                type="button"
                                onClick={() => triggerDelete(db.id, db.db_name, 'internal')}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                title="Hapus Database"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredDatabases.length > 0 && (
                <div className="bg-slate-50/70 px-5 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                  <span className="font-mono text-[11px] text-slate-500">
                    Menampilkan {(dbPage - 1) * dbPageSize + 1} -{' '}
                    {Math.min(dbPage * dbPageSize, filteredDatabases.length)} dari {filteredDatabases.length} database
                  </span>
                  {totalDbPages > 1 && (
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setDbPage((p) => Math.max(1, p - 1))}
                        disabled={dbPage === 1}
                        className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 disabled:opacity-40 transition-colors"
                        title="Halaman Sebelumnya"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {Array.from({ length: totalDbPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setDbPage(page)}
                          className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-colors ${
                            dbPage === page
                              ? 'bg-slate-900 text-white font-bold'
                              : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDbPage((p) => Math.min(totalDbPages, p + 1))}
                        disabled={dbPage === totalDbPages}
                        className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 disabled:opacity-40 transition-colors"
                        title="Halaman Selanjutnya"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* External Databases */}
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-3">
            Koneksi Database Eksternal (Tersimpan)
          </h3>

          {externalDbs.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada koneksi database eksternal yang disimpan.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {externalDbs.map((ext) => (
                <Card
                  key={ext.id}
                  padding="sm"
                  className="p-4 rounded-xl flex items-center justify-between text-slate-900 shadow-xs"
                >
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">{ext.alias_name}</h5>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {ext.engine} • {ext.host}:{ext.port}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => triggerDelete(ext.id, ext.alias_name, 'external')}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                    title="Hapus Koneksi"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Modal: Create Database */}
        <ModalPortal isOpen={showCreateModal}>
          <div
            onClick={() => setShowCreateModal(false)}
            className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-7 text-slate-900 animate-in zoom-in-95 duration-150 font-sans"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-1">Buat Database Praktikum</h3>
              <p className="text-xs text-slate-500 mb-5">
                Sistem akan otomatis mengisolasi user dan hak akses database Anda.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleCreateDatabase} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pilih Database Engine
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEngine('postgres')}
                      className={`p-3 rounded-lg text-left border transition-colors ${
                        engine === 'postgres'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs">PostgreSQL 16</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Web GUI: phpPgAdmin</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEngine('mariadb')}
                      className={`p-3 rounded-lg text-left border transition-colors ${
                        engine === 'mariadb'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs">MySQL / MariaDB 11</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Web GUI: phpMyAdmin</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Database
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="contoh: tokobuku"
                    value={dbName}
                    onChange={(e) => setDbName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    Nama database otomatis diawali dengan NIM Anda.
                  </p>
                </div>

                <div className="flex justify-end space-x-2.5 pt-3">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    type="submit"
                    loading={actionLoading}
                  >
                    Buat Database
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>

        {/* Modal: External Database */}
        <ModalPortal isOpen={showExternalModal}>
          <div
            onClick={() => setShowExternalModal(false)}
            className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-7 text-slate-900 animate-in zoom-in-95 duration-150 font-sans"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-1">Simpan Database Eksternal</h3>
              <p className="text-xs text-slate-500 mb-4">
                Kredensial disimpan aman terenkripsi (AES-256).
              </p>

              <form onSubmit={handleAddExternalDb} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Alias</label>
                  <input
                    type="text"
                    required
                    placeholder="contoh: Supabase Prod / RDS"
                    value={extAlias}
                    onChange={(e) => setExtAlias(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Host</label>
                    <input
                      type="text"
                      required
                      placeholder="db.example.com"
                      value={extHost}
                      onChange={(e) => setExtHost(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Port</label>
                    <input
                      type="number"
                      required
                      value={extPort}
                      onChange={(e) => setExtPort(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama DB</label>
                    <input
                      type="text"
                      required
                      value={extDbName}
                      onChange={(e) => setExtDbName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={extUser}
                      onChange={(e) => setExtUser(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={extPass}
                    onChange={(e) => setExtPass(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div className="flex justify-end space-x-2.5 pt-3">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setShowExternalModal(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    type="submit"
                    loading={actionLoading}
                  >
                    Simpan Koneksi
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>

        {/* Confirmation Modal */}
        <ConfirmModal
          isOpen={confirmDelete.open}
          title="Hapus Database?"
          message={`Apakah Anda yakin ingin menghapus database '${confirmDelete.name}'? Seluruh tabel dan data di dalamnya akan terhapus permanen.`}
          confirmText="Hapus Database"
          onConfirm={executeDelete}
          onClose={() => setConfirmDelete({ open: false, id: null, name: '', type: 'internal' })}
        />
      </div>
    )
}
