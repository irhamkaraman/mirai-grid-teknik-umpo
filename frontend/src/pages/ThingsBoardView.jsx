import React, { useState, useEffect, useRef } from 'react'
import {
  RotateCw,
  RefreshCw,
  ExternalLink,
  Maximize2,
  ChevronLeft,
  Cpu,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  Check,
  Copy,
  Globe
} from 'lucide-react'
import { toast } from 'sonner'
import { getThingsBoardStatus, startThingsBoard, restartThingsBoard } from '../api/thingsboard'
import { syncPageRoute } from '../utils/securityRoute'

export default function ThingsBoardView({ user, onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [restarting, setRestarting] = useState(false)
  const [status, setStatus] = useState(null)
  const [iframeKey, setIframeKey] = useState(Date.now())
  const [initStep, setInitStep] = useState(1)
  const [initProgress, setInitProgress] = useState(25)
  const [showEmbedded, setShowEmbedded] = useState(false)
  const [copied, setCopied] = useState(false)
  const pollIntervalRef = useRef(null)

  const username = user?.username || 'admin'
  const userId = user?.id || 1

  // Dynamic route security hash sync
  useEffect(() => {
    syncPageRoute('/thingsboard', {})
  }, [])

  // Initial load & Polling for Readiness
  useEffect(() => {
    initThingsBoard()
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  const initThingsBoard = async () => {
    setLoading(true)
    setInitStep(1)
    setInitProgress(20)

    try {
      // 1. Fetch initial status or trigger start
      const sRes = await getThingsBoardStatus()
      setStatus(sRes)

      if (!sRes.running || !sRes.exists) {
        setInitStep(2)
        setInitProgress(40)
        const startRes = await startThingsBoard()
        setStatus(startRes)
      }

      // Helper to ensure domain cookie is set before navigating
      const getEnhancedSsoUrl = (rawUrl) => {
        let finalUrl = rawUrl || `https://tb-${username}.miraigrid.web.id`
        const localMgToken = localStorage.getItem('token') || localStorage.getItem('miraigrid_token')
        if (localMgToken) {
          try {
            document.cookie = `miraigrid_token=${localMgToken}; path=/; domain=.miraigrid.web.id; max-age=604800; SameSite=Lax; Secure`
          } catch(e) {}
          if (!finalUrl.includes('mg_token=')) {
            const sep = finalUrl.includes('?') ? '&' : '?'
            finalUrl = `${finalUrl}${sep}mg_token=${encodeURIComponent(localMgToken)}`
          }
        }
        return finalUrl
      }

      // If already ready, immediately redirect directly to dedicated subdomain with SSO
      if (sRes.ready) {
        setInitStep(4)
        setInitProgress(100)
        const targetUrl = getEnhancedSsoUrl(sRes.sso_url || sRes.public_url)
        window.location.replace(targetUrl)
        return
      }

      // 2. Poll every 3 seconds until ThingsBoard Spring Boot is fully HTTP ready
      let pollCount = 0
      pollIntervalRef.current = setInterval(async () => {
        pollCount++
        try {
          const checkRes = await getThingsBoardStatus()
          setStatus(checkRes)

          if (checkRes.ready) {
            clearInterval(pollIntervalRef.current)
            setInitStep(4)
            setInitProgress(100)
            toast.success('ThingsBoard IoT Sandbox siap! Mengalihkan ke dashboard...')
            const targetUrl = getEnhancedSsoUrl(checkRes.sso_url || checkRes.public_url)
            setTimeout(() => {
              window.location.replace(targetUrl)
            }, 500)
            return
          } else {
            // Smooth progress increments during initialization
            if (pollCount < 3) {
              setInitStep(2)
              setInitProgress(Math.min(50, 25 + pollCount * 10))
            } else if (pollCount < 10) {
              setInitStep(3)
              setInitProgress(Math.min(85, 50 + (pollCount - 3) * 5))
            } else {
              setInitStep(4)
              setInitProgress(Math.min(95, 85 + (pollCount - 10) * 2))
            }
          }
        } catch (e) {
          console.warn('Polling ThingsBoard status failed', e)
        }
      }, 3000)
    } catch (err) {
      console.error('Failed to initialize ThingsBoard session', err)
      toast.error('Gagal memuat instance ThingsBoard')
      setLoading(false)
    }
  }

  const handleRestart = async () => {
    setRestarting(true)
    try {
      toast.info('Merestart container ThingsBoard...')
      const res = await restartThingsBoard()
      setStatus(res)
      setIframeKey(Date.now())
      toast.success('ThingsBoard berhasil direstart!')
      if (!res.ready) {
        initThingsBoard()
      }
    } catch (err) {
      console.error('Failed to restart ThingsBoard', err)
      toast.error('Gagal merestart ThingsBoard')
    } finally {
      setTimeout(() => setRestarting(false), 1000)
    }
  }

  const handleCopyUrl = () => {
    if (!publicSubdomainUrl) return
    navigator.clipboard.writeText(publicSubdomainUrl)
    setCopied(true)
    toast.success('URL Subdomain berhasil disalin!')
    setTimeout(() => setCopied(false), 2000)
  }

  // Active target port & URLs
  const targetPort = status?.port || (15000 + userId)
  const publicSubdomainUrl = status?.public_url || `https://tb-${username}.miraigrid.web.id`
  const localUrl = status?.campus_url || `http://100.122.201.18:${targetPort}`

  const isHostnameDomain = typeof window !== 'undefined' && window.location.hostname.includes('miraigrid.web.id')
  const iframeSrc = isHostnameDomain ? publicSubdomainUrl : localUrl
  const isReady = status?.ready === true && !loading

  const quotas = status?.quotas || {
    ram_quota_mb: 2048,
    cpu_quota: 2.0,
    storage_quota_mb: 1000
  }

  // 1. EMBEDDED VIEW (Bila mahasiswa memilih 'Buka di Sini' di dalam panel)
  if (showEmbedded && isReady) {
    return (
      <div className="h-screen w-screen flex flex-col bg-[#1E110A] overflow-hidden select-none m-0 p-0 font-sans">
        {/* Floating Minimalist Header for Embedded Mode */}
        <div className="h-12 bg-[#2B1810] border-b border-[#4D2D1E] px-4 flex items-center justify-between shrink-0 shadow-md z-20">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setShowEmbedded(false)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#3A2216] border border-[#5A3521] text-xs font-semibold text-[#E8DCB8] hover:text-white hover:bg-[#4D2D1E] transition shadow-sm"
              title="Kembali ke Ringkasan Status"
            >
              <ChevronLeft className="h-4 w-4 text-[#C49767]" />
              <span>Ringkasan</span>
            </button>
            <div className="h-4 w-px bg-[#4D2D1E]" />
            <div className="flex items-center space-x-2">
              <img
                src="/logos/thingsboard-emblem.svg"
                alt="ThingsBoard"
                className="w-4 h-4 object-contain"
              />
              <span className="font-serif font-bold text-xs sm:text-sm text-[#FAF5EC]">
                ThingsBoard
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono text-[#26A69A] bg-[#1E110A] px-2 py-0.5 rounded-md border border-[#4D2D1E]">
                tb-{username}.miraigrid.web.id
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setIframeKey(Date.now())
                toast.info('Memuat ulang tampilan...')
              }}
              className="p-1.5 rounded-xl bg-[#3A2216] border border-[#5A3521] text-xs text-[#FAF5EC] hover:bg-[#4D2D1E] transition shadow-sm"
              title="Muat Ulang"
            >
              <RotateCw className="h-3.5 w-3.5 text-[#C49767]" />
            </button>
            <a
              href={iframeSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-[#3A2216] border border-[#5A3521] text-xs text-[#FAF5EC] hover:bg-[#4D2D1E] flex items-center space-x-1 transition shadow-sm"
              title="Buka Tab Baru"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#C49767]" />
              <span className="hidden sm:inline">Tab Baru</span>
            </a>
          </div>
        </div>

        {/* Embedded Iframe */}
        <div className="flex-1 w-full h-[calc(100vh-3rem)] bg-[#180E08]">
          <iframe
            key={iframeKey}
            src={iframeSrc}
            title="ThingsBoard IoT Platform"
            className="w-full h-full border-none bg-[#180E08]"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts allow-downloads"
          />
        </div>
      </div>
    )
  }

  // 2. MAIN ONBOARDING-STYLE VIEW (WARM CREAM THEME, ZERO NAVBAR, ORBITAL DUAL-RING SPINNER)
  return (
    <div className="min-h-screen w-full bg-[#E6D7BE] text-[#26160F] flex flex-col justify-center items-center font-sans selection:bg-[#5A3521] selection:text-[#FAF5EC] p-4 sm:p-6 md:p-8 select-none relative overflow-x-hidden">
      
      {/* Centered Brand Header (Konsisten Seperti Onboarding, No Full Navbar) */}
      <div className="w-full max-w-lg mx-auto mb-6 flex flex-col items-center justify-center text-center alpine-pop-in">
        <div className="flex items-center space-x-3 mb-2">
          <img
            src="/logos/miraigrid-logo.svg"
            alt="MiraiGrid"
            className="h-10 w-10 rounded-2xl bg-white p-1 border border-[#D4C1AC] shadow-md transition-transform duration-300 hover:scale-105"
          />
          <div className="text-left">
            <h1 className="font-serif font-bold text-xl text-[#26160F] tracking-wide">
              MiraiGrid
            </h1>
            <p className="text-[11px] text-[#785338] font-mono">
              Laboratorium Teknik Informatika • Universitas Muhammadiyah Ponorogo
            </p>
          </div>
        </div>
      </div>

      {/* Main Container Card (Dark Vintage Mahogany with Ambient Corner Glows) */}
      <div className="bg-[#2B1810] border border-[#5A3521] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl text-center space-y-6 alpine-pop-in relative overflow-hidden text-[#FAF5EC]">
        {/* Ambient Corner Glows */}
        <div className="absolute -top-16 -left-16 w-44 h-44 bg-[#C49767]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* ======================================================== */}
        {/* STATE A: ENVIRONMENT PREPARATION (LOADING & INITIALIZING) */}
        {/* ======================================================== */}
        {!isReady && (
          <>
            {/* Orbital Dual-Ring High-Tech Spinner (No AI Slop / No Ping) */}
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              {/* Outer Clockwise Golden Ring */}
              <div className="absolute inset-0 border-4 border-t-[#C49767] border-r-transparent border-b-[#E8C58D] border-l-transparent rounded-full animate-spin" />
              {/* Inner Counter-Rotating Emerald Ring */}
              <div className="absolute inset-3 border-2 border-t-[#26A69A] border-r-transparent border-b-[#8C5E35] border-l-transparent rounded-full animate-spin-reverse" />
              {/* Central Crisp Emblem Box */}
              <div className="p-3 bg-[#1E110A] rounded-2xl border border-[#4D2D1E] shadow-inner text-[#E8C58D]">
                <img
                  src="/logos/thingsboard-emblem.svg"
                  alt="ThingsBoard"
                  className="w-7 h-7 object-contain"
                />
              </div>
            </div>

            {/* Title & Account Info */}
            <div className="space-y-1">
              <h3 className="font-serif font-bold text-xl sm:text-2xl text-[#FAF5EC] tracking-wide">
                Menyiapkan Environment IoT Sandbox
              </h3>
              <p className="text-xs sm:text-sm text-[#C49767] font-sans">
                Platform IoT Industri mandiri untuk akun <strong className="text-[#FAF5EC]">{username}</strong>
              </p>
            </div>

            {/* Progress Bar & Percentage */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#A47E65]">Progress Otomatisasi:</span>
                <span className="text-emerald-400 font-bold">{initProgress}%</span>
              </div>
              <div className="h-2.5 w-full bg-[#1E110A] rounded-full overflow-hidden border border-[#4D2D1E]/90 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-[#8C5E35] via-[#C49767] to-emerald-400 rounded-full transition-all duration-500 ease-out shadow-sm"
                  style={{ width: `${initProgress}%` }}
                />
              </div>
            </div>

            {/* Live 4-Stage Checklist */}
            <div className="bg-[#1E110A] border border-[#4D2D1E] rounded-2xl p-4 text-left space-y-2.5 font-sans text-xs">
              {[
                { label: `Mengalokasikan container sandbox: tb_${username}`, idx: 1 },
                { label: `Sinkronisasi Resource (RAM: ${quotas.ram_quota_mb}MB, CPU: ${quotas.cpu_quota} Core)`, idx: 2 },
                { label: 'Inisialisasi Database PostgreSQL & Modul Rule Engine', idx: 3 },
                { label: `Routing Subdomain Dedicated (tb-${username}.miraigrid.web.id)`, idx: 4 }
              ].map((stage) => {
                const isDone = initStep > stage.idx || initProgress === 100
                const isCurrent = initStep === stage.idx && initProgress < 100
                return (
                  <div key={stage.idx} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <RefreshCw className="h-4 w-4 text-[#C49767] animate-spin shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-[#4D2D1E] shrink-0" />
                      )}
                      <span className={isDone ? 'text-emerald-300 font-medium' : isCurrent ? 'text-[#FAF5EC] font-semibold' : 'text-[#785338]'}>
                        {stage.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Micro-specs Summary Row */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-[#A47E65]">
              <div className="bg-[#1E110A] rounded-xl py-2 px-2 text-center border border-[#3A2216]">
                <span className="text-[#A47E65] block font-mono text-[9px] uppercase tracking-wider">ROUTING</span>
                <span className="text-emerald-400 font-medium text-xs">Zero-Port Nginx</span>
              </div>
              <div className="bg-[#1E110A] rounded-xl py-2 px-2 text-center border border-[#3A2216]">
                <span className="text-[#A47E65] block font-mono text-[9px] uppercase tracking-wider">RESOURCE</span>
                <span className="text-emerald-400 font-medium text-xs">{quotas.ram_quota_mb}MB • {quotas.cpu_quota} Core</span>
              </div>
              <div className="bg-[#1E110A] rounded-xl py-2 px-2 text-center border border-[#3A2216]">
                <span className="text-[#A47E65] block font-mono text-[9px] uppercase tracking-wider">SANDBOX</span>
                <span className="text-emerald-400 font-medium text-xs">Multi-Tenant</span>
              </div>
            </div>

            {/* Security Verification Footer */}
            <div className="flex items-center justify-center space-x-2 text-[11px] text-[#A47E65] bg-[#1E110A] py-2.5 px-3 rounded-2xl border border-[#4D2D1E]">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Terisolasi Penuh • Cgroups v2 Protected • Anti-Cross Tampering</span>
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* STATE B: ENVIRONMENT READY & OPERATIONAL                 */}
        {/* ======================================================== */}
        {isReady && (
          <>
            {/* Ready Emblem Badge */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-[#1E110A] border border-[#5A3521] p-3 flex items-center justify-center shadow-xl">
                <img
                  src="/logos/thingsboard-emblem.svg"
                  alt="ThingsBoard"
                  className="w-10 h-10 object-contain"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1 border-2 border-[#2B1810]">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Ready Title & Status */}
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1" />
                <span>Environment Aktif & Siap Digunakan</span>
              </div>
              <h3 className="font-serif font-bold text-xl sm:text-2xl text-[#FAF5EC] tracking-wide">
                ThingsBoard IoT Sandbox
              </h3>
              <p className="text-xs sm:text-sm text-[#C49767] font-sans">
                Platform IoT Industri mandiri untuk akun <strong className="text-[#FAF5EC]">{username}</strong>
              </p>
            </div>

            {/* Subdomain URL Box */}
            <div className="bg-[#1E110A] border border-[#4D2D1E] rounded-2xl p-4 text-left space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-[#A47E65]">
                <span>Subdomain Publik Terdedikasi:</span>
                <span className="text-emerald-400 font-semibold">Port :{targetPort}</span>
              </div>
              <div className="flex items-center justify-between bg-[#24140D] border border-[#3A2216] px-3.5 py-2.5 rounded-xl">
                <div className="flex items-center space-x-2 truncate">
                  <Globe className="w-4 h-4 text-[#26A69A] shrink-0" />
                  <span className="font-mono text-xs sm:text-sm text-[#FAF5EC] truncate">{publicSubdomainUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="text-xs text-[#C49767] hover:text-[#FAF5EC] ml-2 shrink-0 font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3A2216] hover:bg-[#4D2D1E] transition"
                  title="Salin Subdomain URL"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            {/* Micro-specs Summary Row */}
            <div className="grid grid-cols-3 gap-2 text-[11px] text-[#A47E65]">
              <div className="bg-[#1E110A] rounded-xl py-2 px-2 text-center border border-[#3A2216]">
                <span className="text-[#A47E65] block font-mono text-[9px] uppercase tracking-wider">CPU CORES</span>
                <span className="text-emerald-400 font-medium text-xs">{quotas.cpu_quota} Core</span>
              </div>
              <div className="bg-[#1E110A] rounded-xl py-2 px-2 text-center border border-[#3A2216]">
                <span className="text-[#A47E65] block font-mono text-[9px] uppercase tracking-wider">RAM LIMIT</span>
                <span className="text-emerald-400 font-medium text-xs">{quotas.ram_quota_mb} MB</span>
              </div>
              <div className="bg-[#1E110A] rounded-xl py-2 px-2 text-center border border-[#3A2216]">
                <span className="text-[#A47E65] block font-mono text-[9px] uppercase tracking-wider">STORAGE</span>
                <span className="text-emerald-400 font-medium text-xs">{quotas.storage_quota_mb} MB</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              {/* Primary Action Button: Open in New Tab with SSO */}
              <a
                href={status?.sso_url ? (status.sso_url.includes('?') ? `${status.sso_url}&mg_token=${encodeURIComponent(localStorage.getItem('token') || '')}` : `${status.sso_url}?mg_token=${encodeURIComponent(localStorage.getItem('token') || '')}`) : publicSubdomainUrl}
                onClick={() => {
                  try {
                    const t = localStorage.getItem('token') || localStorage.getItem('miraigrid_token')
                    if (t) document.cookie = `miraigrid_token=${t}; path=/; domain=.miraigrid.web.id; max-age=604800; SameSite=Lax; Secure`
                  } catch(e) {}
                }}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:flex-1 flex items-center justify-center space-x-2 py-3.5 px-5 rounded-2xl bg-[#C49767] hover:bg-[#E8C58D] text-[#24140D] font-bold text-xs sm:text-sm transition shadow-xl alpine-hover-card"
              >
                <span>Buka ThingsBoard IoT</span>
                <ExternalLink className="h-4 w-4" />
              </a>

              {/* Optional Embedded Viewer Toggle */}
              <button
                type="button"
                onClick={() => setShowEmbedded(true)}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 py-3.5 px-4 rounded-2xl bg-[#1E110A] hover:bg-[#3A2216] border border-[#5A3521] text-[#FAF5EC] font-semibold text-xs sm:text-sm transition shadow-md alpine-hover-card"
              >
                <Maximize2 className="h-4 w-4 text-[#C49767]" />
                <span>Buka di Sini</span>
              </button>

              {/* Restart Container Button */}
              <button
                type="button"
                onClick={handleRestart}
                disabled={restarting}
                className="w-full sm:w-auto p-3.5 rounded-2xl bg-[#1E110A] hover:bg-[#3A2216] border border-[#5A3521] text-[#FAF5EC] transition shadow-md disabled:opacity-50 flex items-center justify-center space-x-1.5"
                title="Restart Container ThingsBoard"
              >
                <RefreshCw className={`h-4 w-4 text-[#26A69A] ${restarting ? 'animate-spin' : ''}`} />
                <span className="sm:hidden text-xs">Restart</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Return to Main Dashboard Navigation (Below the Card) */}
      <div className="mt-6 text-center alpine-fade">
        <button
          type="button"
          onClick={() => onNavigate ? onNavigate('/dashboard') : (window.location.href = '/dashboard')}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#785338] hover:text-[#26160F] transition-colors py-2 px-3.5 rounded-xl hover:bg-[#DFCEA9]/50"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Kembali ke Dashboard Utama</span>
        </button>
      </div>

    </div>
  )
}
