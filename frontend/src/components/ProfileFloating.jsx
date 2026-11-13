import React, { useState, useRef, useEffect } from 'react'
import { Key, LogOut } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ProfileAvatar({ user, onLogout, onChangePassword }) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)
  const { isV2 } = useTheme()

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
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Circular Avatar Button */}
      <button
        onClick={() => setOpen(!open)}
        title={user?.name}
        className={
          isV2
            ? 'h-9 w-9 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-sm flex items-center justify-center border border-slate-700 shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-slate-400'
            : 'h-10 w-10 rounded-full bg-[#2B1810] hover:bg-[#3D2317] text-[#FAF5EC] font-serif font-bold text-base flex items-center justify-center border-2 border-[#5A3521] shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#8A5132]'
        }
      >
        <span>{initial}</span>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div
          className={
            isV2
              ? 'absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 text-slate-900 animate-in fade-in zoom-in-95 duration-150'
              : 'absolute right-0 mt-2.5 w-60 bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-4 z-50 text-[#FAF5EC] animate-in fade-in zoom-in-95 duration-150'
          }
        >
          <div
            className={
              isV2
                ? 'pb-2.5 mb-2 border-b border-slate-100 flex items-center space-x-3'
                : 'pb-3 mb-2 border-b border-[#3E2316] flex items-center space-x-3'
            }
          >
            <div
              className={
                isV2
                  ? 'h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-sans font-bold text-xs text-slate-700'
                  : 'h-9 w-9 rounded-full bg-[#1C0F0A] border border-[#5A3521] flex items-center justify-center font-serif font-bold text-sm text-[#E8DCB8]'
              }
            >
              {initial}
            </div>
            <div className="overflow-hidden">
              <p
                className={
                  isV2
                    ? 'text-xs font-bold text-slate-900 truncate'
                    : 'text-xs font-bold text-[#FAF5EC] truncate'
                }
              >
                {user?.name}
              </p>
              <p
                className={
                  isV2
                    ? 'text-[10px] text-slate-500 font-mono truncate'
                    : 'text-[10px] text-[#DFCDB5]/70 font-mono truncate'
                }
              >
                {isAdmin ? 'Administrator Lab' : `NIM: ${user?.username}`}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => {
                setOpen(false)
                onChangePassword()
              }}
              className={
                isV2
                  ? 'w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition'
                  : 'w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#DFCDB5] hover:bg-[#3A2115] hover:text-[#FAF5EC] transition'
              }
            >
              <Key className={isV2 ? 'h-4 w-4 text-slate-500' : 'h-4 w-4 text-[#E8DCB8]'} />
              <span>Ganti Password</span>
            </button>

            <button
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              className={
                isV2
                  ? 'w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition'
                  : 'w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition'
              }
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
