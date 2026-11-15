import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Cpu,
  Globe
} from 'lucide-react'
import { api } from '../api/client'
import { Spinner } from '../components/Skeletons'
import LoginIsometricShowcase from '../components/LoginIsometricShowcase'

const SHOWCASE_STEPS = [
  {
    id: 'auth',
    number: '01 / PROVISIONING OTOMATIS',
    title: 'Satu Kredensial untuk Seluruh Infrastruktur Lab.',
    description:
      'Gunakan akun terdaftar Anda untuk masuk ke sistem. Lingkungan kerja, alokasi ruang penyimpanan, dan konfigurasi jaringan langsung disiapkan secara otomatis tanpa perlu setup server manual.',
    label: 'Akses Lingkungan Kerja',
    statusText: 'Sandbox Gateway: Ready • Automated Workspace Provisioning',
    icon: ShieldCheck
  },
  {
    id: 'sandbox',
    number: '02 / KERNEL SANDBOXING',
    title: 'Batas Memori & CPU yang Aman di Level Kernel.',
    description:
      'Setiap proyek berjalan di dalam container terisolasi dengan proteksi cgroup v2. Program yang mengalami kegagalan eksekusi atau konsumsi memori berlebih tidak akan mengganggu stabilitas server maupun proyek pengguna lain.',
    label: 'Isolasi Resource',
    statusText: 'Kernel Sandbox: cgroup v2 Active • OOM Protection Armed',
    icon: Cpu
  },
  {
    id: 'ingress',
    number: '03 / INGRESS & NETWORKING',
    title: 'Proyek Web Langsung Online di Jaringan Terenkripsi.',
    description:
      'Dukungan runtime multi-bahasa terintegrasi penuh dengan reverse proxy modern. Aplikasi praktikum Anda langsung dapat diuji dari browser apa pun melalui subdomain resmi yang aman dengan sertifikat SSL.',
    label: 'Publikasi Instan',
    statusText: 'Edge Routing: SSL Active • Multi-Runtime PHP, Node.js & Python',
    icon: Globe
  }
]

