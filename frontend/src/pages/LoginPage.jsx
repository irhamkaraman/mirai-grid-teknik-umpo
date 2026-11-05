import React, { useState } from 'react'
import { Server, Lock, User, AlertCircle, ArrowRight } from 'lucide-react'
import { api } from '../api/client'

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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl shadow-2xl p-8 relative z-10">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/30 mx-auto mb-3">
            <Server className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">MiraiGrid</h2>
          <p className="text-xs text-sky-400 font-semibold uppercase tracking-wider mt-1">
            Lab Teknik Informatika UMPO
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Platform Hosting Mandiri Praktikum (PaaS & Multi-Database)
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center space-x-2.5 text-rose-400 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              NIM / Username
            </label>
            <div className="relative">
              <User className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
                placeholder="Masukkan NIM Anda"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center space-x-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-sky-600/25 transition duration-150 disabled:opacity-50"
          >
            <span>{loading ? 'Memverifikasi...' : 'Masuk Portal'}</span>
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
          Akun dibuat secara massal oleh Administrator / Asisten Lab TI.
        </div>
      </div>
    </div>
  )
}
