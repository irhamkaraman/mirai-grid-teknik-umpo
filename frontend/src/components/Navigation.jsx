import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Wrench, Users, Server, ChevronLeft, ChevronRight, Info, Code, Loader2 } from 'lucide-react'
import { launchJupyterLab } from '../api/jupyter'

export function JupyterIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 44 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M22.012 11.233c-8.995 0-16.792 4.962-19.645 11.838 2.477-1.897 5.986-3.138 9.932-3.138 6.617 0 12.222 3.46 13.791 8.217.214.645.326 1.32.326 2.001 0 3.847-3.816 7.037-8.81 7.727 1.439.247 2.946.386 4.488.386 8.995 0 16.792-4.962 19.645-11.838-2.477 1.897-5.986 3.138-9.932 3.138-6.617 0-12.222-3.46-13.791-8.217-.214-.645-.326-1.32-.326-2.001 0-3.847 3.816-7.037 8.81-7.727-1.439-.247-2.946-.386-4.488-.386z" fill="#F37626"/>
      <circle cx="22" cy="4.5" r="3.5" fill="#9E9E9E"/>
      <circle cx="6.5" cy="38.5" r="3.5" fill="#9E9E9E"/>
      <circle cx="37.5" cy="38.5" r="3.5" fill="#9E9E9E"/>
    </svg>
  )
}

export function ThingsBoardIcon({ className = "h-4 w-4" }) {
  return (
    <img
      src="/logos/thingsboard-emblem.svg"
      alt="ThingsBoard"
      className={`${className} object-contain`}
    />
  )
}

