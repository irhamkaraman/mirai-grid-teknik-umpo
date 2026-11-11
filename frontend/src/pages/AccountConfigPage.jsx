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

export default function AccountConfigPage({ user: currentUser, onNavigate }) {
  const { userId } = useParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creatingDb, setCreatingDb] = useState(false)
  const [deletingDbId, setDeletingDbId] = useState(null)
  const [account, setAccount] = useState(null)

  // Config Form States
  const [maxDiskMb, setMaxDiskMb] = useState(1000)
  const [maxDatabaseDiskMb, setMaxDatabaseDiskMb] = useState(100)
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
        setMaxDiskMb(u.max_disk_mb ?? 1000)
        setMaxDatabaseDiskMb(u.max_database_disk_mb ?? 100)
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
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="p-2.5 rounded-2xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] transition shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="h-6 w-48 bg-[#DECDBD] rounded-xl animate-pulse" />
            <div className="h-4 w-72 bg-[#DECDBD]/60 rounded-lg animate-pulse mt-1" />
          </div>
        </div>
        <div className="p-8 rounded-3xl bg-[#2B1810] border border-[#4D2D1E] h-64 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="h-8 w-8 text-[#E8C58D] animate-spin" />
          <p className="text-xs text-[#DFCDB5] font-mono">Memuat konfigurasi akun dan database...</p>
        </div>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="p-8 rounded-3xl bg-[#2B1810] border border-[#4D2D1E] text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-rose-400 mx-auto" />
        <h3 className="text-lg font-bold text-[#FAF5EC]">Akun Mahasiswa Tidak Ditemukan</h3>
        <p className="text-xs text-[#DFCDB5]">Akun dengan ID {userId} mungkin telah dihapus dari sistem.</p>
        <button
          type="button"
          onClick={() => onNavigate('/admin')}
          className="inline-flex items-center space-x-2 px-6 py-2.5 bg-[#5A3521] hover:bg-[#6D4029] text-xs font-bold text-white rounded-xl shadow-md"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Kelola Akun</span>
        </button>
      </div>
    )
  }

  const databases = account.databases || []

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-12 font-sans">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DECDBD]">
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="p-2.5 rounded-2xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#5A3521] hover:text-[#26160F] transition shadow-sm flex items-center justify-center shrink-0 group"
            title="Kembali ke Kelola Akun"
          >
            <ArrowLeft className="h-4 w-4 text-[#5A3521] group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <h2 className="text-2xl font-serif font-bold text-[#26160F] flex items-center space-x-2.5">
              <Sliders className="h-5 w-5 text-[#5A3521]" />
              <span>Konfigurasi Akun & Database</span>
            </h2>
            <p className="text-xs text-[#5C3B29] font-sans mt-0.5">
              Alokasi resource komputasi, kuota penyimpanan, dan perizinan database terisolasi.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={fetchAccountDetail}
            className="p-2.5 rounded-2xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] transition shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving}
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-chocolate-700 to-chocolate-600 hover:from-chocolate-600 hover:to-terracotta-600 text-xs font-bold text-[#FAF5EC] rounded-2xl shadow-lg border border-chocolate-500/40 transition active:scale-95 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{saving ? 'Menyimpan...' : 'Simpan Semua Konfigurasi'}</span>
          </button>
        </div>
      </div>

      {/* Account Identity Hero Card */}
      <div className="p-6 rounded-3xl bg-[#2B1810] border border-[#4D2D1E] shadow-xl text-[#FAF5EC] grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex items-center space-x-4 md:col-span-1 border-b md:border-b-0 md:border-r border-[#3E2316] pb-4 md:pb-0 md:pr-6">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-[#5A3521] to-[#341F14] border-2 border-[#7D492F] flex items-center justify-center text-xl font-bold font-mono text-[#E8DCB8] shadow-inner shrink-0">
            {account.username.slice(-3).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-serif font-bold text-[#FAF5EC] truncate">{account.name}</h3>
            </div>
            <p className="text-xs text-[#DFCDB5] font-mono">@{account.username}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                account.role === 'admin' ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60' : 'bg-blue-950/80 text-blue-300 border border-blue-700/60'
              }`}>
                {account.role.toUpperCase()}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                account.is_active ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60' : 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
              }`}>
                {account.is_active ? 'AKTIF' : 'SUSPENDED'}
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316]">
            <span className="text-[10px] text-[#A47E65] block uppercase">Role Akun</span>
            <strong className="text-[#E8DCB8] font-bold truncate block mt-0.5 uppercase">
              {account.role === 'admin' ? 'Administrator' : 'Mahasiswa'}
            </strong>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316]">
            <span className="text-[10px] text-[#A47E65] block uppercase">Deployment</span>
            <strong className="text-blue-300 font-bold block mt-0.5">
              {account.projects_count ?? 0} Aktif
            </strong>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316]">
            <span className="text-[10px] text-[#A47E65] block uppercase">Database Aktif</span>
            <strong className="text-emerald-400 font-bold block mt-0.5">
              {databases.length} DB
            </strong>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316]">
            <span className="text-[10px] text-[#A47E65] block uppercase">Alokasi Hardware</span>
            <strong className="text-cyan-300 font-bold block mt-0.5">
              {maxMemoryMb}MB • {maxCpuCores}C • {maxProcesses} NPROC
            </strong>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns for Limits and Database Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: LIMIT RESOURCE SISTEM */}
        <div className="p-6 sm:p-7 rounded-3xl bg-[#2B1810] border border-[#4D2D1E] shadow-xl text-[#FAF5EC] space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-[#3E2316]">
            <div className="h-10 w-10 rounded-2xl bg-[#5A3521]/40 border border-[#7D492F] flex items-center justify-center text-[#C49767]">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-[#FAF5EC]">
                Limit Resource & Komputasi
              </h3>
              <p className="text-xs text-[#DFCDB5]">Batas alokasi hardware container dan kuota storage akun.</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* 1. Storage Quota */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#FAF5EC] flex items-center space-x-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-[#C49767]" />
                  <span>Storage File Manager (Web Projects & Files)</span>
                </label>
                <span className="text-[11px] font-mono text-[#C49767]">
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
                className="w-full bg-[#1C0F0A] border border-[#4D2D1E] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767] font-mono"
                required
              />
              <div className="flex flex-wrap gap-1.5">
                {[500, 1000, 2000, 5000, 10000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMaxDiskMb(val)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition border ${
                      maxDiskMb === val
                        ? 'bg-[#5A3521] border-[#C49767] text-[#FAF5EC]'
                        : 'bg-[#1C0F0A] border-[#3E2316] text-[#DFCDB5] hover:border-[#5A3521]'
                    }`}
                  >
                    {val >= 1000 ? `${val / 1000} GB` : `${val} MB`}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#A47E65]">
                Alokasi kuota penyimpanan berkas web project, direktori workspace, dan sandbox pengguna.
              </p>
            </div>

            {/* 2. RAM Limit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#FAF5EC] flex items-center space-x-1.5">
                  <Cpu className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Batas Memori RAM per Container</span>
                </label>
                <span className="text-[11px] font-mono text-emerald-400">
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
                className="w-full bg-[#1C0F0A] border border-[#4D2D1E] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
              <div className="flex flex-wrap gap-1.5">
                {[256, 512, 1024, 2048, 4096].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMaxMemoryMb(val)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition border ${
                      maxMemoryMb === val
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                        : 'bg-[#1C0F0A] border-[#3E2316] text-[#DFCDB5] hover:border-[#5A3521]'
                    }`}
                  >
                    {val >= 1024 ? `${val / 1024} GB` : `${val} MB`}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#A47E65]">
                Batas memori runtime container aplikasi (PHP-FPM, Node.js, Python).
              </p>
            </div>

            {/* 3. CPU Core Allocation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#FAF5EC] flex items-center space-x-1.5">
                  <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Alokasi CPU Core per Container</span>
                </label>
                <span className="text-[11px] font-mono text-cyan-400">
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
                className="w-full bg-[#1C0F0A] border border-[#4D2D1E] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] focus:outline-none focus:border-cyan-500 font-mono"
                required
              />
              <div className="flex flex-wrap gap-1.5">
                {[0.5, 1.0, 1.5, 2.0, 4.0].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMaxCpuCores(val)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition border ${
                      maxCpuCores === val
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                        : 'bg-[#1C0F0A] border-[#3E2316] text-[#DFCDB5] hover:border-[#5A3521]'
                    }`}
                  >
                    {val} Core
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#A47E65]">
                Batas pemakaian core virtual CPU yang dialokasikan ke container docker.
              </p>
            </div>

            {/* 4. Number of Processes (NPROC Limit) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#FAF5EC] flex items-center space-x-1.5">
                  <Sliders className="h-3.5 w-3.5 text-amber-400" />
                  <span>Number of Processes (NPROC Limit)</span>
                </label>
                <span className="text-[11px] font-mono text-amber-400">
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
                className="w-full bg-[#1C0F0A] border border-[#4D2D1E] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] focus:outline-none focus:border-amber-500 font-mono"
                required
              />
              <div className="flex flex-wrap gap-1.5">
                {[25, 50, 100, 150, 250].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMaxProcesses(val)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition border ${
                      maxProcesses === val
                        ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                        : 'bg-[#1C0F0A] border-[#3E2316] text-[#DFCDB5] hover:border-[#5A3521]'
                    }`}
                  >
                    {val} Proc
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#A47E65]">
                Batas maksimal simultaneous running processes (pids_limit / fork safety) per sandbox container akun.
              </p>
            </div>
          </div>
        </div>

        {/* CARD 2: KONFIGURASI DATABASE AKUN */}
        <div className="p-6 sm:p-7 rounded-3xl bg-[#2B1810] border border-[#4D2D1E] shadow-xl text-[#FAF5EC] space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-[#3E2316]">
            <div className="h-10 w-10 rounded-2xl bg-[#5A3521]/40 border border-[#7D492F] flex items-center justify-center text-[#E8C58D]">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-[#FAF5EC]">
                Konfigurasi & Perizinan Database
              </h3>
              <p className="text-xs text-[#DFCDB5]">Hak akses mesin database dan perizinan remote koneksi IP.</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* 1. Storage Database Quota */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#FAF5EC] flex items-center space-x-1.5">
                  <Database className="h-3.5 w-3.5 text-[#E8C58D]" />
                  <span>Storage Database (Batas Ukuran Penyimpanan DB)</span>
                </label>
                <span className="text-[11px] font-mono text-[#E8C58D]">
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
                className="w-full bg-[#1C0F0A] border border-[#4D2D1E] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#E8C58D] font-mono"
                required
              />
              <div className="flex flex-wrap gap-1.5">
                {[50, 100, 200, 500, 1000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMaxDatabaseDiskMb(val)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition border ${
                      maxDatabaseDiskMb === val
                        ? 'bg-[#5A3521] border-[#E8C58D] text-[#FAF5EC]'
                        : 'bg-[#1C0F0A] border-[#3E2316] text-[#DFCDB5] hover:border-[#5A3521]'
                    }`}
                  >
                    {val >= 1000 ? `${val / 1000} GB` : `${val} MB`}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#A47E65]">
                Sistem membatasi database berdasarkan ukuran storage (default 100 MB). Mahasiswa bebas membuat banyak database hingga storage ini penuh.
              </p>
            </div>

            {/* 2. Database Engine Privileges */}
            <div className="space-y-3 pt-2 border-t border-[#3E2316]">
              <label className="text-xs font-semibold text-[#FAF5EC] block">
                Perizinan Mesin Database (Engine Access)
              </label>

              {/* PostgreSQL Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] hover:border-sky-500/40 transition">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-xl bg-sky-950/80 border border-sky-700/60 flex items-center justify-center">
                    <img src="/logos/postgres.svg" alt="PostgreSQL" className="h-5 w-5 object-contain" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#FAF5EC]">PostgreSQL 16 Enterprise</h4>
                    <p className="text-[10px] text-[#A47E65]">phpPgAdmin Web GUI & TCP Port 5432</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPostgres}
                    onChange={(e) => setAllowPostgres(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#341F14] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {/* MariaDB / MySQL Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] hover:border-amber-500/40 transition">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-950/80 border border-amber-700/60 flex items-center justify-center">
                    <img src="/logos/phpmyadmin.png" alt="phpMyAdmin" className="h-5 w-5 object-contain" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#FAF5EC]">MySQL / MariaDB 11</h4>
                    <p className="text-[10px] text-[#A47E65]">phpMyAdmin Web GUI & TCP Port 3306</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowMariadb}
                    onChange={(e) => setAllowMariadb(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#341F14] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* Remote Access Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] hover:border-emerald-500/40 transition">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-xl bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#FAF5EC]">Remote Database Access</h4>
                    <p className="text-[10px] text-[#A47E65]">Izinkan koneksi langsung via DBeaver / TablePlus luar</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowRemoteDb}
                    onChange={(e) => setAllowRemoteDb(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#341F14] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CARD 3: MANAJEMEN DATABASE AKTIF MILIK AKUN INI */}
      <div className="p-6 sm:p-7 rounded-3xl bg-[#2B1810] border border-[#4D2D1E] shadow-xl text-[#FAF5EC] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#3E2316]">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-[#5A3521]/40 border border-[#7D492F] flex items-center justify-center text-[#E8C58D]">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
                <span>Daftar Database Aktif Mahasiswa</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#1C0F0A] text-[#E8C58D] border border-[#3E2316]">
                  {databases.length} / {maxDatabases}
                </span>
              </h3>
              <p className="text-xs text-[#DFCDB5]">Basis data terdaftar di server PostgreSQL & MariaDB milik akun ini.</p>
            </div>
          </div>
        </div>

        {/* Database List Table */}
        {databases.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] text-center space-y-2">
            <Database className="h-8 w-8 text-[#A47E65] mx-auto opacity-50" />
            <p className="text-xs text-[#DFCDB5] font-mono">Belum ada database yang dibuat untuk akun ini.</p>
            <p className="text-[11px] text-[#A47E65]">Gunakan form di bawah untuk membuatkan database baru secara instan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#3E2316]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#140A07] border-b border-[#3E2316] text-[#A47E65] font-mono uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Nama Database</th>
                  <th className="p-3.5">Engine</th>
                  <th className="p-3.5">Host / Port</th>
                  <th className="p-3.5">Username & Password</th>
                  <th className="p-3.5">Tanggal Dibuat</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3E2316] font-mono">
                {databases.map((db) => {
                  const isPg = db.engine === 'postgres'
                  const isRevealed = !!revealedPasswords[db.id]
                  return (
                    <tr key={db.id} className="hover:bg-[#1F110B] transition">
                      <td className="p-3.5">
                        <strong className="text-emerald-400 font-bold block">{db.db_name}</strong>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                          isPg ? 'bg-sky-950/80 text-sky-300 border border-sky-700/60' : 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                        }`}>
                          <img
                            src={isPg ? '/logos/postgres.svg' : '/logos/phpmyadmin.png'}
                            alt={db.engine}
                            className="h-3.5 w-3.5 object-contain"
                          />
                          <span>{isPg ? 'PostgreSQL' : 'MariaDB'}</span>
                        </span>
                      </td>
                      <td className="p-3.5 text-[#DFCDB5]">
                        <span className="block">{window.location.hostname || db.host}</span>
                        <span className="text-[10px] text-[#A47E65]">Port: {db.port}</span>
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <span className="text-[#FAF5EC] block">User: {db.db_username}</span>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[11px] text-[#E8C58D]">
                              {isRevealed ? db.db_password : '••••••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleRevealPassword(db.id)}
                              className="p-1 text-[#A47E65] hover:text-[#FAF5EC] rounded"
                              title={isRevealed ? 'Sembunyikan Password' : 'Lihat Password'}
                            >
                              {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(db.db_password, `pass_${db.id}`, 'Password')}
                              className="p-1 text-[#A47E65] hover:text-emerald-400 rounded"
                              title="Salin Password"
                            >
                              {copiedKey === `pass_${db.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-[#A47E65] text-[11px]">
                        {db.created_at ? new Date(db.created_at).toLocaleDateString('id-ID') : '-'}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => launchDatabaseSSO(db.engine, db.id)}
                          title={`Buka Auto-Login SSO ${isPg ? 'phpPgAdmin' : 'phpMyAdmin'}`}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-[#1C0F0A] hover:bg-[#341F14] border border-[#4D2D1E] text-xs font-bold text-[#E8C58D] hover:text-[#FAF5EC] transition active:scale-95"
                        >
                          <span>Web GUI</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteModal({ open: true, dbId: db.id, dbName: db.db_name })}
                          title="Hapus Database Mahasiswa"
                          className="p-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition active:scale-95"
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

        {/* Form Inline Buat Database Baru untuk Mahasiswa */}
        <div className="pt-4 border-t border-[#3E2316]">
          <h4 className="text-xs font-bold font-serif text-[#FAF5EC] mb-3 flex items-center space-x-2">
            <Plus className="h-4 w-4 text-[#C49767]" />
            <span>Buatkan Database Baru untuk Akun Ini</span>
          </h4>

          <form onSubmit={handleCreateDatabaseForStudent} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-[10px] font-mono text-[#A47E65] uppercase mb-1">
                Pilih Engine
              </label>
              <select
                value={newDbEngine}
                onChange={(e) => setNewDbEngine(e.target.value)}
                className="w-full bg-[#1C0F0A] border border-[#4D2D1E] rounded-xl px-3 py-2 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767] font-mono"
              >
                <option value="postgres">PostgreSQL 16</option>
                <option value="mariadb">MySQL / MariaDB 11</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-mono text-[#A47E65] uppercase mb-1">
                Nama Database Praktikum
              </label>
              <div className="flex items-center rounded-xl bg-[#1C0F0A] border border-[#4D2D1E] focus-within:border-[#C49767] overflow-hidden shadow-inner">
                <span className="px-3 py-2 bg-[#140A07] border-r border-[#3E2316] text-[#A47E65] font-mono text-xs select-none">
                  s{account.username}_
                </span>
                <input
                  type="text"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  placeholder="tugas1 / ecommerce"
                  className="w-full bg-transparent px-3 py-2 text-xs text-[#FAF5EC] font-mono outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={creatingDb || !newDbName.trim()}
                className="w-full inline-flex items-center justify-center space-x-2 py-2 px-4 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-xs font-bold text-white rounded-xl shadow-md border border-emerald-500/40 transition active:scale-95 disabled:opacity-50"
              >
                {creatingDb ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span>{creatingDb ? 'Membuat...' : 'Buat Database'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Modal for Delete Database (No JS Alert!) */}
      <ModalPortal isOpen={confirmDeleteModal.open}>
        <div
          onClick={() => setConfirmDeleteModal({ open: false, dbId: null, dbName: '' })}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 text-[#FAF5EC] shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-[#FAF5EC]">Hapus Database Mahasiswa?</h3>
                <p className="text-xs text-[#DFCDB5] font-mono mt-0.5">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <p className="text-xs text-[#DFCDB5]">
              Apakah Anda yakin ingin menghapus database <strong className="text-rose-400 font-mono font-bold">{confirmDeleteModal.dbName}</strong> milik akun <strong className="text-[#FAF5EC] font-mono">{account?.username}</strong>? Seluruh data tabel di server engine akan dihapus permanen.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#3E2316]">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal({ open: false, dbId: null, dbName: '' })}
                className="py-2.5 rounded-xl text-xs font-semibold bg-[#1C0F0A] hover:bg-[#341F14] text-[#DFCDB5] border border-[#3E2316] transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deletingDbId !== null}
                onClick={() => handleDeleteDatabase(confirmDeleteModal.dbId, confirmDeleteModal.dbName)}
                className="py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {deletingDbId !== null ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>{deletingDbId !== null ? 'Menghapus...' : 'Ya, Hapus Database'}</span>
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
    </div>
  )
}
