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
import Button from '../components/Button'
import { formatMBSize } from '../utils/formatters'

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
    maxDiskMb: 10240,
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

  // Filtered & Paginated Users (Synchronized client-side + server-side search & role filter)
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (selectedRole && u.role !== selectedRole) return false
      if (q) {
        const matchUsername = String(u.username || '').toLowerCase().includes(q)
        const matchName = String(u.name || '').toLowerCase().includes(q)
        if (!matchUsername && !matchName) return false
      }
      return true
    })
  }, [users, selectedRole, search])

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / userPageSize))
  const paginatedUsers = filteredUsers.slice((userPage - 1) * userPageSize, userPage * userPageSize)
  const startItem = filteredUsers.length === 0 ? 0 : (userPage - 1) * userPageSize + 1
  const endItem = Math.min(userPage * userPageSize, filteredUsers.length)

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
      maxDiskMb: 10240,
      maxDatabaseDiskMb: 5120,
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
        max_database_disk_mb: parseInt(limitModal.maxDatabaseDiskMb || 5120),
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
      <div className="flex flex-col h-full min-h-0 font-sans w-full text-slate-900">
        {/* 1. Header, Summary Stats Cards & Tabs (Fixed at Top) */}
        <div className="flex-shrink-0 space-y-4 mb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-sans font-bold text-slate-900 tracking-tight flex items-center space-x-2.5">
                <Users className="h-6 w-6 text-slate-700" />
                <span>Kelola Akun – MiraiGrid</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Kelola akun pengguna (Student &amp; Admin), alokasi kuota resource, dan audit log aktivitas.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              icon={UserPlus}
              onClick={() => setActiveTab('create')}
            >
              Tambah Akun Baru
            </Button>
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
              <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-xl">
                <p className="text-xs font-medium text-slate-500">Total Pengguna</p>
                <p className="text-2xl font-bold text-slate-900 mt-1 font-sans">{users.length}</p>
                <p className="text-[11px] text-slate-400 mt-1">Semua Akun Terdaftar</p>
              </div>
              <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-xl">
                <p className="text-xs font-medium text-slate-500">Mahasiswa (Student)</p>
                <p className="text-2xl font-bold text-sky-600 mt-1 font-sans">{totalStudents}</p>
                <p className="text-[11px] text-slate-400 mt-1">Akun Praktikan Sandbox</p>
              </div>
              <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-xl">
                <p className="text-xs font-medium text-slate-500">Administrator (Admin)</p>
                <p className="text-2xl font-bold text-amber-600 mt-1 font-sans">{totalAdmins}</p>
                <p className="text-[11px] text-slate-400 mt-1">Akses Root &amp; Manajemen</p>
              </div>
              <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-xl">
                <p className="text-xs font-medium text-slate-500">Resource Aktif</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1 font-sans">
                  {(stats?.total_projects ?? 0) + (stats?.total_databases ?? 0)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {stats?.total_projects ?? 0} Proj • {stats?.total_databases ?? 0} DB
                </p>
              </div>
            </div>
          )}

          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-slate-200 space-x-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2.5 text-xs border-b-2 whitespace-nowrap transition-colors flex items-center space-x-2 ${
                activeTab === 'users'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Daftar Akun</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2.5 text-xs border-b-2 whitespace-nowrap transition-colors flex items-center space-x-2 ${
                activeTab === 'create'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Tambah Akun</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2.5 text-xs border-b-2 whitespace-nowrap transition-colors flex items-center space-x-2 ${
                activeTab === 'logs'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Audit Log</span>
            </button>
          </div>
        </div>

        {/* TAB 1: DAFTAR AKUN */}
        {activeTab === 'users' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-shrink-0 flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari NIM, Username, atau Nama Akun..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setUserPage(1)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                  className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
                />
              </div>
              <select
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value)
                  setUserPage(1)
                }}
                className="bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-700 focus:outline-none focus:border-slate-400 font-medium"
              >
                <option value="">Semua Role (Student &amp; Admin)</option>
                <option value="student">Mahasiswa (Student)</option>
                <option value="admin">Administrator (Admin)</option>
              </select>
              <Button
                variant="primary"
                size="md"
                onClick={fetchUsers}
              >
                Cari
              </Button>
            </div>

            {loading ? (
              <SkeletonTable rows={5} />
            ) : (
              <>
                {/* Bulk Action Toolbar */}
                {selectedUserIds.length > 0 && (
                  <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 p-3.5 mb-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono font-semibold text-xs">
                        {selectedUserIds.length} Akun Terpilih
                      </span>
                      <span className="text-slate-600 text-xs hidden sm:inline">
                        Pilih aksi massal untuk seluruh akun mahasiswa yang dicentang:
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={openBulkLimitModal}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
                      >
                        <Sliders className="h-3.5 w-3.5 text-slate-600" />
                        <span>Atur Limit ({selectedUserIds.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={triggerBulkDelete}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Hapus Massal ({selectedUserIds.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedUserIds([])}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
                        title="Batalkan Pilihan"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. AREA SCROLL TABEL (BISA DI-SCROLL VERTIKAL & HORIZONTAL SECARA MANDIRI) */}
                <div className="flex-1 min-h-[240px] overflow-auto border border-slate-200/80 rounded-xl bg-white">
                  <table className="w-full text-left border-collapse text-xs text-slate-700">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="p-4 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={allPageSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = somePageSelected && !allPageSelected
                            }}
                            onChange={handleToggleSelectAll}
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 focus:ring-offset-0 bg-white cursor-pointer accent-slate-900"
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
                    <tbody className="divide-y divide-slate-100">
                      {paginatedUsers.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="p-8 text-center text-slate-400">
                            Tidak ada akun yang cocok dengan pencarian atau filter.
                          </td>
                        </tr>
                      ) : (
                        paginatedUsers.map((u) => (
                          <tr
                            key={u.id}
                            className={`hover:bg-slate-50 transition-colors ${
                              selectedUserIds.includes(u.id) ? 'bg-slate-50/90' : ''
                            }`}
                          >
                            <td className="p-4 text-center">
                              {u.role === 'admin' ? (
                                <span className="text-xs text-slate-300 select-none">-</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={selectedUserIds.includes(u.id)}
                                  onChange={() => handleToggleSelectUser(u.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 focus:ring-offset-0 bg-white cursor-pointer accent-slate-900"
                                />
                              )}
                            </td>
                            <td className="p-4 font-mono font-semibold text-slate-900">{u.username}</td>
                            <td className="p-4 font-medium text-slate-700">{u.name}</td>
                            <td className="p-4">
                              <span
                                className={
                                  u.role === 'admin'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200/80 rounded-md px-2 py-0.5 text-xs font-medium uppercase font-mono'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200 rounded-md px-2 py-0.5 text-xs font-medium uppercase font-mono'
                                }
                              >
                                {u.role}
                              </span>
                            </td>
                            {/* Storage */}
                            <td className="p-4 text-center">
                              {u.role === 'admin' ? (
                                <span
                                  title="Akun Administrator memiliki akses penyimpanan Host Penuh (Tanpa Batasan)"
                                  className="inline-flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 font-mono"
                                >
                                  <HardDrive className="h-3 w-3 text-slate-500" />
                                  <span>Tanpa Batas</span>
                                  <span className="text-slate-300">|</span>
                                  <Database className="h-3 w-3 text-slate-500" />
                                  <span>DB ∞</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openLimitPage(u)}
                                  title="Klik untuk konfigurasi limit Storage & Database akun ini"
                                  className="inline-flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-2 py-1 font-mono transition-colors"
                                >
                                  <HardDrive className="h-3 w-3 text-slate-500" />
                                  <span>
                                    {formatMBSize(u.max_disk_mb || 500)}
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  <Database className="h-3 w-3 text-slate-500" />
                                  <span>
                                    DB {formatMBSize(u.max_database_disk_mb || 100)}
                                  </span>
                                </button>
                              )}
                            </td>
                            {/* RAM */}
                            <td className="p-4 text-center">
                              {u.role === 'admin' ? (
                                <span
                                  title="Akun Administrator memiliki alokasi memori Host Penuh"
                                  className="inline-flex items-center space-x-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 font-mono"
                                >
                                  <Cpu className="h-3 w-3 text-emerald-600" />
                                  <span>Host RAM</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openLimitPage(u)}
                                  title="Klik untuk ubah limit RAM akun ini"
                                  className="inline-flex items-center space-x-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 rounded-md px-2 py-1 font-mono transition-colors"
                                >
                                  <Cpu className="h-3 w-3 text-emerald-600" />
                                  <span>
                                    {u.max_memory_mb >= 1024
                                      ? `${(u.max_memory_mb / 1024).toFixed(u.max_memory_mb % 1024 === 0 ? 0 : 1)} GB`
                                      : `${u.max_memory_mb || 512} MB`}
                                  </span>
                                </button>
                              )}
                            </td>
                            {/* CPU */}
                            <td className="p-4 text-center">
                              {u.role === 'admin' ? (
                                <span
                                  title="Akun Administrator memiliki akses komputasi CPU Host Penuh"
                                  className="inline-flex items-center space-x-1 text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-md px-2 py-1 font-mono"
                                >
                                  <Sliders className="h-3 w-3 text-sky-600" />
                                  <span>Host CPU</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openLimitPage(u)}
                                  title="Klik untuk ubah limit CPU akun ini"
                                  className="inline-flex items-center space-x-1 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100/70 border border-sky-200 rounded-md px-2 py-1 font-mono transition-colors"
                                >
                                  <Sliders className="h-3 w-3 text-sky-600" />
                                  <span>{u.max_cpu_cores ?? 1.0} Core</span>
                                </button>
                              )}
                            </td>
                            <td className="p-4">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${
                                  u.is_active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {u.is_active ? 'Aktif' : 'Suspended'}
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-1 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => openLimitPage(u)}
                                title="Atur Limit Resource & Konfigurasi DB"
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                <Sliders className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => triggerResetPassword(u.id, u.name)}
                                title="Reset Password Sementara"
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                <KeyRound className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => triggerToggleSuspend(u.id, u.name, u.is_active)}
                                title={u.is_active ? 'Suspend Akun' : 'Aktifkan Akun'}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  u.is_active
                                    ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                {u.is_active ? <Ban className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </button>
                              {u.role !== 'admin' && (
                                <button
                                  type="button"
                                  onClick={() => triggerDeleteUser(u.id, u.name)}
                                  title="Hapus Akun Mahasiswa"
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
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

                {/* 3. FOOTER PAGINASI (TETAP DIAM DI BAWAH) */}
                <div className="flex-shrink-0 pt-4 border-t border-slate-100 mt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                  {/* Sisi Kiri: Info Ringkas & Rows Per Page */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      Menampilkan <strong className="text-slate-900 font-semibold">{startItem} - {endItem}</strong> dari{' '}
                      <strong className="text-slate-900 font-semibold">{filteredUsers.length}</strong> akun
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-400">•</span>
                      <span>Baris per halaman:</span>
                      <select
                        value={userPageSize}
                        onChange={(e) => {
                          setUserPageSize(parseInt(e.target.value))
                          setUserPage(1)
                        }}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:border-slate-400 cursor-pointer"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  {/* Sisi Kanan: Tombol Navigasi Halaman */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      disabled={userPage <= 1}
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Sebelumnya</span>
                    </button>

                    <div className="flex items-center space-x-1">
                      {Array.from({ length: totalUserPages }, (_, idx) => idx + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setUserPage(pageNum)}
                          className={`min-w-[30px] h-7 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            userPage === pageNum
                              ? 'bg-slate-900 text-white font-semibold border border-slate-900'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={userPage >= totalUserPages}
                      onClick={() => setUserPage((p) => Math.min(totalUserPages, p + 1))}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <span className="hidden sm:inline">Berikutnya</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: TAMBAH AKUN PENGGUNA */}
        {activeTab === 'create' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 text-slate-900 max-w-xl">
            <h3 className="text-lg font-sans font-bold text-slate-900 mb-1 flex items-center space-x-2">
              <UserPlus className="h-5 w-5 text-slate-700" />
              <span>Tambah Akun Pengguna Baru</span>
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Buat akun pengguna baru dengan menentukan username, nama lengkap, password, dan role (Mahasiswa atau Administrator).
            </p>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NIM / Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 23533001 atau admin_lab"
                    value={manualUsername}
                    onChange={(e) => setManualUsername(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Budi Santoso"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Minimal 6 karakter"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role / Peran Akun <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={manualRole}
                    onChange={(e) => setManualRole(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-400 font-medium"
                  >
                    <option value="student">Mahasiswa (Student)</option>
                    <option value="admin">Administrator Lab (Admin)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="mustChangeCheckV2"
                  checked={manualMustChange}
                  onChange={(e) => setManualMustChange(e.target.checked)}
                  className="h-4 w-4 rounded accent-slate-900 bg-white border-slate-300"
                />
                <label htmlFor="mustChangeCheckV2" className="text-xs text-slate-600 cursor-pointer">
                  Wajibkan ganti password saat user pertama kali login
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setActiveTab('users')}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={loadingAction}
                >
                  {loadingAction ? 'Menyimpan...' : 'Buat Akun Sekarang'}
                </Button>
              </div>
            </form>
          </div>
          </div>
        )}

        {/* TAB 3: AUDIT LOGS */}
        {activeTab === 'logs' && (
          <div className="flex-1 min-h-[240px] bg-white border border-slate-200/80 rounded-xl overflow-hidden text-slate-900 flex flex-col">
            <div className="flex-shrink-0 p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
              <h4 className="text-base font-sans font-bold text-slate-900 flex items-center space-x-2">
                <Clock className="h-5 w-5 text-slate-600" />
                <span>Aktivitas Sistem &amp; Audit Log (50 Terakhir)</span>
              </h4>
              <button
                type="button"
                onClick={fetchAuditLogs}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
              >
                Refresh
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Belum ada catatan aktivitas.</div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="px-4 sm:px-5 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                          {log.actor_name || 'System'}
                        </span>
                        <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase">
                          {log.action}
                        </span>
                        <span className="font-mono text-xs text-slate-400">
                          [{log.ip_address}]
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">{log.details}</p>
                    </div>
                    <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
                      {log.created_at}
                    </span>
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
            className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-6 text-slate-900 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                    <Sliders className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-sans font-bold text-slate-900">
                      Atur Limit Resource Massal
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {selectedUserIds.length} Akun Mahasiswa Terpilih
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLimitModal((prev) => ({ ...prev, open: false }))}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveBulkLimit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                      <HardDrive className="h-4 w-4 text-slate-500" />
                      <span>Storage File Manager (MB)</span>
                    </label>
                    <span className="font-mono text-xs text-slate-600">
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
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                      <Database className="h-4 w-4 text-slate-500" />
                      <span>Storage Database (MB)</span>
                    </label>
                    <span className="font-mono text-xs text-slate-600">
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
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                      <Cpu className="h-4 w-4 text-emerald-600" />
                      <span>RAM / Batas Memori Container (MB)</span>
                    </label>
                    <span className="font-mono text-xs text-emerald-700">
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
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                      <Sliders className="h-4 w-4 text-sky-600" />
                      <span>CPU Core Allocation (Cores)</span>
                    </label>
                    <span className="font-mono text-xs text-sky-700">{limitModal.maxCpuCores} Core</span>
                  </div>
                  <input
                    type="number"
                    min="0.1"
                    max="16"
                    step="0.1"
                    required
                    value={limitModal.maxCpuCores}
                    onChange={(e) => setLimitModal({ ...limitModal, maxCpuCores: parseFloat(e.target.value) || 0.1 })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setLimitModal((prev) => ({ ...prev, open: false }))}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={savingLimit}
                  >
                    {savingLimit ? 'Menyimpan...' : 'Simpan Limit'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      </div>
    )
}
