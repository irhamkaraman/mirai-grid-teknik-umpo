import React from 'react'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmModal({ isOpen, title, message, confirmText = 'Hapus', onConfirm, onClose, danger = true }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-[#23150E] border border-[#3E2619] rounded-3xl shadow-2xl p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3.5">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-serif font-bold text-[#F8F5EE] mb-1.5">{title}</h3>
        <p className="text-xs text-[#DFC6AF] mb-6 leading-relaxed">{message}</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#2E1D13] hover:bg-[#3B2519] text-[#DFC6AF] transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`w-full py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg transition ${
              danger
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/30'
                : 'bg-chocolate-600 hover:bg-chocolate-500 shadow-chocolate-900/30'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
