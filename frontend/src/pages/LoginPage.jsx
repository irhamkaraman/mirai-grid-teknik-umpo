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
      const errMsg =
        err.response?.data?.detail ||
        'Gagal masuk. Periksa kembali NIM/Username dan Password Anda.'
      setError(errMsg)
      toast.error(errMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#E6D7BE] text-[#26160F] flex flex-col lg:flex-row relative overflow-hidden font-sans select-none">
      {/* Background Decorative Subtle Texture & Ambient Warmth */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #5A3521 1px, transparent 0)`,
          backgroundSize: '28px 28px'
        }}
      />
      <div className="absolute -top-32 left-1/4 w-[600px] h-[500px] bg-[#C49767]/15 rounded-full blur-[170px] pointer-events-none" />
      <div className="absolute -bottom-32 right-1/4 w-[600px] h-[500px] bg-[#A47E65]/15 rounded-full blur-[170px] pointer-events-none" />

      {/* LEFT COLUMN: Visual Elements, Architecture & System Branding */}
      <div className="lg:w-7/12 p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative z-10 border-b lg:border-b-0 lg:border-r border-[#DECDBD]">
        {/* Top Brand Logo & Identity */}
        <div>
          <div className="flex items-center space-x-3.5 mb-8">
            <div className="h-12 w-12 rounded-2xl bg-white p-2 border border-[#C5B3A1] shadow-md flex items-center justify-center">
              <img
                src="/logos/miraigrid-logo.svg"
                alt="MiraiGrid Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold tracking-tight text-[#26160F]">
                MiraiGrid
              </h1>
              <p className="text-[10px] font-bold tracking-[0.2em] text-[#9E4E2C] uppercase font-mono">
                Lab Teknik Informatika UMPO
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#26160F] leading-[1.15] tracking-tight">
              Infrastruktur Cloud Laboratorium Teknik Informatika UMPO
            </h2>
            <p className="text-sm text-[#5C3B29] mt-4 leading-relaxed font-sans">
              Platform laboratorium modern untuk deployment aplikasi berbasis container terisolasi, manajemen multi-database, dan kontrol versi kode bagi mahasiswa Teknik Informatika.
            </p>
          </div>
        </div>

        {/* Visual Architecture Cards (Elemen Grafis Visual Keren) */}
        <div className="my-8 lg:my-10 space-y-4 max-w-xl">
          {/* Card 1: Container Engines Showcase */}
          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-5 shadow-xl relative overflow-hidden group hover:border-[#C49767]/50 transition-all duration-300 text-[#FAF5EC]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#C49767]/5 rounded-full blur-2xl group-hover:bg-[#C49767]/10 transition-colors pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#DFCDB5]">
                <Cpu className="h-4 w-4 text-[#C49767]" />
                <span>Isolated Application Runtimes</span>
              </div>
              <span className="text-[10px] font-mono text-[#A47454]">PHP • Python • Node.js</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-3 flex items-center space-x-2.5 hover:border-[#543221] transition">
                <img src="/logos/php.svg" alt="PHP" className="h-6 w-6 object-contain" />
                <div>
                  <div className="text-xs font-bold text-[#FAF5EC]">PHP</div>
                  <div className="text-[9px] text-[#A47454] font-mono">v8.3 • Apache</div>
                </div>
              </div>
              <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-3 flex items-center space-x-2.5 hover:border-[#543221] transition">
                <img src="/logos/python.svg" alt="Python" className="h-6 w-6 object-contain" />
                <div>
                  <div className="text-xs font-bold text-[#FAF5EC]">Python</div>
                  <div className="text-[9px] text-[#A47454] font-mono">v3.11 • Flask</div>
                </div>
              </div>
              <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-3 flex items-center space-x-2.5 hover:border-[#543221] transition">
                <img src="/logos/node.svg" alt="Node.js" className="h-6 w-6 object-contain" />
                <div>
                  <div className="text-xs font-bold text-[#FAF5EC]">Node.js</div>
                  <div className="text-[9px] text-[#A47454] font-mono">v20 • LTS</div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 & 3: Multi-Database Cluster & Version Control */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-4 shadow-xl hover:border-[#C49767]/50 transition-all duration-300 text-[#FAF5EC]">
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#DFCDB5] mb-2.5">
                <Database className="h-4 w-4 text-[#D97757]" />
                <span>Multi-Database Cluster</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1.5 text-xs text-[#FAF5EC] font-mono bg-[#1C0F0A] px-2.5 py-1.5 rounded-xl border border-[#3E2316]">
                  <img src="/logos/mariadb.svg" alt="MariaDB" className="h-4 w-4 object-contain" />
                  <span>MariaDB</span>
                </div>
                <div className="flex items-center space-x-1.5 text-xs text-[#FAF5EC] font-mono bg-[#1C0F0A] px-2.5 py-1.5 rounded-xl border border-[#3E2316]">
                  <img src="/logos/postgres.svg" alt="PostgreSQL" className="h-4 w-4 object-contain" />
                  <span>PostgreSQL</span>
                </div>
              </div>
              <p className="text-[10px] text-[#A47454] mt-2 font-mono">
                Port terisolasi & kuota storage mandiri.
              </p>
            </div>

            <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-4 shadow-xl hover:border-[#C49767]/50 transition-all duration-300 text-[#FAF5EC]">
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#DFCDB5] mb-2.5">
                <Code2 className="h-4 w-4 text-emerald-400" />
                <span>Git™ & Sandbox Files</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1.5 text-xs text-[#FAF5EC] font-mono bg-[#1C0F0A] px-2.5 py-1.5 rounded-xl border border-[#3E2316]">
                  <img src="/logos/git.svg" alt="Git" className="h-4 w-4 object-contain" />
                  <span>Version Control</span>
                </div>
                <div className="flex items-center space-x-1.5 text-xs text-[#FAF5EC] font-mono bg-[#1C0F0A] px-2.5 py-1.5 rounded-xl border border-[#3E2316]">
                  <Terminal className="h-3.5 w-3.5 text-amber-400" />
                  <span>Web Console</span>
                </div>
              </div>
              <p className="text-[10px] text-[#A47454] mt-2 font-mono">
                Sandbox terisolasi per akun praktikum.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Left System Footnote */}
        <div className="pt-4 border-t border-[#DECDBD]">
          <p className="text-xs text-[#5C3B29] font-light italic">
            "Memberikan pengalaman nyata mengelola komputasi awan mandiri dan arsitektur server berstandar industri."
          </p>
          <p className="text-[10px] text-[#7A5844] font-mono mt-1 font-semibold">
            Fakultas Teknik • Universitas Muhammadiyah Ponorogo
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: Elevated Dark Chocolate Login Card on Cream Background */}
      <div className="lg:w-5/12 p-6 sm:p-10 lg:p-14 flex flex-col justify-center items-center relative z-10">
        <div className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-7 sm:p-9 shadow-2xl text-[#FAF5EC]">
          {/* Form Header */}
          <div className="mb-7">
            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#FAF5EC]">
              Masuk ke Workspace
            </h3>
            <p className="text-xs text-[#DFCDB5] mt-1.5 font-sans">
              Masukkan NIM atau Username beserta kata sandi Anda untuk mengakses platform.
            </p>
          </div>

          {/* Error Notification Alert */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-start space-x-2.5 text-rose-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 text-[11px] leading-relaxed">
                <span className="font-semibold block text-rose-200">Gagal Masuk</span>
                {error}
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Input NIM / Username */}
            <div>
              <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">
                NIM atau Username
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A47454] group-focus-within:text-[#C49767] transition-colors pointer-events-none">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-2xl pl-10 pr-4 py-3 text-xs text-[#FAF5EC] placeholder-[#705241] focus:outline-none focus:border-[#C49767] focus:ring-1 focus:ring-[#C49767] transition font-sans shadow-inner"
                  placeholder="Contoh: 23533xxx atau admin"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Input Password */}
            <div>
              <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">
                Kata Sandi / Password
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A47454] group-focus-within:text-[#C49767] transition-colors pointer-events-none">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-2xl pl-10 pr-11 py-3 text-xs text-[#FAF5EC] placeholder-[#705241] focus:outline-none focus:border-[#C49767] focus:ring-1 focus:ring-[#C49767] transition font-sans shadow-inner"
                  placeholder="Password akun Anda"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A47454] hover:text-[#FAF5EC] transition p-1.5 rounded-md"
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
              className="w-full mt-6 relative group overflow-hidden flex items-center justify-center space-x-2 bg-gradient-to-r from-chocolate-700 to-chocolate-600 hover:from-chocolate-600 hover:to-terracotta-600 text-[#FAF5EC] font-semibold py-3.5 rounded-2xl shadow-xl border border-chocolate-500/40 transition-all duration-200 disabled:opacity-50 text-xs active:scale-[0.99]"
            >
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform" />

              {loading ? (
                <span className="flex items-center space-x-2">
                  <Spinner size="xs" />
                  <span>Memvalidasi Akun...</span>
                </span>
              ) : (
                <>
                  <span>Masuk ke Workspace</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Clean Subtle Footer */}
          <div className="mt-7 text-center">
            <p className="text-[11px] text-[#A47E65] font-mono">
              MiraiGrid Lab TI UMPO © 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
