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
      <div className="bg-[#E6D7BE] min-h-screen">
        <Toaster richColors position="top-right" theme="dark" />
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#E6D7BE] text-[#26160F] flex flex-col font-sans selection:bg-[#5A3521] selection:text-[#FAF5EC] relative">
      {/* Toast Notification Container (Tema Coklat & Krim) */}
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

      {/* 1. Floating Profile Avatar (Pojok Kanan Atas) */}
      <ProfileFloating
        user={user}
        onLogout={handleLogout}
        onChangePassword={() => {
          setIsMandatoryPasswordChange(false)
          setShowPasswordModal(true)
        }}
      />

      {/* 2. Floating Navigation (Sidebar Mengambang Coklat di Kiri + Nav Mobile) */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={user.role}
        isCollapsed={isCollapsed}
        setIsCollapsed={handleToggleCollapse}
      />

      {/* 3. Main Content Container */}
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

      {/* 4. Password Change Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        isMandatory={isMandatoryPasswordChange}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={handlePasswordChanged}
      />
    </div>
  )
}
