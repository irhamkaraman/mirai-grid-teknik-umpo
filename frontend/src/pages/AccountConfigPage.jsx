import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Sliders,
  Database,
  HardDrive,
  Cpu,
  Layers,
  Save,
  Trash2,
  ExternalLink,
  Plus,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldCheck,
  Globe,
  User,
  FolderGit2,
  AlertTriangle,
  Server
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { launchDatabaseSSO } from '../utils/sso'
import ModalPortal from '../components/ModalPortal'
import { SkeletonCard, SkeletonTable } from '../components/Skeletons'
import Button from '../components/Button'

export default function AccountConfigPage({ user: currentUser, onNavigate }) {
  const { userId } = useParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creatingDb, setCreatingDb] = useState(false)
  const [deletingDbId, setDeletingDbId] = useState(null)
  const [account, setAccount] = useState(null)

  // Config Form States
  const [maxDiskMb, setMaxDiskMb] = useState(10240)
  const [maxDatabaseDiskMb, setMaxDatabaseDiskMb] = useState(5120)
  const [maxMemoryMb, setMaxMemoryMb] = useState(512)
  const [maxCpuCores, setMaxCpuCores] = useState(1.0)
  const [maxProcesses, setMaxProcesses] = useState(50)
  const [maxDatabases, setMaxDatabases] = useState(99)
  const [allowPostgres, setAllowPostgres] = useState(true)
  const [allowMariadb, setAllowMariadb] = useState(true)
  const [allowRemoteDb, setAllowRemoteDb] = useState(true)

  // New DB form inline
  const [newDbEngine, setNewDbEngine] = useState('postgres')
  const [newDbName, setNewDbName] = useState('')

  // Show/hide passwords
  const [revealedPasswords, setRevealedPasswords] = useState({})
  const [copiedKey, setCopiedKey] = useState(null)

  // Confirm delete modal state
  const [confirmDeleteModal, setConfirmDeleteModal] = useState({
    open: false,
    dbId: null,
    dbName: '',
  })

  useEffect(() => {
    fetchAccountDetail()
  }, [userId])

  const fetchAccountDetail = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/users/${userId}/detail`)
      if (res.data?.success && res.data.user) {
        const u = res.data.user
        setAccount(u)
        setMaxDiskMb(u.max_disk_mb ?? 10240)
        setMaxDatabaseDiskMb(u.max_database_disk_mb ?? 5120)
        setMaxMemoryMb(u.max_memory_mb ?? 512)
        setMaxCpuCores(u.max_cpu_cores ?? 1.0)
        setMaxProcesses(u.max_processes ?? 50)
        setMaxDatabases(u.max_databases ?? 99)
        setAllowPostgres(u.allow_postgres !== 0)
        setAllowMariadb(u.allow_mariadb !== 0)
        setAllowRemoteDb(u.allow_remote_db !== 0)
      } else {
        toast.error('Gagal memuat detail akun.')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Terjadi kesalahan saat memuat data akun.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault()
    setSaving(true)
    const toastId = toast.loading('Menyimpan konfigurasi akun & database...')
    try {
      const payload = {
        max_disk_mb: parseInt(maxDiskMb),
        max_database_disk_mb: parseInt(maxDatabaseDiskMb),
        max_memory_mb: parseInt(maxMemoryMb),
        max_cpu_cores: parseFloat(maxCpuCores),
        max_processes: parseInt(maxProcesses),
        max_databases: parseInt(maxDatabases),
        allow_postgres: allowPostgres ? 1 : 0,
        allow_mariadb: allowMariadb ? 1 : 0,
        allow_remote_db: allowRemoteDb ? 1 : 0,
      }
      const res = await api.put(`/admin/users/${userId}/quota`, payload)
      toast.success(res.data?.message || 'Konfigurasi resource & database berhasil disimpan!', { id: toastId })
      fetchAccountDetail()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan konfigurasi akun.', { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleCreateDatabaseForStudent = async (e) => {
    e.preventDefault()
    const cleanName = newDbName.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (!cleanName) {
      toast.error('Nama database wajib diisi!')
      return
    }
    setCreatingDb(true)
    const toastId = toast.loading(`Membuat database ${cleanName} untuk ${account.username}...`)
    try {
      const res = await api.post(`/admin/users/${userId}/databases`, {
        engine: newDbEngine,
        db_name: cleanName,
      })
      toast.success(res.data?.message || `Database '${res.data.db_name}' berhasil dibuat!`, { id: toastId })
      setNewDbName('')
      fetchAccountDetail()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membuat database untuk akun ini.', { id: toastId })
    } finally {
      setCreatingDb(false)
    }
  }

  const handleDeleteDatabase = async (dbId, dbName) => {
    setDeletingDbId(dbId)
    const toastId = toast.loading(`Menghapus database '${dbName}'...`)
    try {
      const res = await api.delete(`/admin/users/${userId}/databases/${dbId}`)
      toast.success(res.data?.message || `Database '${dbName}' berhasil dihapus.`, { id: toastId })
      setConfirmDeleteModal({ open: false, dbId: null, dbName: '' })
      fetchAccountDetail()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus database.', { id: toastId })
    } finally {
      setDeletingDbId(null)
    }
  }

  const copyToClipboard = (text, key, label) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiedKey(key)
      toast.success(`${label} disalin ke clipboard!`)
      setTimeout(() => setCopiedKey(null), 2500)
    } catch (e) {
      toast.error('Gagal menyalin teks.')
    }
  }

  const toggleRevealPassword = (dbId) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [dbId]: !prev[dbId],
    }))
  }

  if (loading) {
      return (
        <div className="space-y-6 animate-in fade-in duration-200 font-sans">
          <SkeletonTable rows={2} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonTable rows={3} />
        </div>
      )
  }

  if (!account) {
      return (
        <div className="p-8 rounded-xl bg-white border border-slate-200/80 text-center space-y-4 font-sans">
          <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">Akun Pengguna Tidak Ditemukan</h3>
          <p className="text-xs text-slate-500">Akun dengan ID {userId} mungkin telah dihapus dari sistem.</p>
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Kelola Akun</span>
          </button>
        </div>
      )
  }

  const databases = account.databases || []

    return (
      <div className="space-y-6 animate-in fade-in duration-200 pb-12 font-sans text-slate-900">
        {/* Top Header & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
          <div className="flex items-center space-x-3.5">
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors flex items-center justify-center shrink-0"
              title="Kembali ke Kelola Akun"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-2xl font-sans font-bold text-slate-900 tracking-tight flex items-center space-x-2.5">
                <Sliders className="h-5 w-5 text-slate-700" />
                <span>Konfigurasi Akun &amp; Database</span>
              </h2>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Alokasi resource komputasi, kuota penyimpanan, dan perizinan database terisolasi.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            <button
              type="button"
              onClick={fetchAccountDetail}
              className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={saving}
              className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{saving ? 'Menyimpan...' : 'Simpan Semua Konfigurasi'}</span>
            </button>
          </div>
        </div>

        {/* Account Identity Hero Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center space-x-4 md:col-span-1 border-b md:border-b-0 md:border-r border-slate-200/80 pb-4 md:pb-0 md:pr-6">
            <div className="h-16 w-16 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center text-xl font-bold font-mono shrink-0">
              {account.username.slice(-3).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-sans font-bold text-slate-900 truncate">{account.name}</h3>
              </div>
              <p className="text-xs text-slate-500 font-mono">@{account.username}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span
                  className={
                    account.role === 'admin'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200/80 rounded-md px-2 py-0.5 text-xs font-medium font-mono'
                      : 'bg-slate-100 text-slate-700 border border-slate-200 rounded-md px-2 py-0.5 text-xs font-medium font-mono'
                  }
                >
                  {account.role.toUpperCase()}
                </span>
                <span
                  className={
                    account.is_active
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md px-2 py-0.5 text-xs font-medium font-mono'
                      : 'bg-rose-50 text-rose-700 border border-rose-200 rounded-md px-2 py-0.5 text-xs font-medium font-mono'
                  }
                >
                  {account.is_active ? 'AKTIF' : 'SUSPENDED'}
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] text-slate-500 block uppercase font-sans font-medium">Role Akun</span>
              <strong className="text-slate-900 font-bold truncate block mt-0.5 uppercase">
                {account.role === 'admin' ? 'Administrator' : 'Mahasiswa'}
              </strong>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] text-slate-500 block uppercase font-sans font-medium">Deployment</span>
              <strong className="text-sky-700 font-bold block mt-0.5">
                {account.projects_count ?? 0} Aktif
              </strong>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] text-slate-500 block uppercase font-sans font-medium">Database Aktif</span>
              <strong className="text-emerald-700 font-bold block mt-0.5">
                {databases.length} DB
              </strong>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] text-slate-500 block uppercase font-sans font-medium">Alokasi Hardware</span>
              <strong className="text-slate-900 font-bold block mt-0.5">
                {maxMemoryMb}MB • {maxCpuCores}C • {maxProcesses} NPROC
              </strong>
            </div>
          </div>
        </div>

        {/* Grid: 2 Columns for Limits and Database Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CARD 1: LIMIT RESOURCE SISTEM */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
              <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                <HardDrive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-sans font-bold text-slate-900">
                  Limit Resource &amp; Komputasi
                </h3>
                <p className="text-xs text-slate-500">Batas alokasi hardware container dan kuota storage akun.</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* 1. Storage Quota */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                    <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                    <span>Storage File Manager (Web Projects &amp; Files)</span>
                  </label>
                  <span className="text-xs font-mono font-semibold text-emerald-700">
                    {maxDiskMb >= 1000 ? `${(maxDiskMb / 1000).toFixed(maxDiskMb % 1000 === 0 ? 0 : 1)} GB (${maxDiskMb} MB)` : `${maxDiskMb} MB`}
                  </span>
                </div>
                <input
                  type="number"
                  min="50"
                  max="100000"
                  step="50"
                  value={maxDiskMb}
                  onChange={(e) => setMaxDiskMb(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-400 font-mono"
                  required
                />
                <div className="flex flex-wrap gap-1.5">
                  {[500, 1000, 2000, 5000, 10000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMaxDiskMb(val)}
                      className={
                        maxDiskMb === val
                          ? 'bg-slate-900 text-white rounded-md px-2.5 py-1 text-xs font-medium font-mono transition-colors'
                          : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-md px-2.5 py-1 text-xs font-mono transition-colors'
                      }
                    >
                      {val >= 1000 ? `${val / 1000} GB` : `${val} MB`}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Alokasi kuota penyimpanan berkas web project, direktori workspace, dan sandbox pengguna.
                </p>
              </div>

              {/* 2. RAM Limit */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                    <Cpu className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Batas Memori RAM per Container</span>
                  </label>
                  <span className="text-xs font-mono font-semibold text-emerald-700">
                    {maxMemoryMb >= 1024 ? `${(maxMemoryMb / 1024).toFixed(maxMemoryMb % 1024 === 0 ? 0 : 1)} GB (${maxMemoryMb} MB)` : `${maxMemoryMb} MB`}
                  </span>
                </div>
                <input
                  type="number"
                  min="64"
                  max="64000"
                  step="64"
                  value={maxMemoryMb}
                  onChange={(e) => setMaxMemoryMb(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-400 font-mono"
                  required
                />
                <div className="flex flex-wrap gap-1.5">
                  {[256, 512, 1024, 2048, 4096].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMaxMemoryMb(val)}
                      className={
                        maxMemoryMb === val
                          ? 'bg-slate-900 text-white rounded-md px-2.5 py-1 text-xs font-medium font-mono transition-colors'
                          : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-md px-2.5 py-1 text-xs font-mono transition-colors'
                      }
                    >
                      {val >= 1024 ? `${val / 1024} GB` : `${val} MB`}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Batas memori runtime container aplikasi (PHP-FPM, Node.js, Python).
                </p>
              </div>

              {/* 3. CPU Core Allocation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                    <Sliders className="h-3.5 w-3.5 text-sky-600" />
                    <span>Alokasi CPU Core per Container</span>
                  </label>
                  <span className="text-xs font-mono font-semibold text-sky-700">
                    {maxCpuCores} Core
                  </span>
                </div>
                <input
                  type="number"
                  min="0.1"
                  max="16.0"
                  step="0.1"
                  value={maxCpuCores}
                  onChange={(e) => setMaxCpuCores(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-400 font-mono"
                  required
                />
                <div className="flex flex-wrap gap-1.5">
                  {[0.5, 1.0, 1.5, 2.0, 4.0].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMaxCpuCores(val)}
                      className={
                        maxCpuCores === val
                          ? 'bg-slate-900 text-white rounded-md px-2.5 py-1 text-xs font-medium font-mono transition-colors'
                          : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-md px-2.5 py-1 text-xs font-mono transition-colors'
                      }
                    >
                      {val} Core
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Batas pemakaian core virtual CPU yang dialokasikan ke container docker.
                </p>
              </div>

              {/* 4. Number of Processes (NPROC Limit) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                    <Sliders className="h-3.5 w-3.5 text-amber-600" />
                    <span>Number of Processes (NPROC Limit)</span>
                  </label>
                  <span className="text-xs font-mono font-semibold text-amber-700">
                    {maxProcesses} NPROC
                  </span>
                </div>
                <input
                  type="number"
                  min="10"
                  max="2000"
                  step="5"
                  value={maxProcesses}
                  onChange={(e) => setMaxProcesses(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-400 font-mono"
                  required
                />
                <div className="flex flex-wrap gap-1.5">
                  {[25, 50, 100, 150, 250].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMaxProcesses(val)}
                      className={
                        maxProcesses === val
                          ? 'bg-slate-900 text-white rounded-md px-2.5 py-1 text-xs font-medium font-mono transition-colors'
                          : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-md px-2.5 py-1 text-xs font-mono transition-colors'
                      }
                    >
                      {val} Proc
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Batas maksimal simultaneous running processes (pids_limit / fork safety) per sandbox container akun.
                </p>
              </div>
            </div>
          </div>

          {/* CARD 2: KONFIGURASI DATABASE AKUN */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
              <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-sans font-bold text-slate-900">
                  Konfigurasi &amp; Perizinan Database
                </h3>
                <p className="text-xs text-slate-500">Hak akses mesin database dan perizinan remote koneksi IP.</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* 1. Storage Database Quota */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                    <Database className="h-3.5 w-3.5 text-slate-500" />
                    <span>Storage Database (Batas Ukuran Penyimpanan DB)</span>
                  </label>
                  <span className="text-xs font-mono font-semibold text-emerald-700">
                    {maxDatabaseDiskMb >= 1000 ? `${(maxDatabaseDiskMb / 1000).toFixed(1)} GB (${maxDatabaseDiskMb} MB)` : `${maxDatabaseDiskMb} MB`}
                  </span>
                </div>
                <input
                  type="number"
                  min="10"
                  max="50000"
                  step="10"
                  value={maxDatabaseDiskMb}
                  onChange={(e) => setMaxDatabaseDiskMb(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-400 font-mono"
                  required
                />
                <div className="flex flex-wrap gap-1.5">
                  {[100, 500, 1000, 2500, 5120].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMaxDatabaseDiskMb(val)}
                      className={
                        maxDatabaseDiskMb === val
                          ? 'bg-slate-900 text-white rounded-md px-2.5 py-1 text-xs font-medium font-mono transition-colors'
                          : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-md px-2.5 py-1 text-xs font-mono transition-colors'
                      }
                    >
                      {val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)} GB` : `${val} MB`}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Sistem membatasi database berdasarkan ukuran storage (default 5 GB / 5120 MB). Mahasiswa bebas membuat banyak database hingga storage ini penuh.
                </p>
              </div>

              {/* 2. Database Engine Privileges */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-800 block">
                  Perizinan Mesin Database (Engine Access)
                </label>

                {/* PostgreSQL Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                      <img src="/logos/postgres.svg" alt="PostgreSQL" className="h-5 w-5 object-contain" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">PostgreSQL 16 Enterprise</h4>
                      <p className="text-[11px] text-slate-500">phpPgAdmin Web GUI &amp; TCP Port 5432</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowPostgres}
                      onChange={(e) => setAllowPostgres(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>

                {/* MariaDB / MySQL Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                      <img src="/logos/phpmyadmin.png" alt="phpMyAdmin" className="h-5 w-5 object-contain" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">MySQL / MariaDB 11</h4>
                      <p className="text-[11px] text-slate-500">phpMyAdmin Web GUI &amp; TCP Port 3306</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowMariadb}
                      onChange={(e) => setAllowMariadb(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                {/* Remote Access Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Remote Database Access</h4>
                      <p className="text-[11px] text-slate-500">Izinkan koneksi langsung via DBeaver / TablePlus luar</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowRemoteDb}
                      onChange={(e) => setAllowRemoteDb(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: MANAJEMEN DATABASE AKTIF MILIK AKUN INI */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-sans font-bold text-slate-900 flex items-center space-x-2">
                  <span>Daftar Database Aktif Pengguna</span>
                  <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200">
                    {databases.length} / {maxDatabases}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">Basis data terdaftar di server PostgreSQL &amp; MariaDB milik akun ini.</p>
              </div>
            </div>
          </div>

          {/* Database List Table */}
          {databases.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-50/70 border border-slate-200/80 text-center space-y-2">
              <Database className="h-8 w-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-600 font-medium">Belum ada database yang dibuat untuk akun ini.</p>
              <p className="text-[11px] text-slate-400">Gunakan form di bawah untuk membuatkan database baru secara instan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80">
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="p-3.5">Nama Database</th>
                    <th className="p-3.5">Engine</th>
                    <th className="p-3.5">Host / Port</th>
                    <th className="p-3.5">Username &amp; Password</th>
                    <th className="p-3.5">Tanggal Dibuat</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {databases.map((db) => {
                    const isPg = db.engine === 'postgres'
                    const isRevealed = !!revealedPasswords[db.id]
                    return (
                      <tr key={db.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5">
                          <strong className="text-slate-900 font-bold block">{db.db_name}</strong>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${
                              isPg
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            <img
                              src={isPg ? '/logos/postgres.svg' : '/logos/phpmyadmin.png'}
                              alt={db.engine}
                              className="h-3.5 w-3.5 object-contain"
                            />
                            <span>{isPg ? 'PostgreSQL' : 'MariaDB'}</span>
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-700">
                          <span className="block">{window.location.hostname || db.host}</span>
                          <span className="text-[11px] text-slate-400">Port: {db.port}</span>
                        </td>
                        <td className="p-3.5">
                          <div className="space-y-1">
                            <span className="text-slate-900 block">User: {db.db_username}</span>
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs text-slate-600">
                                {isRevealed ? db.db_password : '••••••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleRevealPassword(db.id)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded"
                                title={isRevealed ? 'Sembunyikan Password' : 'Lihat Password'}
                              >
                                {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(db.db_password, `pass_${db.id}`, 'Password')}
                                className="p-1 text-slate-400 hover:text-emerald-600 rounded"
                                title="Salin Password"
                              >
                                {copiedKey === `pass_${db.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-500 text-xs">
                          {db.created_at ? new Date(db.created_at).toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            onClick={() => launchDatabaseSSO(db.engine, db.id)}
                            title={`Buka Auto-Login SSO ${isPg ? 'phpPgAdmin' : 'phpMyAdmin'}`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
                          >
                            <span>Web GUI</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteModal({ open: true, dbId: db.id, dbName: db.db_name })}
                            title="Hapus Database"
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Form Inline Buat Database Baru */}
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold font-sans text-slate-900 mb-3 flex items-center space-x-2">
              <Plus className="h-4 w-4 text-slate-700" />
              <span>Buatkan Database Baru untuk Akun Ini</span>
            </h4>

            <form onSubmit={handleCreateDatabaseForStudent} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Pilih Engine
                </label>
                <select
                  value={newDbEngine}
                  onChange={(e) => setNewDbEngine(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-400 font-mono"
                >
                  <option value="postgres">PostgreSQL 16</option>
                  <option value="mariadb">MySQL / MariaDB 11</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Nama Database Praktikum
                </label>
                <div className="flex items-center rounded-lg bg-white border border-slate-200 focus-within:border-slate-400 overflow-hidden">
                  <span className="px-3 py-2 bg-slate-50 border-r border-slate-200 text-slate-500 font-mono text-xs select-none">
                    s{account.username}_
                  </span>
                  <input
                    type="text"
                    value={newDbName}
                    onChange={(e) => setNewDbName(e.target.value)}
                    placeholder="tugas1 / ecommerce"
                    className="w-full bg-transparent px-3 py-2 text-xs text-slate-900 font-mono outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={creatingDb || !newDbName.trim()}
                  className="w-full inline-flex items-center justify-center space-x-2 py-2 px-4 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {creatingDb ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span>{creatingDb ? 'Membuat...' : 'Buat Database'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Confirmation Modal for Delete Database */}
        <ModalPortal isOpen={confirmDeleteModal.open}>
          <div
            onClick={() => setConfirmDeleteModal({ open: false, dbId: null, dbName: '' })}
            className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 text-slate-900 space-y-4 animate-in zoom-in-95 duration-150"
            >
              <div className="flex items-center space-x-3 text-rose-600">
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-sans font-bold text-slate-900">Hapus Database Pengguna?</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Tindakan ini tidak dapat dibatalkan.</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus database <strong className="text-rose-600 font-mono font-bold">{confirmDeleteModal.dbName}</strong> milik akun <strong className="text-slate-900 font-mono">{account?.username}</strong>? Seluruh data tabel di server engine akan dihapus permanen.
              </p>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setConfirmDeleteModal({ open: false, dbId: null, dbName: '' })}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  disabled={deletingDbId !== null}
                  onClick={() => handleDeleteDatabase(confirmDeleteModal.dbId, confirmDeleteModal.dbName)}
                >
                  {deletingDbId !== null ? 'Menghapus...' : 'Ya, Hapus Database'}
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      </div>
    )
}
