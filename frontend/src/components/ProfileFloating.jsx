import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { User, LogOut, LifeBuoy } from 'lucide-react'

export default function ProfileAvatar({ user, onLogout, onOpenProfile }) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const isOnReport = location.pathname.startsWith('/report')

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
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={() => navigate('/report')}
        title="Laporkan kendala ke tim pengembang"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
          isOnReport
            ? 'bg-slate-900 text-white border-slate-900'
            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80'
        }`}
      >
        <LifeBuoy className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">Terjadi Masalah?</span>
      </button>

      <div className="relative inline-block text-left" ref={dropdownRef}>
        {/* Circular Avatar Button */}
        <button
          onClick={() => setOpen(!open)}
          title={user?.name}
          className="h-9 w-9 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-sm flex items-center justify-center border border-slate-700 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <span>{initial}</span>
        </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl p-3 z-50 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
          <div className="pb-2.5 mb-2 border-b border-slate-100 flex items-center space-x-3">
            <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-sans font-bold text-xs text-slate-700">
              {initial}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-900 truncate">
                {user?.name}
              </p>
              <p className="text-[10px] text-slate-500 font-mono truncate">
                {isAdmin ? 'Administrator Lab' : `NIM: ${user?.username}`}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => {
                setOpen(false)
                if (onOpenProfile) onOpenProfile()
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <User className="h-4 w-4 text-slate-500" />
              <span>Profil Anda</span>
            </button>

            <button
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar Akun</span>
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
