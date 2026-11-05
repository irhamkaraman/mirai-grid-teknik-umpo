import React, { useState, useEffect } from 'react'
import { Shield, Users, UserPlus, KeyRound, Ban, Search, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonCard, SkeletonTable, Spinner } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import ModalPortal from '../components/ModalPortal'

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

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: () => {} })

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
    const toastId = toast.loading('Sedang membuat akun massal...')
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
      toast.success(`Berhasil membuat ${res.data.total_generated} akun mahasiswa baru!`, { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal generate akun.', { id: toastId })
    } finally {
      setLoadingAction(false)
    }
  }

  const handleCreateCohort = async (e) => {
    e.preventDefault()
    try {
      await api.post('/admin/cohorts', { year: parseInt(newCohortYear), description: newCohortDesc })
      fetchCohorts()
      toast.success('Angkatan berhasil ditambahkan.')
    } catch (err) {
      toast.error('Gagal menambah angkatan.')
    }
  }

  const handleCreateClass = async (e) => {
    e.preventDefault()
    try {
      await api.post('/admin/classes', { cohort_id: parseInt(newClassCohortId), name: newClassName })
      fetchClasses()
      setNewClassName('')
      toast.success('Kelas praktikum berhasil ditambahkan.')
    } catch (err) {
      toast.error('Gagal menambah kelas.')
    }
  }

  const triggerResetPassword = (userId, name) => {
    setConfirmModal({
      open: true,
      title: 'Reset Password?',
      message: `Reset password untuk mahasiswa '${name}' ke password sementara?`,
      onConfirm: async () => {
        try {
          const res = await api.post(`/admin/users/${userId}/reset-password`)
          toast.success(`Password sementara baru: ${res.data.new_temporary_password}`, { duration: 10000 })
        } catch (err) {
          toast.error('Gagal reset password.')
        }
      }
    })
  }

  const handleToggleStatus = async (userId) => {
    try {
      const res = await api.post(`/admin/users/${userId}/toggle-status`)
      fetchUsers()
      toast.success(res.data.is_active ? 'Akun telah diaktifkan kembali.' : 'Akun telah di-suspend.')
    } catch (err) {
      toast.error('Gagal mengubah status akun.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#26160F] flex items-center space-x-2">
            <Shield className="h-6 w-6 text-[#5A3521]" />
            <span>Admin Lab Panel — MiraiGrid</span>
          </h2>
          <p className="text-xs text-[#5C3B29] mt-1 font-sans">
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
          <div className="bg-[#2B1810] border border-[#4D2D1E] p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
            <p className="text-xs text-[#DFCDB5]">Total Mahasiswa</p>
            <p className="text-2xl font-black text-[#FAF5EC] mt-1 font-sans">{stats?.total_students ?? 0}</p>
          </div>
          <div className="bg-[#2B1810] border border-[#4D2D1E] p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
            <p className="text-xs text-[#DFCDB5]">Project Aktif</p>
            <p className="text-2xl font-black text-[#E8DCB8] mt-1 font-sans">{stats?.total_projects ?? 0}</p>
          </div>
          <div className="bg-[#2B1810] border border-[#4D2D1E] p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
            <p className="text-xs text-[#DFCDB5]">Database Siswa</p>
            <p className="text-2xl font-black text-emerald-400 mt-1 font-sans">{stats?.total_databases ?? 0}</p>
          </div>
          <div className="bg-[#2B1810] border border-[#4D2D1E] p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
            <p className="text-xs text-[#DFCDB5]">Kelas Praktikum</p>
            <p className="text-2xl font-black text-[#E8C58D] mt-1 font-sans">{stats?.total_classes ?? 0}</p>
          </div>
        </div>
      )}

      {/* Sub Navigation */}
      <div className="flex border-b border-[#DECDBD] space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'users' ? 'border-[#5A3521] text-[#26160F] font-bold' : 'border-transparent text-[#7A5A48] hover:text-[#26160F]'
          }`}
        >
          Daftar Mahasiswa
        </button>
        <button
          onClick={() => setActiveTab('generator')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'generator' ? 'border-[#5A3521] text-[#26160F] font-bold' : 'border-transparent text-[#7A5A48] hover:text-[#26160F]'
          }`}
        >
          Generator Akun Massal
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'classes' ? 'border-[#5A3521] text-[#26160F] font-bold' : 'border-transparent text-[#7A5A48] hover:text-[#26160F]'
          }`}
        >
          Kelola Angkatan & Kelas
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'logs' ? 'border-[#5A3521] text-[#26160F] font-bold' : 'border-transparent text-[#7A5A48] hover:text-[#26160F]'
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
              <Search className="h-4 w-4 text-[#7A5A48] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari NIM atau Nama Mahasiswa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                className="w-full bg-[#DECDBD] border border-[#BFAB96] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#26160F] placeholder-[#7A5A48] focus:outline-none focus:border-[#5A3521]"
              />
            </div>
            <select
              value={selectedClass}
              onChange={(e) => { setSelectedClass(e.target.value); setTimeout(fetchUsers, 50); }}
              className="bg-[#DECDBD] border border-[#BFAB96] rounded-2xl px-4 py-2.5 text-xs text-[#26160F] focus:outline-none focus:border-[#5A3521]"
            >
              <option value="">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.cohort_year})</option>
              ))}
            </select>
            <button
              onClick={fetchUsers}
              className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#2B1810] hover:bg-[#3D2317] text-[#FAF5EC] transition"
            >
              Filter
            </button>
          </div>

          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl overflow-hidden shadow-xl text-[#FAF5EC]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#FAF5EC]">
                <thead className="bg-[#1C0F0A] text-[#DFCDB5] uppercase text-[10px] tracking-wider border-b border-[#3E2316]">
                  <tr>
                    <th className="p-4">NIM / Username</th>
                    <th className="p-4">Nama</th>
                    <th className="p-4">Kelas / Angkatan</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3E2316]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#361E13] transition">
                      <td className="p-4 font-mono font-semibold text-[#FAF5EC]">{u.username}</td>
                      <td className="p-4 font-medium">{u.name}</td>
                      <td className="p-4 text-[#DFCDB5]">
                        {u.class_name ? `${u.class_name} (${u.cohort_year})` : '-'}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          u.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {u.is_active ? 'Aktif' : 'Suspended'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-1">
                        <button
                          onClick={() => triggerResetPassword(u.id, u.name)}
                          title="Reset Password Sementara"
                          className="p-1.5 text-[#DFCDB5] hover:text-[#E8C58D] hover:bg-[#3E2316] rounded-lg transition"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          title={u.is_active ? 'Suspend Akun' : 'Aktifkan Akun'}
                          className={`p-1.5 rounded-lg transition ${
                            u.is_active ? 'text-[#DFCDB5] hover:text-rose-400 hover:bg-[#3E2316]' : 'text-emerald-400 hover:bg-emerald-500/10'
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
          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-7 shadow-xl text-[#FAF5EC]">
            <h3 className="text-lg font-serif font-bold text-[#FAF5EC] mb-1 flex items-center space-x-2">
              <UserPlus className="h-5 w-5 text-[#E8DCB8]" />
              <span>Generator Akun Kelas Sekali Klik</span>
            </h3>
            <p className="text-xs text-[#DFCDB5] mb-5">
              Sistem akan otomatis membuat rentang akun mahasiswa dengan password awal unik acak.
            </p>

            <form onSubmit={handleGenerateAccounts} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Pilih Angkatan</label>
                <select
                  value={genCohortId}
                  onChange={(e) => setGenCohortId(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                >
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>Angkatan {c.year} - {c.description}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Pilih Kelas</label>
                <select
                  value={genClassId}
                  onChange={(e) => setGenClassId(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                >
                  {classes.map((cl) => (
                    <option key={cl.id} value={cl.id}>{cl.name} (Tahun {cl.cohort_year})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Prefix NIM</label>
                  <input
                    type="text"
                    required
                    value={genNimPrefix}
                    onChange={(e) => setGenNimPrefix(e.target.value)}
                    className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3 py-2 text-xs text-[#FAF5EC] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Nomor Awal</label>
                  <input
                    type="number"
                    required
                    value={genStartNum}
                    onChange={(e) => setGenStartNum(e.target.value)}
                    className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3 py-2 text-xs text-[#FAF5EC] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Jumlah</label>
                  <input
                    type="number"
                    required
                    value={genCount}
                    onChange={(e) => setGenCount(e.target.value)}
                    className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3 py-2 text-xs text-[#FAF5EC] font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingAction}
                className="w-full py-3 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] shadow-lg shadow-black/20 transition disabled:opacity-50 mt-2"
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
          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col text-[#FAF5EC]">
            <h3 className="text-lg font-serif font-bold text-[#FAF5EC] mb-1">Hasil Akun Baru</h3>
            <p className="text-xs text-[#DFCDB5] mb-4">Salin dan bagikan password sementara ini kepada mahasiswa.</p>

            <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-4 flex-1 overflow-y-auto max-h-96 font-mono text-xs text-[#FAF5EC]">
              {generatedAccounts.length === 0 ? (
                <span className="text-[#7A5A48]">Daftar akun yang baru digenerate akan muncul di sini.</span>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#A47E65] pb-2 border-b border-[#3E2316] flex justify-between">
                    <span>NIM</span>
                    <span>INITIAL PASSWORD</span>
                  </div>
                  {generatedAccounts.map((acc) => (
                    <div key={acc.nim} className="flex justify-between items-center text-[#FAF5EC] py-1">
                      <span className="font-bold text-[#E8DCB8]">{acc.nim}</span>
                      <span className="bg-[#3A2115] px-2 py-0.5 rounded text-[#E8C58D] font-mono border border-[#543221]">{acc.initial_password}</span>
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
          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-7 shadow-xl text-[#FAF5EC]">
            <h3 className="text-base font-serif font-bold text-[#FAF5EC] mb-3">Tambah Angkatan</h3>
            <form onSubmit={handleCreateCohort} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Tahun Angkatan</label>
                <input
                  type="number"
                  required
                  value={newCohortYear}
                  onChange={(e) => setNewCohortYear(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Deskripsi</label>
                <input
                  type="text"
                  placeholder="e.g. Mahasiswa Angkatan 2024"
                  value={newCohortDesc}
                  onChange={(e) => setNewCohortDesc(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] transition"
              >
                Simpan Angkatan
              </button>
            </form>
          </div>

          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-7 shadow-xl text-[#FAF5EC]">
            <h3 className="text-base font-serif font-bold text-[#FAF5EC] mb-3">Tambah Kelas Praktikum</h3>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Pilih Angkatan</label>
                <select
                  value={newClassCohortId}
                  onChange={(e) => setNewClassCohortId(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                >
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>Angkatan {c.year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Nama Kelas</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TI-A / Praktikum Basis Data A"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-[#FAF5EC] border border-emerald-500/40 transition"
              >
                Simpan Kelas
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl overflow-hidden shadow-xl text-[#FAF5EC]">
          <div className="p-4 sm:p-5 border-b border-[#3E2316] flex items-center justify-between">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
              <Clock className="h-5 w-5 text-[#E8DCB8]" />
              <span>Aktivitas Sistem & Audit Log (50 Terakhir)</span>
            </h4>
            <button
              onClick={fetchAuditLogs}
              className="text-xs text-[#E8DCB8] hover:underline"
            >
              Refresh
            </button>
          </div>
          <div className="divide-y divide-[#3E2316] text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-[#361E13] flex items-center justify-between gap-4 transition">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-[#FAF5EC]">{log.actor_name || 'System'}</span>
                    <span className="bg-[#1C0F0A] px-2 py-0.5 rounded-lg text-[10px] font-mono text-[#E8DCB8] border border-[#3E2316]">{log.action}</span>
                    <span className="text-[#A47E65] text-[11px] font-mono">[{log.ip_address}]</span>
                  </div>
                  <p className="text-[#DFCDB5] text-xs mt-1">{log.details}</p>
                </div>
                <span className="text-[11px] text-[#A47E65] whitespace-nowrap">{log.created_at}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ open: false, title: '', message: '', onConfirm: () => {} })}
      />
    </div>
  )
}
