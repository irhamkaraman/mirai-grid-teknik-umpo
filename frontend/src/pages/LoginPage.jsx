import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Database,
  Code2,
  Terminal,
  Cpu
} from 'lucide-react'
import { api } from '../api/client'
import { Spinner } from '../components/Skeletons'
import Button from '../components/Button'

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col lg:flex-row relative overflow-x-hidden font-sans select-none">
      {/* LEFT COLUMN: Visual Elements, Architecture & System Branding */}
      <div className="lg:w-7/12 p-6 sm:p-10 lg:p-14 flex flex-col justify-between relative z-10 border-b lg:border-b-0 lg:border-r border-slate-200/80 bg-white">
        {/* Top Brand Logo & Identity */}
        <div>
          <div className="flex items-center space-x-3.5 mb-8">
            <div className="h-11 w-11 rounded-xl bg-slate-50 p-2 border border-slate-200 flex items-center justify-center">
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
              <p className="text-[11px] font-semibold tracking-wider text-emerald-700 uppercase font-mono">
                Lab Teknik Informatika UMPO
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 leading-[1.18] tracking-tight">
              Infrastruktur Cloud Laboratorium Teknik Informatika UMPO
            </h2>
            <p className="text-sm text-slate-600 mt-4 leading-relaxed font-sans">
              Platform laboratorium modern untuk deployment aplikasi berbasis container terisolasi, manajemen multi-database, dan kontrol versi kode bagi mahasiswa Teknik Informatika.
            </p>
          </div>
        </div>

        {/* Visual Architecture Cards (Flat Clean Minimalist V2) */}
        <div className="my-8 lg:my-10 space-y-4 max-w-xl">
          {/* Card 1: Container Engines Showcase */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-5 transition-colors duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
                <Cpu className="h-4 w-4 text-emerald-600" />
                <span>Isolated Application Runtimes</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">PHP • Python • Node.js</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex items-center space-x-2.5">
                <img src="/logos/php.svg" alt="PHP" className="h-6 w-6 object-contain" />
                <div>
                  <div className="text-xs font-bold text-slate-900">PHP</div>
                  <div className="text-[10px] text-slate-500 font-mono">v8.3 • Apache</div>
                </div>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex items-center space-x-2.5">
                <img src="/logos/python.svg" alt="Python" className="h-6 w-6 object-contain" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Python</div>
                  <div className="text-[10px] text-slate-500 font-mono">v3.11 • Flask</div>
                </div>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex items-center space-x-2.5">
                <img src="/logos/node.svg" alt="Node.js" className="h-6 w-6 object-contain" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Node.js</div>
                  <div className="text-[10px] text-slate-500 font-mono">v20 • LTS</div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 & 3: Multi-Database Cluster & Version Control */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 mb-2.5">
                <Database className="h-4 w-4 text-emerald-600" />
                <span>Multi-Database Cluster</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1.5 text-xs text-slate-800 font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <img src="/logos/mariadb.svg" alt="MariaDB" className="h-4 w-4 object-contain" />
                  <span>MariaDB</span>
                </div>
                <div className="flex items-center space-x-1.5 text-xs text-slate-800 font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <img src="/logos/postgres.svg" alt="PostgreSQL" className="h-4 w-4 object-contain" />
                  <span>PostgreSQL</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2.5 font-mono">
                Port terisolasi &amp; kuota storage mandiri.
              </p>
            </div>

            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 mb-2.5">
                <Code2 className="h-4 w-4 text-emerald-600" />
                <span>Git &amp; Sandbox Files</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1.5 text-xs text-slate-800 font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <img src="/logos/git.svg" alt="Git" className="h-4 w-4 object-contain" />
                  <span>Version Control</span>
                </div>
                <div className="flex items-center space-x-1.5 text-xs text-slate-800 font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <Terminal className="h-3.5 w-3.5 text-slate-600" />
                  <span>Web Console</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2.5 font-mono">
                Sandbox terisolasi per akun praktikum.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Left System Footnote */}
        <div className="pt-4 border-t border-slate-200/80">
          <p className="text-xs text-slate-600 italic">
            "Memberikan pengalaman nyata mengelola komputasi awan mandiri dan arsitektur server berstandar industri."
          </p>
          <p className="text-[11px] text-slate-400 font-mono mt-1 font-medium">
            Fakultas Teknik • Universitas Muhammadiyah Ponorogo
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: Clean V2 Login Card */}
      <div className="lg:w-5/12 p-5 sm:p-10 lg:p-14 flex flex-col justify-center items-center relative z-10 bg-[#F8FAFC]">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 text-slate-900">
          {/* Form Header */}
          <div className="mb-6">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              Masuk ke Workspace
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 font-sans">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition font-sans"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-11 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition font-sans"
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
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              className="w-full mt-4 justify-center py-3"
            >
              {loading ? (
                <span className="flex items-center space-x-2">
                  <Spinner size="xs" />
                  <span>Memvalidasi Akun...</span>
                </span>
              ) : (
                <>
                  <span>Masuk dengan SIMTIK</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Clean Subtle Footer */}
          <div className="mt-6 text-center">
            <p className="text-[11px] text-slate-400 font-mono">
              MiraiGrid Lab TI UMPO © 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
