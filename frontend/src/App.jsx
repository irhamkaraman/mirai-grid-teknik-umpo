import React, { useState, useEffect, useMemo } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Search, X, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { ThemeProvider } from './context/ThemeContext'
import { UploadProvider } from './context/UploadContext'
import FloatingUploadManager from './components/FloatingUploadManager'
import NavigationV2 from './components/NavigationV2'
import ResourceDetailModal from './components/ResourceDetailModal'
import ProfileAvatar from './components/ProfileFloating'
import ChangePasswordModal from './components/ChangePasswordModal'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import DashboardV2 from './pages/DashboardV2'
import UserDashboardPage from './pages/UserDashboardPage'
import ProjectsView from './pages/ProjectsView'
import DatabasesView from './pages/DatabasesView'
import AdminView from './pages/AdminView'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminContainerDetailPage from './pages/AdminContainerDetailPage'
import AdminWafPage from './pages/AdminWafPage'
import AdminReportsPage from './pages/AdminReportsPage'
import AdminSubdomainsPage from './pages/AdminSubdomainsPage'
import ReportIssuePage from './pages/ReportIssuePage'
import ProfilePage from './pages/ProfilePage'
import DiskUsagePage from './pages/DiskUsagePage'
import RemoteDatabasePage from './pages/RemoteDatabasePage'
import DatabaseWizardPage from './pages/DatabaseWizardPage'
import GitVersionControlView from './pages/GitVersionControlView'
import AccountConfigPage from './pages/AccountConfigPage'
import AboutPage from './pages/AboutPage'
import StudentResourcesPage from './pages/StudentResourcesPage'
import TerminalPage from './pages/TerminalPage'
import SSHAccessPage from './pages/SSHAccessPage'
import CronJobsPage from './pages/CronJobsPage'
import RedisView from './pages/RedisView'
import VSCodeView from './pages/VSCodeView'
import ThingsBoardView from './pages/ThingsBoardView'
import JupyterView from './pages/JupyterView'
import N8nView from './pages/N8nView'
import OnboardingWizardPage from './pages/OnboardingWizardPage'
import ErrorBoundary from './components/ErrorBoundary'
import { syncPageRoute, checkUrlTampering, triggerRouteSecurityAlarm } from './utils/securityRoute'
import SecurityLockModal from './components/SecurityLockModal'
import { api } from './api/client'
import {
  isAuthSubdomain,
  isMiraiGridProductionHost,
  getAuthLoginUrl,
  getAuthLogoutUrl,
  sanitizeRedirectUrl,
  setSharedAuthCookie,
  getSharedAuthCookie,
  clearSharedAuthCookie,
} from './utils/authHost'

