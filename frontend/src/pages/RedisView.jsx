import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Server,
  HardDrive,
  Activity,
  Play,
  Square,
  RotateCw,
  RefreshCw,
  Sliders,
  Trash2,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Flame,
  Zap,
  Clock,
  AlertTriangle,
  ChevronLeft,
  FileCode,
  Radio,
  X,
  Plus
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonCard } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import ModalPortal from '../components/ModalPortal'

// Robust clipboard copy with fallback
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

export default function RedisView({ user: propUser, onNavigate }) {
  const navigate = useNavigate()
  const currentUser = useMemo(() => {
    if (propUser) return propUser
    try {
      return JSON.parse(localStorage.getItem('miraigrid_user') || '{}')
    } catch {
      return {}
    }
  }, [propUser])

  const isAdmin = currentUser?.role === 'admin'

  // Data States
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [fillTestLoading, setFillTestLoading] = useState(false)
  const [keyList, setKeyList] = useState([])
  const [allInstances, setAllInstances] = useState([])

  // UI Interactive States
  const [activeTab, setActiveTab] = useState('guide') // 'guide', 'explorer', 'admin'
  const [guideLang, setGuideLang] = useState('laravel') // 'laravel', 'python', 'node', 'wordpress', 'cli'
  const [showPassword, setShowPassword] = useState(false)
  const [copiedKey, setCopiedKey] = useState(null)
  const [pingResult, setPingResult] = useState(null)

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: '',
    confirmColor: '',
    onConfirm: () => {}
  })

  // Config Form
  const [configMem, setConfigMem] = useState(32)
  const [configPolicy, setConfigPolicy] = useState('allkeys-lru')

  // Test Key Form
  const [testKeyName, setTestKeyName] = useState('')
  const [testKeyValue, setTestKeyValue] = useState('')
  const [testKeyTTL, setTestKeyTTL] = useState(0)

  // Back Navigation Handler
  const handleBack = () => {
    if (onNavigate) {
      onNavigate('/dashboard')
    } else {
      navigate('/dashboard')
    }
  }

  // Fetch Status
  const fetchStatus = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/redis/status')
      setStatus(res.data)
      setConfigMem(res.data.max_memory_mb || 32)
      setConfigPolicy(res.data.eviction_policy || 'allkeys-lru')
      if (silent) {
        toast.success('Status dan metrik Redis berhasil diperbarui.')
      }
    } catch (err) {
      console.error('Fetch redis status error:', err)
      if (!silent) {
        toast.error('Gagal mengambil status Redis instance.')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Fetch Key List for Explorer
  const fetchKeys = async () => {
    try {
      const res = await api.post('/redis/key-op', { action: 'list' })
      if (res.data.success) {
        setKeyList(res.data.items || res.data.keys || [])
      }
    } catch (err) {
      console.error('Fetch keys error:', err)
    }
  }

  // Fetch Admin Instances
  const fetchAdminInstances = async () => {
    if (!isAdmin) return
    try {
      const res = await api.get('/redis/admin/all')
      if (res.data.success) {
        setAllInstances(res.data.instances || [])
      }
    } catch (err) {
      console.error('Fetch admin instances error:', err)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  useEffect(() => {
    if (activeTab === 'explorer') {
      fetchKeys()
    }
    if (isAdmin && activeTab === 'admin') {
      fetchAdminInstances()
    }
  }, [status?.is_running, activeTab])

  // Copy helper with feedback
  const copyWithFeedback = (text, keyName, label = 'Teks') => {
    if (!text) return
    safeCopy(text)
    setCopiedKey(keyName)
    toast.success(`${label} berhasil disalin ke clipboard!`)
    setTimeout(() => {
      setCopiedKey(null)
    }, 2000)
  }

  // Start Redis
  const handleStart = async (customMem = null, customPolicy = null) => {
    setActionLoading(true)
    try {
      const res = await api.post('/redis/start', {
        max_memory_mb: customMem || configMem,
        eviction_policy: customPolicy || configPolicy
      })
      if (res.data.success) {
        toast.success(res.data.message || 'Redis instance berhasil diaktifkan!')
        setStatus(res.data.data)
        fetchKeys()
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message
      toast.error(`Gagal mengaktifkan Redis: ${msg}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Stop Redis
  const handleStop = async () => {
    setActionLoading(true)
    try {
      const res = await api.post('/redis/stop')
      if (res.data.success) {
        toast.success(res.data.message || 'Redis instance dinonaktifkan.')
        setStatus(res.data.data)
        setKeyList([])
        setPingResult(null)
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message
      toast.error(`Gagal menonaktifkan Redis: ${msg}`)
    } finally {
      setActionLoading(false)
      setConfirmModal((prev) => ({ ...prev, open: false }))
    }
  }

  // Restart Redis
  const handleRestart = async () => {
    setActionLoading(true)
    try {
      const res = await api.post('/redis/restart')
      if (res.data.success) {
        toast.success('Redis instance berhasil dimuat ulang (restarted)!')
        setStatus(res.data.data)
        fetchKeys()
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message
      toast.error(`Gagal memuat ulang Redis: ${msg}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Flush Redis
  const handleFlush = async () => {
    setActionLoading(true)
    try {
      const res = await api.post('/redis/flush')
      if (res.data.success) {
        toast.success('Seluruh key & database cache Redis berhasil dibersihkan!')
        fetchStatus(true)
        fetchKeys()
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message
      toast.error(`Gagal membersihkan cache: ${msg}`)
    } finally {
      setActionLoading(false)
      setConfirmModal((prev) => ({ ...prev, open: false }))
    }
  }

  // Save Config
  const handleSaveConfig = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const res = await api.post('/redis/config', {
        max_memory_mb: Number(configMem),
        eviction_policy: configPolicy
      })
      if (res.data.success) {
        toast.success('Konfigurasi memori Redis berhasil diterapkan!')
        setStatus(res.data.data)
        setShowConfigModal(false)
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message
      toast.error(`Gagal memperbarui konfigurasi: ${msg}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Test Ping (Always clickable)
  const handlePing = async () => {
    if (!status?.is_running) {
      toast.info('Redis sedang offline. Silakan klik tombol "Aktifkan Redis" untuk mulai.')
      return
    }
    try {
      const startT = performance.now()
      const res = await api.post('/redis/key-op', { action: 'ping' })
      const latency = Math.round((performance.now() - startT) * 10) / 10
      if (res.data.success) {
        setPingResult({ status: 'PONG', latency })
        toast.success(`Ping berhasil: PONG (${latency} ms) via socket terisolasi!`)
      }
    } catch (err) {
      toast.error('Ping gagal: Redis tidak merespons.')
    }
  }

  // Add / Set Key (Auto-activates Redis if offline)
  const handleSetKey = async (e) => {
    e.preventDefault()
    if (!testKeyName.trim()) {
      toast.error('Nama key tidak boleh kosong.')
      return
    }
    setActionLoading(true)
    try {
      if (!status?.is_running) {
        toast.info('Mengaktifkan Redis secara otomatis...')
        await api.post('/redis/start', {
          max_memory_mb: configMem,
          eviction_policy: configPolicy
        })
      }

      const res = await api.post('/redis/key-op', {
        action: 'set',
        key: testKeyName.trim(),
        value: testKeyValue,
        ttl: Number(testKeyTTL) || 0
      })
      if (res.data.success) {
        toast.success(res.data.message || `Key '${testKeyName}' berhasil disimpan!`)
        setShowKeyModal(false)
        setTestKeyName('')
        setTestKeyValue('')
        setTestKeyTTL(0)
        fetchKeys()
        fetchStatus(true)
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message
      toast.error(`Gagal menyimpan key: ${msg}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Delete Key
  const handleDeleteKey = async (keyName) => {
    try {
      const res = await api.post('/redis/key-op', { action: 'del', key: keyName })
      if (res.data.success) {
        toast.success(`Key '${keyName}' berhasil dihapus.`)
        fetchKeys()
        fetchStatus(true)
      }
    } catch (err) {
      toast.error(`Gagal menghapus key: ${err.message}`)
    }
  }

  // Fill Memory Test (Always clickable)
  const handleFillMemoryTest = async () => {
    setFillTestLoading(true)
    try {
      if (!status?.is_running) {
        toast.info('Mengaktifkan Redis secara otomatis untuk uji kapasitas...')
        await api.post('/redis/start', {
          max_memory_mb: configMem,
          eviction_policy: configPolicy
        })
      }

      const res = await api.post('/redis/fill-test', { target_kb: 4000 })
      if (res.data.success) {
        if (res.data.oom_triggered) {
          toast.warning(
            `Kapasitas memori penuh tercapai! Kebijakan '${res.data.eviction_policy}' memproteksi memori akun dengan OOM Protection.`,
            { duration: 6000 }
          )
        } else {
          toast.success(
            `Uji berhasil! ${res.data.keys_created} objek tersimpan. Kebijakan '${res.data.eviction_policy}' otomatis menyeimbangkan kuota memori.`,
            { duration: 6000 }
          )
        }
        setStatus(res.data.status)
        fetchKeys()
      }
    } catch (err) {
      toast.error(`Uji kapasitas gagal: ${err.message}`)
    } finally {
      setFillTestLoading(false)
    }
  }

  // Memory calculation & bounds
  const memoryPercent = status?.memory_usage_percent || 0
  const isMemoryFull = status?.is_full || memoryPercent >= 90
  const maxAvailableMem = Math.min(status?.quota_max_memory_mb || 256, 256)

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-200">
      {/* Top Header - Consistent with DatabasesView, ProjectsView, and CronJobsPage */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 rounded-2xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] border border-[#BFAB96] transition shadow-sm cursor-pointer"
              title="Kembali ke Dashboard"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#2B1810] border border-[#4D2D1E] p-1.5 flex items-center justify-center shadow-sm">
                <img src="/logos/redis.svg" alt="Redis" className="w-6 h-6 object-contain" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-[#26160F]">
                Redis™ Manager
              </h2>
            </div>
          </div>
          <p className="text-xs text-[#5C3B29] font-sans ml-12">
            In-memory data caching, session storage mandiri, dan message broker terisolasi per akun mahasiswa.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => fetchStatus(true)}
            title="Segarkan Metrik"
            className="p-2.5 rounded-2xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] border border-[#BFAB96] transition shadow-sm cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {status?.is_running ? (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleRestart}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] border border-[#BFAB96] transition shadow-sm flex items-center space-x-1.5 cursor-pointer"
              >
                <RotateCw className={`h-3.5 w-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                <span>Restart</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setConfirmModal({
                    open: true,
                    title: 'Nonaktifkan Redis Instance',
                    message: 'Apakah Anda yakin ingin mematikan Redis instance? Aplikasi web yang bergantung pada caching atau session Redis mungkin akan mengalami penurunan performa atau logout.',
                    confirmText: 'Hentikan Redis',
                    confirmColor: 'bg-rose-900 hover:bg-rose-950',
                    onConfirm: handleStop
                  })
                }
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-2xl text-xs font-semibold bg-rose-900/90 hover:bg-rose-900 text-rose-100 border border-rose-800 transition shadow-sm flex items-center space-x-1.5 cursor-pointer"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Hentikan (Stop)</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleStart()}
              disabled={actionLoading}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#2B1810] hover:bg-[#3D2317] text-[#FAF5EC] border border-[#4D2D1E] shadow-lg shadow-black/10 transition shrink-0 cursor-pointer"
            >
              <Play className="h-4 w-4 text-emerald-400 fill-current" />
              <span>Aktifkan Redis (Enable)</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 3 Overview Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Socket & Runtime (Clean, NO AI SLOP, NO dot stopped badge) */}
          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-5 shadow-xl flex flex-col justify-between text-[#FAF5EC]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="p-2 rounded-xl bg-[#1C0F0A] border border-[#3E2316] text-[#C49767]">
                    <Server className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#DFCDB5]">
                    Socket & Runtime
                  </span>
                </div>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {/* User */}
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#A47E65]">Akun Pengguna:</div>
                  <div className="text-sm font-semibold text-[#FAF5EC] mt-0.5">{currentUser?.username || 'user'}</div>
                </div>

                {/* Unix Socket */}
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#A47E65] flex items-center justify-between">
                    <span>Unix Domain Socket (Terisolasi):</span>
                    <button
                      type="button"
                      onClick={() => copyWithFeedback(status?.socket_path, 'sock', 'Socket Path')}
                      className="text-[#C49767] hover:text-[#FAF5EC] text-[10px] flex items-center gap-1 font-sans cursor-pointer"
                    >
                      {copiedKey === 'sock' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>Salin</span>
                    </button>
                  </div>
                  <div className="p-2 rounded-xl bg-[#1C0F0A] border border-[#3E2316] text-[#E8DCB8] text-[11px] break-all select-all mt-1">
                    {status?.socket_path || `/home/${currentUser?.username}/.redis/redis.sock`}
                  </div>
                </div>

                {/* TCP Port & Host */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-[#A47E65]">Host IP:</div>
                    <div className="p-2 rounded-xl bg-[#1C0F0A] border border-[#3E2316] text-[#E8DCB8] text-[11px] mt-0.5">
                      127.0.0.1
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-[#A47E65]">Loopback Port:</div>
                    <div className="p-2 rounded-xl bg-[#1C0F0A] border border-[#3E2316] text-[#E8DCB8] text-[11px] mt-0.5">
                      {status?.port || 13000}
                    </div>
                  </div>
                </div>

                {/* Password Token */}
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#A47E65] flex items-center justify-between">
                    <span>Password (requirepass):</span>
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[#A47E65] hover:text-[#FAF5EC] p-0.5 cursor-pointer"
                        title={showPassword ? 'Sembunyikan' : 'Lihat'}
                      >
                        {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyWithFeedback(status?.password, 'pass', 'Password Redis')}
                        className="text-[#C49767] hover:text-[#FAF5EC] text-[10px] flex items-center gap-1 font-sans cursor-pointer"
                      >
                        {copiedKey === 'pass' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        <span>Salin</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#1C0F0A] border border-[#3E2316] text-[#E8DCB8] text-[11px] font-mono mt-1 flex items-center justify-between">
                    <span>{showPassword ? status?.password : '••••••••••••••••••••'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#3E2316] flex items-center justify-between text-[11px] text-[#DFCDB5]">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#C49767]" />
                <span>Status:</span>
              </span>
              <span className="font-mono font-semibold text-[#FAF5EC]">
                {status?.is_running ? `Aktif (${status?.uptime_human})` : 'Offline (Siap Diaktifkan)'}
              </span>
            </div>
          </div>

          {/* Card 2: Alokasi Memori Akun */}
          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-5 shadow-xl flex flex-col justify-between text-[#FAF5EC]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="p-2 rounded-xl bg-[#1C0F0A] border border-[#3E2316] text-[#C49767]">
                    <HardDrive className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#DFCDB5]">
                    Alokasi Memori Akun
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(true)}
                  className="px-2.5 py-1 rounded-xl bg-[#1C0F0A] hover:bg-[#3E2216] border border-[#3E2316] text-[11px] font-semibold text-[#C49767] hover:text-[#FAF5EC] transition flex items-center gap-1 cursor-pointer"
                >
                  <Sliders className="h-3 w-3" />
                  <span>Ubah</span>
                </button>
              </div>

              {/* Memory Meter Bar */}
              <div className="space-y-3">
                <div className="flex items-baseline justify-between font-mono">
                  <div>
                    <span className="text-2xl font-black text-[#FAF5EC]">{status?.used_memory_human || '0B'}</span>
                    <span className="text-xs text-[#DFCDB5]/70 ml-1.5">/ {status?.max_memory_mb || 32} MB</span>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      isMemoryFull ? 'text-red-400' : memoryPercent > 70 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {memoryPercent}%
                  </span>
                </div>

                <div className="w-full bg-[#1C0F0A] h-3 rounded-full overflow-hidden p-0.5 border border-[#3E2316]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isMemoryFull
                        ? 'bg-gradient-to-r from-red-600 to-rose-500'
                        : memoryPercent > 70
                        ? 'bg-gradient-to-r from-amber-600 to-yellow-500'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(3, memoryPercent))}%` }}
                  ></div>
                </div>

                <div className="space-y-2 text-xs pt-1 font-sans">
                  <div className="flex items-center justify-between text-[#DFCDB5]/80">
                    <span>Memori Puncak (Peak):</span>
                    <span className="font-mono font-semibold text-[#FAF5EC]">{status?.used_memory_peak_human || '0B'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#DFCDB5]/80">
                    <span>Batas Kuota Workspace:</span>
                    <span className="font-mono font-semibold text-[#C49767]">{status?.quota_max_memory_mb || 256} MB</span>
                  </div>
                  <div className="flex items-center justify-between text-[#DFCDB5]/80">
                    <span>Kebijakan Eviction (Penuh):</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-[#1C0F0A] border border-[#3E2316] text-amber-300">
                      {status?.eviction_policy || 'allkeys-lru'}
                    </span>
                  </div>
                </div>

                {isMemoryFull && (
                  <div className="p-3 rounded-2xl bg-red-950/60 border border-red-700/60 text-xs text-red-200 flex items-start gap-2 mt-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                    <div>
                      <div className="font-bold">Memori Redis Mendekati Penuh!</div>
                      <div className="text-[11px] text-red-300 mt-0.5">
                        Kebijakan <b>{status?.eviction_policy}</b> aktif menghapus key usang secara otomatis agar sistem tetap stabil.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#3E2316]">
              <button
                type="button"
                onClick={handleFillMemoryTest}
                disabled={fillTestLoading}
                className="w-full py-2 px-3 rounded-xl bg-[#1C0F0A] hover:bg-[#3A2216] border border-[#3E2316] text-xs font-semibold text-[#C49767] hover:text-[#FAF5EC] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                title="Simulasi penulisan data kapasitas penuh untuk menguji mekanisme eviction & proteksi OOM"
              >
                <Flame className={`h-3.5 w-3.5 text-amber-400 ${fillTestLoading ? 'animate-bounce' : ''}`} />
                <span>{fillTestLoading ? 'Menguji Kapasitas Penuh...' : 'Uji Beban Kapasitas Penuh (Full Test)'}</span>
              </button>
            </div>
          </div>

          {/* Card 3: Performa & Key Store */}
          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-5 shadow-xl flex flex-col justify-between text-[#FAF5EC]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="p-2 rounded-xl bg-[#1C0F0A] border border-[#3E2316] text-[#C49767]">
                    <Activity className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#DFCDB5]">
                    Performa & Key Store
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handlePing}
                  className="px-2.5 py-1 rounded-xl bg-[#1C0F0A] hover:bg-[#3E2216] border border-[#3E2316] text-[11px] font-semibold text-emerald-400 hover:text-white transition flex items-center gap-1 cursor-pointer"
                  title="Ping socket redis"
                >
                  <Zap className="h-3 w-3 fill-current" />
                  <span>Ping Test</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] text-center">
                  <div className="text-[10px] uppercase font-bold text-[#A47E65]">Total Keys Aktif</div>
                  <div className="text-xl font-extrabold text-[#FAF5EC] font-mono mt-0.5">
                    {status?.total_keys || 0}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] text-center">
                  <div className="text-[10px] uppercase font-bold text-[#A47E65]">Koneksi Klien</div>
                  <div className="text-xl font-extrabold text-[#FAF5EC] font-mono mt-0.5">
                    {status?.connected_clients || 0}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs font-sans">
                <div className="flex items-center justify-between text-[#DFCDB5]/80">
                  <span>Cache Hit Rate:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {status?.hit_rate_percent || 0}% ({status?.keyspace_hits || 0} hits)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#DFCDB5]/80">
                  <span>Keyspace Misses:</span>
                  <span className="font-mono font-bold text-[#DFCDB5]">{status?.keyspace_misses || 0}</span>
                </div>
                {pingResult && (
                  <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-[11px] text-emerald-300 flex items-center justify-between font-mono mt-2">
                    <span>Hasil Ping: {pingResult.status}</span>
                    <span className="font-bold">{pingResult.latency} ms</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#3E2316] flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  if (!status?.is_running) {
                    toast.info('Redis sedang offline.')
                    return
                  }
                  setConfirmModal({
                    open: true,
                    title: 'Bersihkan Seluruh Cache (FLUSHALL)',
                    message: 'Apakah Anda yakin ingin menghapus seluruh cache dan data key-value di instance Redis Anda? Data yang belum disimpan permanen ke disk akan terhapus.',
                    confirmText: 'Bersihkan Cache',
                    confirmColor: 'bg-amber-700 hover:bg-amber-800',
                    onConfirm: handleFlush
                  })
                }}
                disabled={actionLoading}
                className="flex-1 py-2 px-3 rounded-xl bg-[#3D2516] hover:bg-[#52331F] border border-[#633C24] text-xs font-semibold text-[#E8C58D] hover:text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Flush Cache</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('explorer')
                  fetchKeys()
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-[#2E1810] hover:bg-[#3E2216] border border-[#5A3521] text-xs font-semibold text-[#E8DCB8] hover:text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Key className="h-3.5 w-3.5 text-[#C49767]" />
                <span>Kelola Key</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Section: Panduan Integrasi vs Key Explorer vs Admin Cluster */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl overflow-hidden shadow-2xl text-[#FAF5EC]">
        {/* Tab Headers */}
        <div className="flex items-center border-b border-[#3E2316] bg-[#1C0F0A] px-4 pt-2 overflow-x-auto gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-2 border-b-2 shrink-0 cursor-pointer ${
              activeTab === 'guide'
                ? 'border-[#C49767] text-[#FAF5EC]'
                : 'border-transparent text-[#DFCDB5]/70 hover:text-[#FAF5EC]'
            }`}
          >
            <FileCode className="h-4 w-4 text-[#C49767]" />
            <span>Cara Hubungkan (Panduan Integrasi Framework)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('explorer')
              fetchKeys()
            }}
            className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-2 border-b-2 shrink-0 cursor-pointer ${
              activeTab === 'explorer'
                ? 'border-[#C49767] text-[#FAF5EC]'
                : 'border-transparent text-[#DFCDB5]/70 hover:text-[#FAF5EC]'
            }`}
          >
            <Key className="h-4 w-4 text-[#C49767]" />
            <span>Key Explorer & Caching Test</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('admin')
                fetchAdminInstances()
              }}
              className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-2 border-b-2 shrink-0 cursor-pointer ${
                activeTab === 'admin'
                  ? 'border-[#C49767] text-[#FAF5EC]'
                  : 'border-transparent text-[#DFCDB5]/70 hover:text-[#FAF5EC]'
              }`}
            >
              <Radio className="h-4 w-4 text-emerald-400" />
              <span>Semua Instance Mahasiswa (Admin)</span>
            </button>
          )}
        </div>

        {/* Tab Content 1: Panduan Integrasi */}
        {activeTab === 'guide' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap gap-2 pb-2 border-b border-[#3E2316]">
              {[
                { id: 'laravel', label: 'PHP / Laravel (.env)' },
                { id: 'python', label: 'Python (Flask / Django / redis-py)' },
                { id: 'node', label: 'Node.js (ioredis / Express)' },
                { id: 'wordpress', label: 'WordPress (Object Cache)' },
                { id: 'cli', label: 'Terminal / redis-cli' }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setGuideLang(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    guideLang === t.id
                      ? 'bg-[#C49767] text-[#1C0F0A]'
                      : 'bg-[#1C0F0A] text-[#DFCDB5] hover:bg-[#3E2216]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Code Display */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#DFCDB5]/80 font-mono">
                  {guideLang === 'laravel' && 'Konfigurasi file .env project Laravel Anda:'}
                  {guideLang === 'python' && 'Script Python terisolasi menggunakan redis-py:'}
                  {guideLang === 'node' && 'Inisialisasi koneksi Node.js menggunakan paket ioredis:'}
                  {guideLang === 'wordpress' && 'Konfigurasi file wp-config.php WordPress:'}
                  {guideLang === 'cli' && 'Perintah eksekusi interaktif di Web Terminal MiraiGrid:'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    let snippet = ''
                    const user = currentUser?.username || 'user'
                    const sock = status?.socket_path || `/home/${user}/.redis/redis.sock`
                    const pass = status?.password || 'password'
                    const port = status?.port || 13000

                    if (guideLang === 'laravel') {
                      snippet = `CACHE_STORE=redis\nSESSION_DRIVER=redis\nQUEUE_CONNECTION=redis\n\nREDIS_CLIENT=predis\nREDIS_SCHEME=unix\nREDIS_PATH=${sock}\nREDIS_PASSWORD=${pass}\nREDIS_PORT=0`
                    } else if (guideLang === 'python') {
                      snippet = `import redis\n\n# Koneksi via Unix Domain Socket (Direkomendasikan - Kecepatan Maksimal)\nr = redis.Redis(unix_socket_path='${sock}', password='${pass}', decode_responses=True)\n\nr.set('praktikum_key', 'Halo Lab TI UMPO')\nprint(r.get('praktikum_key'))`
                    } else if (guideLang === 'node') {
                      snippet = `const Redis = require('ioredis');\n\n// Koneksi via Unix Domain Socket\nconst redis = new Redis('${sock}', {\n  password: '${pass}'\n});\n\nredis.set('session_id', '12345');\nredis.get('session_id').then(console.log);`
                    } else if (guideLang === 'wordpress') {
                      snippet = `define('WP_REDIS_SCHEME', 'unix');\ndefine('WP_REDIS_PATH', '${sock}');\ndefine('WP_REDIS_PASSWORD', '${pass}');\ndefine('WP_REDIS_DATABASE', 0);`
                    } else if (guideLang === 'cli') {
                      snippet = `redis-cli -s ${sock} -a "${pass}"`
                    }
                    copyWithFeedback(snippet, `snippet-${guideLang}`, 'Snippet Kode')
                  }}
                  className="px-2.5 py-1 rounded-xl bg-[#1C0F0A] hover:bg-[#3E2216] border border-[#3E2316] text-xs font-semibold text-[#C49767] hover:text-[#FAF5EC] transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === `snippet-${guideLang}` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Salin Snippet</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] font-mono text-xs text-[#E8DCB8] overflow-x-auto leading-relaxed select-all">
                {guideLang === 'laravel' && (
                  <pre>{`# ==========================================
# Konfigurasi Redis Cache & Session Laravel
# ==========================================
CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

REDIS_CLIENT=predis
REDIS_SCHEME=unix
REDIS_PATH=${status?.socket_path || `/home/${currentUser?.username}/.redis/redis.sock`}
REDIS_PASSWORD=${status?.password || 'password'}
REDIS_PORT=0

# Atau via TCP Loopback:
# REDIS_HOST=127.0.0.1
# REDIS_PORT=${status?.port || 13000}
# REDIS_PASSWORD=${status?.password || 'password'}`}</pre>
                )}

                {guideLang === 'python' && (
                  <pre>{`import redis

# 1. Koneksi via Unix Domain Socket (Direkomendasikan - Zero Network Overhead)
r = redis.Redis(
    unix_socket_path='${status?.socket_path || `/home/${currentUser?.username}/.redis/redis.sock`}',
    password='${status?.password || 'password'}',
    decode_responses=True
)

# 2. Atau koneksi via TCP Port terisolasi:
# r = redis.Redis(host='127.0.0.1', port=${status?.port || 13000}, password='${status?.password || 'password'}')

r.set('mahasiswa:nim', '${currentUser?.username}')
r.set('praktikum:status', 'Aktif')
print("Status:", r.get('praktikum:status'))`}</pre>
                )}

                {guideLang === 'node' && (
                  <pre>{`const Redis = require('ioredis');

// 1. Inisialisasi koneksi via Unix Domain Socket
const redis = new Redis('${status?.socket_path || `/home/${currentUser?.username}/.redis/redis.sock`}', {
  password: '${status?.password || 'password'}'
});

redis.set('jwt_token_sample', 'eyJhbGciOi...');
redis.get('jwt_token_sample', (err, result) => {
  console.log('Value:', result);
});`}</pre>
                )}

                {guideLang === 'wordpress' && (
                  <pre>{`// Tambahkan di wp-config.php sebelum baris "That's all, stop editing!"
define('WP_REDIS_SCHEME', 'unix');
define('WP_REDIS_PATH', '${status?.socket_path || `/home/${currentUser?.username}/.redis/redis.sock`}');
define('WP_REDIS_PASSWORD', '${status?.password || 'password'}');
define('WP_REDIS_DATABASE', 0);`}</pre>
                )}

                {guideLang === 'cli' && (
                  <pre>{`# Akses langsung di Web Terminal MiraiGrid (/terminal):
redis-cli -s ${status?.socket_path || `/home/${currentUser?.username}/.redis/redis.sock`} -a "${status?.password || 'password'}"

# Contoh Perintah Redis CLI:
# 127.0.0.1:0> PING
# PONG
# 127.0.0.1:0> SET praktikum "Teknik Informatika UMPO"
# OK
# 127.0.0.1:0> GET praktikum
# "Teknik Informatika UMPO"`}</pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 2: Key Explorer */}
        {activeTab === 'explorer' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#FAF5EC]">Daftar Key di Instance Redis Anda</h3>
                <p className="text-xs text-[#DFCDB5]/70">Daftar objek key-value aktif yang tersimpan dalam database Redis Anda saat ini.</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={fetchKeys}
                  className="p-2 rounded-xl bg-[#1C0F0A] hover:bg-[#3E2216] border border-[#3E2316] text-[#DFCDB5] hover:text-[#FAF5EC] transition cursor-pointer"
                  title="Segarkan Key"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowKeyModal(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#C49767] hover:bg-[#D4A777] text-xs font-bold text-[#1C0F0A] transition shadow-sm cursor-pointer active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Key Baru</span>
                </button>
              </div>
            </div>

            {keyList.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#DFCDB5]/70 bg-[#1C0F0A] rounded-2xl border border-[#3E2316]">
                <Key className="h-8 w-8 mx-auto mb-2 text-[#A47E65]" />
                <p>Belum ada key yang tersimpan di instance Redis ini.</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowKeyModal(true)}
                    className="px-4 py-2 rounded-xl bg-[#C49767] hover:bg-[#D4A777] text-xs font-bold text-[#1C0F0A] transition cursor-pointer"
                  >
                    + Buat Key Pertama
                  </button>
                  {!status?.is_running && (
                    <button
                      type="button"
                      onClick={() => handleStart()}
                      className="px-4 py-2 rounded-xl bg-[#2B1810] hover:bg-[#3E2216] border border-[#5A3521] text-xs font-semibold text-[#E8DCB8] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 text-emerald-400 fill-current" />
                      <span>Aktifkan Redis</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#3E2316]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1C0F0A] text-[#DFCDB5] uppercase text-[10px] tracking-wider border-b border-[#3E2316]">
                    <tr>
                      <th className="p-3 font-semibold">Nama Key</th>
                      <th className="p-3 font-semibold">Tipe Data</th>
                      <th className="p-3 font-semibold">TTL (Sisa Waktu)</th>
                      <th className="p-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3E2316] bg-[#2B1810]">
                    {keyList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#361E13] transition font-mono">
                        <td className="p-3 font-bold text-[#FAF5EC]">{item.key}</td>
                        <td className="p-3 text-[#E8C58D] text-[11px] uppercase">{item.type}</td>
                        <td className="p-3 text-[#DFCDB5] text-[11px]">
                          {item.ttl === -1 ? 'Persisten (No Expire)' : `${item.ttl} detik`}
                        </td>
                        <td className="p-3 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => handleDeleteKey(item.key)}
                            className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 transition cursor-pointer"
                            title="Hapus Key"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 3: Admin Multi-Tenant Instances */}
        {activeTab === 'admin' && isAdmin && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#FAF5EC]">Daftar Instance Redis Seluruh Mahasiswa</h3>
                <p className="text-xs text-[#DFCDB5]/70">Pantau socket terisolasi, port loopback, dan status aktif Redis setiap akun di cluster.</p>
              </div>
              <button
                type="button"
                onClick={fetchAdminInstances}
                className="p-2 rounded-xl bg-[#1C0F0A] hover:bg-[#3E2216] border border-[#3E2316] text-[#DFCDB5] hover:text-[#FAF5EC] transition cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#3E2316]">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#1C0F0A] text-[#DFCDB5] uppercase text-[10px] tracking-wider border-b border-[#3E2316]">
                  <tr>
                    <th className="p-3 font-semibold">User / NIM</th>
                    <th className="p-3 font-semibold">Nama Mahasiswa</th>
                    <th className="p-3 font-semibold">Status Runtime</th>
                    <th className="p-3 font-semibold">Socket Path Terisolasi</th>
                    <th className="p-3 font-semibold">Port</th>
                    <th className="p-3 font-semibold">Kapasitas</th>
                    <th className="p-3 font-semibold">Eviction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3E2316] bg-[#2B1810]">
                  {allInstances.map((inst) => (
                    <tr key={inst.id} className="hover:bg-[#361E13] transition font-mono">
                      <td className="p-3 font-bold text-[#FAF5EC]">{inst.username}</td>
                      <td className="p-3 font-sans text-[#DFCDB5]">{inst.user_name}</td>
                      <td className="p-3 font-sans">
                        {inst.is_running ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>Running</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900/60 text-zinc-400 border border-zinc-700/50 text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
                            <span>Stopped</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-[#E8DCB8] text-[11px]">{inst.socket_path}</td>
                      <td className="p-3 text-[#E8C58D]">{inst.port}</td>
                      <td className="p-3 text-[#FAF5EC]">{inst.max_memory_mb} MB</td>
                      <td className="p-3 text-[#DFCDB5] text-[11px]">{inst.eviction_policy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Konfigurasi Memori & Eviction Policy */}
      <ModalPortal isOpen={showConfigModal}>
        <div
          onClick={() => setShowConfigModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#2B1810] border border-[#5A3521] rounded-3xl p-6 w-full max-w-md shadow-2xl text-[#FAF5EC] relative animate-in zoom-in-95 duration-150"
          >
            <button
              type="button"
              onClick={() => setShowConfigModal(false)}
              className="absolute right-5 top-5 p-1 rounded-xl text-[#A47E65] hover:text-[#FAF5EC] hover:bg-[#3E2216] transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-3 mb-5">
              <div className="w-9 h-9 rounded-2xl bg-[#1C0F0A] border border-[#5A3521] p-1.5 flex items-center justify-center">
                <Sliders className="h-4 w-4 text-[#C49767]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#FAF5EC]">Konfigurasi Memori Redis</h3>
                <p className="text-xs text-[#DFCDB5]/70">Atur batas kapasitas memori dan kebijakan saat memori penuh.</p>
              </div>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              {/* Preset Memori */}
              <div>
                <label className="text-xs font-semibold text-[#DFCDB5] block mb-2">
                  Pilih Alokasi Kapasitas Memori (MB):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[16, 32, 64, 128].map((size) => {
                    const disabled = size > maxAvailableMem && !isAdmin
                    return (
                      <button
                        key={size}
                        type="button"
                        disabled={disabled}
                        onClick={() => setConfigMem(size)}
                        className={`py-2 rounded-xl text-xs font-mono font-bold transition border cursor-pointer ${
                          configMem === size
                            ? 'bg-[#C49767] text-[#1C0F0A] border-[#D4A777]'
                            : disabled
                            ? 'opacity-30 bg-[#1C0F0A] border-[#3E2316] cursor-not-allowed'
                            : 'bg-[#1C0F0A] text-[#DFCDB5] border-[#3E2316] hover:bg-[#3E2216]'
                        }`}
                      >
                        {size} MB
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-[#A47E65] mt-1.5">
                  Batas memori maksimal akun praktikum Anda: <b>{maxAvailableMem} MB</b>.
                </p>
              </div>

              {/* Eviction Policy */}
              <div>
                <label className="text-xs font-semibold text-[#DFCDB5] block mb-1.5">
                  Kebijakan Saat Memori Penuh (Eviction Policy):
                </label>
                <select
                  value={configPolicy}
                  onChange={(e) => setConfigPolicy(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#4D2D1E] focus:border-[#C49767] rounded-xl px-3 py-2 text-xs text-[#FAF5EC] font-mono outline-none"
                >
                  <option value="allkeys-lru">allkeys-lru (Otomatis hapus key usang - Sangat Direkomendasikan)</option>
                  <option value="volatile-lru">volatile-lru (Hanya hapus key yang memiliki masa TTL)</option>
                  <option value="allkeys-random">allkeys-random (Hapus key acak saat penuh)</option>
                  <option value="noeviction">noeviction (Tolak penulisan baru saat penuh / OOM Error)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#3E2316] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#1C0F0A] hover:bg-[#3E2216] border border-[#3E2316] text-xs font-semibold text-[#DFCDB5] transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#C49767] hover:bg-[#D4A777] text-xs font-bold text-[#1C0F0A] transition shadow-md cursor-pointer"
                >
                  {actionLoading ? 'Menyimpan...' : 'Terapkan Konfigurasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* Modal 2: Tambah Test Key */}
      <ModalPortal isOpen={showKeyModal}>
        <div
          onClick={() => setShowKeyModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#2B1810] border border-[#5A3521] rounded-3xl p-6 w-full max-w-md shadow-2xl text-[#FAF5EC] relative animate-in zoom-in-95 duration-150"
          >
            <button
              type="button"
              onClick={() => setShowKeyModal(false)}
              className="absolute right-5 top-5 p-1 rounded-xl text-[#A47E65] hover:text-[#FAF5EC] hover:bg-[#3E2216] transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-3 mb-5">
              <div className="w-9 h-9 rounded-2xl bg-[#1C0F0A] border border-[#5A3521] p-1.5 flex items-center justify-center">
                <Key className="h-4 w-4 text-[#C49767]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#FAF5EC]">Simpan Key Baru ke Redis</h3>
                <p className="text-xs text-[#DFCDB5]/70">Simpan string data ke dalam in-memory cache instance Anda.</p>
              </div>
            </div>

            <form onSubmit={handleSetKey} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#DFCDB5] block mb-1">Nama Key:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: user_session:1001"
                  value={testKeyName}
                  onChange={(e) => setTestKeyName(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#4D2D1E] focus:border-[#C49767] rounded-xl px-3 py-2 text-xs text-[#FAF5EC] font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#DFCDB5] block mb-1">Nilai / Value:</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Contoh: Halo dari Praktikum Sistem Lab TI UMPO"
                  value={testKeyValue}
                  onChange={(e) => setTestKeyValue(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#4D2D1E] focus:border-[#C49767] rounded-xl px-3 py-2 text-xs text-[#FAF5EC] font-mono outline-none"
                ></textarea>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#DFCDB5] block mb-1">
                  Masa Berlaku / TTL dalam Detik (0 = Persisten):
                </label>
                <input
                  type="number"
                  min="0"
                  value={testKeyTTL}
                  onChange={(e) => setTestKeyTTL(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#4D2D1E] focus:border-[#C49767] rounded-xl px-3 py-2 text-xs text-[#FAF5EC] font-mono outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[#3E2316] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#1C0F0A] hover:bg-[#3E2216] border border-[#3E2316] text-xs font-semibold text-[#DFCDB5] transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#C49767] hover:bg-[#D4A777] text-xs font-bold text-[#1C0F0A] transition shadow-md cursor-pointer"
                >
                  {actionLoading ? 'Menyimpan...' : 'Simpan Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmColor={confirmModal.confirmColor}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  )
}
