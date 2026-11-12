import React, { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Database, Plus, Trash2, Copy, Check, Eye, EyeOff, Server, ExternalLink, AlertCircle, Wand2, Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

import { toast } from 'sonner'

import { api } from '../api/client'

import { SkeletonTable, SkeletonCard, Spinner } from '../components/Skeletons'

import ConfirmModal from '../components/ConfirmModal'

import ModalPortal from '../components/ModalPortal'
import { launchDatabaseSSO } from '../utils/sso'

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
  const currentUser = propUser || (() => {
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

    fetchExternalDbs()

  }, [])

  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.search.includes('create=true')) {
      navigate('/database-wizard', { replace: true })
    }
  }, [location.search, navigate])

  const fetchDatabases = async () => {
    try {
      const [res, qRes] = await Promise.allSettled([
        api.get('/databases/my-databases'),
        api.get('/quotas/my-quota')
      ])
      if (res.status === 'fulfilled') setDatabases(res.value.data)
      if (qRes.status === 'fulfilled') setQuota(qRes.value.data)
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat database.')
    } finally {
      setLoading(false)
    }
  }

  const fetchExternalDbs = async () => {

    try {

      const res = await api.get('/databases/external')

      setExternalDbs(res.data)

    } catch (err) {}

  }

  // Filter & Search Logic
  const filteredDatabases = useMemo(() => {
    return databases.filter((db) => {
      const q = searchDb.toLowerCase().trim()
      const matchesSearch =
        !q ||
        db.db_name?.toLowerCase().includes(q) ||
        db.db_username?.toLowerCase().includes(q) ||
        db.engine?.toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (engineFilter === 'all') return true
      if (engineFilter === 'postgres') return db.engine === 'postgres'
      if (engineFilter === 'mariadb') return db.engine === 'mariadb' || db.engine === 'mysql'
      return true
    })
  }, [databases, searchDb, engineFilter])

  useEffect(() => {
    setDbPage(1)
  }, [searchDb, engineFilter])

  const dbCounts = useMemo(() => {
    return {
      all: databases.length,
      postgres: databases.filter((db) => db.engine === 'postgres').length,
      mariadb: databases.filter((db) => db.engine === 'mariadb' || db.engine === 'mysql').length,
    }
  }, [databases])

  const totalDbPages = Math.ceil(filteredDatabases.length / dbPageSize)
  const paginatedDatabases = useMemo(() => {
    const start = (dbPage - 1) * dbPageSize
    return filteredDatabases.slice(start, start + dbPageSize)
  }, [filteredDatabases, dbPage, dbPageSize])

  const handleCreateDatabase = async (e) => {

    e.preventDefault()

    setError('')

    setActionLoading(true)

    const toastId = toast.loading('Membuat database terisolasi di server...')

    try {

      await api.post('/databases/create', {

        engine,

        db_name: dbName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),

      })

      toast.success('Database berhasil dibuat!', { id: toastId })

      setShowCreateModal(false)

      setDbName('')

      fetchDatabases()

    } catch (err) {

      const msg = err.response?.data?.detail || 'Gagal membuat database.'

      setError(msg)

      toast.error(msg, { id: toastId })

    } finally {

      setActionLoading(false)

    }

  }

  const triggerDelete = (dbId, name, type = 'internal') => {

    setConfirmDelete({ open: true, id: dbId, name, type })

  }

  const executeDelete = async () => {

    const isInternal = confirmDelete.type === 'internal'

    const toastId = toast.loading(`Menghapus database ${confirmDelete.name}...`)

    try {

      if (isInternal) {

        await api.delete(`/databases/${confirmDelete.id}`)

        fetchDatabases()

      } else {

        await api.delete(`/databases/external/${confirmDelete.id}`)

        fetchExternalDbs()

      }

      toast.success('Database berhasil dihapus.', { id: toastId })

    } catch (err) {

      toast.error(err.response?.data?.detail || 'Gagal menghapus database.', { id: toastId })

    }

  }

  const handleAddExternalDb = async (e) => {

    e.preventDefault()

    setError('')

    setActionLoading(true)

    const toastId = toast.loading('Menyimpan koneksi database eksternal...')

    try {

      await api.post('/databases/external', {

        alias_name: extAlias,

        engine: extEngine,

        host: extHost,

        port: parseInt(extPort),

        db_name: extDbName,

        username: extUser,

        password: extPass

      })

      toast.success('Koneksi eksternal berhasil disimpan!', { id: toastId })

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

  const dbStorageMaxMb = quota?.max_database_disk_mb || 100
  const dbStorageUsedMb = quota?.used_database_disk_mb ?? parseFloat((databases.length * 12.5).toFixed(1))
  const dbStoragePercent = Math.min(100, Math.round((dbStorageUsedMb / dbStorageMaxMb) * 100))
  const isDbStorageFull = (dbStorageUsedMb + 12.5) > dbStorageMaxMb

  return (

    <div className="space-y-8 w-full">

      {/* Header: Judul Coklat Gelap Tebal di atas Latar Krim */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <div>

          <h2 className="text-2xl font-serif font-bold text-[#26160F]">Database Mandiri Praktikum</h2>

          <p className="text-xs text-[#5C3B29] mt-1 font-sans">

            Buat dan kelola database terisolasi Anda di PostgreSQL 16 (phpPgAdmin) atau MySQL / MariaDB 11 (phpMyAdmin).

          </p>

        </div>

        <div className="flex items-center space-x-2">

          <button

            onClick={() => { setError(''); setShowExternalModal(true); }}

            className="px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] border border-[#BFAB96] transition shadow-sm"

          >

            + Simpan DB Eksternal

          </button>

          <button
            onClick={() => navigate('/database-wizard')}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#2B1810] hover:bg-[#3D2317] text-[#FAF5EC] border border-[#4D2D1E] shadow-lg shadow-black/10 transition shrink-0"
          >
            <Wand2 className="h-4 w-4 text-[#E8DCB8]" />
            <span>Database Wizard (Buat DB Baru)</span>
          </button>

        </div>

      </div>

      {/* STORAGE DATABASE QUOTA BANNER */}
      <div className="p-5 rounded-3xl bg-[#2B1810] border border-[#4D2D1E] shadow-xl text-[#FAF5EC] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="h-11 w-11 rounded-2xl bg-[#5A3521]/50 border border-[#7D492F] flex items-center justify-center text-[#E8C58D] shrink-0">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-[#FAF5EC]">Storage Database Mandiri</span>
            </div>
            <p className="text-xs text-[#DFCDB5] mt-0.5 font-sans">
              Alokasi database dibatasi berdasarkan kapasitas storage akun Anda. Anda bebas membuat dan mengelola beberapa database praktikum selama kuota penyimpanan mencukupi.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
          <div className="min-w-[170px]">
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="text-[#DFCDB5]">Terpakai:</span>
              <span className="font-bold text-[#FAF5EC]">{dbStorageUsedMb} / {dbStorageMaxMb} MB</span>
            </div>
            <div className="w-full bg-[#1C0F0A] h-2 rounded-full overflow-hidden border border-[#3D2316]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  dbStoragePercent >= 90 ? 'bg-rose-500' : dbStoragePercent >= 70 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${dbStoragePercent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Internal Databases Table (Model ala Halaman Deploy/ProjectsView) */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-serif font-bold text-[#26160F] flex items-center space-x-2">
            <Server className="h-4 w-4 text-[#5A3521]" />
            <span>Database Server Lab Anda</span>
          </h3>
          <span className="text-[11px] text-[#5C3B29] font-mono">
            {databases.length} Database Terdaftar • Terisolasi Penuh
          </span>
        </div>

        {/* Search, Filter & Control Toolbar */}
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
            {/* Search Box */}
            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 text-[#A47E65] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama database, user, engine..."
                value={searchDb}
                onChange={(e) => setSearchDb(e.target.value)}
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF5EC] placeholder-[#A47E65] focus:outline-none focus:border-[#C49767] transition font-sans"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <button
                onClick={() => setEngineFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                  engineFilter === 'all'
                    ? 'bg-amber-600 text-amber-950 font-bold shadow'
                    : 'bg-[#1C0F0A] text-[#DFCDB5] hover:bg-[#382115] border border-[#3E2316]'
                }`}
              >
                Semua ({dbCounts.all})
              </button>
              <button
                onClick={() => setEngineFilter('postgres')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                  engineFilter === 'postgres'
                    ? 'bg-indigo-600 text-indigo-950 font-bold shadow'
                    : 'bg-[#1C0F0A] text-indigo-300 hover:bg-[#241B33] border border-indigo-900/40'
                }`}
              >
                PostgreSQL ({dbCounts.postgres})
              </button>
              <button
                onClick={() => setEngineFilter('mariadb')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                  engineFilter === 'mariadb'
                    ? 'bg-amber-600 text-amber-950 font-bold shadow'
                    : 'bg-[#1C0F0A] text-amber-300 hover:bg-[#282116] border border-amber-900/40'
                }`}
              >
                MariaDB / MySQL ({dbCounts.mariadb})
              </button>
            </div>
          </div>

          <button
            onClick={() => fetchDatabases()}
            title="Muat Ulang Database"
            className="p-2 rounded-xl bg-[#1C0F0A] hover:bg-[#3A2216] text-[#DFCDB5] border border-[#3E2316] transition shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <SkeletonTable rows={3} />
        ) : databases.length === 0 ? (
          <div className="text-center py-14 bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 text-[#FAF5EC] shadow-xl">
            <Database className="h-8 w-8 text-[#A47E65] mx-auto mb-2" />
            <p className="text-xs text-[#DFCDB5]">Belum ada database dibuat.</p>
          </div>
        ) : (
          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl overflow-hidden shadow-2xl text-[#FAF5EC]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1C0F0A] text-[#DFCDB5] uppercase text-[10px] tracking-wider border-b border-[#3E2316]">
                  <tr>
                    <th className="p-4 font-semibold">Database & Engine</th>
                    <th className="p-4 font-semibold">Kredensial User</th>
                    <th className="p-4 font-semibold">Host & Port</th>
                    <th className="p-4 font-semibold">Connection URI</th>
                    <th className="p-4 font-semibold">Web GUI (Isolasi)</th>
                    <th className="p-4 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3E2316]">
                  {filteredDatabases.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-[#A47E65]">
                        Tidak ada database yang cocok dengan pencarian atau filter yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    paginatedDatabases.map((db) => {

                    const isPg = db.engine === 'postgres'

                    const showPass = visiblePasswords[db.id]

                    return (

                      <tr key={db.id} className="hover:bg-[#361E13] transition group">

                        {/* 1. Database & Engine */}

                        <td className="p-4">

                          <div className="flex items-center space-x-2">

                            <span

                              className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider font-mono ${

                                isPg ? 'bg-[#442718] text-[#E8DCB8] border border-[#5C3825]' : 'bg-[#402613] text-[#E8C58D] border border-[#593920]'

                              }`}

                            >

                              {isPg ? 'PostgreSQL 16' : 'MySQL / MariaDB 11'}

                            </span>

                          </div>

                          <div className="font-bold text-sm text-[#FAF5EC] font-mono mt-1">

                            {db.db_name}

                          </div>

                        </td>

                        {/* 2. User & Password */}

                        <td className="p-4 font-mono text-xs">

                          <div className="text-[#DFCDB5]/70 text-[10px]">User: <span className="text-[#FAF5EC] font-semibold">{db.db_username}</span></div>

                          <div className="flex items-center space-x-1.5 mt-1">

                            <span className="text-[#FAF5EC]">{showPass ? db.db_password : '••••••••••••'}</span>

                            <button

                              onClick={() => togglePasswordVisibility(db.id)}

                              className="text-[#A47E65] hover:text-[#FAF5EC] p-0.5"

                              title={showPass ? 'Sembunyikan' : 'Lihat password'}

                            >

                              {showPass ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}

                            </button>

                            <button

                              onClick={() => copyToClipboard(db.db_password, `pass-${db.id}`, 'Password database')}

                              className="text-[#A47E65] hover:text-[#FAF5EC] p-0.5"

                              title="Salin password"

                            >

                              {copiedId === `pass-${db.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}

                            </button>

                          </div>

                        </td>

                        {/* 3. Host & Port */}

                        <td className="p-4 font-mono text-xs text-[#DFCDB5]">

                          <div>{db.host}</div>

                          <div className="text-[#A47E65] text-[11px]">Port: {db.port}</div>

                        </td>

                        {/* 4. Connection URI */}

                        <td className="p-4">

                          <button

                            onClick={() => copyToClipboard(db.connection_uri, `uri-${db.id}`, 'URI koneksi database')}

                            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-[#1C0F0A] hover:bg-[#25140D] border border-[#3E2316] text-[11px] font-mono text-[#E8DCB8] transition"

                            title="Salin URI koneksi"

                          >

                            {copiedId === `uri-${db.id}` ? (

                              <>

                                <Check className="h-3 w-3 text-emerald-400" />

                                <span className="text-emerald-400 font-semibold">Tersalin!</span>

                              </>

                            ) : (

                              <>

                                <Copy className="h-3 w-3 text-[#A47E65]" />

                                <span>Salin URI</span>

                              </>

                            )}

                          </button>

                        </td>

                        {/* 5. Web GUI (CloudBeaver Auto-Connect & phpPgAdmin/phpMyAdmin) */}
                        <td className="p-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            {/* CloudBeaver Studio (Terisolasi Multi-Tenant via SSO) */}
                            <a
                              href={
                                window.location.hostname.includes('miraigrid.web.id')
                                  ? `https://cloudbeaver.miraigrid.web.id/sso?token=${encodeURIComponent(localStorage.getItem('miraigrid_token') || '')}`
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
                                toast.success(`Membuka CloudBeaver! Database '${db.db_name}' terhubung. Password disalin ke clipboard.`, { duration: 5000 })
                              }}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-[#2E1810] hover:bg-[#3E2216] border border-[#5A3521] text-xs text-[#E8DCB8] hover:text-white transition font-medium shadow-sm"
                              title="Buka CloudBeaver Visual SQL Studio (Terisolasi per Mahasiswa)"
                            >
                              <Database className="h-3.5 w-3.5 text-[#C49767]" />
                              <span>CloudBeaver</span>
                              <ExternalLink className="h-3 w-3 text-[#A47E65]" />
                            </a>

                            {/* Dedicated Manager (phpPgAdmin / phpMyAdmin with Auto-Login SSO - 100% Terisolasi Anti-Bocor) */}
                            {isPg ? (
                              <button
                                type="button"
                                onClick={() => launchDatabaseSSO('postgres', db.id)}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-[#3A2216] hover:bg-[#4D2E1F] border border-[#5E3926] text-xs text-[#E8DCB8] hover:text-white transition font-medium shadow-sm active:scale-95 cursor-pointer"
                                title="Auto-Login ke phpPgAdmin (Sesi Terisolasi & Anti-Bocor)"
                              >
                                {!isAdmin && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                                <span>phpPgAdmin</span>
                                {!isAdmin && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono">Terisolasi</span>}
                                <ExternalLink className="h-3 w-3 text-[#A47E65]" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => launchDatabaseSSO('mariadb', db.id)}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-[#3D2516] hover:bg-[#52331F] border border-[#633C24] text-xs text-[#E8C58D] hover:text-white transition font-medium shadow-sm active:scale-95 cursor-pointer"
                                title="Auto-Login ke phpMyAdmin (Sesi Terisolasi & Anti-Bocor)"
                              >
                                {!isAdmin && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                                <Server className="h-3.5 w-3.5 text-[#E8C58D]" />
                                <span>phpMyAdmin</span>
                                {!isAdmin && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono">Terisolasi</span>}
                                <ExternalLink className="h-3 w-3 text-[#A47E65]" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 6. Aksi */}

                        <td className="p-4 text-right">

                          <button

                            onClick={() => triggerDelete(db.id, db.db_name, 'internal')}

                            className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-xl transition"

                            title="Hapus Database"

                          >

                            <Trash2 className="h-4 w-4" />

                          </button>

                        </td>

                      </tr>
                    )
                  }))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredDatabases.length > 0 && (
              <div className="bg-[#1C0F0A] px-5 py-3.5 border-t border-[#3E2316] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#DFCDB5]">
                <span className="font-mono text-[11px] text-[#A47E65]">
                  Menampilkan {(dbPage - 1) * dbPageSize + 1} - {Math.min(dbPage * dbPageSize, filteredDatabases.length)} dari {filteredDatabases.length} database
                </span>
                {totalDbPages > 1 && (
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setDbPage((p) => Math.max(1, p - 1))}
                      disabled={dbPage === 1}
                      className="p-1.5 rounded-lg bg-[#2B1810] hover:bg-[#3D2317] border border-[#4D2D1E] text-[#DFCDB5] disabled:opacity-40 transition"
                      title="Halaman Sebelumnya"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: totalDbPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setDbPage(page)}
                        className={`px-2.5 py-1 rounded-lg font-mono text-xs transition ${
                          dbPage === page
                            ? 'bg-[#C49767] text-[#2B1810] font-bold shadow-sm'
                            : 'bg-[#2B1810] hover:bg-[#3D2317] border border-[#4D2D1E] text-[#DFCDB5]'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setDbPage((p) => Math.min(totalDbPages, p + 1))}
                      disabled={dbPage === totalDbPages}
                      className="p-1.5 rounded-lg bg-[#2B1810] hover:bg-[#3D2317] border border-[#4D2D1E] text-[#DFCDB5] disabled:opacity-40 transition"
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

      <div className="pt-6 border-t border-[#DECDBD]">

        <h3 className="text-base font-serif font-bold text-[#26160F] mb-3">Koneksi Database Eksternal (Tersimpan)</h3>

        {externalDbs.length === 0 ? (

          <p className="text-xs text-[#5C3B29]">Belum ada koneksi database eksternal yang disimpan.</p>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

            {externalDbs.map((ext) => (

              <div key={ext.id} className="bg-[#2B1810] border border-[#4D2D1E] p-4 rounded-2xl flex items-center justify-between text-[#FAF5EC] shadow-md">

                <div>

                  <h5 className="text-xs font-bold text-[#FAF5EC]">{ext.alias_name}</h5>

                  <p className="text-[11px] text-[#DFCDB5] font-mono mt-0.5">{ext.engine} • {ext.host}:{ext.port}</p>

                </div>

                <button

                  onClick={() => triggerDelete(ext.id, ext.alias_name, 'external')}

                  className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"

                >

                  <Trash2 className="h-3.5 w-3.5" />

                </button>

              </div>

            ))}

          </div>

        )}

      </div>

      {/* Modal: Create Database with Full-Screen Portal */}

      <ModalPortal isOpen={showCreateModal}>

        <div
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >

          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 sm:p-7 text-[#FAF5EC] animate-in zoom-in-95 duration-150"
          >

            <h3 className="text-lg font-serif font-bold text-[#FAF5EC] mb-1">Buat Database Praktikum</h3>

            <p className="text-xs text-[#DFCDB5] mb-5">Sistem akan otomatis mengisolasi user dan hak akses database Anda.</p>

            {error && (

              <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">

                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />

                <span>{error}</span>

              </div>

            )}

            <form onSubmit={handleCreateDatabase} className="space-y-4">

              <div>

                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">Pilih Database Engine</label>

                <div className="grid grid-cols-2 gap-3">

                  <button

                    type="button"

                    onClick={() => setEngine('postgres')}

                    className={`p-3 rounded-2xl text-left border transition ${

                      engine === 'postgres'

                        ? 'bg-[#5A3521] border-[#7D492F] text-[#FAF5EC] shadow-md'

                        : 'bg-[#1C0F0A] border-[#3E2316] text-[#A47E65] hover:text-[#DFCDB5]'

                    }`}

                  >

                    <div className="font-bold text-xs">PostgreSQL 16</div>

                    <div className="text-[10px] text-[#DFCDB5]/70 mt-0.5">Web GUI: phpPgAdmin</div>

                  </button>

                  <button

                    type="button"

                    onClick={() => setEngine('mariadb')}

                    className={`p-3 rounded-2xl text-left border transition ${

                      engine === 'mariadb'

                        ? 'bg-[#5A3521] border-[#7D492F] text-[#FAF5EC] shadow-md'

                        : 'bg-[#1C0F0A] border-[#3E2316] text-[#A47E65] hover:text-[#DFCDB5]'

                    }`}

                  >

                    <div className="font-bold text-xs">MySQL / MariaDB 11</div>

                    <div className="text-[10px] text-[#DFCDB5]/70 mt-0.5">Web GUI: phpMyAdmin</div>

                  </button>

                </div>

              </div>

              <div>

                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Nama Database</label>

                <input

                  type="text"

                  required

                  placeholder="contoh: tokobuku"

                  value={dbName}

                  onChange={(e) => setDbName(e.target.value)}

                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] placeholder-[#553826] focus:outline-none focus:border-[#C49767]"

                />

                <p className="text-[10px] text-[#A47E65] mt-1 font-mono">Nama database otomatis diawali dengan NIM Anda.</p>

              </div>

              <div className="flex justify-end space-x-2.5 pt-3">

                <button

                  type="button"

                  onClick={() => setShowCreateModal(false)}

                  className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"

                >

                  Batal

                </button>

                <button

                  type="submit"

                  disabled={actionLoading}

                  className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] shadow-lg shadow-black/20 transition disabled:opacity-50"

                >

                  {actionLoading ? (

                    <span className="flex items-center space-x-1.5">

                      <Spinner size="xs" />

                      <span>Membuat Database...</span>

                    </span>

                  ) : (

                    'Buat Database'

                  )}

                </button>

              </div>

            </form>

          </div>

        </div>

      </ModalPortal>

      {/* Modal: External Database with Full-Screen Portal */}

      <ModalPortal isOpen={showExternalModal}>

        <div
          onClick={() => setShowExternalModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >

          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 sm:p-7 text-[#FAF5EC] animate-in zoom-in-95 duration-150"
          >

            <h3 className="text-lg font-serif font-bold text-[#FAF5EC] mb-1">Simpan Database Eksternal</h3>

            <p className="text-xs text-[#DFCDB5] mb-4">Kredensial disimpan aman terenkripsi (AES-256).</p>

            <form onSubmit={handleAddExternalDb} className="space-y-3">

              <div>

                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Nama Alias</label>

                <input

                  type="text"

                  required

                  placeholder="contoh: Supabase Prod / RDS"

                  value={extAlias}

                  onChange={(e) => setExtAlias(e.target.value)}

                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"

                />

              </div>

              <div className="grid grid-cols-3 gap-2">

                <div className="col-span-2">

                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Host</label>

                  <input

                    type="text"

                    required

                    placeholder="db.example.com"

                    value={extHost}

                    onChange={(e) => setExtHost(e.target.value)}

                    className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3 py-2 text-xs text-[#FAF5EC]"

                  />

                </div>

                <div>

                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Port</label>

                  <input

                    type="number"

                    required

                    value={extPort}

                    onChange={(e) => setExtPort(e.target.value)}

                    className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3 py-2 text-xs text-[#FAF5EC]"

                  />

                </div>

              </div>

              <div className="grid grid-cols-2 gap-2">

                <div>

                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Nama DB</label>

                  <input

                    type="text"

                    required

                    value={extDbName}

                    onChange={(e) => setExtDbName(e.target.value)}

                    className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3 py-2 text-xs text-[#FAF5EC]"

                  />

                </div>

                <div>

                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Username</label>

                  <input

                    type="text"

                    required

                    value={extUser}

                    onChange={(e) => setExtUser(e.target.value)}

                    className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3 py-2 text-xs text-[#FAF5EC]"

                  />

                </div>

              </div>

              <div>

                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Password</label>

                <input

                  type="password"

                  required

                  value={extPass}

                  onChange={(e) => setExtPass(e.target.value)}

                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC]"

                />

              </div>

              <div className="flex justify-end space-x-2.5 pt-3">

                <button

                  type="button"

                  onClick={() => setShowExternalModal(false)}

                  className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"

                >

                  Batal

                </button>

                <button

                  type="submit"

                  disabled={actionLoading}

                  className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] transition disabled:opacity-50"

                >

                  {actionLoading ? <Spinner size="xs" /> : 'Simpan Koneksi'}

                </button>

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

