import React, { useState, useEffect } from 'react'
import { Shield, Users, UserPlus, KeyRound, Ban, Search, Clock, Sparkles } from 'lucide-react'
import { api } from '../api/client'
import { SkeletonCard, SkeletonTable, Spinner } from '../components/Skeletons'

export default function AdminView() {
  const [stats, setStats] = useState(null)
  const [cohorts, setCohorts] = useState([])
  const [classes, setClasses] = useState([])
  const [users, setUsers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [activeTab, setActiveTab] = useState('users') // 'users', 'generator', 'classes', 'logs'

  // Generator states
  const [genCohortId, setGenCohortId] = useState('')
  const [genClassId, setGenClassId] = useState('')
  const [genNimPrefix, setGenNimPrefix] = useState('23533')
  const [genStartNum, setGenStartNum] = useState(1)
  const [genCount, setGenCount] = useState(30)
  const [generatedAccounts, setGeneratedAccounts] = useState([])
  const [loadingAction, setLoadingAction] = useState(false)

  // Class create states
  const [newCohortYear, setNewCohortYear] = useState(2024)
  const [newCohortDesc, setNewCohortDesc] = useState('')
  const [newClassName, setNewClassName] = useState('')
  const [newClassCohortId, setNewClassCohortId] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    await Promise.allSettled([
      fetchStats(),
      fetchCohorts(),
      fetchClasses(),
      fetchUsers(),
      fetchAuditLogs(),
    ])
    setLoading(false)
  }

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/stats')
      setStats(res.data)
    } catch (err) {}
  }

  const fetchCohorts = async () => {
    try {
      const res = await api.get('/admin/cohorts')
      setCohorts(res.data)
      if (res.data.length > 0) {
        setGenCohortId(res.data[0].id)
        setNewClassCohortId(res.data[0].id)
      }
    } catch (err) {}
  }

  const fetchClasses = async () => {
    try {
      const res = await api.get('/admin/classes')
      setClasses(res.data)
      if (res.data.length > 0) {
        setGenClassId(res.data[0].id)
      }
    } catch (err) {}
  }

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users', {
        params: {
          search: search || undefined,
          class_id: selectedClass || undefined,
        },
      })
      setUsers(res.data)
    } catch (err) {}
  }

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/admin/audit-logs?limit=50')
      setAuditLogs(res.data)
    } catch (err) {}
  }

  const handleGenerateAccounts = async (e) => {
    e.preventDefault()
    setLoadingAction(true)
    try {
      const res = await api.post('/admin/generate-bulk-accounts', {
        cohort_id: parseInt(genCohortId),
        class_id: parseInt(genClassId),
        nim_prefix: genNimPrefix,
        start_number: parseInt(genStartNum),
        count: parseInt(genCount),
      })
      setGeneratedAccounts(res.data.accounts)
      fetchUsers()
      fetchStats()
      alert(`Berhasil membuat ${res.data.total_generated} akun mahasiswa baru!`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal generate akun.')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleCreateCohort = async (e) => {
    e.preventDefault()
    try {
      await api.post('/admin/cohorts', { year: parseInt(newCohortYear), description: newCohortDesc })
      fetchCohorts()
      alert('Angkatan berhasil ditambahkan.')
    } catch (err) {
      alert('Gagal menambah angkatan.')
    }
  }

  const handleCreateClass = async (e) => {
    e.preventDefault()
    try {
      await api.post('/admin/classes', { cohort_id: parseInt(newClassCohortId), name: newClassName })
      fetchClasses()
      setNewClassName('')
      alert('Kelas praktikum berhasil ditambahkan.')
    } catch (err) {
      alert('Gagal menambah kelas.')
    }
  }

  const handleResetPassword = async (userId, name) => {
    if (!window.confirm(`Reset password untuk ${name}?`)) return
    try {
      const res = await api.post(`/admin/users/${userId}/reset-password`)
      alert(`Password baru sementara: ${res.data.new_temporary_password}`)
    } catch (err) {
      alert('Gagal reset password.')
    }
  }

  const handleToggleStatus = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/toggle-status`)
      fetchUsers()
    } catch (err) {
      alert('Gagal mengubah status akun.')
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif font-bold text-cream-50 flex items-center space-x-2">
            <Shield className="h-5 w-5 text-terracotta-400" />
            <span>Admin Lab Panel — MiraiGrid</span>
          </h2>
          <p className="text-xs text-cream-400/80 mt-1 font-sans">
            Kelola angkatan, kelas praktikum, akun mahasiswa massal, dan audit log.
          </p>
        </div>
      </div>

      {/* Global Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-warmdark-850/90 border border-warmdark-750 p-5 rounded-2xl shadow-sm">
            <p className="text-xs text-cream-400/70">Total Mahasiswa</p>
            <p className="text-2xl font-black text-cream-50 mt-1 font-sans">{stats?.total_students ?? 0}</p>
          </div>
          <div className="bg-warmdark-850/90 border border-warmdark-750 p-5 rounded-2xl shadow-sm">
            <p className="text-xs text-cream-400/70">Project Aktif</p>
            <p className="text-2xl font-black text-terracotta-400 mt-1 font-sans">{stats?.total_projects ?? 0}</p>
          </div>
          <div className="bg-warmdark-850/90 border border-warmdark-750 p-5 rounded-2xl shadow-sm">
            <p className="text-xs text-cream-400/70">Database Siswa</p>
            <p className="text-2xl font-black text-emerald-400 mt-1 font-sans">{stats?.total_databases ?? 0}</p>
          </div>
          <div className="bg-warmdark-850/90 border border-warmdark-750 p-5 rounded-2xl shadow-sm">
            <p className="text-xs text-cream-400/70">Kelas Praktikum</p>
            <p className="text-2xl font-black text-amber-300 mt-1 font-sans">{stats?.total_classes ?? 0}</p>
          </div>
        </div>
      )}

      {/* Sub Navigation */}
      <div className="flex border-b border-warmdark-750 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'users' ? 'border-terracotta-500 text-terracotta-400' : 'border-transparent text-cream-400/70 hover:text-cream-200'
          }`}
        >
          Daftar Mahasiswa
        </button>
        <button
          onClick={() => setActiveTab('generator')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'generator' ? 'border-terracotta-500 text-terracotta-400' : 'border-transparent text-cream-400/70 hover:text-cream-200'
          }`}
        >
          Generator Akun Massal
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'classes' ? 'border-terracotta-500 text-terracotta-400' : 'border-transparent text-cream-400/70 hover:text-cream-200'
          }`}
        >
          Kelola Angkatan & Kelas
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'logs' ? 'border-terracotta-500 text-terracotta-400' : 'border-transparent text-cream-400/70 hover:text-cream-200'
          }`}
        >
          Audit Log
        </button>
      </div>

      {/* TAB 1: USER LIST */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-cream-400/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari NIM atau Nama Mahasiswa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl pl-10 pr-4 py-2 text-xs text-cream-100 placeholder-warmdark-700 focus:outline-none focus:border-terracotta-500"
              />
            </div>
            <select
              value={selectedClass}
              onChange={(e) => { setSelectedClass(e.target.value); setTimeout(fetchUsers, 50); }}
              className="bg-warmdark-900 border border-warmdark-700 rounded-xl px-3 py-2 text-xs text-cream-100 focus:outline-none focus:border-terracotta-500"
            >
              <option value="">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.cohort_year})</option>
              ))}
            </select>
            <button
              onClick={fetchUsers}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-chocolate-700 hover:bg-chocolate-600 text-cream-100 border border-chocolate-500/40 transition"
            >
              Filter
            </button>
          </div>

          <div className="bg-warmdark-850/90 border border-warmdark-750 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-cream-200">
                <thead className="bg-warmdark-950 text-cream-400/80 uppercase text-[10px] tracking-wider border-b border-warmdark-750">
                  <tr>
                    <th className="p-3.5">NIM / Username</th>
                    <th className="p-3.5">Nama</th>
                    <th className="p-3.5">Kelas / Angkatan</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warmdark-750/70">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-warmdark-800/40 transition">
                      <td className="p-3.5 font-mono font-semibold text-cream-50">{u.username}</td>
                      <td className="p-3.5 font-medium">{u.name}</td>
                      <td className="p-3.5 text-cream-400/80">
                        {u.class_name ? `${u.class_name} (${u.cohort_year})` : '-'}
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          u.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {u.is_active ? 'Aktif' : 'Suspended'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        <button
                          onClick={() => handleResetPassword(u.id, u.name)}
                          title="Reset Password Sementara"
                          className="p-1.5 text-cream-400 hover:text-amber-400 hover:bg-warmdark-750 rounded-lg transition"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          title={u.is_active ? 'Suspend Akun' : 'Aktifkan Akun'}
                          className={`p-1.5 rounded-lg transition ${
                            u.is_active ? 'text-cream-400 hover:text-rose-400 hover:bg-warmdark-750' : 'text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GENERATOR */}
      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-warmdark-850/90 border border-warmdark-750 rounded-3xl p-6 shadow-sm">
            <h3 className="text-base font-serif font-bold text-cream-100 mb-1 flex items-center space-x-2">
              <UserPlus className="h-4 w-4 text-terracotta-400" />
              <span>Generator Akun Kelas Sekali Klik</span>
            </h3>
            <p className="text-xs text-cream-400/80 mb-5">
              Sistem akan otomatis membuat rentang akun mahasiswa dengan password awal unik acak.
            </p>

            <form onSubmit={handleGenerateAccounts} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-cream-200 mb-1">Pilih Angkatan</label>
                <select
                  value={genCohortId}
                  onChange={(e) => setGenCohortId(e.target.value)}
                  className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3.5 py-2 text-xs text-cream-100 focus:outline-none focus:border-terracotta-500"
                >
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>Angkatan {c.year} - {c.description}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-cream-200 mb-1">Pilih Kelas</label>
                <select
                  value={genClassId}
                  onChange={(e) => setGenClassId(e.target.value)}
                  className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3.5 py-2 text-xs text-cream-100 focus:outline-none focus:border-terracotta-500"
                >
                  {classes.map((cl) => (
                    <option key={cl.id} value={cl.id}>{cl.name} (Tahun {cl.cohort_year})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-cream-200 mb-1">Prefix NIM</label>
                  <input
                    type="text"
                    required
                    value={genNimPrefix}
                    onChange={(e) => setGenNimPrefix(e.target.value)}
                    className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3 py-2 text-xs text-cream-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cream-200 mb-1">Nomor Awal</label>
                  <input
                    type="number"
                    required
                    value={genStartNum}
                    onChange={(e) => setGenStartNum(e.target.value)}
                    className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3 py-2 text-xs text-cream-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cream-200 mb-1">Jumlah</label>
                  <input
                    type="number"
                    required
                    value={genCount}
                    onChange={(e) => setGenCount(e.target.value)}
                    className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3 py-2 text-xs text-cream-100 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingAction}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-chocolate-700 hover:bg-chocolate-600 text-cream-100 border border-chocolate-500/40 shadow-lg shadow-chocolate-950/40 transition disabled:opacity-50 mt-2"
              >
                {loadingAction ? (
                  <span className="flex items-center justify-center space-x-1.5">
                    <Spinner size="xs" />
                    <span>Sedang Memproses Akun...</span>
                  </span>
                ) : (
                  'Generate Akun Sekarang'
                )}
              </button>
            </form>
          </div>

          {/* Results Box */}
          <div className="bg-warmdark-850/90 border border-warmdark-750 rounded-3xl p-6 shadow-sm flex flex-col">
            <h3 className="text-base font-serif font-bold text-cream-100 mb-1">Hasil Akun Baru</h3>
            <p className="text-xs text-cream-400/80 mb-4">Salin dan bagikan password sementara ini kepada mahasiswa.</p>

            <div className="bg-warmdark-950 border border-warmdark-750/80 rounded-2xl p-4 flex-1 overflow-y-auto max-h-96 font-mono text-xs text-cream-200">
              {generatedAccounts.length === 0 ? (
                <span className="text-cream-400/40">Daftar akun yang baru digenerate akan muncul di sini.</span>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] text-cream-400/60 pb-2 border-b border-warmdark-750 flex justify-between">
                    <span>NIM</span>
                    <span>INITIAL PASSWORD</span>
                  </div>
                  {generatedAccounts.map((acc) => (
                    <div key={acc.nim} className="flex justify-between items-center text-cream-200 py-1">
                      <span className="font-bold text-terracotta-400">{acc.nim}</span>
                      <span className="bg-warmdark-900 px-2 py-0.5 rounded text-amber-300 font-mono border border-warmdark-750">{acc.initial_password}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLASSES & COHORTS */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-warmdark-850/90 border border-warmdark-750 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-serif font-bold text-cream-100 mb-3">Tambah Angkatan</h3>
            <form onSubmit={handleCreateCohort} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-cream-200 mb-1">Tahun Angkatan</label>
                <input
                  type="number"
                  required
                  value={newCohortYear}
                  onChange={(e) => setNewCohortYear(e.target.value)}
                  className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3.5 py-2 text-xs text-cream-100 focus:outline-none focus:border-terracotta-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-cream-200 mb-1">Deskripsi</label>
                <input
                  type="text"
                  placeholder="e.g. Mahasiswa Angkatan 2024"
                  value={newCohortDesc}
                  onChange={(e) => setNewCohortDesc(e.target.value)}
                  className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3.5 py-2 text-xs text-cream-100 focus:outline-none focus:border-terracotta-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-chocolate-700 hover:bg-chocolate-600 text-cream-100 border border-chocolate-500/40 transition"
              >
                Simpan Angkatan
              </button>
            </form>
          </div>

          <div className="bg-warmdark-850/90 border border-warmdark-750 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-serif font-bold text-cream-100 mb-3">Tambah Kelas Praktikum</h3>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-cream-200 mb-1">Pilih Angkatan</label>
                <select
                  value={newClassCohortId}
                  onChange={(e) => setNewClassCohortId(e.target.value)}
                  className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3.5 py-2 text-xs text-cream-100 focus:outline-none focus:border-terracotta-500"
                >
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>Angkatan {c.year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-cream-200 mb-1">Nama Kelas</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TI-A / Praktikum Basis Data A"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl px-3.5 py-2 text-xs text-cream-100 focus:outline-none focus:border-terracotta-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-cream-100 border border-emerald-500/40 transition"
              >
                Simpan Kelas
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-warmdark-850/90 border border-warmdark-750 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-warmdark-750 flex items-center justify-between">
            <h4 className="text-sm font-serif font-bold text-cream-100 flex items-center space-x-2">
              <Clock className="h-4 w-4 text-terracotta-400" />
              <span>Aktivitas Sistem & Audit Log (50 Terakhir)</span>
            </h4>
            <button
              onClick={fetchAuditLogs}
              className="text-xs text-terracotta-400 hover:underline"
            >
              Refresh
            </button>
          </div>
          <div className="divide-y divide-warmdark-750 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-warmdark-800/40 flex items-center justify-between gap-4 transition">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-cream-100">{log.actor_name || 'System'}</span>
                    <span className="bg-warmdark-950 px-2 py-0.5 rounded-lg text-[10px] font-mono text-terracotta-400 border border-warmdark-750">{log.action}</span>
                    <span className="text-cream-400/50 text-[11px] font-mono">[{log.ip_address}]</span>
                  </div>
                  <p className="text-cream-300/80 text-xs mt-1">{log.details}</p>
                </div>
                <span className="text-[11px] text-cream-400/50 whitespace-nowrap">{log.created_at}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
