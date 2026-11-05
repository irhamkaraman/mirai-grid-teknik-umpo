import React, { useState, useEffect } from 'react'
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
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className="min-h-screen bg-warmdark-950 text-cream-100 flex flex-col font-sans selection:bg-terracotta-500 selection:text-white relative">
      {/* 1. Floating Profile Avatar (Pojok Kanan Atas) */}
      <ProfileFloating
        user={user}
        onLogout={handleLogout}
        onChangePassword={() => {
          setIsMandatoryPasswordChange(false)
          setShowPasswordModal(true)
        }}
      />

      {/* 2. Floating Navigation (Sidebar Mengambang di Kiri + Floating Nav di Mobile) */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={user.role}
      />

      {/* 3. Main Content Container */}
      <main className="flex-1 md:ml-76 transition-all duration-200 p-4 sm:p-6 md:p-8 md:pr-24 pb-24 md:pb-12">
        <div className="max-w-6xl mx-auto pt-14 md:pt-2">
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
