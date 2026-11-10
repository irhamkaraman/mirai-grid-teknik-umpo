import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import Navigation from './components/Navigation'
import ProfileAvatar from './components/ProfileFloating'
import ChangePasswordModal from './components/ChangePasswordModal'
import LoginPage from './pages/LoginPage'
import StudentDashboard from './pages/StudentDashboard'
import ProjectsView from './pages/ProjectsView'
import DatabasesView from './pages/DatabasesView'
import FilesView from './pages/FilesView'
import AdminView from './pages/AdminView'
import DiskUsagePage from './pages/DiskUsagePage'
import RemoteDatabasePage from './pages/RemoteDatabasePage'
import DatabaseWizardPage from './pages/DatabaseWizardPage'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [isMandatoryPasswordChange, setIsMandatoryPasswordChange] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('miraigrid_sidebar_collapsed') === 'true'
  })

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
    setUser({
      username: data.username,
      name: data.name,
      role: data.role,
      must_change_password: data.must_change_password,
    })
    if (data.must_change_password) {
      setIsMandatoryPasswordChange(true)
      setShowPasswordModal(true)
    }
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

  if (!user) {
    return (
      <div className="bg-[#E6D7BE] min-h-screen">
        <Toaster richColors position="top-right" theme="dark" />
        <Routes>
          <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
          <Route path="*" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
        </Routes>
      </div>
    )
  }

  // 1. STANDALONE LAYOUT FOR FILE MANAGER (Wajib Terpisah dari Layout Utama Sesuai Instruksi!)
  const isStandaloneFilesView = location.pathname.startsWith('/files')
  if (isStandaloneFilesView) {
    return (
      <div className="h-screen w-screen bg-[#1C0F0A] text-[#FAF5EC] font-sans overflow-hidden select-none m-0 p-0">
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            style: {
              background: '#2B1810',
              border: '1px solid #5A3521',
              color: '#FAF5EC',
              borderRadius: '12px',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            },
          }}
        />
        <FilesView onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} isStandalone={true} />
      </div>
    )
  }
  // 2. MAIN LAYOUT WITH FLOATING SIDEBAR (Untuk Dashboard, Deploy, Databases, Admin)
  return (
    <div className="min-h-screen bg-[#E6D7BE] text-[#26160F] flex flex-col font-sans selection:bg-[#5A3521] selection:text-[#FAF5EC] relative">
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

      {/* Floating Navigation Sidebar & Mobile Bar */}
      <Navigation
        userRole={user.role}
        isCollapsed={isCollapsed}
        setIsCollapsed={handleToggleCollapse}
      />

      {/* Main Content Area */}
      <main
        className={`flex-1 transition-all duration-300 ease-in-out p-4 sm:p-6 md:p-8 pb-24 md:pb-12 ${
          isCollapsed ? 'md:ml-[110px]' : 'md:ml-[290px]'
        }`}
      >
        <div className="max-w-6xl mx-auto">
          {/* Header Tanpa Latar Belakang Navbar: Cukup lingkaran inisial di pojok kanan atas */}
          <header className="flex items-center justify-end pb-4 pt-1">
            <ProfileAvatar
              user={user}
              onLogout={handleLogout}
              onChangePassword={() => {
                setIsMandatoryPasswordChange(false)
                setShowPasswordModal(true)
              }}
            />
          </header>

          {/* Declarative URL Routes */}
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={<StudentDashboard user={user} onNavigate={(path) => navigate(path.startsWith('/') ? path : '/' + path)} />}
            />
            <Route path="/deploy/*" element={<ProjectsView />} />
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
              path="/admin"
              element={user.role === 'admin' ? (
                <ErrorBoundary>
                  <AdminView />
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
    </div>
  )
}
