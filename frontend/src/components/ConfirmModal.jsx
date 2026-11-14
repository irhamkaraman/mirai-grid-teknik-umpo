import React from 'react'
import { AlertTriangle } from 'lucide-react'
import ModalPortal from './ModalPortal'
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
  return (
    <ModalPortal isOpen={isOpen}>
      <div
        onClick={onClose}
        className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-900 animate-in zoom-in-95 duration-150 font-sans"
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