export default function Navigation({ userRole, isCollapsed, setIsCollapsed }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isLaunchingJupyter, setIsLaunchingJupyter] = useState(false)
  const [jupyterError, setJupyterError] = useState(null)

  const menuGroups = [
    {
      id: 'main',
      label: 'Menu Utama',
      items: [
        { id: 'tools', label: 'Tools', path: '/dashboard', icon: Wrench },
        { id: 'vscode', label: 'Web IDE (VS Code)', path: '/vscode', icon: Code },
        ...(userRole === 'admin'
          ? [{ id: 'accounts', label: 'Kelola Akun', path: '/admin', icon: Users }]
          : []),
      ],
    },
    {
      id: 'platform',
      label: 'Platform',
      items: [
        { id: 'jupyter', label: 'Jupyter Hub', action: 'jupyter', icon: JupyterIcon, badge: 'LAN' },
        { id: 'thingsboard', label: 'ThingsBoard', path: '/thingsboard', icon: ThingsBoardIcon, badge: 'IoT' },
      ],
    },
    {
      id: 'system',
      label: 'Sistem',
      items: [
        { id: 'about', label: 'Tentang', path: '/about', icon: Info },
      ],
    },
  ]

  const handleNavClick = async (item) => {
    if (item.action === 'jupyter') {
      try {
        setIsLaunchingJupyter(true)
        await launchJupyterLab()
      } catch (err) {
        console.error('Jupyter SSO launch failed:', err)
        const msg = err.response?.data?.detail || err.message || ''
        if (err.response?.status === 403) {
          setJupyterError({
            title: 'Akses Ditolak',
            message: msg || 'Hanya mahasiswa Teknik Informatika (S1) yang diizinkan mengakses JupyterHub Lab Komputasi.',
            isNetwork: false,
          })
        } else {
          setJupyterError({
            title: 'Jaringan Kampus Diperlukan',
            message: 'Server JupyterHub Lab Komputasi berjalan pada jaringan intranet kampus UMPO (76.76.76.188:8090). Pastikan perangkat Anda terhubung ke jaringan Wi-Fi Lab / LAN Kampus UMPO untuk menggunakan fitur ini.',
            isNetwork: true,
          })
        }
      } finally {
        setIsLaunchingJupyter(false)
      }
      return
    }

    if (item.path) {
      navigate(item.path)
    }
  }

  const isItemActive = (itemPath) => {
    if (!itemPath) return false
    if (itemPath === '/dashboard') {
      return (
        location.pathname === '/' ||
        location.pathname === '/dashboard' ||
        location.pathname.startsWith('/deploy') ||
        location.pathname.startsWith('/databases') ||
        location.pathname.startsWith('/disk-usage') ||
        location.pathname.startsWith('/remote-database') ||
        location.pathname.startsWith('/database-wizard') ||
        location.pathname.startsWith('/git') ||
        location.pathname.startsWith('/terminal') ||
        location.pathname.startsWith('/cron') ||
        location.pathname.startsWith('/redis')
      )
    }
    return location.pathname === itemPath || location.pathname.startsWith(itemPath + '/')
  }

  return (
    <>
      {/* 1. FLOATING SIDEBAR (Desktop / Tablet) */}
      <aside
        className={`fixed left-5 top-5 bottom-5 bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-4 z-30 hidden md:flex flex-col backdrop-blur-xl transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20 items-center' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className={`flex items-center mb-6 w-full ${isCollapsed ? 'justify-center' : 'justify-between px-1'}`}>
          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-3 overflow-hidden cursor-pointer"
          >
            <img
              src="/logos/miraigrid-logo.svg"
              alt="MiraiGrid"
              className="h-10 w-10 rounded-2xl object-contain shadow-md bg-white p-0.5 border border-white/30 shrink-0 hover:scale-105 transition-transform"
            />
            {!isCollapsed && (
              <div className="overflow-hidden">
                <h1 className="text-xl font-serif font-bold text-[#FAF5EC] tracking-wide truncate">
                  MiraiGrid
                </h1>
                <p className="text-[10px] text-terracotta-400 font-medium tracking-wider uppercase truncate">
                  Lab TI UMPO
                </p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              title="Perkecil Sidebar"
              className="p-1.5 rounded-xl text-cream-400/60 hover:text-white hover:bg-[#341F14] transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Collapsed expand button */}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            title="Buka Sidebar"
            className="mb-6 p-2 rounded-xl text-cream-400/60 hover:text-white hover:bg-[#341F14] transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Navigation Items grouped by section */}
        <nav className="space-y-4 flex-1 w-full overflow-y-auto pr-0.5 custom-scrollbar">
          {menuGroups.map((group) => (
            <div key={group.id} className="space-y-1.5">
              {!isCollapsed && (
                <p className="text-[10px] font-semibold text-cream-400/50 uppercase tracking-wider px-3 mb-1.5">
                  {group.label}
                </p>
              )}

              {isCollapsed && group.id !== 'main' && (
                <div className="w-8 h-px bg-[#4D2D1E] mx-auto my-2" />
              )}

              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = item.path ? isItemActive(item.path) : false
                const isItemLoading = item.id === 'jupyter' && isLaunchingJupyter

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item)}
                    disabled={isItemLoading}
                    title={isCollapsed ? `${group.label}: ${item.label}` : undefined}
                    className={`w-full flex items-center rounded-2xl text-xs font-semibold transition-all duration-200 group ${
                      isCollapsed ? 'justify-center p-3' : 'space-x-3 px-3.5 py-3'
                    } ${
                      isActive
                        ? 'bg-gradient-to-r from-chocolate-700 to-chocolate-600 text-[#FAF5EC] border border-chocolate-500/50 shadow-md shadow-chocolate-950/40'
                        : 'text-[#D0B8A2] hover:text-white hover:bg-[#301C12]'
                    } ${isItemLoading ? 'opacity-70 cursor-wait' : ''}`}
                  >
                    {isItemLoading ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#F37626]" />
                    ) : (
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive ? 'text-terracotta-400' : 'text-cream-400/70 group-hover:text-cream-200'
                        }`}
                      />
                    )}
                    {!isCollapsed && (
                      <span className="truncate flex-1 text-left flex items-center justify-between">
                        <span>{item.label}</span>
                        {item.badge && (
                          <span
                            className={`ml-1 px-1.5 py-0.5 text-[9px] rounded-md font-mono border ${
                              item.id === 'thingsboard'
                                ? 'bg-[#00897B]/20 text-[#26A69A] border-[#26A69A]/30 font-semibold'
                                : 'bg-[#F37626]/20 text-[#F37626] border-[#F37626]/30'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* 2. FLOATING BOTTOM NAVIGATION (Mobile) */}
      <nav className="fixed bottom-4 left-4 right-4 z-40 md:hidden bg-[#2B1810]/95 backdrop-blur-xl border border-[#4D2D1E] rounded-2xl shadow-2xl px-2 py-2 flex items-center justify-around">
        {menuGroups.flatMap((g) => g.items).map((item) => {
          const Icon = item.icon
          const isActive = item.path ? isItemActive(item.path) : false
          const isItemLoading = item.id === 'jupyter' && isLaunchingJupyter

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              disabled={isItemLoading}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive ? 'text-terracotta-400' : 'text-[#D0B8A2]/70 hover:text-[#FAF5EC]'
              }`}
            >
              {isItemLoading ? (
                <Loader2 className="h-5 w-5 mb-0.5 animate-spin text-[#F37626]" />
              ) : (
                <Icon className="h-5 w-5 mb-0.5" />
              )}
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* 3. JUPYTER INTRANET / ERROR MODAL */}
      {jupyterError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#FAF5EC] text-[#2B1810] border border-[#D0B8A2] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-[#F37626]/10 text-[#F37626] border border-[#F37626]/20">
                <JupyterIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-[#2B1810]">{jupyterError.title}</h3>
                <p className="text-xs text-stone-500 font-medium">Platform Komputasi AI Lab TI UMPO</p>
              </div>
            </div>

            <div className="bg-[#F3EAD8] border border-[#E2D2BC] rounded-2xl p-4 text-xs text-stone-700 leading-relaxed space-y-2">
              <p>{jupyterError.message}</p>
              {jupyterError.isNetwork && (
                <div className="mt-3 pt-3 border-t border-[#D9C4A9] text-[11px] text-stone-600 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-stone-700">Host Server:</span>
                    <code className="bg-[#FAF5EC] px-2 py-0.5 rounded text-chocolate-800 font-mono">http://76.76.76.188:8090</code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-stone-700">Akses Jaringan:</span>
                    <span className="text-emerald-700 font-medium">Wi-Fi Lab TI / LAN Kampus</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-stone-700">Otentikasi:</span>
                    <span className="text-stone-800">MiraiGrid Single Sign-On (SSO)</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setJupyterError(null)}
                className="px-5 py-2.5 bg-[#2B1810] hover:bg-[#3D2317] text-[#FAF5EC] font-semibold text-xs rounded-xl shadow transition"
              >
                Mengerti & Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
