import React from 'react'
import { AlertTriangle } from 'lucide-react'
import ModalPortal from './ModalPortal'

export default function ConfirmModal({ isOpen, title, message, confirmText = 'Hapus', onConfirm, onClose, danger = true }) {
  return (
    <ModalPortal isOpen={isOpen}>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-[#FDFBF7] border border-[#D4C1AC] rounded-3xl shadow-2xl p-6 text-center text-[#26160F] animate-in zoom-in-95 duration-150"
        >
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center mx-auto mb-3.5">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-serif font-bold text-[#26160F] mb-1.5">{title}</h3>
          <p className="text-xs text-[#704D36] mb-6 leading-relaxed font-sans">{message}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#EFE4D2] hover:bg-[#E5D7C2] text-[#5C3B25] border border-[#D4C1AC] transition"
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
                  : 'bg-[#946132] hover:bg-[#7D5027] shadow-black/20'
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
