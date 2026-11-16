import React, { useState, useEffect } from 'react'
import {
  ExternalLink,
  Cpu,
  Check,
  Copy,
  Globe
} from 'lucide-react'
import { toast } from 'sonner'
import { syncPageRoute } from '../utils/securityRoute'

export default function JupyterView({ user }) {
  const [copied, setCopied] = useState(false)
  const [token, setToken] = useState('')

  const nim = user?.nim || user?.username || '23533740'
  const nama = user?.full_name || user?.name || user?.nama || `Mahasiswa ${nim}`

  useEffect(() => {
    syncPageRoute('/jupyter', {})
    const localToken = localStorage.getItem('miraigrid_token') || localStorage.getItem('token') || ''
    setToken(localToken)
    if (localToken && window.location.hostname.includes('miraigrid.web.id')) {
      try {
        document.cookie = `miraigrid_token=${localToken}; path=/; domain=.miraigrid.web.id; max-age=86400; SameSite=Lax; Secure`
      } catch (e) {}
    }
  }, [])

  const isDomain = typeof window !== 'undefined' && window.location.hostname.includes('miraigrid.web.id')
  const jupyterUrl = isDomain
    ? (token ? `https://jupyter.miraigrid.web.id/?token=${encodeURIComponent(token)}` : 'https://jupyter.miraigrid.web.id')
    : `http://76.76.76.188:8090/?token=${encodeURIComponent(token)}`

  const handleCopyNim = () => {
    navigator.clipboard.writeText(nim)
    setCopied(true)
    toast.success('NIM berhasil disalin!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 w-full pb-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center p-2 shrink-0">
            <img src="/logos/jupyter.png" alt="JupyterHub" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              JupyterHub Lab Komputasi
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Klaster notebook interaktif Python &amp; riset AI Laboratorium Teknik Informatika UMPO
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <a
            href={jupyterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-none cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Buka JupyterHub Lab</span>
          </a>
        </div>
      </div>

      {/* Main Overview Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Lingkungan Komputasi AI &amp; Data Science
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
            Akses penuh ke JupyterLab dengan kernel Python 3 terisolasi, akselerator GPU ganda, dan ratusan library machine learning siap pakai untuk praktikum dan riset skripsi.
          </p>
        </div>

        {/* Specs & Credential Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">NIM / Username</span>
              <button
                type="button"
                onClick={handleCopyNim}
                className="p-1 text-slate-400 hover:text-slate-700 rounded transition cursor-pointer"
                title="Salin NIM"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-sm font-semibold font-mono text-slate-900">{nim}</div>
            <div className="text-[11px] text-slate-500 truncate">{nama}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <span className="text-xs font-medium text-slate-500">Password Akses</span>
            <div className="text-sm font-semibold text-slate-900">Password SIMTIK</div>
            <div className="text-[11px] text-slate-500">Gunakan kata sandi akun SIMTIK / MiraiGrid Anda</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <span className="text-xs font-medium text-slate-500">Akselerasi Cluster</span>
            <div className="text-sm font-semibold text-slate-900 flex items-center">
              <Cpu className="w-3.5 h-3.5 text-orange-500 mr-1.5 shrink-0" />
              Dual NVIDIA RTX 5060 Ti
            </div>
            <div className="text-[11px] text-slate-500">CUDA 12.x &amp; PyTorch Enabled</div>
          </div>
        </div>

        {/* Subdomain Info Box */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Subdomain Resmi: <strong className="font-mono text-slate-900">jupyter.miraigrid.web.id</strong>
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Single Sign-On (SSO) Terintegrasi
          </span>
        </div>
      </div>
    </div>
  )
}
