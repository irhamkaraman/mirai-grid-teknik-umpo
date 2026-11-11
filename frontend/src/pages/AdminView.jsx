import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, Users, UserPlus, KeyRound, Ban, Search, Clock, Trash2, Plus, Sparkles,
  UserCheck, ChevronLeft, ChevronRight, Sliders, HardDrive, Cpu, X, Database, ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonCard, SkeletonTable, Spinner } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import ModalPortal from '../components/ModalPortal'

export default function AdminView({ onNavigate }) {
  const routerNavigate = useNavigate()
  const navigate = (p) => onNavigate ? onNavigate(p) : routerNavigate(p)
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [userPage, setUserPage] = useState(1)
  const [userPageSize, setUserPageSize] = useState(10)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedRole, setSelectedRole] = useState('') // '' = all, 'student', 'admin'
  const [activeTab, setActiveTab] = useState('users') // 'users', 'create', 'logs'

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: () => {} })

  // Bulk selection states
  const [selectedUserIds, setSelectedUserIds] = useState([])

  // Resource limit modal states (bulk only)
  const [limitModal, setLimitModal] = useState({
    open: false,
    isBulk: false,
    userId: null,
    username: '',
    name: '',
    maxDiskMb: 1000,
    maxMemoryMb: 512,
    maxCpuCores: 1.0,
  })
  const [savingLimit, setSavingLimit] = useState(false)
  const [loadingAction, setLoadingAction] = useState(false)

  // Single Account Creation states
  const [manualUsername, setManualUsername] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualPassword, setManualPassword] = useState('')
  const [manualRole, setManualRole] = useState('student')
  const [manualMustChange, setManualMustChange] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    await Promise.allSettled([
      fetchStats(),
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

  const fetchUsers = async () => {
    setUserPage(1)
    try {
      const res = await api.get('/admin/users', {
        params: {
          search: search || undefined,
        },
      })
      setUsers(res.data || [])
    } catch (err) {}
  }

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/admin/audit-logs?limit=50')
      setAuditLogs(res.data || [])
    } catch (err) {}
  }

  // Create Single Account (Student or Admin)
  const handleCreateAccount = async (e) => {
    e.preventDefault()
    setLoadingAction(true)
    const toastId = toast.loading('Membuat akun baru...')
    try {
      await api.post('/admin/users/create', {
        username: manualUsername.trim(),
        name: manualName.trim(),
        password: manualPassword,
        role: manualRole,
        class_id: null,
        must_change_password: manualMustChange,
      })
      toast.success(`Akun '${manualUsername}' (${manualRole === 'admin' ? 'Administrator' : 'Mahasiswa'}) berhasil dibuat!`, { id: toastId })
      setManualUsername('')
      setManualName('')
      setManualPassword('')
      setManualRole('student')
      fetchUsers()
      fetchStats()
      setActiveTab('users')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membuat akun.', { id: toastId })
    } finally {
      setLoadingAction(false)
    }
  }

  // User Actions
  const triggerResetPassword = (userId, name) => {
    setConfirmModal({
      open: true,
      title: 'Reset Password Akun?',
      message: `Reset password untuk ${name}? Sistem akan membuat password sementara acak dan mewajibkan ganti password saat login berikutnya.`,
      onConfirm: async () => {
        try {
          const res = await api.post(`/admin/users/${userId}/reset-password`)
          const newPass = res.data.new_temporary_password
          toast.success(
            <div>
              <p className="font-bold">Password Berhasil Direset!</p>
              <p className="font-mono text-xs mt-1">Password Baru: <strong>{newPass}</strong></p>
            </div>,
            { duration: 10000 }
          )
          fetchUsers()
        } catch (err) {
          toast.error('Gagal mereset password.')
        }
      }
    })
  }

  const triggerToggleSuspend = (userId, name, currentStatus) => {
    const actionText = currentStatus ? 'Nonaktifkan (Suspend)' : 'Aktifkan Kembali'
    setConfirmModal({
      open: true,
      title: `${actionText} Akun?`,
      message: `${actionText} akun ${name}? ${currentStatus ? 'User tidak akan bisa login ke sistem.' : 'User akan dapat kembali mengakses platform.'}`,
      onConfirm: async () => {
        try {
          await api.post(`/admin/users/${userId}/toggle-suspend`)
          toast.success(`Status akun ${name} berhasil diperbarui.`)
          fetchUsers()
        } catch (err) {
          toast.error('Gagal memperbarui status akun.')
        }
      }
    })
  }

  const triggerDeleteUser = (userId, name) => {
    setConfirmModal({
      open: true,
      title: 'Hapus Akun Pengguna?',
      message: `Hapus akun '${name}' secara permanen? Seluruh project, file di direktori home, dan database terkait akan dibersihkan.`,
      danger: true,
      confirmText: 'Hapus Permanen',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/users/${userId}`)
          toast.success(`Akun ${name} berhasil dihapus.`)
          fetchUsers()
          fetchStats()
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Gagal menghapus akun.')
        }
      }
    })
  }

  // Filtered & Paginated Users
  const filteredUsers = useMemo(() => {
    if (!selectedRole) return users
    return users.filter((u) => u.role === selectedRole)
  }, [users, selectedRole])

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / userPageSize))
  const paginatedUsers = filteredUsers.slice((userPage - 1) * userPageSize, userPage * userPageSize)

  // Selection helpers (only student role accounts can be selected/bulk deleted)
  const selectableUsersOnPage = paginatedUsers.filter((u) => u.role !== 'admin')
  const allPageSelected = selectableUsersOnPage.length > 0 && selectableUsersOnPage.every((u) => selectedUserIds.includes(u.id))
  const somePageSelected = selectableUsersOnPage.some((u) => selectedUserIds.includes(u.id))

  const handleToggleSelectAll = () => {
    if (allPageSelected) {
      const pageIds = selectableUsersOnPage.map((u) => u.id)
      setSelectedUserIds((prev) => prev.filter((id) => !pageIds.includes(id)))
    } else {
      const pageIds = selectableUsersOnPage.map((u) => u.id)
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  const handleToggleSelectUser = (id) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const triggerBulkDelete = () => {
    if (selectedUserIds.length === 0) return
    setConfirmModal({
      open: true,
      title: 'Hapus Massal Akun Mahasiswa?',
      message: `Apakah Anda yakin ingin menghapus ${selectedUserIds.length} akun mahasiswa terpilih secara permanen? Seluruh project, direktori web, dan database terkait juga akan dibersihkan. Tindakan ini tidak dapat dibatalkan.`,
      danger: true,
      confirmText: `Hapus ${selectedUserIds.length} Akun`,
      onConfirm: async () => {
        const toastId = toast.loading(`Menghapus ${selectedUserIds.length} akun mahasiswa...`)
        try {
          const res = await api.post('/admin/users/bulk-delete', { user_ids: selectedUserIds })
          toast.success(res.data.message || `Berhasil menghapus ${res.data.deleted_count} akun!`, { id: toastId })
          setSelectedUserIds([])
          fetchUsers()
          fetchStats()
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Gagal menghapus akun massal.', { id: toastId })
        }
      }
    })
  }

  const openLimitPage = (u) => {
    navigate(`/admin/users/${u.id}/config`)
  }

  const openBulkLimitModal = () => {
    if (selectedUserIds.length === 0) return
    setLimitModal({
      open: true,
      isBulk: true,
      userId: null,
      username: `${selectedUserIds.length} Akun Mahasiswa Terpilih`,
      name: 'Pengaturan Limit Massal',
      maxDiskMb: 1000,
      maxDatabaseDiskMb: 100,
      maxMemoryMb: 512,
      maxCpuCores: 1.0,
    })
  }

  const handleSaveBulkLimit = async (e) => {
    e.preventDefault()
    setSavingLimit(true)
    const toastId = toast.loading('Menyimpan konfigurasi limit resource & database...')
    try {
      const res = await api.post('/admin/users/bulk-quota', {
        user_ids: selectedUserIds,
        max_disk_mb: parseInt(limitModal.maxDiskMb),
        max_database_disk_mb: parseInt(limitModal.maxDatabaseDiskMb || 100),
        max_memory_mb: parseInt(limitModal.maxMemoryMb),
        max_cpu_cores: parseFloat(limitModal.maxCpuCores),
      })
      toast.success(res.data.message || 'Limit resource berhasil diperbarui.', { id: toastId })
      setLimitModal((prev) => ({ ...prev, open: false }))
      setSelectedUserIds([])
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan limit resource.', { id: toastId })
    } finally {
      setSavingLimit(false)
    }
  }

  // Dynamic user counters
  const totalStudents = users.filter((u) => u.role === 'student').length
  const totalAdmins = users.filter((u) => u.role === 'admin').length

  return (
    <div className="space-y-6 font-sans w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-extrabold text-[#26160F] flex items-center space-x-2.5">
            <Users className="h-6 w-6 text-[#5A3521]" />
            <span>Kelola Akun – MiraiGrid</span>
          </h2>
          <p className="text-xs text-[#7A5A48] mt-1">
            Kelola akun pengguna (Student & Admin), alokasi kuota resource, dan audit log aktivitas.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('create')}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-[#2B1810] hover:bg-[#3E2316] text-[#FAF5EC] border border-[#4D2D1E] shadow-md transition font-semibold text-xs shrink-0"
        >
          <UserPlus className="h-4 w-4 text-[#C49767]" />
          <span>Tambah Akun Baru</span>
        </button>
      </div>

      {/* Global Stat Cards: Berdasarkan Role Student vs Admin */}
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
            <p className="text-xs text-[#DFCDB5]">Total Pengguna</p>
            <p className="text-2xl font-black text-[#FAF5EC] mt-1 font-sans">{users.length}</p>
            <p className="text-[10px] text-[#A47E65] mt-1">Semua Akun Terdaftar</p>
          </div>
          <div className="bg-[#2B1810] border border-[#4D2D1E] p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
            <p className="text-xs text-[#DFCDB5]">Mahasiswa (Student)</p>
            <p className="text-2xl font-black text-cyan-300 mt-1 font-sans">{totalStudents}</p>
            <p className="text-[10px] text-[#A47E65] mt-1">Akun Praktikan Sandbox</p>
          </div>
          <div className="bg-[#2B1810] border border-[#4D2D1E] p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
            <p className="text-xs text-[#DFCDB5]">Administrator (Admin)</p>
            <p className="text-2xl font-black text-amber-300 mt-1 font-sans">{totalAdmins}</p>
            <p className="text-[10px] text-[#A47E65] mt-1">Akses Root & Manajemen</p>
          </div>
          <div className="bg-[#2B1810] border border-[#4D2D1E] p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
            <p className="text-xs text-[#DFCDB5]">Resource Aktif</p>
            <p className="text-2xl font-black text-emerald-400 mt-1 font-sans">
              {(stats?.total_projects ?? 0) + (stats?.total_databases ?? 0)}
            </p>
            <p className="text-[10px] text-[#A47E65] mt-1">
              {stats?.total_projects ?? 0} Proj • {stats?.total_databases ?? 0} DB
            </p>
          </div>
        </div>
      )}

      {/* Sub Navigation (Disederhanakan: Daftar Akun, Tambah Akun, Audit Log) */}
      <div className="flex border-b border-[#DECDBD] space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition flex items-center space-x-2 ${
            activeTab === 'users' ? 'border-[#5A3521] text-[#26160F] font-bold' : 'border-transparent text-[#7A5A48] hover:text-[#26160F]'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Daftar Akun</span>
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition flex items-center space-x-2 ${
            activeTab === 'create' ? 'border-[#5A3521] text-[#26160F] font-bold' : 'border-transparent text-[#7A5A48] hover:text-[#26160F]'
          }`}
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>Tambah Akun</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition flex items-center space-x-2 ${
            activeTab === 'logs' ? 'border-[#5A3521] text-[#26160F] font-bold' : 'border-transparent text-[#7A5A48] hover:text-[#26160F]'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Audit Log</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: DAFTAR AKUN (ROLE STUDENT & ADMIN)                 */}
      {/* ======================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search Bar & Filter Berdasarkan Role */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-[#7A5A48] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari NIM, Username, atau Nama Akun..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                className="w-full bg-[#DECDBD] border border-[#BFAB96] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#26160F] placeholder-[#7A5A48] focus:outline-none focus:border-[#5A3521]"
              />
            </div>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value)
                setUserPage(1)
              }}
              className="bg-[#DECDBD] border border-[#BFAB96] rounded-2xl px-4 py-2.5 text-xs text-[#26160F] focus:outline-none focus:border-[#5A3521] font-medium"
            >
              <option value="">Semua Role (Student & Admin)</option>
              <option value="student">Mahasiswa (Student)</option>
              <option value="admin">Administrator (Admin)</option>
            </select>
            <button
              onClick={fetchUsers}
              className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#2B1810] hover:bg-[#3D2317] text-[#FAF5EC] transition"
            >
              Cari
            </button>
          </div>

          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl overflow-hidden shadow-xl text-[#FAF5EC]">
            {/* Bulk Action Toolbar */}
            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#1C0F0A] border-b border-[#3E2316] text-xs animate-in fade-in duration-150">
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-[#5A3521]/60 text-[#E8DCB8] border border-[#7D492F] font-mono font-semibold">
                    {selectedUserIds.length} Akun Terpilih
                  </span>
                  <span className="text-[#DFCDB5] text-xs hidden sm:inline">
                    Pilih aksi massal untuk seluruh akun mahasiswa yang dicentang:
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={openBulkLimitModal}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#3A2216] hover:bg-[#4D2E1F] border border-[#5A3521] text-[#FAF5EC] transition shadow-md"
                  >
                    <Sliders className="h-3.5 w-3.5 text-[#C49767]" />
                    <span>Atur Limit ({selectedUserIds.length})</span>
                  </button>
                  <button
                    onClick={triggerBulkDelete}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600/90 hover:bg-rose-600 text-white transition shadow-md shadow-rose-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Hapus Massal ({selectedUserIds.length})</span>
                  </button>
                  <button
                    onClick={() => setSelectedUserIds([])}
                    className="p-1.5 text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3E2316] rounded-xl transition"
                    title="Batalkan Pilihan"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#FAF5EC]">
                <thead className="bg-[#1C0F0A] text-[#DFCDB5] uppercase text-[10px] tracking-wider border-b border-[#3E2316]">
                  <tr>
                    <th className="p-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = somePageSelected && !allPageSelected
                        }}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded border-[#4D2D1E] text-[#C49767] focus:ring-0 focus:ring-offset-0 bg-[#2B1810] cursor-pointer accent-[#C49767]"
                        title="Pilih Semua Mahasiswa di Halaman Ini"
                      />
                    </th>
                    <th className="p-4">NIM / Username</th>
                    <th className="p-4">Nama</th>
                    <th className="p-4">Role</th>
                    <th className="p-4 text-center">Storage</th>
                    <th className="p-4 text-center">RAM</th>
                    <th className="p-4 text-center">CPU</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3E2316]">
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-8 text-center text-[#DFCDB5]">
                        {loading ? (
                          <span className="flex items-center justify-center space-x-2">
                            <Spinner size="xs" />
                            <span>Memuat daftar akun...</span>
                          </span>
                        ) : (
                          <span>Tidak ada akun yang cocok dengan pencarian atau filter.</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u) => (
                      <tr
                        key={u.id}
                        className={`hover:bg-[#361E13] transition ${
                          selectedUserIds.includes(u.id) ? 'bg-[#3A2216]/60' : ''
                        }`}
                      >
                        <td className="p-4 text-center">
                          {u.role === 'admin' ? (
                            <span className="text-[10px] text-[#7A5A48] select-none">-</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(u.id)}
                              onChange={() => handleToggleSelectUser(u.id)}
                              className="w-4 h-4 rounded border-[#4D2D1E] text-[#C49767] focus:ring-0 focus:ring-offset-0 bg-[#2B1810] cursor-pointer accent-[#C49767]"
                            />
                          )}
                        </td>
                        <td className="p-4 font-mono font-semibold text-[#FAF5EC]">{u.username}</td>
                        <td className="p-4 font-medium">{u.name}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold ${
                            u.role === 'admin'
                              ? 'bg-[#5A3521] text-[#E8DCB8] border border-[#7D492F]'
                              : 'bg-[#1C0F0A] text-[#DFCDB5] border border-[#3E2316]'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        {/* Storage */}
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => openLimitPage(u)}
                            title="Klik untuk konfigurasi limit Storage & Database akun ini"
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-[#1C0F0A] hover:bg-[#2A170F] border border-[#3E2316] hover:border-[#C49767]/60 text-[#DFCDB5] hover:text-[#FAF5EC] transition font-mono text-[11px]"
                          >
                            <HardDrive className="h-3 w-3 text-[#C49767]" />
                            <span>
                              {u.max_disk_mb >= 1000
                                ? `${(u.max_disk_mb / 1000).toFixed(u.max_disk_mb % 1000 === 0 ? 0 : 1)} GB`
                                : `${u.max_disk_mb || 500} MB`}
                            </span>
                            <span className="text-[#A47E65]">|</span>
                            <Database className="h-3 w-3 text-[#E8C58D]" />
                            <span>
                              DB {u.max_database_disk_mb >= 1000
                                ? `${(u.max_database_disk_mb / 1000).toFixed(u.max_database_disk_mb % 1000 === 0 ? 0 : 1)} GB`
                                : `${u.max_database_disk_mb || 100} MB`}
                            </span>
                          </button>
                        </td>
                        {/* RAM */}
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => openLimitPage(u)}
                            title="Klik untuk ubah limit RAM akun ini"
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-[#1C0F0A] hover:bg-[#2A170F] border border-[#3E2316] hover:border-emerald-500/60 text-[#DFCDB5] hover:text-[#FAF5EC] transition font-mono text-[11px]"
                          >
                            <Cpu className="h-3 w-3 text-emerald-400" />
                            <span>
                              {u.max_memory_mb >= 1024
                                ? `${(u.max_memory_mb / 1024).toFixed(u.max_memory_mb % 1024 === 0 ? 0 : 1)} GB`
                                : `${u.max_memory_mb || 512} MB`}
                            </span>
                          </button>
                        </td>
                        {/* CPU */}
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => openLimitPage(u)}
                            title="Klik untuk ubah limit CPU akun ini"
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-[#1C0F0A] hover:bg-[#2A170F] border border-[#3E2316] hover:border-cyan-500/60 text-[#DFCDB5] hover:text-[#FAF5EC] transition font-mono text-[11px]"
                          >
                            <Sliders className="h-3 w-3 text-cyan-400" />
                            <span>{u.max_cpu_cores ?? 1.0} Core</span>
                          </button>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            u.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {u.is_active ? 'Aktif' : 'Suspended'}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => openLimitPage(u)}
                            title="Atur Limit Resource & Konfigurasi DB"
                            className="p-1.5 text-[#DFCDB5] hover:text-[#C49767] hover:bg-[#3E2316] rounded-lg transition"
                          >
                            <Sliders className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => triggerResetPassword(u.id, u.name)}
                            title="Reset Password Sementara"
                            className="p-1.5 text-[#DFCDB5] hover:text-[#E8C58D] hover:bg-[#3E2316] rounded-lg transition"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => triggerToggleSuspend(u.id, u.name, u.is_active)}
                            title={u.is_active ? 'Suspend Akun' : 'Aktifkan Akun'}
                            className={`p-1.5 rounded-lg transition ${
                              u.is_active ? 'text-[#DFCDB5] hover:text-amber-400 hover:bg-[#3E2316]' : 'text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          >
                            {u.is_active ? <Ban className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => triggerDeleteUser(u.id, u.name)}
                              title="Hapus Akun Mahasiswa"
                              className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-[#1C0F0A] border-t border-[#3E2316] gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-[#DFCDB5]">Tampilkan</span>
                <select
                  value={userPageSize}
                  onChange={(e) => {
                    setUserPageSize(parseInt(e.target.value))
                    setUserPage(1)
                  }}
                  className="bg-[#2B1810] border border-[#3E2316] rounded-xl px-2.5 py-1 text-xs text-[#FAF5EC] focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-[#DFCDB5]">
                  akun per halaman (Total {filteredUsers.length} akun)
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[#DFCDB5]">
                  Halaman {userPage} dari {totalUserPages}
                </span>
                <button
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-xl border border-[#3E2316] bg-[#2B1810] text-[#DFCDB5] hover:text-white disabled:opacity-40 transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={userPage >= totalUserPages}
                  onClick={() => setUserPage((p) => Math.min(totalUserPages, p + 1))}
                  className="p-1.5 rounded-xl border border-[#3E2316] bg-[#2B1810] text-[#DFCDB5] hover:text-white disabled:opacity-40 transition"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: TAMBAH AKUN PENGGUNA (ROLE STUDENT & ADMIN)        */}
      {/* ======================================================== */}
      {activeTab === 'create' && (
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 shadow-xl text-[#FAF5EC] max-w-xl">
          <h3 className="text-lg font-serif font-bold text-[#FAF5EC] mb-1 flex items-center space-x-2">
            <UserPlus className="h-5 w-5 text-[#C49767]" />
            <span>Tambah Akun Pengguna Baru</span>
          </h3>
          <p className="text-xs text-[#DFCDB5] mb-6">
            Buat akun pengguna baru dengan menentukan username, nama lengkap, password, dan role (Mahasiswa atau Administrator).
          </p>

          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">
                  NIM / Username <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 23533001 atau admin_lab"
                  value={manualUsername}
                  onChange={(e) => setManualUsername(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">
                  Nama Lengkap <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Budi Santoso"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">
                  Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Minimal 6 karakter"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">
                  Role / Peran Akun <span className="text-rose-400">*</span>
                </label>
                <select
                  value={manualRole}
                  onChange={(e) => setManualRole(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767] font-medium"
                >
                  <option value="student">Mahasiswa (Student)</option>
                  <option value="admin">Administrator Lab (Admin)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="mustChangeCheck"
                checked={manualMustChange}
                onChange={(e) => setManualMustChange(e.target.checked)}
                className="h-4 w-4 rounded accent-[#5A3521] bg-[#1C0F0A] border-[#3E2316]"
              />
              <label htmlFor="mustChangeCheck" className="text-xs text-[#DFCDB5] cursor-pointer">
                Wajibkan ganti password saat user pertama kali login
              </label>
            </div>

            <div className="pt-2 flex items-center space-x-3">
              <button
                type="submit"
                disabled={loadingAction}
                className="px-6 py-2.5 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] shadow-lg transition disabled:opacity-50"
              >
                {loadingAction ? 'Menyimpan...' : 'Buat Akun Sekarang'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className="px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#1C0F0A] hover:bg-[#341F14] text-[#DFCDB5] border border-[#3E2316] transition"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: AUDIT LOGS                                         */}
      {/* ======================================================== */}
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
            {auditLogs.length === 0 ? (
              <div className="p-6 text-center text-[#7A5A48]">Belum ada catatan aktivitas.</div>
            ) : (
              auditLogs.map((log) => (
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
              ))
            )}
          </div>
        </div>
      )}

      {/* Reusable Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ open: false, title: '', message: '', onConfirm: () => {} })}
      />

      {/* Resource Limit (Bulk Only) Modal */}
      <ModalPortal isOpen={limitModal.open}>
        <div
          onClick={() => setLimitModal((prev) => ({ ...prev, open: false }))}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 sm:p-7 text-[#FAF5EC] max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#3E2316]">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-2xl bg-[#5A3521]/40 border border-[#7D492F] flex items-center justify-center text-[#C49767]">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-[#FAF5EC]">
                    Atur Limit Resource Massal
                  </h3>
                  <p className="text-xs text-[#DFCDB5] font-mono mt-0.5">
                    {selectedUserIds.length} Akun Mahasiswa Terpilih
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLimitModal((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3E2316] rounded-xl transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBulkLimit} className="space-y-5">
              {/* Storage File Manager */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#DFCDB5] flex items-center space-x-1.5">
                    <HardDrive className="h-4 w-4 text-[#C49767]" />
                    <span>Storage File Manager (MB)</span>
                  </label>
                  <span className="font-mono text-xs text-[#C49767]">
                    {limitModal.maxDiskMb >= 1000
                      ? `${(limitModal.maxDiskMb / 1000).toFixed(limitModal.maxDiskMb % 1000 === 0 ? 0 : 1)} GB (${limitModal.maxDiskMb} MB)`
                      : `${limitModal.maxDiskMb} MB`}
                  </span>
                </div>
                <input
                  type="number"
                  min="100"
                  max="100000"
                  step="50"
                  required
                  value={limitModal.maxDiskMb}
                  onChange={(e) => setLimitModal({ ...limitModal, maxDiskMb: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                />
              </div>

              {/* Storage Database */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#DFCDB5] flex items-center space-x-1.5">
                    <Database className="h-4 w-4 text-[#E8C58D]" />
                    <span>Storage Database (MB)</span>
                  </label>
                  <span className="font-mono text-xs text-[#E8C58D]">
                    {limitModal.maxDatabaseDiskMb || 100} MB
                  </span>
                </div>
                <input
                  type="number"
                  min="20"
                  max="50000"
                  step="20"
                  required
                  value={limitModal.maxDatabaseDiskMb || 100}
                  onChange={(e) => setLimitModal({ ...limitModal, maxDatabaseDiskMb: parseInt(e.target.value) || 100 })}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#E8C58D]"
                />
              </div>

              {/* RAM */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#DFCDB5] flex items-center space-x-1.5">
                    <Cpu className="h-4 w-4 text-emerald-400" />
                    <span>RAM / Batas Memori Container (MB)</span>
                  </label>
                  <span className="font-mono text-xs text-emerald-400">
                    {limitModal.maxMemoryMb >= 1024
                      ? `${(limitModal.maxMemoryMb / 1024).toFixed(limitModal.maxMemoryMb % 1024 === 0 ? 0 : 1)} GB`
                      : `${limitModal.maxMemoryMb} MB`}
                  </span>
                </div>
                <input
                  type="number"
                  min="128"
                  max="32768"
                  step="64"
                  required
                  value={limitModal.maxMemoryMb}
                  onChange={(e) => setLimitModal({ ...limitModal, maxMemoryMb: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* CPU */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#DFCDB5] flex items-center space-x-1.5">
                    <Sliders className="h-4 w-4 text-cyan-400" />
                    <span>CPU Core Allocation (Cores)</span>
                  </label>
                  <span className="font-mono text-xs text-cyan-400">{limitModal.maxCpuCores} Core</span>
                </div>
                <input
                  type="number"
                  min="0.1"
                  max="16"
                  step="0.1"
                  required
                  value={limitModal.maxCpuCores}
                  onChange={(e) => setLimitModal({ ...limitModal, maxCpuCores: parseFloat(e.target.value) || 0.1 })}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setLimitModal((prev) => ({ ...prev, open: false }))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1C0F0A] hover:bg-[#3E2316] text-[#DFCDB5] border border-[#3E2316] transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingLimit}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] shadow-lg transition disabled:opacity-50"
                >
                  {savingLimit ? 'Menyimpan...' : 'Simpan Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>
    </div>
  )
}
