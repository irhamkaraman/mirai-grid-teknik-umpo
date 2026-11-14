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

const SHOWCASE_STEPS = [
  {
    id: 'auth',
    number: '01 / OTENTIKASI SATU PINTU',
    title: 'Terhubung Langsung ke SSO SIMTIK UMPO.',
    description:
      'Tidak perlu registrasi baru. Masuk dengan akun kampus Anda; sistem otomatis membedakan alokasi Mahasiswa dan Dosen secara instan.',
    label: 'Autentikasi Kampus',
    type: 'card'
  },
  {
    id: 'sandbox',
    number: '02 / KERNEL SANDBOXING',
    title: 'Ruang Eksekusi Terisolasi dengan Cgroup V2.',
    description:
      'Batas memori dan CPU dikunci ketat per container. Skrip error atau looping tak terbatas tidak akan mengganggu praktikum mahasiswa lain.',
    label: 'Isolasi Komputasi',
    type: 'terminal'
  },
  {
    id: 'ingress',
    number: '03 / WILDCARD INGRESS',
    title: 'Situs Mengudara di Subdomain *.miraigrid.web.id.',
    description:
      'Dukungan multi-runtime PHP, Node.js, dan Python dengan routing SSL otomatis. Uji coba aplikasi web langsung dari smartphone Anda.',
    label: 'Publikasi Instan',
    type: 'browser'
  }
]

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % SHOWCASE_STEPS.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [activeStep])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const cleanUsername = username.trim()

    try {
      const response = await api.post('/auth/login', {
        username: cleanUsername,
        password
      })
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
      <div className="hidden md:flex md:w-7/12 p-8 lg:p-14 flex-col justify-between relative z-10 border-r border-slate-200/80 bg-white">
        {/* Top Brand Header + Progress Line Tracker */}
        <div>
          <div className="flex items-center space-x-3.5 mb-8">
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
        <div className="my-10 max-w-xl">
          <div key={currentStep.id} className="animate-showcase-step space-y-6">
            <div className="space-y-3">
              <p className="font-mono text-xs text-slate-400 tracking-wider">
                {currentStep.number}
              </p>
              <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 leading-[1.18] tracking-tight">
                {currentStep.title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {currentStep.description}
              </p>
            </div>

            {/* Step-specific Mini Visual */}
            {currentStep.type === 'card' && (
              <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="font-mono text-xs text-slate-700 truncate">
                    SIMTIK Handshake: Connected • Role Auto-Detection Active
                  </span>
                </div>
              </div>
            )}

            {currentStep.type === 'terminal' && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <Cpu className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>kernel-isolation / cgroup-v2</span>
                </div>
                <div className="font-mono text-xs text-emerald-400 leading-relaxed break-words">
                  cgroup: memory.max=512M • cpu.max=50000 • OOM-Killer: Armed
                </div>
              </div>
            )}

            {currentStep.type === 'browser' && (
              <div className="bg-white border border-slate-200/80 rounded-xl p-4">
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Lock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="font-mono text-xs text-slate-700 truncate">
                      https://web-26533xxx.miraigrid.web.id
                    </span>
                  </div>
                  <Globe className="h-4 w-4 text-slate-400 shrink-0" />
                </div>
              </div>
            )}
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
                Gunakan akun SIMTIK UMPO Anda untuk mengakses workspace Mahasiswa atau Dosen.
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
              {/* Input NIM / Username / NIDN */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  NIM Mahasiswa / Username / NIDN Dosen
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
                    placeholder="NIM Mahasiswa / Username / NIDN Dosen"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              {/* Input Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password SIMTIK
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
                    placeholder="Password SIMTIK"
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
                disabled={loading}
                className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg py-3 font-medium transition text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Spinner size="xs" />
                    <span>Memvalidasi Akun...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk</span>
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
