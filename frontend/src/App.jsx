import React, { useState, useEffect, useMemo } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Search, X, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { ThemeProvider } from './context/ThemeContext'
import { UploadProvider } from './context/UploadContext'
import FloatingUploadManager from './components/FloatingUploadManager'
import Navigation from './components/Navigation'
import NavigationV2 from './components/NavigationV2'
import ThemeToggle from './components/ThemeToggle'
import ResourceDetailModal from './components/ResourceDetailModal'
import ProfileAvatar from './components/ProfileFloating'
import ChangePasswordModal from './components/ChangePasswordModal'
import LoginPage from './pages/LoginPage'
import StudentDashboard from './pages/StudentDashboard'
import DashboardV2 from './pages/DashboardV2'
import ProjectsView from './pages/ProjectsView'
import DatabasesView from './pages/DatabasesView'
import FilesView from './pages/FilesView'
import AdminView from './pages/AdminView'
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
import OnboardingWizardPage from './pages/OnboardingWizardPage'
import ErrorBoundary from './components/ErrorBoundary'
import { syncPageRoute, checkUrlTampering, triggerRouteSecurityAlarm } from './utils/securityRoute'
import SecurityLockModal from './components/SecurityLockModal'
import { api } from './api/client'

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [isMandatoryPasswordChange, setIsMandatoryPasswordChange] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('miraigrid_sidebar_collapsed') === 'true'
  })
  const [securityBreach, setSecurityBreach] = useState(null)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('miraigrid_theme_mode') || 'v1'
  })
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [userQuota, setUserQuota] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (theme === 'v2') {
      document.documentElement.classList.add('theme-v2', 'theme-mig-cloud')
      document.body.classList.add('theme-v2', 'theme-mig-cloud')
      document.documentElement.classList.remove('bg-[#E6D7BE]')
      document.body.classList.remove('bg-[#E6D7BE]')
    } else {
      document.documentElement.classList.remove('theme-v2', 'theme-mig-cloud')
      document.body.classList.remove('theme-v2', 'theme-mig-cloud')
      document.documentElement.classList.add('bg-[#E6D7BE]')
      document.body.classList.add('bg-[#E6D7BE]')
    }
  }, [theme])

  const handleToggleTheme = () => {
    const nextTheme = theme === 'v1' ? 'v2' : 'v1'
    setTheme(nextTheme)
    setSearchQuery('')
    localStorage.setItem('miraigrid_theme_mode', nextTheme)
  }

  const themeContextValue = useMemo(() => ({
    theme,
    isV2: theme === 'v2',
    toggleTheme: handleToggleTheme,
    setTheme,
  }), [theme])

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

    if (user && !location.pathname.startsWith('/files') && !location.pathname.startsWith('/vscode') && !location.pathname.startsWith('/thingsboard')) {
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
    }
  }, [])

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
    if (data.must_change_password) {
      setIsMandatoryPasswordChange(true)
      setShowPasswordModal(true)
    }
    if (userData.role !== 'admin' && !userData.onboarding_completed) {
      navigate('/onboarding')
    } else {
      navigate('/dashboard')
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
    setUser(null)
    navigate('/login')
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
    return <SecurityLockModal reason={securityBreach} onReset={() => window.location.href = '/login'} />
  }

  if (!user) {
    return (
      <div className="bg-[#E6D7BE] min-h-screen">
        <Toaster
          richColors
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: '#2B1810',
              border: '1px solid #5A3521',
              color: '#FAF5EC',
              borderRadius: '18px',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
          <Route path="*" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
        </Routes>
      </div>
    )
  }

  // 0. GATED ONBOARDING WIZARD (Pengguna baru wajib menyelesaikan onboarding sebelum bisa mengakses Dashboard & Fitur)
  const isOnboardingGated = user && user.role !== 'admin' && !user.onboarding_completed
  if (isOnboardingGated) {
    return (
      <div className="min-h-screen w-screen bg-[#E6D7BE] flex flex-col font-sans select-none m-0 p-0">
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            style: {
              background: '#2B1810',
              border: '1px solid #5A3521',
              color: '#FAF5EC',
              borderRadius: '18px',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            },
          }}
        />
        <OnboardingWizardPage user={user} onComplete={handleOnboardingComplete} />
      </div>
    )
  }

  // 1. STANDALONE LAYOUT FOR FILE MANAGER (Latar Belakang Krim Cerah Sesuai Dasbor)
  const isStandaloneFilesView = location.pathname.startsWith('/files')
  if (isStandaloneFilesView) {
    if (theme === 'v2') {
      return <Navigate to="/dashboard" replace />
    }
    return (
      <UploadProvider>
        <div className="h-screen w-screen bg-[#E6D7BE] p-2.5 sm:p-4 md:p-6 flex flex-col font-sans overflow-hidden select-none m-0">
          <Toaster
            richColors
            position="top-right"
            toastOptions={{
              style: {
                background: '#2B1810',
                border: '1px solid #5A3521',
                color: '#FAF5EC',
                borderRadius: '18px',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              },
            }}
          />
          <FilesView onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} isStandalone={true} />
          <FloatingUploadManager />
        </div>
      </UploadProvider>
    )
  }

  // 2. STANDALONE LAYOUT FOR WEB IDE (VS CODE SERVER) (Tampilan Terpisah Bebas Distraksi Tanpa Sidebar & Header Utama)
  const isStandaloneIDE = location.pathname.startsWith('/vscode')
  if (isStandaloneIDE) {
    return (
      <div className="h-screen w-screen bg-[#1E110A] flex flex-col font-sans overflow-hidden select-none m-0 p-0">
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            style: {
              background: '#2B1810',
              border: '1px solid #5A3521',
              color: '#FAF5EC',
              borderRadius: '18px',
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
      <div className="min-h-screen w-full bg-[#E6D7BE] flex flex-col font-sans selection:bg-[#5A3521] selection:text-[#FAF5EC] select-none m-0 p-0">
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            style: {
              background: '#2B1810',
              border: '1px solid #5A3521',
              color: '#FAF5EC',
              borderRadius: '18px',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            },
          }}
        />
        <ThingsBoardView user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} isStandalone={true} />
      </div>
    )
  }
  // 2. MAIN LAYOUT WITH FLOATING SIDEBAR (Untuk Dashboard, Deploy, Databases, Admin)
  const isV2 = theme === 'v2'

  return (
    <ThemeProvider value={themeContextValue}>
      <UploadProvider>
      <div
        className={`min-h-screen ${
          isV2
            ? 'mig-shell-canvas bg-[#F8FAFC] text-gray-900 selection:bg-emerald-100 selection:text-emerald-900'
            : 'bg-[#E6D7BE] text-[#26160F] selection:bg-[#5A3521] selection:text-[#FAF5EC]'
        } flex flex-col font-sans relative transition-colors duration-300`}
      >
      <Toaster
        richColors
        position="top-right"
        toastOptions={
          isV2
            ? {
                style: {
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  color: '#111827',
                  borderRadius: '16px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08)',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                },
              }
            : {
                style: {
                  background: '#2B1810',
                  border: '1px solid #5A3521',
                  color: '#FAF5EC',
                  borderRadius: '18px',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                },
              }
        }
      />

      {/* Floating Navigation Sidebar & Mobile Bar */}
      {isV2 ? (
        <NavigationV2
          userRole={user.role}
          isCollapsed={isCollapsed}
          setIsCollapsed={handleToggleCollapse}
          quota={userQuota}
          onOpenResources={() => navigate('/resources')}
          mobileOpen={mobileNavOpen}
          setMobileOpen={setMobileNavOpen}
        />
      ) : (
        <Navigation
          userRole={user.role}
          isCollapsed={isCollapsed}
          setIsCollapsed={handleToggleCollapse}
        />
      )}

      {/* Top Header Bar for Theme V2 (Floating Transparent Cloud Header - Zero Border) */}
      {isV2 && (
        <header
          className={`h-14 bg-[#F8FAFC]/95 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-6 flex items-center justify-between transition-all duration-300 ease-in-out ${
            isCollapsed ? 'md:ml-20' : 'md:ml-64'
          }`}
        >
          <div className="flex items-center space-x-3">
            {/* Mobile Hamburger on v2 */}
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

          {/* Right actions: Theme Toggle + Profile Avatar */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0 ml-auto">
            <ThemeToggle theme={theme} onToggle={handleToggleTheme} />
            <ProfileAvatar
              user={user}
              onLogout={handleLogout}
              onChangePassword={() => {
                setIsMandatoryPasswordChange(false)
                setShowPasswordModal(true)
              }}
            />
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isV2
            ? `mig-shell-canvas bg-transparent px-3 sm:px-4 md:pl-1 md:pr-4 pb-20 md:pb-4 pt-0 ${
                isCollapsed ? 'md:ml-20' : 'md:ml-64'
              }`
            : `p-4 sm:p-6 md:p-8 pb-24 md:pb-12 ${
                isCollapsed ? 'md:ml-[110px]' : 'md:ml-[290px]'
              }`
        }`}
      >
        <div
          className={
            isV2
              ? 'mig-main-card w-full min-h-[calc(100vh-4.5rem)] bg-white rounded-2xl border border-slate-200/80 overflow-hidden flex flex-col p-4 sm:p-6 md:p-7'
              : 'w-full'
          }
        >
          {/* Header Navbar for V1 ONLY */}
          {!isV2 && (
            <header className="flex items-center justify-between gap-4 pb-5 pt-1">
              <div className="flex items-center space-x-3 w-full max-w-sm sm:max-w-md">
                <div className="relative w-full">
                  <Search className="h-4 w-4 absolute left-3.5 top-2.5 text-[#A47E65]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      if (location.pathname !== '/dashboard' && e.target.value) {
                        navigate('/dashboard')
                      }
                    }}
                    placeholder="Cari tools, php, python, file, wizard (/)..."
                    className="w-full bg-[#2B1810] border-[#4D2D1E] focus:border-[#C49767] text-[#FAF5EC] placeholder-[#A47E65] border rounded-2xl pl-10 pr-9 py-2 text-xs outline-none transition shadow-sm font-sans"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2 text-[#A47E65] hover:text-[#FAF5EC] p-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Right actions: Theme Toggle + Profile Avatar */}
              <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0">
                <ThemeToggle theme={theme} onToggle={handleToggleTheme} />
                <ProfileAvatar
                  user={user}
                  onLogout={handleLogout}
                  onChangePassword={() => {
                    setIsMandatoryPasswordChange(false)
                    setShowPasswordModal(true)
                  }}
                />
              </div>
            </header>
          )}

          {/* Declarative URL Routes */}
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                isV2 ? (
                  <DashboardV2
                    user={user}
                    onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    onOpenResources={() => navigate('/resources')}
                  />
                ) : (
                  <StudentDashboard
                    user={user}
                    onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                  />
                )
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
