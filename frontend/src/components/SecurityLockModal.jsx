import React from 'react'
import { ShieldAlert, RefreshCw, LogIn } from 'lucide-react'

export default function SecurityLockModal({ reason, onReset }) {
  if (!reason) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#1C0F0A] border-2 border-rose-600/60 rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="h-16 w-16 rounded-3xl bg-rose-600/20 border border-rose-500/40 text-rose-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-700/60 inline-block mb-3">
          PAAS ISOLATION SHIELD ACTIVE
        </span>

        <h3 className="text-lg font-serif font-bold text-[#FAF5EC] mb-2">
          Upaya Manipulasi Rute Terdeteksi
        </h3>

        <p className="text-xs text-[#DFCDB5] leading-relaxed mb-4">
          Sistem keamanan MiraiGrid mendeteksi perubahan parameter URL, traversal path, atau upaya forging rute yang tidak sah:
        </p>

        <div className="p-3 bg-[#140A07] border border-rose-900/60 rounded-xl text-left text-xs font-mono text-rose-300 mb-6 break-all">
          {reason}
        </div>

        <p className="text-[11px] text-[#A47E65] mb-6">
          Sesi Anda telah dibekukan demi melindungi integritas container &amp; data mahasiswa lain.
        </p>

        <button
          type="button"
          onClick={onReset}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-xs shadow-lg transition flex items-center justify-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Muat Ulang &amp; Login Ulang</span>
        </button>
      </div>
    </div>
  )
}