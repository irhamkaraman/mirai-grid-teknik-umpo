import React from 'react'
import { LayoutDashboard, Layers, Database, ShieldAlert } from 'lucide-react'

export default function Sidebar({ activeTab, setActiveTab, userRole }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects & Deploy', icon: Layers },
    { id: 'databases', label: 'Databases', icon: Database },
  ]

  if (userRole === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin Lab Panel', icon: ShieldAlert })
  }

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-[calc(100vh-4rem)] p-4 shrink-0">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
          Menu Utama
        </p>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition duration-150 ${
                isActive
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-auto p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400">
        <p className="font-semibold text-slate-300">Server Lab TI</p>
        <p className="text-[11px] text-slate-500 mt-0.5">Host: 76.76.76.189</p>
        <div className="flex items-center space-x-1.5 mt-2 text-[10px] text-emerald-400 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Docker & Portainer Ready</span>
        </div>
      </div>
    </aside>
  )
}
