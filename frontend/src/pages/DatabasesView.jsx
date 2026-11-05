import React, { useState, useEffect } from 'react'
import { Database, Plus, Trash2, Copy, Check, Eye, EyeOff, Server, ExternalLink, AlertCircle } from 'lucide-react'
import { api } from '../api/client'
import { SkeletonCard, Spinner } from '../components/Skeletons'

export default function DatabasesView() {
  const [databases, setDatabases] = useState([])
  const [externalDbs, setExternalDbs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showExternalModal, setShowExternalModal] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [visiblePasswords, setVisiblePasswords] = useState({})

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

  const fetchDatabases = async () => {
    try {
      const res = await api.get('/databases/my-databases')
      setDatabases(res.data)
    } catch (err) {
      console.error(err)
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
    try {
      await api.post('/databases/create', {
        engine,
        db_name: dbName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      })
      setShowCreateModal(false)
      setDbName('')
      fetchDatabases()
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal membuat database.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteDatabase = async (dbId, name) => {
    if (!window.confirm(`Hapus database '${name}' beserta seluruh datanya?`)) return
    try {
      await api.delete(`/databases/${dbId}`)
      fetchDatabases()
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus database.')
    }
  }

  const handleAddExternalDb = async (e) => {
    e.preventDefault()
    setError('')
    setActionLoading(true)
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
      setShowExternalModal(false)
      setExtAlias('')
      setExtHost('')
      setExtDbName('')
      setExtUser('')
      setExtPass('')
      fetchExternalDbs()
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal menyimpan database eksternal.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteExternalDb = async (extId, alias) => {
    if (!window.confirm(`Hapus koneksi '${alias}'?`)) return
    try {
      await api.delete(`/databases/external/${extId}`)
      fetchExternalDbs()
    } catch (err) {
      alert('Gagal menghapus koneksi eksternal.')
    }
  }

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-cream-50">Database Mandiri Praktikum</h2>
          <p className="text-xs text-cream-400/80 mt-1 font-sans">
            Buat dan kelola database terisolasi Anda di PostgreSQL 16 atau MariaDB 11.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => { setError(''); setShowExternalModal(true); }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-warmdark-750 hover:bg-warmdark-700 text-cream-200 border border-warmdark-700 transition"
          >
            + Simpan DB Eksternal
          </button>
          <button
            onClick={() => { setError(''); setShowCreateModal(true); }}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-cream-100 border border-emerald-500/50 shadow-md shadow-emerald-950/30 transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Database Baru</span>
          </button>
        </div>
      </div>

      {/* Internal Databases Grid */}
      <div>
        <h3 className="text-sm font-serif font-bold text-cream-100 mb-3 flex items-center space-x-2">
          <Server className="h-4 w-4 text-emerald-400" />
          <span>Database Server Lab Anda</span>
        </h3>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : databases.length === 0 ? (
          <div className="text-center py-14 bg-warmdark-850/60 border border-warmdark-750 rounded-3xl p-6">
            <Database className="h-8 w-8 text-cream-400/30 mx-auto mb-2" />
            <p className="text-xs text-cream-400/70">Belum ada database dibuat.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {databases.map((db) => {
              const isPg = db.engine === 'postgres'
              const showPass = visiblePasswords[db.id]
              return (
                <div
                  key={db.id}
                  className="bg-warmdark-850/90 border border-warmdark-750 rounded-3xl p-5 space-y-4 hover:border-chocolate-500/40 transition shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                          isPg ? 'bg-terracotta-500/10 text-terracotta-400 border border-terracotta-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {isPg ? 'PostgreSQL 16' : 'MariaDB 11'}
                      </span>
                      <h4 className="text-sm font-bold text-cream-100 font-mono">{db.db_name}</h4>
                    </div>

                    <button
                      onClick={() => handleDeleteDatabase(db.id, db.db_name)}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                      title="Hapus Database"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Credentials Box */}
                  <div className="bg-warmdark-950/90 p-4 rounded-2xl border border-warmdark-750 space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center text-cream-400/70">
                      <span>Host:</span>
                      <span className="text-cream-200 font-semibold">{db.host}:{db.port}</span>
                    </div>
                    <div className="flex justify-between items-center text-cream-400/70">
                      <span>User DB:</span>
                      <span className="text-cream-200">{db.db_username}</span>
                    </div>
                    <div className="flex justify-between items-center text-cream-400/70">
                      <span>Password:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-cream-200">{showPass ? db.db_password : '••••••••••••••••'}</span>
                        <button
                          onClick={() => togglePasswordVisibility(db.id)}
                          className="text-cream-400/60 hover:text-cream-200"
                        >
                          {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Copy URI */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => copyToClipboard(db.connection_uri, `uri-${db.id}`)}
                      className="inline-flex items-center space-x-1.5 text-xs text-terracotta-400 hover:text-terracotta-300 transition"
                    >
                      {copiedId === `uri-${db.id}` ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Tersalin ke Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Salin Connection URI</span>
                        </>
                      )}
                    </button>

                    <a
                      href="http://76.76.76.189:8978"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-cream-400/70 hover:text-cream-200 flex items-center space-x-1"
                    >
                      <span>CloudBeaver</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* External Databases */}
      <div className="pt-4 border-t border-warmdark-750/70">
        <h3 className="text-sm font-serif font-bold text-cream-100 mb-3">Koneksi Database Eksternal (Tersimpan)</h3>
        {externalDbs.length === 0 ? (
          <p className="text-xs text-cream-400/60">Belum ada koneksi database eksternal yang disimpan.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {externalDbs.map((ext) => (
              <div key={ext.id} className="bg-warmdark-850 border border-warmdark-750 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-cream-100">{ext.alias_name}</h5>
                  <p className="text-[11px] text-cream-400/70 font-mono mt-0.5">{ext.engine} • {ext.host}:{ext.port}</p>
                </div>
                <button
                  onClick={() => handleDeleteExternalDb(ext.id, ext.alias_name)}
                  className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create Database */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-warmdark-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-warmdark-850 border border-warmdark-700 rounded-3xl shadow-2xl p-6">
            <h3 className="text-base font-serif font-bold text-cream-100 mb-1">Buat Database Praktikum</h3>
            <p className="text-xs text-cream-400/80 mb-4">Sistem akan otomatis mengisolasi user dan hak akses database Anda.</p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateDatabase} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-cream-200 mb-1.5">Pilih Database Engine</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEngine('postgres')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      engine === 'postgres'
                        ? 'bg-terracotta-500/10 border-terracotta-500 text-terracotta-400'
                        : 'bg-warmdark-900 border-warmdark-700 text-cream-400'
                    }`}
                  >
                    PostgreSQL 16
                  </button>
                  <button
                    type="button"
                    onClick={() => setEngine('mariadb')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      engine === 'mariadb'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                        : 'bg-warmdark-900 border-warmdark-700 text-cream-400'
                    }`}
                  >
                    MariaDB 11
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-cream-200 mb-1">Nama Database</label>
                <input
                  type="text"
                  required
                  placeholder="contoh: tokobuku"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3.5 py-2 text-xs text-cream-100 placeholder-warmdark-700 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-cream-400/60 mt-1">Nama database otomatis diawali dengan NIM Anda.</p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-cream-400 hover:text-cream-200 hover:bg-warmdark-750 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-cream-100 border border-emerald-500/40 shadow-md shadow-emerald-950/30 transition disabled:opacity-50"
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
      )}

      {/* Modal: External Database */}
      {showExternalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-warmdark-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-warmdark-850 border border-warmdark-700 rounded-3xl shadow-2xl p-6">
            <h3 className="text-base font-serif font-bold text-cream-100 mb-1">Simpan Database Eksternal</h3>
            <p className="text-xs text-cream-400/80 mb-4">Kredensial disimpan aman terenkripsi (AES-256).</p>

            <form onSubmit={handleAddExternalDb} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-cream-200 mb-1">Nama Alias</label>
                <input
                  type="text"
                  required
                  placeholder="contoh: Supabase Prod / RDS"
                  value={extAlias}
                  onChange={(e) => setExtAlias(e.target.value)}
                  className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3.5 py-2 text-xs text-cream-100 focus:outline-none focus:border-terracotta-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-cream-200 mb-1">Host</label>
                  <input
                    type="text"
                    required
                    placeholder="db.example.com"
                    value={extHost}
                    onChange={(e) => setExtHost(e.target.value)}
                    className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3 py-2 text-xs text-cream-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cream-200 mb-1">Port</label>
                  <input
                    type="number"
                    required
                    value={extPort}
                    onChange={(e) => setExtPort(e.target.value)}
                    className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3 py-2 text-xs text-cream-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-cream-200 mb-1">Nama DB</label>
                  <input
                    type="text"
                    required
                    value={extDbName}
                    onChange={(e) => setExtDbName(e.target.value)}
                    className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3 py-2 text-xs text-cream-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cream-200 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={extUser}
                    onChange={(e) => setExtUser(e.target.value)}
                    className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3 py-2 text-xs text-cream-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-cream-200 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={extPass}
                  onChange={(e) => setExtPass(e.target.value)}
                  className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3.5 py-2 text-xs text-cream-100"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowExternalModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-cream-400 hover:text-cream-200 hover:bg-warmdark-750 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-chocolate-700 hover:bg-chocolate-600 text-cream-100 border border-chocolate-500/40 transition disabled:opacity-50"
                >
                  {actionLoading ? <Spinner size="xs" /> : 'Simpan Koneksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
