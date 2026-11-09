import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Database, Plus, Trash2, Copy, Check, Eye, EyeOff, Server, ExternalLink, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonTable, SkeletonCard, Spinner } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import ModalPortal from '../components/ModalPortal'

export default function DatabasesView() {
  const [databases, setDatabases] = useState([])
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

  useEffect(() => {
    fetchDatabases()
    fetchExternalDbs()
  }, [])

  const location = useLocation()
  useEffect(() => {
    if (location.search.includes('create=true')) {
      setShowCreateModal(true)
    }
  }, [location.search])

  const fetchDatabases = async () => {
    try {
      const res = await api.get('/databases/my-databases')
      setDatabases(res.data)
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
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success(`${label} berhasil disalin ke clipboard!`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-8">
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
            onClick={() => { setError(''); setShowCreateModal(true); }}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#2B1810] hover:bg-[#3D2317] text-[#FAF5EC] border border-[#4D2D1E] shadow-lg shadow-black/10 transition shrink-0"
          >
            <Plus className="h-4 w-4 text-[#E8DCB8]" />
            <span>Buat Database Baru</span>
          </button>
        </div>
      </div>

      {/* Internal Databases Table (Model ala Halaman Deploy/ProjectsView) */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-base font-serif font-bold text-[#26160F] flex items-center space-x-2">
            <Server className="h-4 w-4 text-[#5A3521]" />
            <span>Database Server Lab Anda</span>
          </h3>
          <span className="text-[11px] text-[#5C3B29] font-mono">
            {databases.length} Database Terdaftar • Terisolasi Penuh
          </span>
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
                  {databases.map((db) => {
                    const isPg = db.engine === 'postgres'
                    const showPass = visiblePasswords[db.id]
                    const ppaUrl = 'http://76.76.76.189:8088/'
                    const pmaUrl = `http://76.76.76.189:8080/?pma_username=${encodeURIComponent(db.db_username)}`

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
                          <div className="text-[10px] text-emerald-400 font-mono mt-0.5 flex items-center space-x-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                            <span>Dedicated Isolated Role</span>
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

                        {/* 5. Web GUI (Isolasi Dedicated phpPgAdmin & phpMyAdmin) */}
                        <td className="p-4">
                          {isPg ? (
                            <a
                              href={ppaUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => {
                                navigator.clipboard.writeText(db.db_password)
                                toast.success(`Password disalin ke clipboard! Masuk dengan user '${db.db_username}' di phpPgAdmin.`, { duration: 5000 })
                              }}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#3A2216] hover:bg-[#4D2E1F] border border-[#5E3926] text-xs text-[#E8DCB8] hover:text-white transition font-medium shadow-sm"
                              title="Buka phpPgAdmin (Password otomatis disalin)"
                            >
                              <Database className="h-3.5 w-3.5 text-[#C49767]" />
                              <span>phpPgAdmin</span>
                              <ExternalLink className="h-3 w-3 text-[#A47E65]" />
                            </a>
                          ) : (
                            <a
                              href={pmaUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => {
                                navigator.clipboard.writeText(db.db_password)
                                toast.success(`Password disalin ke clipboard! Username '${db.db_username}' terisi di phpMyAdmin.`, { duration: 5000 })
                              }}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#3D2516] hover:bg-[#52331F] border border-[#633C24] text-xs text-[#E8C58D] hover:text-white transition font-medium shadow-sm"
                              title="Buka phpMyAdmin (Password otomatis disalin)"
                            >
                              <Server className="h-3.5 w-3.5 text-[#E8C58D]" />
                              <span>phpMyAdmin</span>
                              <ExternalLink className="h-3 w-3 text-[#A47E65]" />
                            </a>
                          )}
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
                  })}
                </tbody>
              </table>
            </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 sm:p-7 text-[#FAF5EC]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 sm:p-7 text-[#FAF5EC]">
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
