import React from 'react'
import { Server, User, LogOut, Shield, Key } from 'lucide-react'

export default function Navbar({ user, onLogout, onChangePassword }) {
  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center space-x-3">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
          <Server className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            MiraiGrid
          </h1>
          <p className="text-[10px] text-sky-400 font-medium tracking-wider uppercase -mt-0.5">
            Lab Teknik Informatika UMPO
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3 bg-slate-950/60 px-3 py-1.5 rounded-full border border-slate-800/80">
          <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
            {user?.role === 'admin' ? <Shield className="h-3.5 w-3.5 text-amber-400" /> : <User className="h-3.5 w-3.5 text-sky-400" />}
          </div>
          <div className="text-left text-xs pr-1">
            <span className="font-semibold text-slate-200 block leading-tight">{user?.name}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {user?.role === 'admin' ? 'Administrator' : `NIM: ${user?.username}`}
            </span>
          </div>
        </div>

        <button
          onClick={onChangePassword}
          title="Ganti Password"
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
        >
          <Key className="h-4 w-4" />
        </button>

        <button
          onClick={onLogout}
          title="Keluar"
          className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
