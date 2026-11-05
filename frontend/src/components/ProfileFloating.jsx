import React, { useState, useRef, useEffect } from 'react'
import { Shield, User, Key, LogOut, ChevronDown } from 'lucide-react'

export default function ProfileFloating({ user, onLogout, onChangePassword }) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'
  const isAdmin = user?.role === 'admin'

  return (
    <div className="fixed top-5 right-5 z-40" ref={dropdownRef}>
      {/* Floating Circular Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center space-x-2 bg-warmdark-850/90 hover:bg-warmdark-750/90 text-cream-100 p-1.5 pr-3 rounded-full border border-warmdark-700/80 shadow-xl backdrop-blur-md transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-terracotta-500/50"
      >
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-chocolate-600 via-chocolate-700 to-warmdark-900 flex items-center justify-center font-bold text-cream-200 border border-chocolate-500/50 shadow-inner">
          {isAdmin ? <Shield className="h-4 w-4 text-terracotta-400" /> : initial}
        </div>
        <div className="text-left hidden sm:block pr-1">
          <p className="text-xs font-semibold text-cream-100 leading-tight">{user?.name?.split(' ')[0]}</p>
          <p className="text-[10px] text-cream-400/80 font-mono">{isAdmin ? 'Admin Lab' : user?.username}</p>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-cream-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Floating Dropdown Card */}
      {open && (
        <div className="absolute right-0 mt-3 w-64 bg-warmdark-850/95 border border-warmdark-700 rounded-2xl shadow-2xl p-4 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="pb-3 mb-2 border-b border-warmdark-700/60 flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-chocolate-700 flex items-center justify-center font-bold text-cream-100 text-sm border border-chocolate-500/40">
              {isAdmin ? <Shield className="h-5 w-5 text-terracotta-400" /> : initial}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-cream-100 truncate">{user?.name}</p>
              <p className="text-xs text-cream-400/80 font-mono truncate">{isAdmin ? 'Administrator' : `NIM: ${user?.username}`}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-terracotta-500/10 text-terracotta-400 border border-terracotta-500/20 uppercase tracking-wider">
                {isAdmin ? 'Akses Lab Penuh' : 'Akun Mahasiswa'}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => {
                setOpen(false)
                onChangePassword()
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-cream-200 hover:bg-warmdark-750 hover:text-white transition"
            >
              <Key className="h-4 w-4 text-cream-400" />
              <span>Ganti Password</span>
            </button>

            <button
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar Akun</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
