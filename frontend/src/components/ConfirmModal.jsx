import React from 'react'
import { AlertTriangle } from 'lucide-react'
import ModalPortal from './ModalPortal'

export default function ConfirmModal({ isOpen, title, message, confirmText = 'Hapus', onConfirm, onClose, danger = true }) {
  return (
    <ModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-sm bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 text-center text-[#FAF5EC]">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3.5">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-serif font-bold text-[#FAF5EC] mb-1.5">{title}</h3>
          <p className="text-xs text-[#DFCDB5] mb-6 leading-relaxed font-sans">{message}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] transition"
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
                  : 'bg-[#5A3521] hover:bg-[#6D4029] shadow-black/20'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
