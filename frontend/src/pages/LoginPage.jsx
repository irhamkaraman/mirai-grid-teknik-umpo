import React, { useState } from 'react'
import { Server, Lock, User, AlertCircle, ArrowRight } from 'lucide-react'
import { api } from '../api/client'
import { Spinner } from '../components/Skeletons'

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/auth/login', { username, password })
      const data = response.data
      localStorage.setItem('miraigrid_token', data.access_token)
      localStorage.setItem('miraigrid_user', JSON.stringify({
        username: data.username,
        name: data.name,
        role: data.role,
        must_change_password: data.must_change_password
      }))
      onLoginSuccess(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal masuk. Periksa NIM/Username dan Password Anda.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-warmdark-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Warm Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-chocolate-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-warmdark-850/90 backdrop-blur-2xl border border-warmdark-700/80 rounded-3xl shadow-2xl p-8 relative z-10">
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-chocolate-700 via-chocolate-600 to-terracotta-500 flex items-center justify-center text-cream-50 shadow-lg shadow-chocolate-950/50 mx-auto mb-4 border border-chocolate-500/40">
            <Server className="h-7 w-7" />
          </div>
          <h2 className="text-3xl font-serif font-bold tracking-tight text-cream-100">MiraiGrid</h2>
          <p className="text-[11px] text-terracotta-400 font-semibold uppercase tracking-widest mt-1">
            Lab Teknik Informatika UMPO
          </p>
          <p className="text-xs text-cream-300/80 mt-2 font-sans">
            Platform Hosting Mandiri Praktikum (PaaS & Multi-Database)
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center space-x-2.5 text-rose-300 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-cream-200 mb-1.5">
              NIM / Username
            </label>
            <div className="relative">
              <User className="h-4 w-4 text-cream-400/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-cream-100 placeholder-warmdark-700 focus:outline-none focus:border-terracotta-500 focus:ring-1 focus:ring-terracotta-500 transition font-sans"
                placeholder="Masukkan NIM Anda"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-cream-200 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-cream-400/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-warmdark-900 border border-warmdark-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-cream-100 placeholder-warmdark-700 focus:outline-none focus:border-terracotta-500 focus:ring-1 focus:ring-terracotta-500 transition font-sans"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center space-x-2 bg-gradient-to-r from-chocolate-700 to-chocolate-600 hover:from-chocolate-600 hover:to-chocolate-500 text-cream-100 font-semibold py-2.5 rounded-xl shadow-lg shadow-chocolate-950/40 border border-chocolate-500/40 transition duration-150 disabled:opacity-50 text-xs"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <Spinner size="xs" />
                <span>Memverifikasi...</span>
              </span>
            ) : (
              <>
                <span>Masuk Portal</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-warmdark-750/70 text-center text-[11px] text-cream-400/60">
          Akun dibuat secara massal oleh Administrator / Asisten Lab TI.
        </div>
      </div>
    </div>
  )
}
