import React, { useState, useEffect, useRef } from 'react'
import {
  RotateCw,
  ExternalLink,
  Maximize2,
  Minimize2,
  ChevronLeft,
  Cpu,
  Database,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Radio,
  Server,
  Activity,
  Zap,
  Globe
} from 'lucide-react'
import { toast } from 'sonner'
import { getThingsBoardStatus, startThingsBoard, restartThingsBoard } from '../api/thingsboard'
import { syncPageRoute } from '../utils/securityRoute'

export default function ThingsBoardView({ user, onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [restarting, setRestarting] = useState(false)
  const [status, setStatus] = useState(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [iframeKey, setIframeKey] = useState(Date.now())
  const [initStep, setInitStep] = useState(1)
  const [initProgress, setInitProgress] = useState(25)
  const pollIntervalRef = useRef(null)

  const username = user?.username || 'admin'
  const userId = user?.id || 1

  // Dynamic route security hash sync
  useEffect(() => {
    syncPageRoute('/thingsboard', {})
  }, [])

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
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

      // If already ready, finish loading
      if (sRes.ready) {
        setInitProgress(100)
        setTimeout(() => setLoading(false), 600)
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
            setTimeout(() => {
              setLoading(false)
              toast.success('ThingsBoard IoT Sandbox siap digunakan!')
            }, 800)
          } else {
            // Smooth progress increments during initialization
            if (pollCount < 4) {
              setInitStep(2)
              setInitProgress(Math.min(65, 40 + pollCount * 8))
            } else if (pollCount < 10) {
              setInitStep(3)
              setInitProgress(Math.min(90, 65 + (pollCount - 4) * 4))
            } else {
              setInitStep(4)
              setInitProgress(95)
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

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        setIsFullScreen(!isFullScreen)
      })
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }

  // Active target port & URLs
  const targetPort = status?.port || (15000 + userId)
  const publicSubdomainUrl = status?.public_url || `https://tb-${username}.miraigrid.web.id`
  const localUrl = status?.campus_url || `http://100.122.201.18:${targetPort}`

  const isHostnameDomain = typeof window !== 'undefined' && window.location.hostname.includes('miraigrid.web.id')
  const iframeSrc = isHostnameDomain ? publicSubdomainUrl : localUrl
  const isReady = status?.ready === true && !loading

  const quotas = status?.quotas || {
    ram_quota_mb: 512,
    cpu_quota: 0.5,
    storage_quota_mb: 1024
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1E110A] overflow-hidden select-none m-0 p-0 font-sans">
      {/* 1. SLIM STANDALONE TOPBAR (Sesuai Gaya Vintage Cream / Dark MiraiGrid) */}
      <header className="h-14 bg-[#2B1810] border-b border-[#4D2D1E] px-3 sm:px-5 flex items-center justify-between shrink-0 shadow-lg z-20">
        
        {/* Left: Back Button, ThingsBoard Logo, Title & Status */}
        <div className="flex items-center space-x-3">
          {/* Back to Dashboard Button */}
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('/dashboard') : (window.location.href = '/dashboard')}
            className="group flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#3A2216] border border-[#5A3521] text-xs font-semibold text-[#E8DCB8] hover:text-white hover:bg-[#4D2D1E] transition shadow-sm"
            title="Kembali ke Dashboard Utama"
          >
            <ChevronLeft className="h-4 w-4 text-[#C49767] group-hover:text-[#FAF5EC] transition-colors" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          <div className="h-5 w-px bg-[#4D2D1E]" />

          {/* Official ThingsBoard Logo */}
          <div className="w-8 h-8 rounded-xl bg-[#1E110A] border border-[#4D2D1E] p-1.5 flex items-center justify-center shadow-inner shrink-0">
            <img
              src="/logos/thingsboard-emblem.svg"
              alt="ThingsBoard"
              className="w-5 h-5 object-contain"
            />
          </div>

          <div className="flex items-center space-x-2">
            <h1 className="text-sm sm:text-base font-serif font-bold text-[#FAF5EC] tracking-wide">
              ThingsBoard <span className="hidden md:inline font-sans font-normal text-xs text-[#A47E65]">(IoT Cloud Sandbox)</span>
            </h1>

            {/* Status Live */}
            {isReady ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
                Online
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60 shadow-sm">
                <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin text-amber-400" />
                Menyiapkan...
              </span>
            )}
          </div>

          {/* User & Resource Quotas Pills (RAM, CPU, Storage mengikuti Resource Akun) */}
          <div className="hidden xl:flex items-center space-x-2 text-[11px] text-[#C49767] font-mono bg-[#1E110A] border border-[#4D2D1E] px-2.5 py-1 rounded-xl">
            <span className="flex items-center gap-1 text-[#26A69A]">
              <Cpu className="w-3 h-3 text-[#26A69A]" />
              <strong>{quotas.cpu_quota} Core</strong>
            </span>
            <span className="text-[#5A3521]">•</span>
            <span className="flex items-center gap-1 text-[#42A5F5]">
              <Activity className="w-3 h-3 text-[#42A5F5]" />
              <strong>{quotas.ram_quota_mb} MB RAM</strong>
            </span>
            <span className="text-[#5A3521]">•</span>
            <span className="flex items-center gap-1 text-[#AB47BC]">
              <HardDrive className="w-3 h-3 text-[#AB47BC]" />
              <strong>{quotas.storage_quota_mb} MB Disk</strong>
            </span>
            <span className="text-[#5A3521]">•</span>
            <span>Port: <strong className="text-[#FAF5EC]">:{targetPort}</strong></span>
            <span className="text-[#5A3521]">•</span>
            <span>Akun: <strong className="text-[#FAF5EC]">{username}</strong></span>
          </div>
        </div>

        {/* Right: Action Buttons (Reload, Restart, Open Tab, Fullscreen) */}
        <div className="flex items-center space-x-2">
          {/* Subdomain Pill & Link */}
          <a
            href={publicSubdomainUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#1E110A] border border-[#4D2D1E] text-xs font-mono text-[#E8DCB8] hover:text-white hover:border-[#C49767] transition shadow-sm"
            title={`Buka subdomain publik: tb-${username}.miraigrid.web.id`}
          >
            <Globe className="h-3.5 w-3.5 text-[#26A69A]" />
            <span className="truncate max-w-[200px]">tb-{username}.miraigrid.web.id</span>
            <ExternalLink className="h-3 w-3 text-[#A47E65]" />
          </a>

          {/* Muat Ulang Iframe Button */}
          <button
            type="button"
            onClick={() => {
              setIframeKey(Date.now())
              toast.info('Memuat ulang tampilan ThingsBoard...')
            }}
            disabled={!isReady}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-[#3A2216] border border-[#5A3521] text-xs font-semibold text-[#FAF5EC] hover:bg-[#4D2D1E] disabled:opacity-40 transition shadow-sm"
            title="Muat ulang halaman ThingsBoard"
          >
            <RotateCw className="h-3.5 w-3.5 text-[#C49767]" />
            <span className="hidden sm:inline">Muat Ulang</span>
          </button>

          {/* Restart Sandbox Container Button */}
          <button
            type="button"
            onClick={handleRestart}
            disabled={restarting}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-[#3A2216] border border-[#5A3521] text-xs font-semibold text-[#FAF5EC] hover:bg-[#4D2D1E] disabled:opacity-40 transition shadow-sm"
            title="Restart container IoT sandbox"
          >
            <Loader2 className={`h-3.5 w-3.5 text-[#26A69A] ${restarting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Restart</span>
          </button>

          {/* Buka di Tab Baru Button */}
          <a
            href={iframeSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#3A2216] border border-[#5A3521] text-xs font-semibold text-[#FAF5EC] hover:bg-[#4D2D1E] flex items-center space-x-1 transition shadow-sm"
            title="Buka ThingsBoard di Tab Baru"
          >
            <ExternalLink className="h-3.5 w-3.5 text-[#C49767]" />
            <span className="hidden sm:inline">Tab Baru</span>
          </a>

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullScreen}
            className="p-1.5 rounded-xl bg-[#3A2216] border border-[#5A3521] text-xs font-semibold text-[#FAF5EC] hover:bg-[#4D2D1E] transition shadow-sm"
            title={isFullScreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
          >
            {isFullScreen ? (
              <Minimize2 className="h-3.5 w-3.5 text-[#C49767]" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5 text-[#C49767]" />
            )}
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE / LOADING SCREEN */}
      <div className="flex-1 relative w-full h-[calc(100vh-3.5rem)] bg-[#180E08] overflow-hidden">
        {/* HIGH-TECH ANIMATED ENVIRONMENT SETUP SCREEN */}
        {!isReady && (
          <div className="absolute inset-0 z-30 bg-[#1E110A] flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
            <div className="max-w-md w-full bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
              
              {/* Subtle Background Glow Effect */}
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-[#26A69A]/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-[#F37626]/10 rounded-full blur-2xl pointer-events-none" />

              {/* Pulsing Animated Tech Core Icon */}
              <div className="relative mx-auto w-20 h-20 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#00897B] to-[#26A69A] opacity-20 animate-ping duration-1000" />
                <div className="relative w-16 h-16 rounded-2xl bg-[#180E08] border border-[#5A3521] p-3 flex items-center justify-center shadow-xl">
                  <img
                    src="/logos/thingsboard-emblem.svg"
                    alt="ThingsBoard Core"
                    className="w-10 h-10 object-contain animate-pulse"
                  />
                </div>
              </div>

              {/* Title & Tagline */}
              <h2 className="text-xl font-serif font-bold text-[#FAF5EC] mb-1 tracking-wide">
                Menyiapkan Environment IoT Sandbox
              </h2>
              <p className="text-xs text-[#A47E65] mb-6">
                Platform IoT Industri mandiri untuk akun <strong className="text-[#FAF5EC]">{username}</strong>
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-[#180E08] h-2 rounded-full overflow-hidden mb-6 border border-[#4D2D1E] p-0.5">
                <div
                  className="bg-gradient-to-r from-[#00897B] via-[#26A69A] to-[#80CBC4] h-full rounded-full transition-all duration-700 ease-out shadow-lg"
                  style={{ width: `${initProgress}%` }}
                />
              </div>

              {/* Milestone Checklist */}
              <div className="space-y-3 text-left mb-6 font-mono text-xs">
                {/* Step 1 */}
                <div className={`flex items-center space-x-2.5 p-2 rounded-xl transition-all ${
                  initStep >= 1 ? 'bg-[#3A2216]/60 border border-[#5A3521]' : 'opacity-40'
                }`}>
                  {initStep > 1 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-[#26A69A] animate-spin shrink-0" />
                  )}
                  <span className="text-[#FAF5EC] text-[11px] truncate">
                    Mengalokasikan container sandbox: <strong>tb_{username}</strong>
                  </span>
                </div>

                {/* Step 2 */}
                <div className={`flex items-center space-x-2.5 p-2 rounded-xl transition-all ${
                  initStep >= 2 ? 'bg-[#3A2216]/60 border border-[#5A3521]' : 'opacity-40'
                }`}>
                  {initStep > 2 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : initStep === 2 ? (
                    <Loader2 className="w-4 h-4 text-[#26A69A] animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-gray-600 shrink-0" />
                  )}
                  <span className="text-[#FAF5EC] text-[11px] truncate">
                    Sinkronisasi Resource (RAM: {quotas.ram_quota_mb}MB, CPU: {quotas.cpu_quota})
                  </span>
                </div>

                {/* Step 3 */}
                <div className={`flex items-center space-x-2.5 p-2 rounded-xl transition-all ${
                  initStep >= 3 ? 'bg-[#3A2216]/60 border border-[#5A3521]' : 'opacity-40'
                }`}>
                  {initStep > 3 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : initStep === 3 ? (
                    <Loader2 className="w-4 h-4 text-[#26A69A] animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-gray-600 shrink-0" />
                  )}
                  <span className="text-[#FAF5EC] text-[11px] truncate">
                    Inisialisasi Database PostgreSQL & Modul Rule Engine
                  </span>
                </div>

                {/* Step 4 */}
                <div className={`flex items-center space-x-2.5 p-2 rounded-xl transition-all ${
                  initStep >= 4 ? 'bg-[#3A2216]/60 border border-[#5A3521]' : 'opacity-40'
                }`}>
                  {initStep >= 4 && initProgress === 100 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : initStep >= 4 ? (
                    <Loader2 className="w-4 h-4 text-[#26A69A] animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-gray-600 shrink-0" />
                  )}
                  <span className="text-[#FAF5EC] text-[11px] truncate">
                    Routing Subdomain Dedicated (tb-{username}.miraigrid.web.id)
                  </span>
                </div>
              </div>

              {/* Informative Footer Badge */}
              <div className="flex items-center justify-center space-x-2 text-[10px] text-[#A47E65] bg-[#180E08] py-2 px-3 rounded-xl border border-[#4D2D1E]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Terisolasi Penuh • Cgroups v2 Protected • Anti-Cross Tampering</span>
              </div>
            </div>
          </div>
        )}

        {/* EMBEDDED THINGSBOARD IFRAME */}
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
