import React from 'react'
import { AlertTriangle } from 'lucide-react'
import ModalPortal from './ModalPortal'
import { useTheme } from '../context/ThemeContext'
import Button from './Button'

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Hapus',
  onConfirm,
  onClose,
  danger = true,
}) {
  const { isV2 } = useTheme()

  if (isV2) {
    return (
      <ModalPortal isOpen={isOpen}>
        <div
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-6 text-center text-slate-900 animate-in zoom-in-95 duration-150 font-sans"
          >
            <div className="h-12 w-12 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3.5">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">{title}</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">{message}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={onClose}
                className="w-full"
              >
                Batal
              </Button>
              <Button
                variant={danger ? 'danger-solid' : 'primary'}
                size="md"
                onClick={() => {
                  onConfirm()
                  onClose()
                }}
                className="w-full"
              >
                {confirmText}
              </Button>
            </div>
          </div>
        </div>
      </ModalPortal>
    )
  }

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
