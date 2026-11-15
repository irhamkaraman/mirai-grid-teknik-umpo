import React, { useState, useEffect } from 'react'
import {
  Workflow,
  Play,
  Square,
  RotateCw,
  ExternalLink,
  Copy,
  Check,
  Cpu,
  HardDrive,
  ShieldCheck,
  Globe,
  RefreshCw,
  Maximize2
} from 'lucide-react'
import { toast } from 'sonner'
import { getN8nStatus, startN8n, startN8nAsync, stopN8n, restartN8n, getN8nSSO, buildN8nSsoRedirectUrl } from '../api/n8n'
import { syncPageRoute } from '../utils/securityRoute'

export default function N8nView({ user }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showEmbedded, setShowEmbedded] = useState(false)
  const [iframeKey, setIframeKey] = useState(Date.now())
  const [autoLaunching, setAutoLaunching] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('autolaunch') === '1'
    } catch {
      return false
    }
  })

  const username = (user?.username || 'admin').toLowerCase()
  const publicUrl = status?.public_url || `https://n8n-${username}.miraigrid.web.id`

  useEffect(() => {
    syncPageRoute('/n8n', {})
    if (autoLaunching) {
      let cancelled = false
      const runAutoLaunch = async () => {
        try {
          syncDomainTokenCookie()
          const initial = await startN8nAsync()
          if (cancelled) return
          setStatus(initial)
          setLoading(false)
          if (initial?.ready) {
            window.location.replace(buildN8nSsoRedirectUrl())
            return
          }
          // Poll every 2s until cold boot finishes (up to 90s)
          for (let i = 0; i < 45; i++) {
            await new Promise((r) => setTimeout(r, 2000))
            if (cancelled) return
            const st = await getN8nStatus()
            setStatus(st)
            if (st?.ram_limit_exceeded) {
              setAutoLaunching(false)
              toast.error('Kapasitas RAM Akun Tercapai', {
                description: st.ram_warning || 'Hentikan layanan/project lain terlebih dahulu.'
              })
              return
            }
            if (st?.ready) {
              window.location.replace(buildN8nSsoRedirectUrl())
              return
            }
          }
          setAutoLaunching(false)
          toast.error('Waktu tunggu engine n8n habis. Silakan coba klik Start / Buka Studio lagi.')
        } catch (err) {
          if (!cancelled) {
            setAutoLaunching(false)
            setLoading(false)
            toast.error('Gagal menyiapkan engine n8n', {
              description: err.response?.data?.detail || err.message
            })
          }
        }
      }
      runAutoLaunch()
      return () => {
        cancelled = true
      }
    } else {
      fetchStatus()
    }
  }, [])

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await getN8nStatus()
      setStatus(res)
    } catch (err) {
      toast.error('Gagal memuat status engine n8n', {
        description: err.response?.data?.detail || err.message
      })
    } finally {
      setLoading(false)
    }
  }

  const syncDomainTokenCookie = () => {
    const tok = localStorage.getItem('miraigrid_token') || localStorage.getItem('token')
    if (tok) {
      try {
        document.cookie = `miraigrid_token=${tok}; path=/; domain=.miraigrid.web.id; max-age=604800; SameSite=Lax; Secure`
      } catch (e) {}
    }
  }

  const handleLaunchAutoLogin = async (embed = false) => {
    setLaunching(true)
    try {
      syncDomainTokenCookie()
      if (!embed) {
        if (status?.ready) {
          window.open(buildN8nSsoRedirectUrl(), '_blank', 'noopener,noreferrer')
          return
        }
        window.open('/n8n?autolaunch=1', '_blank', 'noopener,noreferrer')
        return
      }
      const sso = await getN8nSSO()
      setStatus(sso)
      const targetUrl = sso?.sso_url || publicUrl
      setIframeKey(Date.now())
      setShowEmbedded(true)
      toast.success('Sesi Auto-Login n8n aktif', {
        description: `Terhubung ke ${targetUrl}`
      })
    } catch (err) {
      toast.error('Gagal menyiapkan Auto-Login n8n', {
        description: err.response?.data?.detail || err.message
      })
    } finally {
      setLaunching(false)
    }
  }

  const handleAction = async (type) => {
    setActionBusy(true)
    try {
      if (type === 'start') {
        const res = await startN8n()
        setStatus(res)
        toast.success('Engine n8n berhasil dijalankan')
      } else if (type === 'stop') {
        await stopN8n()
        setShowEmbedded(false)
        await fetchStatus()
        toast.success('Engine n8n dihentikan')
      } else if (type === 'restart') {
        const res = await restartN8n()
        setStatus(res)
        setIframeKey(Date.now())
        toast.success('Engine n8n berhasil direstart')
      }
    } catch (err) {
      toast.error(`Gagal melakukan ${type} pada n8n`, {
        description: err.response?.data?.detail || err.message
      })
    } finally {
      setActionBusy(false)
    }
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const isRunning = Boolean(status?.running)
  const isReady = Boolean(status?.ready)

  return (
    <div className="space-y-6 w-full pb-6">
      {status?.ram_limit_exceeded && (
        <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-4 flex items-start justify-between gap-4">
          <div className="text-xs text-rose-800 space-y-1">
            <p className="font-bold text-sm text-rose-900">Batas Kapasitas RAM Akun Tercapai</p>
            <p>{status.ram_warning || 'Total penggunaan RAM kontainer akun Anda menyentuh batas. Sistem menghentikan layanan untuk menjaga stabilitas.'}</p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-rose-200/80 text-[11px] font-mono font-semibold text-rose-700 shrink-0">
            RAM LIMIT
          </span>
        </div>
      )}
      {autoLaunching && (
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-4 w-4 text-emerald-600 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Menyiapkan Engine Otomasi n8n &amp; Auto-Login SSO...
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {isRunning
                  ? 'Container aktif, menunggu layanan REST API & SQLite siap lalu mengarahkan otomatis.'
                  : 'Membuat dan menyalakan container terisolasi Anda. Inisialisasi pertama memerlukan ~30–45 detik.'}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200/80 text-[11px] font-mono font-semibold text-emerald-700 shrink-0">
            {isRunning ? 'INITIALIZING' : 'BOOTING'}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            n8n Workflow Automation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Engine otomasi workflow terisolasi per akun dengan provisioning otomatis dan subdomain HTTPS wildcard.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={fetchStatus}
            disabled={loading || actionBusy}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => handleLaunchAutoLogin(false)}
            disabled={launching || actionBusy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition disabled:opacity-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>{launching ? 'Menyiapkan Auto-Login...' : 'Buka Studio n8n (Auto-Login)'}</span>
          </button>
        </div>
      </div>

      {/* Status & Resource Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Engine Status */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Workflow className="h-4 w-4 text-emerald-600" />
              <span>Status Container</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-semibold border ${
                isReady
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                  : isRunning
                  ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                  : 'bg-slate-100 text-slate-600 border-slate-200/80'
              }`}
            >
              {loading ? 'CHECKING' : isReady ? 'ONLINE' : isRunning ? 'STARTING' : 'STOPPED'}
            </span>
          </div>
          <div className="text-sm font-mono text-slate-800">
            {status?.container_name || `n8n_${username}`}
          </div>
          <div className="flex items-center gap-2 pt-1">
            {!isRunning ? (
              <button
                type="button"
                onClick={() => handleAction('start')}
                disabled={actionBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Start</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleAction('restart')}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-50"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Restart</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAction('stop')}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition disabled:opacity-50"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>Stop</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Card 2: Wildcard Subdomain */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Globe className="h-4 w-4 text-emerald-600" />
            <span>Subdomain Wildcard &amp; Webhook</span>
          </div>
          <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2">
            <span className="font-mono text-xs text-slate-700 truncate">{publicUrl}</span>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="text-slate-400 hover:text-slate-700 transition shrink-0"
              title="Salin URL"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Endpoint <span className="font-mono">/webhook/*</span> aktif publik dengan SSL otomatis.
          </p>
        </div>

        {/* Card 3: Cgroup v2 Isolation */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Isolasi Resource &amp; Storage</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                <Cpu className="h-3 w-3" />
                <span>RAM / CPU</span>
              </div>
              <div className="font-mono font-semibold text-slate-800 mt-0.5">
                {status?.ram_limit_mb || (['dosen', 'lecturer', 'admin', 'staff'].includes((user?.role || '').toLowerCase()) ? 350 : 200)} MB / {status?.cpu_limit || (['dosen', 'lecturer', 'admin', 'staff'].includes((user?.role || '').toLowerCase()) ? 0.5 : 0.3)}C
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                <HardDrive className="h-3 w-3" />
                <span>Data Volume</span>
              </div>
              <div className="font-mono font-semibold text-slate-800 mt-0.5 truncate">
                /home/{username}/.n8n
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Preview / Quick Launch Panel */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Maximize2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Workspace Studio Preview</span>
          </div>
          <button
            type="button"
            onClick={() => (showEmbedded ? setShowEmbedded(false) : handleLaunchAutoLogin(true))}
            disabled={launching}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition"
          >
            {showEmbedded ? 'Tutup Preview' : launching ? 'Memuat...' : 'Muat Preview di Halaman Ini'}
          </button>
        </div>

        {showEmbedded ? (
          <iframe
            key={iframeKey}
            src={publicUrl}
            title="n8n Workflow Studio"
            className="w-full h-[72vh] border-0 bg-slate-50"
          />
        ) : (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700">
              Siap menjalankan workflow automation pribadi Anda.
            </p>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              Klik <strong>Buka Studio n8n (Auto-Login)</strong> untuk langsung masuk ke canvas n8n di tab baru tanpa perlu registrasi atau login ulang.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
