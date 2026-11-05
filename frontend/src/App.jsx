import React, { useState, useEffect } from 'react'
import { Toaster } from 'sonner'
import Navigation from './components/Navigation'
import ProfileFloating from './components/ProfileFloating'
import ChangePasswordModal from './components/ChangePasswordModal'
import LoginPage from './pages/LoginPage'
import StudentDashboard from './pages/StudentDashboard'
import ProjectsView from './pages/ProjectsView'
import DatabasesView from './pages/DatabasesView'
import AdminView from './pages/AdminView'

export default function App() {
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
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
  }

  const handleLogout = () => {
    localStorage.removeItem('miraigrid_token')
    localStorage.removeItem('miraigrid_user')
    setUser(null)
    setActiveTab('dashboard')
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
      <>
        <Toaster richColors position="top-right" theme="dark" />
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F1E8] text-[#2C1910] flex flex-col font-sans selection:bg-terracotta-500 selection:text-white relative">
      {/* Toast Notification Container */}
      <Toaster
        richColors
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#23150E',
            border: '1px solid #3E2619',
            color: '#FAF8F5',
            borderRadius: '16px',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          },
        }}
      />

      {/* Floating Profile Avatar (Pojok Kanan Atas) */}
      <ProfileFloating
        user={user}
        onLogout={handleLogout}
        onChangePassword={() => {
          setIsMandatoryPasswordChange(false)
          setShowPasswordModal(true)
        }}
      />

      {/* Floating Navigation (Sidebar Mengambang di Kiri + Floating Nav di Mobile) */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={user.role}
        isCollapsed={isCollapsed}
        setIsCollapsed={handleToggleCollapse}
      />

      {/* Main Content: Margin menyesuaikan sidebar secara dinamis dan mulus */}
      <main
        className={`flex-1 transition-all duration-300 ease-in-out p-4 sm:p-6 md:p-8 md:pr-24 pb-24 md:pb-12 ${
          isCollapsed ? 'md:ml-[110px]' : 'md:ml-[290px]'
        }`}
      >
        <div className="max-w-6xl mx-auto pt-14 md:pt-4">
          {activeTab === 'dashboard' && (
            <StudentDashboard user={user} onNavigate={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === 'projects' && <ProjectsView />}
          {activeTab === 'databases' && <DatabasesView />}
          {activeTab === 'admin' && user.role === 'admin' && <AdminView />}
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