function ExternalRedirect({ to }) {
  const [loopBlocked, setLoopBlocked] = useState(false)

  useEffect(() => {
    try {
      const now = Date.now()
      const raw = sessionStorage.getItem('miraigrid_redir_log')
      const recent = (raw ? JSON.parse(raw) : []).filter((ts) => now - ts < 6000)
      if (recent.length >= 3) {
        localStorage.removeItem('miraigrid_token')
        localStorage.removeItem('miraigrid_user')
        clearSharedAuthCookie()
        sessionStorage.removeItem('miraigrid_redir_log')
        setLoopBlocked(true)
        return
      }
      recent.push(now)
      sessionStorage.setItem('miraigrid_redir_log', JSON.stringify(recent))
    } catch {}
    window.location.replace(to)
  }, [to])

  if (loopBlocked) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-sm w-full rounded-xl border border-slate-200/80 bg-white p-6 text-center space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Sesi Dialihkan Ulang</h2>
          <p className="text-xs text-slate-500">
            Sesi lama telah dibersihkan demi mencegah pengalihan berulang. Silakan masuk kembali.
          </p>
          <a
            href={getAuthLogoutUrl()}
            className="inline-block rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Ke Halaman Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
    </div>
  )
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(() => {
    const isLoggingOut =
      window.location.pathname === '/logout' ||
      new URLSearchParams(window.location.search).get('logged_out') === '1'
    if (isLoggingOut) {
      localStorage.removeItem('miraigrid_user')
      localStorage.removeItem('miraigrid_token')
      clearSharedAuthCookie()
      return null
    }
    if (isAuthSubdomain() && !getSharedAuthCookie()) {
      localStorage.removeItem('miraigrid_user')
      localStorage.removeItem('miraigrid_token')
      return null
    }
    const savedUser = localStorage.getItem('miraigrid_user')
    const token = localStorage.getItem('miraigrid_token')
    if (savedUser && token) {
      try {
        return JSON.parse(savedUser)
      } catch (e) {
        localStorage.removeItem('miraigrid_user')
        localStorage.removeItem('miraigrid_token')
      }
    }
    return null
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [isMandatoryPasswordChange, setIsMandatoryPasswordChange] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('miraigrid_sidebar_collapsed') === 'true'
  })
  const [securityBreach, setSecurityBreach] = useState(null)
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [userQuota, setUserQuota] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [authBootstrapping, setAuthBootstrapping] = useState(() => {
    const hasLocal = Boolean(localStorage.getItem('miraigrid_token') && localStorage.getItem('miraigrid_user'))
    return !hasLocal && Boolean(getSharedAuthCookie())
  })

  useEffect(() => {
    try {
      localStorage.removeItem('miraigrid_theme_mode')
    } catch {}
    document.documentElement.classList.add('theme-v2', 'theme-mig-cloud')
    document.body.classList.add('theme-v2', 'theme-mig-cloud')
  }, [])

  const themeContextValue = useMemo(() => ({
    theme: 'v2',
    isV2: true,
    toggleTheme: () => {},
    setTheme: () => {},
  }), [])

  useEffect(() => {
    const refreshQuota = () => {
      if (user) {
        api.get('/quotas/my-quota').then((res) => {
          setUserQuota(res.data)
        }).catch(() => {})
      }
    }
    refreshQuota()
    window.addEventListener('miraigrid:files_updated', refreshQuota)
    return () => window.removeEventListener('miraigrid:files_updated', refreshQuota)
  }, [user])

  useEffect(() => {
    const onBreach = (e) => setSecurityBreach(e.detail?.reason || 'Manipulasi rute terdeteksi')
    window.addEventListener('miraigrid:security_breach', onBreach)
    return () => window.removeEventListener('miraigrid:security_breach', onBreach)
  }, [])

  // Route integrity check & dynamic session hash sync
  useEffect(() => {
    const check = checkUrlTampering(window.location.href)
    if (check.isTampered) {
      triggerRouteSecurityAlarm(check.reason)
      return
    }

    if (user && !location.pathname.startsWith('/files') && !location.pathname.startsWith('/vscode') && !location.pathname.startsWith('/thingsboard') && !location.pathname.startsWith('/jupyter')) {
      syncPageRoute(location.pathname)
    }
  }, [location.pathname, location.search, user])

  // Global hashchange security watchdog
  useEffect(() => {
    const onHashChange = () => {
      const check = checkUrlTampering(window.location.href)
      if (check.isTampered) {
        triggerRouteSecurityAlarm(check.reason)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const isLoggingOut =
      location.pathname === '/logout' ||
      new URLSearchParams(location.search).get('logged_out') === '1'

    if (isLoggingOut) {
      localStorage.removeItem('miraigrid_token')
      localStorage.removeItem('miraigrid_user')
      clearSharedAuthCookie()
      setUser(null)
      setAuthBootstrapping(false)
      api.post('/auth/logout').catch(() => {})
      if (isAuthSubdomain()) {
        if (location.pathname === '/logout') {
          window.history.replaceState(null, '', '/login?logged_out=1')
        }
      } else if (isMiraiGridProductionHost()) {
        window.location.replace(getAuthLogoutUrl())
      }
      return
    }

    if (isAuthSubdomain() && !getSharedAuthCookie()) {
      localStorage.removeItem('miraigrid_token')
      localStorage.removeItem('miraigrid_user')
      setUser(null)
      setAuthBootstrapping(false)
      return
    }

    const savedUser = localStorage.getItem('miraigrid_user')
    const token = localStorage.getItem('miraigrid_token')
    if (savedUser && token) {
      try {
        const parsed = JSON.parse(savedUser)
        setUser(parsed)
        if (parsed.must_change_password) {
          setIsMandatoryPasswordChange(true)
          setShowPasswordModal(true)
        }
      } catch (e) {
        localStorage.clear()
      }
      setAuthBootstrapping(false)
      return
    }

    const cookieToken = getSharedAuthCookie()
    if (cookieToken) {
      localStorage.setItem('miraigrid_token', cookieToken)
      api.get('/auth/me')
        .then((res) => {
          const data = res.data
          const userData = {
            username: data.username,
            name: data.name,
            role: data.role,
            must_change_password: Boolean(data.must_change_password),
            onboarding_step: data.onboarding_step ?? 1,
            onboarding_completed: Boolean(data.onboarding_completed),
          }
          localStorage.setItem('miraigrid_user', JSON.stringify(userData))
          setUser(userData)
          if (userData.must_change_password) {
            setIsMandatoryPasswordChange(true)
            setShowPasswordModal(true)
          }
        })
        .catch(() => {
          localStorage.removeItem('miraigrid_token')
          localStorage.removeItem('miraigrid_user')
          clearSharedAuthCookie()
          setUser(null)
        })
        .finally(() => {
          setAuthBootstrapping(false)
        })
    } else {
      setAuthBootstrapping(false)
    }
  }, [location.pathname, location.search])

  const handleToggleCollapse = (collapsed) => {
    setIsCollapsed(collapsed)
    localStorage.setItem('miraigrid_sidebar_collapsed', String(collapsed))
  }

  const handleLoginSuccess = (data) => {
    const userData = {
      username: data.username,
      name: data.name,
      role: data.role,
      must_change_password: data.must_change_password,
      onboarding_step: data.onboarding_step ?? 1,
      onboarding_completed: Boolean(data.onboarding_completed),
    }
    setUser(userData)
    localStorage.setItem('miraigrid_user', JSON.stringify(userData))
    if (data.access_token) {
      setSharedAuthCookie(data.access_token)
    }
    if (data.must_change_password) {
      setIsMandatoryPasswordChange(true)
      setShowPasswordModal(true)
    }
    const defaultPath = (userData.role !== 'admin' && !userData.onboarding_completed) ? '/onboarding' : '/dashboard'
    const redirectParam = new URLSearchParams(window.location.search).get('redirect')
    const targetUrl = sanitizeRedirectUrl(redirectParam, defaultPath)
    if (isAuthSubdomain() || isMiraiGridProductionHost()) {
      window.location.replace(targetUrl)
    } else {
      navigate(defaultPath)
    }
  }

  const handleOnboardingComplete = (updatedUser) => {
    const nextUser = {
      ...user,
      ...updatedUser,
      onboarding_completed: true,
      onboarding_step: 4,
    }
    setUser(nextUser)
    localStorage.setItem('miraigrid_user', JSON.stringify(nextUser))
    navigate('/dashboard')
  }

  const handleLogout = () => {
    localStorage.removeItem('miraigrid_token')
    localStorage.removeItem('miraigrid_user')
    clearSharedAuthCookie()
    setUser(null)
    if (isMiraiGridProductionHost()) {
      window.location.replace(getAuthLogoutUrl())
    } else {
      navigate('/login')
    }
  }

  const handlePasswordChanged = () => {
    setIsMandatoryPasswordChange(false)
    if (user) {
      const updated = { ...user, must_change_password: false }
      setUser(updated)
      localStorage.setItem('miraigrid_user', JSON.stringify(updated))
    }
  }

  if (securityBreach) {
    return (
      <SecurityLockModal
        reason={securityBreach}
        onReset={() => {
          localStorage.removeItem('miraigrid_token')
          localStorage.removeItem('miraigrid_user')
          clearSharedAuthCookie()
          window.location.href = getAuthLoginUrl()
        }}
      />
    )
  }

  if (authBootstrapping) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
      </div>
    )
  }

  if (isAuthSubdomain()) {
    const isLogoutFlow =
      location.pathname === '/logout' ||
      new URLSearchParams(location.search).get('logged_out') === '1'
    if (user && !isLogoutFlow && Boolean(getSharedAuthCookie())) {
      const defaultPath = (user.role !== 'admin' && !user.onboarding_completed) ? '/onboarding' : '/dashboard'
      const redirectParam = new URLSearchParams(window.location.search).get('redirect')
      const targetUrl = sanitizeRedirectUrl(redirectParam, defaultPath)
      return <ExternalRedirect to={targetUrl} />
    }
    return (
      <div className="bg-[#F8FAFC] min-h-screen">
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#0F172A',
              borderRadius: '12px',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            },
          }}
        />
        <Routes>
          <Route path="/" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
          <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
          <Route path="/logout" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    )
  }

  if (!user) {
    const redirectParam = new URLSearchParams(window.location.search).get('redirect')
    const prodAuthUrl = getAuthLoginUrl(redirectParam)
    return (
      <div className="bg-[#F8FAFC] min-h-screen">
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#0F172A',
              borderRadius: '12px',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            },
          }}
        />
        <Routes>
          <Route path="/" element={<LandingPage onLogin={() => window.location.assign(getAuthLoginUrl('/dashboard'))} />} />
          <Route path="/welcome" element={<LandingPage onLogin={() => window.location.assign(getAuthLoginUrl('/dashboard'))} />} />
          <Route
            path="/login"
            element={
              isMiraiGridProductionHost()
                ? <ExternalRedirect to={prodAuthUrl} />
                : <LoginPage onLoginSuccess={handleLoginSuccess} />
            }
          />
          <Route
            path="/logout"
            element={
              isMiraiGridProductionHost()
                ? <ExternalRedirect to={getAuthLogoutUrl()} />
                : <Navigate to="/login" replace />
            }
          />
          <Route
            path="*"
            element={
              isMiraiGridProductionHost()
                ? <ExternalRedirect to={getAuthLoginUrl(window.location.pathname + window.location.search)} />
                : <Navigate to="/login" replace />
            }
          />
        </Routes>
      </div>
    )
  }

  if (isMiraiGridProductionHost() && location.pathname === '/login') {
    const redirectParam = new URLSearchParams(window.location.search).get('redirect')
    return <ExternalRedirect to={getAuthLoginUrl(redirectParam)} />
  }

  if (location.pathname === '/welcome') {
    return <LandingPage onLogin={() => window.location.assign('/dashboard')} />
  }

  // 0. GATED ONBOARDING WIZARD (Pengguna baru wajib menyelesaikan onboarding sebelum bisa mengakses Dashboard & Fitur)
  const isOnboardingGated = user && user.role !== 'admin' && !user.onboarding_completed
  if (isOnboardingGated) {
    return (
      <div className="min-h-screen w-screen bg-[#F8FAFC] flex flex-col font-sans select-none m-0 p-0">
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#0F172A',
              borderRadius: '12px',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            },
          }}
        />
        <OnboardingWizardPage user={user} onComplete={handleOnboardingComplete} />
      </div>
    )
  }

  // 1. STANDALONE /files ROUTE -> REDIRECT TO WORKSPACE FILE MANAGER
  const isStandaloneFilesView = location.pathname.startsWith('/files')
  if (isStandaloneFilesView) {
    const searchParams = new URLSearchParams(location.search)
    const targetSubpath = (searchParams.get('path') || searchParams.get('dir') || '').replace(/^\/+|\/+$/g, '')
    const baseFilesRoute = user?.role === 'admin' ? '/dashboard' : '/workspace/files'
    return <Navigate to={targetSubpath ? `${baseFilesRoute}?path=${encodeURIComponent(targetSubpath)}` : baseFilesRoute} replace />
  }

  // 2. STANDALONE LAYOUT FOR WEB IDE (VS CODE SERVER) (Tampilan Terpisah Bebas Distraksi Tanpa Sidebar & Header Utama)
  const isStandaloneIDE = location.pathname.startsWith('/vscode')
  if (isStandaloneIDE) {
    return (
      <div className="h-screen w-screen bg-[#F8FAFC] flex flex-col font-sans overflow-hidden select-none m-0 p-0">
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#0F172A',
              borderRadius: '12px',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            },
          }}
        />
        <VSCodeView user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} isStandalone={true} />
      </div>
    )
  }

  // 3. STANDALONE LAYOUT FOR THINGSBOARD IOT PLATFORM
  const isStandaloneThingsBoard = location.pathname.startsWith('/thingsboard')
  if (isStandaloneThingsBoard) {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col font-sans select-none m-0 p-0">
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#0F172A',
              borderRadius: '12px',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            },
          }}
        />
        <ThingsBoardView user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} isStandalone={true} />
      </div>
    )
  }
  // 2. MAIN LAYOUT WITH FLOATING SIDEBAR (V2 Only)
  return (
    <ThemeProvider value={themeContextValue}>
      <UploadProvider>
      <div className="min-h-screen mig-shell-canvas bg-[#F8FAFC] text-gray-900 selection:bg-emerald-100 selection:text-emerald-900 flex flex-col font-sans relative">
      <Toaster
        richColors
        position="top-right"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            color: '#0F172A',
            borderRadius: '12px',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          },
        }}
      />

      {/* Floating Navigation Sidebar & Mobile Bar */}
      <NavigationV2
        userRole={user.role}
        isCollapsed={isCollapsed}
        setIsCollapsed={handleToggleCollapse}
        quota={userQuota}
        onOpenResources={() => navigate('/resources')}
        mobileOpen={mobileNavOpen}
        setMobileOpen={setMobileNavOpen}
      />

      {/* Top Header Bar (V2 Clean Cloud Header) */}
      <header
        className={`h-14 bg-[#F8FAFC]/95 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-6 flex items-center justify-between transition-all duration-300 ease-in-out ${
          isCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        <div className="flex items-center space-x-3">
          {/* Mobile Hamburger */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            title="Buka Menu Navigasi"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop Sidebar Expand Toggle Button in Header (shown ONLY when collapsed) */}
          {isCollapsed && (
            <button
              type="button"
              onClick={() => handleToggleCollapse(false)}
              className="hidden md:flex p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition shrink-0"
              title="Perlebar Sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Right actions: Profile Avatar */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0 ml-auto">
          <ProfileAvatar
            user={user}
            onLogout={handleLogout}
            onOpenProfile={() => navigate('/profile')}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className={`flex-1 transition-all duration-300 ease-in-out mig-shell-canvas bg-transparent px-3 sm:px-4 md:pl-1 md:pr-4 pb-20 md:pb-4 pt-0 ${
          isCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        <div
          className={
            location.pathname === '/workspace/files' || (user?.role === 'admin' && (location.pathname === '/dashboard' || location.pathname === '/'))
              ? 'mig-main-card w-full h-[calc(100vh-4.5rem)] bg-white rounded-2xl border border-slate-200/80 overflow-hidden flex flex-col p-0'
              : 'mig-main-card w-full h-[calc(100vh-4.5rem)] bg-white rounded-2xl border border-slate-200/80 overflow-y-auto overflow-x-hidden flex flex-col p-4 sm:p-6 md:p-7'
          }
        >
          {/* Declarative URL Routes */}
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                user?.role === 'admin' ? (
                  <DashboardV2
                    user={user}
                    onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    onOpenResources={() => navigate('/resources')}
                  />
                ) : new URLSearchParams(location.search).get('path') ? (
                  <Navigate to={`/workspace/files${location.search}`} replace />
                ) : (
                  <UserDashboardPage user={user} />
                )
              }
            />
            <Route
              path="/workspace/files"
              element={
                <DashboardV2
                  user={user}
                  onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onOpenResources={() => navigate('/resources')}
                />
              }
            />
            <Route path="/deploy/*" element={<ProjectsView user={user} />} />
            <Route path="/databases" element={<DatabasesView />} />
            <Route
              path="/disk-usage"
              element={<DiskUsagePage user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/remote-database"
              element={<RemoteDatabasePage user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/database-wizard"
              element={<DatabaseWizardPage user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/git/*"
              element={<GitVersionControlView user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/tools/git/*"
              element={<GitVersionControlView user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/terminal"
              element={<TerminalPage user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/ssh"
              element={<SSHAccessPage user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/cron"
              element={<CronJobsPage user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/thingsboard"
              element={<ThingsBoardView user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/jupyter"
              element={<JupyterView user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/n8n"
              element={<N8nView user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/redis"
              element={<RedisView user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/cron-jobs"
              element={<Navigate to="/cron" replace />}
            />
            <Route
              path="/resources"
              element={<StudentResourcesPage user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/dashboard/resources"
              element={<Navigate to="/resources" replace />}
            />
            <Route
              path="/about"
              element={<AboutPage user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route
              path="/admin/dashboard/containers/:username"
              element={user.role === 'admin' ? (
                <ErrorBoundary>
                  <AdminContainerDetailPage />
                </ErrorBoundary>
              ) : (
                <Navigate to="/dashboard" replace />
              )}
            />
            <Route
              path="/admin/dashboard"
              element={user.role === 'admin' ? (
                <ErrorBoundary>
                  <AdminDashboardPage user={user} />
                </ErrorBoundary>
              ) : (
                <Navigate to="/dashboard" replace />
              )}
            />
            <Route
              path="/profile"
              element={
                <ErrorBoundary>
                  <ProfilePage user={user} onUserUpdated={(u) => setUser(u)} />
                </ErrorBoundary>
              }
            />
            <Route
              path="/report"
              element={
                <ErrorBoundary>
                  <ReportIssuePage user={user} />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/waf"
              element={user.role === 'admin' ? (
                <ErrorBoundary>
                  <AdminWafPage />
                </ErrorBoundary>
              ) : (
                <Navigate to="/dashboard" replace />
              )}
            />
            <Route
              path="/admin/reports"
              element={user.role === 'admin' ? (
                <ErrorBoundary>
                  <AdminReportsPage />
                </ErrorBoundary>
              ) : (
                <Navigate to="/dashboard" replace />
              )}
            />
            <Route
              path="/admin/subdomains"
              element={user.role === 'admin' ? (
                <ErrorBoundary>
                  <AdminSubdomainsPage />
                </ErrorBoundary>
              ) : (
                <Navigate to="/dashboard" replace />
              )}
            />
            <Route
              path="/admin"
              element={user.role === 'admin' ? (
                <ErrorBoundary>
                  <AdminView onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />
                </ErrorBoundary>
              ) : (
                <Navigate to="/dashboard" replace />
              )}
            />
            <Route
              path="/admin/users/:userId/config"
              element={user.role === 'admin' ? (
                <ErrorBoundary>
                  <AccountConfigPage user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />
                </ErrorBoundary>
              ) : (
                <Navigate to="/dashboard" replace />
              )}
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>

      {/* Password Change Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        isMandatory={isMandatoryPasswordChange}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={handlePasswordChanged}
      />

      {/* Resource Detail Modal for v2 (MiG-Cloud) */}
      <ResourceDetailModal
        isOpen={showResourceModal}
        onClose={() => setShowResourceModal(false)}
        quota={userQuota}
        user={user}
      />

      {/* Global Google Drive Style Floating Upload Manager & Navigation Guard Modal */}
      <FloatingUploadManager />
    </div>
      </UploadProvider>
    </ThemeProvider>
  )
}