async function computeDeviceFingerprint() {
  const parts = [
    navigator.userAgent || '',
    navigator.platform || '',
    navigator.language || '',
    `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 0}`,
    String(navigator.hardwareConcurrency || ''),
    Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  ]
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 180
    canvas.height = 40
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#069'
      ctx.fillText('MiraiGrid-WAF-FP', 2, 2)
      parts.push(canvas.toDataURL().slice(-64))
    }
  } catch {
    // ignore canvas errors in headless/restricted environments
  }
  const raw = parts.join('|')
  try {
    if (window.crypto?.subtle) {
      const buf = new TextEncoder().encode(raw)
      const digest = await window.crypto.subtle.digest('SHA-256', buf)
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      return `dev_${hex.slice(0, 32)}`
    }
  } catch {
    // fallback below
  }
  let h = 2166136261
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `dev_${(h >>> 0).toString(16).padStart(8, '0')}`
}

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeStep, setActiveStep] = useState(0)
  const [loginSig, setLoginSig] = useState(null)
  const [deviceId, setDeviceId] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  const refreshLoginSignature = async (fp) => {
    try {
      const res = await api.get('/auth/login-signature', {
        headers: fp ? { 'X-Device-ID': fp } : undefined
      })
      const sigData = res.data
      setLoginSig(sigData)
      if (sigData?.t && sigData?.n && sigData?.sig) {
        const params = new URLSearchParams({
          t: String(sigData.t),
          n: String(sigData.n),
          sig: String(sigData.sig)
        })
        window.history.replaceState(null, '', `/login?${params.toString()}`)
      }
      return sigData
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.detail) {
        setError(err.response.data.detail)
      }
      return null
    }
  }

  useEffect(() => {
    let mounted = true
    computeDeviceFingerprint().then((fp) => {
      if (!mounted) return
      setDeviceId(fp)
      refreshLoginSignature(fp)
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const t = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(t)
  }, [cooldownSeconds])

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % SHOWCASE_STEPS.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [activeStep])

  const handleLogin = async (e) => {
    e.preventDefault()
    if (cooldownSeconds > 0) return
    setError('')
    setLoading(true)

    const cleanUsername = username.trim()
    const fp = deviceId || (await computeDeviceFingerprint())
    if (!deviceId) setDeviceId(fp)
    let sigObj = loginSig
    if (!sigObj?.t || !sigObj?.sig) {
      sigObj = await refreshLoginSignature(fp)
    }

    try {
      const response = await api.post(
        '/auth/login',
        {
          username: cleanUsername,
          password,
          login_t: sigObj?.t || null,
          login_n: sigObj?.n || null,
          login_sig: sigObj?.sig || null,
          device_id: fp
        },
        {
          headers: { 'X-Device-ID': fp }
        }
      )
      const data = response.data
      localStorage.setItem('miraigrid_token', data.access_token)
      try {
        if (window.location.hostname.includes('miraigrid.web.id')) {
          document.cookie = `miraigrid_token=${data.access_token}; path=/; domain=.miraigrid.web.id; max-age=86400; SameSite=Lax; Secure`
        } else {
          document.cookie = `miraigrid_token=${data.access_token}; path=/; max-age=86400; SameSite=Lax`
        }
      } catch (e) {
        console.error('Cookie set error:', e)
      }
      localStorage.setItem(
        'miraigrid_user',
        JSON.stringify({
          username: data.username,
          name: data.name,
          role: data.role,
          must_change_password: data.must_change_password
        })
      )

      if (data.role === 'admin') {
        toast.success(`Selamat datang kembali, ${data.name}!`, {
          description: 'Akses administrator Lab TI UMPO berhasil diaktifkan.'
        })
      } else {
        toast.success(`Selamat datang di MiraiGrid, ${data.name}!`, {
          description: 'Otentikasi berhasil. Ruang praktikum Anda siap digunakan.'
        })
      }

      onLoginSuccess(data)
    } catch (err) {
      let errMsg = 'Gagal masuk. Periksa kembali NIM/Username dan Password Anda.'
      if (err.response?.data?.detail) {
        errMsg = err.response.data.detail
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errMsg = 'Koneksi ke server timeout. Silakan periksa koneksi jaringan kampus Anda dan coba lagi.'
      } else if (err.message === 'Network Error' || !err.response) {
        errMsg = 'Gagal terhubung ke server API MiraiGrid. Pastikan koneksi jaringan aktif.'
      }

      if (err.response?.status === 429) {
        const retryHdr = parseInt(err.response.headers?.['retry-after'] || '0', 10)
        if (retryHdr > 0) setCooldownSeconds(retryHdr)
      } else if (err.response?.status === 403 && String(err.response?.data?.detail || '').toLowerCase().includes('signature')) {
        refreshLoginSignature(fp)
      }

      setError(errMsg)
      toast.error('Gagal Otentikasi Masuk', {
        description: errMsg,
        duration: 6000
      })
    } finally {
      setLoading(false)
    }
  }

  const currentStep = SHOWCASE_STEPS[activeStep]

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col md:flex-row relative overflow-x-hidden font-sans select-none">
      {/* LEFT COLUMN: 3-Step Living Showcase (Hidden cleanly on mobile < 768px) */}
      <div className="hidden md:flex md:w-7/12 p-8 lg:p-12 flex-col justify-between relative z-10 border-r border-slate-200/80 bg-white">
        {/* Top Brand Header + Progress Line Tracker */}
        <div>
          <div className="flex items-center space-x-3.5 mb-6">
            <div className="h-11 w-11 rounded-xl bg-slate-50 p-2 border border-slate-200/80 flex items-center justify-center shrink-0">
              <img
                src="/logos/miraigrid-logo.svg"
                alt="MiraiGrid Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                MiraiGrid
              </h1>
              <p className="text-xs font-medium text-slate-500">
                Cloud Workspace • Lab TI UMPO
              </p>
            </div>
          </div>

          {/* 3-Bar Interactive Progress Line Tracker */}
          <div
            className="grid grid-cols-3 gap-2.5 max-w-xl"
            role="tablist"
            aria-label="Langkah Ekosistem Cloud Lab"
          >
            {SHOWCASE_STEPS.map((step, idx) => {
              const isActive = idx === activeStep
              return (
                <button
                  key={step.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Langkah ${idx + 1}: ${step.label}`}
                  onClick={() => setActiveStep(idx)}
                  className="py-2 text-left cursor-pointer group focus:outline-none"
                >
                  <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                    {isActive ? (
                      <div
                        key={`progress-${activeStep}`}
                        className="h-full bg-emerald-600 rounded-full animate-showcase-progress"
                      />
                    ) : (
                      <div className="h-full w-0 bg-slate-200 rounded-full group-hover:w-full group-hover:bg-slate-300 transition-all duration-200" />
                    )}
                  </div>
                  <span
                    className={`mt-2 block text-[11px] font-mono transition-colors ${
                      isActive
                        ? 'text-emerald-700 font-semibold'
                        : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  >
                    0{idx + 1} • {step.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Center Living Showcase Step Content (Fade & Slide Transition) */}
        <div className="my-6 max-w-xl">
          <div key={currentStep.id} className="animate-showcase-step space-y-4">
            <div className="space-y-2.5">
              <p className="font-mono text-xs text-slate-400 tracking-wider">
                {currentStep.number}
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 leading-[1.2] tracking-tight">
                {currentStep.title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {currentStep.description}
              </p>
            </div>

            {/* Clean 2.5D Isometric Vector Illustration */}
            <LoginIsometricShowcase activeStep={activeStep} />

            {/* Step Status Card */}
            {(() => {
              const StatusIcon = currentStep.icon
              return (
                <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0">
                    <StatusIcon className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-mono text-xs text-slate-700 leading-relaxed">
                    {currentStep.statusText}
                  </span>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Bottom Left System Footnote */}
        <div className="pt-4 border-t border-slate-200/80">
          <p className="text-xs text-slate-500">
            Platform praktikum cloud mandiri untuk mahasiswa &amp; dosen Teknik Informatika.
          </p>
          <p className="text-[11px] text-slate-400 font-mono mt-1 font-medium">
            Fakultas Teknik • Universitas Muhammadiyah Ponorogo
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: Flat Clean & Minimalist V2 Login Card */}
      <div className="w-full md:w-5/12 min-h-screen p-5 sm:p-10 lg:p-14 flex flex-col justify-center items-center relative z-10 bg-[#F8FAFC]">
        <div className="w-full max-w-md">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-slate-900">
            {/* Form Header */}
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                Masuk ke Workspace
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-sans">
                Masukkan kredensial akun terdaftar Anda untuk mengakses lingkungan kerja cloud.
              </p>
            </div>

            {/* Error Notification Alert */}
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-rose-700 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1 text-xs leading-relaxed">
                  <span className="font-semibold block text-rose-800">Gagal Masuk</span>
                  {error}
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Input NIM / NIDN / Nama Pengguna */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  NIM / NIDN / Nama Pengguna
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-700 transition-colors pointer-events-none">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition font-sans"
                    placeholder="NIM / NIDN / Nama Pengguna"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              {/* Input Kata Sandi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-700 transition-colors pointer-events-none">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg pl-10 pr-11 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition font-sans"
                    placeholder="Masukkan kata sandi"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition p-1.5 rounded-md"
                    title={showPassword ? 'Sembunyikan Password' : 'Lihat Password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || cooldownSeconds > 0}
                className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg py-3 font-medium transition text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Spinner size="xs" />
                    <span>Memvalidasi Akun...</span>
                  </>
                ) : cooldownSeconds > 0 ? (
                  <span>Terlalu banyak aksi, coba lagi nanti</span>
                ) : (
                  <>
                    <span>Masuk ke Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Clean Subtle Footer Outside Card */}
          <div className="mt-6 text-center">
            <p className="text-[11px] text-slate-400 font-mono">
              MiraiGrid • Laboratorium Teknik Informatika UMPO © 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
