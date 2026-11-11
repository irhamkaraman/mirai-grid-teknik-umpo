import React, { useState, useEffect, useRef } from 'react'
import {
  Folder,
  RotateCw,
  ExternalLink,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronDown,
  Layers,
  Sparkles,
  CheckCircle2,
  Terminal,
  ShieldCheck
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { syncPageRoute } from '../utils/securityRoute'

export default function VSCodeView({ user, onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [restarting, setRestarting] = useState(false)
  const [status, setStatus] = useState(null)
  const [folders, setFolders] = useState([])
  const [selectedFolder, setSelectedFolder] = useState('')
  const [showFolderDropdown, setShowFolderDropdown] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [iframeKey, setIframeKey] = useState(Date.now())
  const dropdownRef = useRef(null)

  const username = user?.username || 'admin'
  const userId = user?.id || 1

  // Close folder dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowFolderDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Dynamic route security hash sync
  useEffect(() => {
    syncPageRoute('/vscode', selectedFolder ? { folder: selectedFolder } : {})
  }, [selectedFolder])

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  // Fetch IDE status & available folders
  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    try {
      // 1. Fetch user workspace folders
      const fRes = await api.get('/vscode/folders')
      const fList = fRes.data?.folders || []
      setFolders(fList)
      const defaultFolder = fList[0]?.path || `/home/${username}`
      setSelectedFolder(defaultFolder)

      // 2. Fetch or auto-start IDE instance
      const sRes = await api.get('/vscode/status')
      if (!sRes.data?.running) {
        const startRes = await api.post('/vscode/start', { folder: defaultFolder })
        setStatus(startRes.data)
      } else {
        setStatus(sRes.data)
      }
    } catch (err) {
      console.error('Failed to initialize VS Code session', err)
      try {
        const startRes = await api.post('/vscode/start', {})
        setStatus(startRes.data)
      } catch (e) {
        console.error('Auto-start fallback failed', e)
      }
    } finally {
      // Allow slight buffer for code-server render
      setTimeout(() => setLoading(false), 800)
    }
  }

  const handleSelectFolder = async (folderPath) => {
    setSelectedFolder(folderPath)
    setShowFolderDropdown(false)
    setRestarting(true)
    try {
      const res = await api.post('/vscode/start', { folder: folderPath })
      setStatus(res.data)
      setIframeKey(Date.now())
      toast.success(`Membuka folder: ${folderPath.split('/').pop() || folderPath}`)
    } catch (err) {
      console.error('Failed to switch folder', err)
      toast.error('Gagal membuka folder di Web IDE')
    } finally {
      setTimeout(() => setRestarting(false), 600)
    }
  }

  const handleRestart = async () => {
    setRestarting(true)
    try {
      const res = await api.post('/vscode/restart', { folder: selectedFolder })
      setStatus(res.data)
      setIframeKey(Date.now())
      toast.success('Web IDE berhasil dimuat ulang!')
    } catch (err) {
      console.error('Failed to restart VS Code', err)
      toast.error('Gagal memuat ulang Web IDE')
    } finally {
      setTimeout(() => setRestarting(false), 800)
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
  const targetPort = status?.port || (14000 + userId)
  const publicSubdomainUrl = status?.public_url || `https://code-${username}.miraigrid.web.id`
  const localUrl = status?.campus_url || `http://100.122.201.18:${targetPort}`

  const isHostnameDomain = typeof window !== 'undefined' && window.location.hostname.includes('miraigrid.web.id')
  const baseUrl = isHostnameDomain ? publicSubdomainUrl : localUrl
  const iframeSrc = `${baseUrl}/?folder=${encodeURIComponent(selectedFolder || `/home/${username}`)}`

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1E110A] overflow-hidden select-none m-0 p-0 font-sans">
      {/* 1. SLIM STANDALONE TOPBAR (Tampilan Terpisah Bersih Bebas Distraksi) */}
      <header className="h-14 bg-[#2B1810] border-b border-[#4D2D1E] px-3 sm:px-5 flex items-center justify-between shrink-0 shadow-lg z-20">
        
        {/* Left: Back Button, VS Code Brand, Title & Info Badges */}
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

          {/* Official VS Code Logo */}
          <div className="w-8 h-8 rounded-xl bg-[#1E110A] border border-[#4D2D1E] p-1.5 flex items-center justify-center shadow-inner shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M17.5 2.5L7.5 10.5L3.5 7.5L2 8.5L5.5 12L2 15.5L3.5 16.5L7.5 13.5L17.5 21.5L22 19.5V4.5L17.5 2.5Z" fill="#007ACC" />
              <path d="M17.5 6.5V17.5L10 12L17.5 6.5Z" fill="#0065A9" />
            </svg>
          </div>

          <div className="flex items-center space-x-2">
            <h1 className="text-sm sm:text-base font-serif font-bold text-[#FAF5EC] tracking-wide">
              Web IDE <span className="hidden md:inline font-sans font-normal text-xs text-[#A47E65]">(VS Code Server)</span>
            </h1>

            {/* Status Live */}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
              Online
            </span>
          </div>

          {/* User & Port Info Pills */}
          <div className="hidden xl:flex items-center space-x-2 text-[11px] text-[#C49767] font-mono bg-[#1E110A] border border-[#4D2D1E] px-2.5 py-1 rounded-xl">
            <span>Port: <strong className="text-[#FAF5EC]">:{targetPort}</strong></span>
            <span className="text-[#5A3521]">•</span>
            <span>Akun: <strong className="text-[#FAF5EC]">{username}</strong></span>
            <span className="text-[#5A3521]">•</span>
            <span className="truncate max-w-[220px]">Folder: <strong className="text-[#FAF5EC]">{selectedFolder || `/home/${username}`}</strong></span>
          </div>
        </div>

        {/* Right: Folder Selector Dropdown, Restart, New Tab, Fullscreen */}
        <div className="flex items-center space-x-2">
          
          {/* Dynamic Workspace Folder Picker */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowFolderDropdown(!showFolderDropdown)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#3A2216] border border-[#5A3521] text-xs text-[#FAF5EC] hover:bg-[#4D2D1E] transition shadow-sm font-sans"
              title="Pilih Folder Workspace"
            >
              <Folder className="h-3.5 w-3.5 text-[#E8C58D] shrink-0" />
              <span className="max-w-[120px] sm:max-w-[160px] truncate font-medium">
                {folders.find(f => f.path === selectedFolder)?.name || selectedFolder.split('/').pop() || 'Pilih Folder'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[#C49767] shrink-0" />
            </button>

            {showFolderDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-[#2B1810] border border-[#4D2D1E] rounded-2xl shadow-2xl py-2 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 border-b border-[#4D2D1E]/60 text-[10px] font-semibold tracking-wider uppercase text-[#C49767]">
                  Buka Folder Workspace
                </div>
                <div className="max-h-60 overflow-y-auto py-1 space-y-0.5 custom-scrollbar">
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleSelectFolder(f.path)}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center space-x-2 transition ${
                        selectedFolder === f.path
                          ? 'bg-[#4D2D1E] text-[#E8C58D] font-semibold'
                          : 'text-[#FAF5EC]/90 hover:bg-[#3A2216] hover:text-[#FAF5EC]'
                      }`}
                    >
                      <Folder className={`h-3.5 w-3.5 shrink-0 ${selectedFolder === f.path ? 'text-[#E8C58D]' : 'text-[#A47E65]'}`} />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Muat Ulang (Restart) Button */}
          <button
            type="button"
            onClick={handleRestart}
            disabled={restarting}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#3A2216] border border-[#5A3521] text-xs font-semibold text-[#FAF5EC] hover:bg-[#4D2D1E] transition disabled:opacity-50 shadow-sm"
            title="Muat Ulang / Restart Layanan Web IDE"
          >
            <RotateCw className={`h-3.5 w-3.5 text-[#E8C58D] ${restarting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Muat Ulang</span>
          </button>

          {/* Tab Baru (Open in dedicated tab) */}
          <a
            href={iframeSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#3A2216] border border-[#5A3521] text-xs font-semibold text-[#FAF5EC] hover:bg-[#4D2D1E] transition shadow-sm"
            title="Buka Web IDE di Tab Peramban Penuh"
          >
            <ExternalLink className="h-3.5 w-3.5 text-[#C49767]" />
            <span className="hidden md:inline">Tab Baru</span>
          </a>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullScreen}
            className="p-1.5 rounded-xl bg-[#C49767] text-[#24140D] hover:bg-[#E8C58D] transition shadow-md font-bold"
            title={isFullScreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* 2. FULL-BLEED EMBEDDED IFRAME AREA (100% Layar Tanpa Sidebar & Header Utama) */}
      <main className="flex-1 w-full relative bg-[#1E1E1E] overflow-hidden">
        {(loading || restarting) && (
          <div className="absolute inset-0 z-20 bg-[#1E110A]/95 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-[#2B1810] border border-[#4D2D1E] p-3 shadow-inner flex items-center justify-center">
                <svg className="w-8 h-8 animate-pulse" viewBox="0 0 24 24" fill="none">
                  <path d="M17.5 2.5L7.5 10.5L3.5 7.5L2 8.5L5.5 12L2 15.5L3.5 16.5L7.5 13.5L17.5 21.5L22 19.5V4.5L17.5 2.5Z" fill="#007ACC" />
                </svg>
              </div>
              <RotateCw className="h-5 w-5 text-[#E8C58D] animate-spin absolute -bottom-1 -right-1" />
            </div>
            <div className="text-center">
              <p className="text-sm font-serif font-bold text-[#FAF5EC]">
                {restarting ? 'Memuat Ulang Visual Studio Code...' : 'Menghubungkan Sesi Web IDE Sandboxed...'}
              </p>
              <p className="text-xs text-[#A47E65] mt-1 font-mono">
                Port :{targetPort} • Akun: {username} • {selectedFolder || `/home/${username}`}
              </p>
            </div>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={iframeSrc}
          title="MiraiGrid Web IDE"
          className="w-full h-full border-0 bg-[#1E1E1E] block"
          allow="clipboard-read; clipboard-write; cross-origin-isolated; fullscreen"
          onLoad={() => setLoading(false)}
        />
      </main>
    </div>
  )
}
