import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Folder,
  Wrench,
  Database,
  Globe,
  Info,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Activity,
  Layers,
  Sparkles,
  ExternalLink,
  HelpCircle,
  Bell,
  X,
  Code,
  Terminal,
  Cpu,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Workflow,
  Rocket,
  GitBranch
} from 'lucide-react'
import { launchJupyterLab } from '../api/jupyter'
import { useUpload } from '../context/UploadContext'
import { formatMBSize } from '../utils/formatters'

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

export default function NavigationV2({
  userRole,
  isCollapsed,
  setIsCollapsed,
  quota,
  onOpenResources,
  mobileOpen = false,
  setMobileOpen = () => {}
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { requestGuardedNavigation } = useUpload()
  const [showPlatformMenu, setShowPlatformMenu] = useState(false)
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(true)
  const [showToolsMenu, setShowToolsMenu] = useState(true)
  const [logoFailed, setLogoFailed] = useState(false)

  const isQuotaLoaded = Boolean(
    quota && (quota.max_disk_mb !== undefined || quota.disk_used_mb !== undefined)
  )
  const diskTotalMb = isQuotaLoaded ? (quota.max_disk_mb || 10240) : 0
  const diskUsedMb = isQuotaLoaded && quota.disk_used_mb !== undefined && quota.disk_used_mb !== null
    ? parseFloat(Number(quota.disk_used_mb).toFixed(1))
    : 0
  const diskPercentRaw = diskTotalMb > 0 ? Math.min(100, (diskUsedMb / diskTotalMb) * 100) : 0
  const diskPercent = diskPercentRaw > 0 && diskPercentRaw < 1
    ? parseFloat(diskPercentRaw.toFixed(1))
    : Math.round(diskPercentRaw)

  const menuItems = [
    {
      id: 'files',
      label: 'Workspace',
      path: '/dashboard',
      icon: Folder,
      isDropdown: true,
      dropdownKey: 'workspace',
      activeCheck: (p) =>
        p === '/' ||
        p === '/dashboard' ||
        p.startsWith('/workspace/files') ||
        p.startsWith('/files') ||
        (userRole === 'admin' && (p === '/admin/dashboard' || p.startsWith('/admin/dashboard/'))),
    },
    {
      id: 'tools',
      label: 'Tools & Deployment',
      path: '/deploy',
      icon: Wrench,
      isDropdown: true,
      dropdownKey: 'tools',
      activeCheck: (p) => p.startsWith('/deploy') || p.startsWith('/tools/git') || p.startsWith('/git'),
    },
    {
      id: 'databases',
      label: 'Databases',
      path: '/databases',
      icon: Database,
      activeCheck: (p) => p.startsWith('/databases') || p.startsWith('/remote-database') || p.startsWith('/database-wizard'),
    },
    {
      id: 'platform',
      label: 'Platform & Lab',
      icon: Globe,
      isDropdown: true,
      dropdownKey: 'platform',
      activeCheck: (p) => p.startsWith('/thingsboard') || p.startsWith('/n8n') || p.startsWith('/vscode') || p.startsWith('/terminal') || p.startsWith('/redis'),
    },
    {
      id: 'about',
      label: 'Tentang Sistem',
      path: '/about',
      icon: Info,
      activeCheck: (p) => p.startsWith('/about'),
    },
    ...(userRole === 'admin'
      ? [
          {
            id: 'admin',
            label: 'Kelola Akun',
            path: '/admin',
            icon: Layers,
            activeCheck: (p) =>
              (p === '/admin' || p.startsWith('/admin/users') || p.startsWith('/admin/accounts')) &&
              !p.includes('dashboard'),
          },
        ]
      : []),
  ]

  const handleItemClick = (item) => {
    if (item.isDropdown) {
      if (item.dropdownKey === 'workspace') {
        setShowWorkspaceMenu(!showWorkspaceMenu)
      } else if (item.dropdownKey === 'tools') {
        setShowToolsMenu(!showToolsMenu)
      } else {
        setShowPlatformMenu(!showPlatformMenu)
      }
      return
    }
    if (item.path) {
      setMobileOpen(false)
      requestGuardedNavigation(item.path, navigate)
    }
  }

  const handleLaunchPlatform = async (type) => {
    setMobileOpen(false)
    setShowPlatformMenu(false)
    if (type === 'jupyter') {
      try {
        await launchJupyterLab()
      } catch (err) {
        console.error(err)
      }
      return
    }
    if (type === 'thingsboard') {
      requestGuardedNavigation('/thingsboard', async () => {
        try {
          const localMgToken = localStorage.getItem('miraigrid_token') || localStorage.getItem('token') || ''
          if (localMgToken) {
            try {
              document.cookie = `miraigrid_token=${localMgToken}; path=/; domain=.miraigrid.web.id; max-age=604800; SameSite=Lax; Secure`
            } catch (e) {}
          }
          const { getThingsBoardSSO } = await import('../api/thingsboard')
          const ssoData = await getThingsBoardSSO()
          if (ssoData && ssoData.ready && ssoData.sso_url) {
            let targetUrl = ssoData.sso_url
            if (localMgToken && !targetUrl.includes('mg_token=')) {
              targetUrl += (targetUrl.includes('?') ? '&' : '?') + `mg_token=${encodeURIComponent(localMgToken)}`
            }
            window.location.href = targetUrl
            return
          }
        } catch (e) {
          console.error('[ThingsBoard SSO] Fast launch fallback to /thingsboard:', e)
        }
        navigate('/thingsboard')
      })
      return
    }
    if (type === 'vscode') {
      requestGuardedNavigation('/vscode', navigate)
      return
    }
    if (type === 'terminal') {
      requestGuardedNavigation('/terminal', navigate)
      return
    }
    if (type === 'redis') {
      requestGuardedNavigation('/redis', navigate)
      return
    }
    if (type === 'n8n') {
      requestGuardedNavigation('/n8n', () => {
        const win = window.open('/n8n?autolaunch=1', '_blank', 'noopener,noreferrer')
        if (!win) {
          navigate('/n8n?autolaunch=1')
        }
      })
      return
    }
  }

  const renderSidebarContent = (isMobile = false) => {
    const effectiveCollapsed = isMobile ? false : isCollapsed

    return (
      <div className="flex flex-col h-full justify-between select-none">
        {/* Top Header */}
        <div className="flex flex-col shrink-0">
          {!effectiveCollapsed ? (
            <div className="h-14 px-4 pt-2 flex items-center justify-between">
              <div
                onClick={() => {
                  navigate('/dashboard')
                  if (isMobile) setMobileOpen(false)
                }}
                className="flex items-center space-x-3 overflow-hidden cursor-pointer group"
              >
                <img
                  src="/logos/miraigrid-logo.svg"
                  alt="MiraiGrid"
                  className="h-8 w-8 rounded-lg object-contain shrink-0"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = '/logos/miraigrid-logo.png'
                  }}
                />
                <div className="overflow-hidden">
                  <h1 className="text-sm font-bold text-slate-900 font-sans tracking-tight truncate">
                    MiraiGrid
                  </h1>
                  <p className="text-xs text-slate-500 font-medium truncate">
                    Cloud Workspace
                  </p>
                </div>
              </div>

              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  title="Tutup Menu"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition flex items-center justify-center shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCollapsed(true)}
                  title="Perkecil Sidebar"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition hidden md:flex items-center justify-center shrink-0"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="h-14 pt-2 flex items-center justify-center px-2">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                title="Perlebar Sidebar"
                className="relative p-1.5 rounded-xl hover:bg-gray-100 transition group flex items-center justify-center"
              >
                <img
                  src="/logos/miraigrid-logo.svg"
                  alt="MiraiGrid"
                  className="h-8 w-8 rounded-lg object-contain shrink-0"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = '/logos/miraigrid-logo.png'
                  }}
                />
              </button>
            </div>
          )}

          {/* Menu Navigation */}
          <nav className="p-3 space-y-1.5 w-full overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = item.activeCheck(location.pathname)

              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(item)}
                    title={item.label}
                    className={`w-full flex items-center ${
                      effectiveCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                    } py-2.5 rounded-lg text-xs font-semibold transition-colors duration-150 ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/80'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 border border-transparent'
                    }`}
                  >
                    <div className={`flex items-center ${effectiveCollapsed ? 'justify-center' : 'space-x-3'} truncate`}>
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-600'
                        }`}
                      />
                      {!effectiveCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!effectiveCollapsed && item.isDropdown && (
                      <ChevronRight
                        className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
                          (item.dropdownKey === 'workspace'
                            ? showWorkspaceMenu
                            : item.dropdownKey === 'tools'
                              ? showToolsMenu
                              : showPlatformMenu)
                            ? 'rotate-90 text-emerald-600'
                            : ''
                        }`}
                      />
                    )}
                  </button>

                  {/* Submenu Tools & Deployment (Deploy & Git Version Control) */}
                  {!effectiveCollapsed && item.isDropdown && item.dropdownKey === 'tools' && showToolsMenu && (
                    <div className="ml-4 mt-1 pl-3 border-l-2 border-emerald-100 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMobileOpen(false)
                          requestGuardedNavigation('/deploy', navigate)
                        }}
                        className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition text-left ${
                          location.pathname.startsWith('/deploy')
                            ? 'bg-emerald-50 text-emerald-700 font-bold'
                            : 'text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50'
                        }`}
                      >
                        <Rocket className="h-3.5 w-3.5 shrink-0" />
                        <span>Deploy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileOpen(false)
                          requestGuardedNavigation('/tools/git', navigate)
                        }}
                        className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition text-left ${
                          location.pathname.startsWith('/tools/git') || location.pathname.startsWith('/git')
                            ? 'bg-emerald-50 text-emerald-700 font-bold'
                            : 'text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50'
                        }`}
                      >
                        <GitBranch className="h-3.5 w-3.5 shrink-0" />
                        <span>Git Version Control</span>
                      </button>
                    </div>
                  )}

                  {/* Submenu Workspace (Dashboard & File Manager) */}
                  {!effectiveCollapsed && item.isDropdown && item.dropdownKey === 'workspace' && showWorkspaceMenu && (
                    <div className="ml-4 mt-1 pl-3 border-l-2 border-emerald-100 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMobileOpen(false)
                          requestGuardedNavigation(userRole === 'admin' ? '/admin/dashboard' : '/dashboard', navigate)
                        }}
                        className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition text-left ${
                          (userRole === 'admin'
                            ? location.pathname === '/admin/dashboard' || location.pathname.startsWith('/admin/dashboard/')
                            : location.pathname === '/dashboard' || location.pathname === '/')
                            ? 'bg-emerald-50 text-emerald-700 font-bold'
                            : 'text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50'
                        }`}
                      >
                        <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                        <span>Dashboard</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileOpen(false)
                          requestGuardedNavigation(userRole === 'admin' ? '/dashboard' : '/workspace/files', navigate)
                        }}
                        className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition text-left ${
                          (userRole === 'admin'
                            ? location.pathname === '/dashboard' || location.pathname.startsWith('/files') || location.pathname.startsWith('/workspace/files')
                            : location.pathname.startsWith('/workspace/files') || location.pathname.startsWith('/files'))
                            ? 'bg-emerald-50 text-emerald-700 font-bold'
                            : 'text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50'
                        }`}
                      >
                        <Folder className="h-3.5 w-3.5 shrink-0" />
                        <span>File Manager</span>
                      </button>
                    </div>
                  )}

                  {/* Submenu Platform & Lab */}
                  {!effectiveCollapsed && item.isDropdown && item.dropdownKey === 'platform' && showPlatformMenu && (
                    <div className="ml-4 mt-1 pl-3 border-l-2 border-emerald-100 space-y-1">
                      <button
                        onClick={() => handleLaunchPlatform('jupyter')}
                        className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50 transition text-left"
                      >
                        <JupyterIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>JupyterHub (LAN)</span>
                      </button>
                      <button
                        onClick={() => handleLaunchPlatform('thingsboard')}
                        className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50 transition text-left"
                      >
                        <span className="text-[10px] font-bold text-blue-600 font-mono">IoT</span>
                        <span>ThingsBoard</span>
                      </button>
                      <button
                        onClick={() => handleLaunchPlatform('n8n')}
                        className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition text-left ${
                          location.pathname.startsWith('/n8n')
                            ? 'bg-emerald-50 text-emerald-700 font-bold'
                            : 'text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50'
                        }`}
                      >
                        <Workflow className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>Otomasi n8n</span>
                      </button>
                      <button
                        onClick={() => handleLaunchPlatform('vscode')}
                        className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50 transition text-left"
                      >
                        <Code className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span>Web IDE (VS Code)</span>
                      </button>
                      <button
                        onClick={() => handleLaunchPlatform('terminal')}
                        className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50 transition text-left"
                      >
                        <Terminal className="h-3.5 w-3.5 text-gray-700 shrink-0" />
                        <span>Terminal Jail</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </div>

        {/* Bottom Storage & Resource Widget */}
        <div className="p-3 shrink-0 space-y-3">
          {!effectiveCollapsed ? (
            <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700 flex items-center space-x-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Penyimpanan Cloud</span>
                </span>
                <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.2 rounded">
                  {isQuotaLoaded ? `${diskPercent}%` : '...'}
                </span>
              </div>

              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${isQuotaLoaded ? diskPercent : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
                <span>{isQuotaLoaded ? formatMBSize(diskUsedMb) : 'Memuat...'}</span>
                <span>{isQuotaLoaded ? formatMBSize(diskTotalMb) : '...'}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isMobile) setMobileOpen(false)
                  requestGuardedNavigation('/resources', navigate)
                }}
                className="w-full py-1.5 px-2.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-[11px] font-bold text-slate-700 hover:text-emerald-700 transition-colors flex items-center justify-center space-x-1.5"
              >
                <Activity className="h-3.5 w-3.5 text-emerald-600" />
                <span>Lihat Detail Resource</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <button
                type="button"
                onClick={() => requestGuardedNavigation('/resources', navigate)}
                title={`Detail Resource: ${diskPercent}% terpakai`}
                className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100/70 transition-colors"
              >
                <Activity className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Footer Links */}
          {!effectiveCollapsed ? (
            <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-gray-400">
              <button
                onClick={() => {
                  navigate('/about')
                  if (isMobile) setMobileOpen(false)
                }}
                className="hover:text-gray-700 transition flex items-center space-x-1"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Panduan</span>
              </button>
              <span className="font-mono text-[10px] text-gray-300">v2.0</span>
            </div>
          ) : (
            <div className="flex flex-col items-center pt-1">
              <button
                onClick={() => navigate('/about')}
                title="Panduan Sistem (v2.0)"
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition flex items-center justify-center"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Desktop Flush Full-Height Sidebar (Unified Seamless Canvas without border-r) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 h-screen bg-[#F8FAFC] z-30 hidden md:flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full border-r border-slate-200 flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}
    </>
  )
}
