import React from 'react'
import { ShieldAlert, RefreshCw, LogIn } from 'lucide-react'

export default function SecurityLockModal({ reason, onReset }) {
  if (!reason) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-sans">
      <div className="w-full max-w-md bg-white border border-rose-200 rounded-xl p-6 text-center animate-in zoom-in-95 duration-200">
        <div className="h-14 w-14 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-block mb-3">
          PAAS ISOLATION SHIELD ACTIVE
        </span>

        <h3 className="text-lg font-bold text-slate-900 mb-2">
          Upaya Manipulasi Rute Terdeteksi
        </h3>

        <p className="text-xs text-slate-600 leading-relaxed mb-4">
          Sistem keamanan MiraiGrid mendeteksi perubahan parameter URL, traversal path, atau upaya forging rute yang tidak sah:
        </p>

        <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg text-left text-xs font-mono text-rose-700 mb-6 break-all">
          {reason}
        </div>

        <p className="text-[11px] text-slate-500 mb-6">
          Sesi Anda telah dibekukan demi melindungi integritas container &amp; data mahasiswa lain.
        </p>

        <button
          type="button"
          onClick={onReset}
          className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition flex items-center justify-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Muat Ulang &amp; Login Ulang</span>
        </button>
      </div>
    </div>
  )
}