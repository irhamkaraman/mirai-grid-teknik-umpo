import React from 'react'
import { LayoutDashboard, Layers, Database, ShieldAlert, Server } from 'lucide-react'

export default function Navigation({ activeTab, setActiveTab, userRole }) {
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
      {/* 1. FLOATING SIDEBAR (Desktop / Tablet Landscape) */}
      <aside className="fixed left-5 top-5 bottom-5 w-64 bg-warmdark-850/90 border border-warmdark-700/70 rounded-3xl shadow-2xl p-5 z-30 hidden md:flex flex-col backdrop-blur-xl transition-all">
        {/* Brand Header */}
        <div className="flex items-center space-x-3 mb-8 px-1">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-chocolate-700 via-chocolate-600 to-terracotta-500 flex items-center justify-center text-cream-50 shadow-md shadow-chocolate-950/40 border border-chocolate-500/30 shrink-0">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-bold text-cream-50 tracking-wide">
              MiraiGrid
            </h1>
            <p className="text-[10px] text-terracotta-400 font-medium tracking-wider uppercase">
              Lab Teknik Informatika
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5 flex-1">
          <p className="text-[11px] font-semibold text-cream-400/60 uppercase tracking-wider px-3 mb-2.5">
            Navigasi
          </p>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-chocolate-700/80 to-chocolate-600/80 text-cream-100 border border-chocolate-500/50 shadow-lg shadow-chocolate-950/30'
                    : 'text-cream-300 hover:text-white hover:bg-warmdark-750/70'
                }`}
              >
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    isActive ? 'text-terracotta-400' : 'text-cream-400 group-hover:text-cream-200'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Server Status Footer */}
        <div className="p-4 rounded-2xl bg-warmdark-900/80 border border-warmdark-750/80 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-cream-200 text-xs">Infrastruktur Lab</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <p className="text-[11px] text-cream-400/70 font-mono">Host: 76.76.76.189</p>
          <p className="text-[10px] text-cream-400/50 mt-1">Docker • Portainer CE</p>
        </div>
      </aside>

      {/* 2. FLOATING BOTTOM NAVIGATION (Mobile Screen) */}
      <nav className="fixed bottom-4 left-4 right-4 z-40 md:hidden bg-warmdark-850/95 backdrop-blur-xl border border-warmdark-700/80 rounded-2xl shadow-2xl px-2 py-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive ? 'text-terracotta-400' : 'text-cream-400/80 hover:text-cream-200'
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
