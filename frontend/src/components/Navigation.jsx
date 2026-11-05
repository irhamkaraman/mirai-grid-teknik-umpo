import React from 'react'
import { LayoutDashboard, Layers, Database, ShieldAlert, Server, ChevronLeft, ChevronRight } from 'lucide-react'

export default function Navigation({ activeTab, setActiveTab, userRole, isCollapsed, setIsCollapsed }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects & Deploy', icon: Layers },
    { id: 'databases', label: 'Databases', icon: Database },
  ]

  if (userRole === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin Lab', icon: ShieldAlert })
  }

  return (
    <>
      {/* 1. FLOATING SIDEBAR (Desktop / Tablet) */}
      <aside
        className={`fixed left-5 top-5 bottom-5 bg-[#23150E] border border-[#3E2619] rounded-3xl shadow-2xl p-4 z-30 hidden md:flex flex-col backdrop-blur-xl transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20 items-center' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className={`flex items-center mb-6 w-full ${isCollapsed ? 'justify-center' : 'justify-between px-1'}`}>
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-chocolate-700 via-chocolate-600 to-terracotta-500 flex items-center justify-center text-[#FBF9F5] shadow-md border border-chocolate-500/30 shrink-0">
              <Server className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <h1 className="text-xl font-serif font-bold text-[#FBF9F5] tracking-wide truncate">
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

        {/* Navigation Items */}
        <nav className="space-y-2 flex-1 w-full">
          {!isCollapsed && (
            <p className="text-[10px] font-semibold text-cream-400/50 uppercase tracking-wider px-3 mb-2">
              Menu Utama
            </p>
          )}

          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-2xl text-xs font-semibold transition-all duration-200 group ${
                  isCollapsed ? 'justify-center p-3' : 'space-x-3 px-3.5 py-3'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-chocolate-700 to-chocolate-600 text-[#FAF8F5] border border-chocolate-500/50 shadow-md shadow-chocolate-950/40'
                    : 'text-[#D0B8A2] hover:text-white hover:bg-[#301C12]'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    isActive ? 'text-terracotta-400' : 'text-cream-400/70 group-hover:text-cream-200'
                  }`}
                />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* 2. FLOATING BOTTOM NAVIGATION (Mobile) */}
      <nav className="fixed bottom-4 left-4 right-4 z-40 md:hidden bg-[#23150E]/95 backdrop-blur-xl border border-[#3E2619] rounded-2xl shadow-2xl px-2 py-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive ? 'text-terracotta-400' : 'text-[#D0B8A2]/70 hover:text-[#FAF8F5]'
              }`}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
