import React from 'react'
import {
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  AlertTriangle,
} from 'lucide-react'
import { useUpload } from '../context/UploadContext'
import ModalPortal from './ModalPortal'

export function formatUploadBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)))
  const val = bytes / Math.pow(k, i)
  const decimals = i >= 3 ? 2 : i >= 2 ? 1 : 0
  return `${parseFloat(val.toFixed(decimals))} ${sizes[i]}`
}

function getUploadFileIcon(filename = '') {
  const ext = (filename.includes('.') ? '.' + filename.split('.').pop() : '').toLowerCase()
  if (['.zip', '.tar', '.gz', '.rar', '.7z'].includes(ext)) {
    return <FileArchive className="h-5 w-5 text-amber-600 shrink-0" />
  }
  if (['.php', '.html', '.js', '.jsx', '.ts', '.tsx', '.py', '.css', '.json', '.sql', '.sh', '.env'].includes(ext)) {
    return <FileCode className="h-5 w-5 text-slate-700 shrink-0" />
  }
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.mp4'].includes(ext)) {
    return <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />
  }
  if (['.xls', '.xlsx', '.csv'].includes(ext)) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
  }
  return <FileText className="h-5 w-5 text-slate-500 shrink-0" />
}

export default function FloatingUploadManager() {
  const {
    queue,
    isMinimized,
    setIsMinimized,
    activeCount,
    completedCount,
    cancelledCount,
    errorCount,
    cancelUpload,
    removeUploadItem,
    closeQueueCard,
    pendingNav,
    confirmLeaveAndCancelUploads,
    cancelLeavePage,
  } = useUpload()

  const headerTitle = React.useMemo(() => {
    if (activeCount > 0) {
      return `Mengunggah ${activeCount} item...`
    }
    if (completedCount > 0 && cancelledCount === 0 && errorCount === 0) {
      return `${completedCount} unggahan selesai`
    }
    if (completedCount > 0) {
      return `${completedCount} selesai • ${cancelledCount + errorCount} batal/gagal`
    }
    if (cancelledCount > 0 && errorCount === 0) {
      return `${cancelledCount} unggahan dibatalkan`
    }
    return `${errorCount} unggahan gagal`
  }, [activeCount, completedCount, cancelledCount, errorCount])

  const overallPercent = React.useMemo(() => {
    if (queue.length === 0) return 0
    const totalBytes = queue.reduce((acc, it) => acc + (it.size || 0), 0)
    const loadedBytes = queue.reduce((acc, it) => acc + (it.loaded || 0), 0)
    if (totalBytes <= 0) return 0
    return Math.min(100, Math.round((loadedBytes / totalBytes) * 100))
  }, [queue])

  return (
    <>
      {/* 1. Google Drive Style Floating Upload Manager Card (Bottom-Right) */}
      {queue.length > 0 && (
        <div
          data-testid="floating-upload-manager"
          className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-slate-200/90 shadow-xl overflow-hidden font-sans select-none animate-in slide-in-from-bottom-3 duration-200"
        >
          {/* Header Card */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5 min-w-0">
              {activeCount > 0 ? (
                <Loader2 className="h-4 w-4 text-emerald-400 animate-spin shrink-0" />
              ) : cancelledCount === 0 && errorCount === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              )}
              <span className="text-xs font-semibold tracking-wide truncate" data-testid="upload-header-title">
                {headerTitle}
              </span>
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              {/* Minimize / Expand Button */}
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title={isMinimized ? 'Perbesar daftar unggahan' : 'Perkecil daftar unggahan'}
                data-testid="upload-minimize-btn"
              >
                {isMinimized ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {/* Close (X) Button - only active when all uploads finished or cancelled */}
              <button
                type="button"
                disabled={activeCount > 0}
                onClick={closeQueueCard}
                className={`p-1.5 rounded-lg transition-colors ${
                  activeCount > 0
                    ? 'text-slate-600 cursor-not-allowed opacity-50'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer'
                }`}
                title={
                  activeCount > 0
                    ? 'Tunggu hingga semua unggahan selesai atau batalkan terlebih dahulu'
                    : 'Tutup panel unggahan'
                }
                data-testid="upload-close-card-btn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Compact progress strip when minimized */}
          {isMinimized && activeCount > 0 && (
            <div className="w-full h-1 bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-150"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          )}

          {/* Body List (Linear Queue) */}
          {!isMinimized && (
            <div
              className="max-h-72 overflow-y-auto divide-y divide-slate-100 bg-white custom-scrollbar"
              data-testid="upload-queue-list"
            >
              {queue.map((item) => {
                const isUploading = item.status === 'uploading' || item.status === 'pending'
                const isExtracting = item.status === 'extracting'
                const isCompleted = item.status === 'completed'
                const isCancelled = item.status === 'cancelled'
                const isError = item.status === 'error'

                return (
                  <div
                    key={item.id}
                    data-testid={`upload-item-${item.id}`}
                    className="px-4 py-3 hover:bg-slate-50/70 transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 shrink-0">
                          {getUploadFileIcon(item.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p
                              className="text-xs font-semibold text-slate-900 truncate"
                              title={item.name}
                            >
                              {item.name}
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono truncate">
                            {item.name} • {formatUploadBytes(item.size)}
                          </p>
                        </div>
                      </div>

                      {/* Right Action: Cancel (X) button while uploading, or Status icon */}
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span
                          data-testid={`upload-percent-${item.id}`}
                          className={`text-xs font-mono font-bold ${
                            isCompleted
                              ? 'text-emerald-600'
                              : isCancelled
                              ? 'text-slate-400'
                              : isError
                              ? 'text-rose-600'
                              : 'text-slate-700'
                          }`}
                        >
                          {isCancelled ? 'Dibatalkan' : isError ? 'Gagal' : `${item.percent}%`}
                        </span>

                        {isUploading ? (
                          <button
                            type="button"
                            onClick={() => cancelUpload(item.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Batalkan unggahan ini"
                            data-testid={`upload-cancel-item-${item.id}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : isExtracting ? (
                          <Loader2 className="h-4 w-4 text-emerald-600 animate-spin" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeUploadItem(item.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Hapus dari daftar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Real-Time Smooth Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-150 ${
                          isCompleted
                            ? 'bg-emerald-500'
                            : isCancelled
                            ? 'bg-slate-300'
                            : isError
                            ? 'bg-rose-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(isUploading ? 2 : 0, item.percent)}%` }}
                      />
                    </div>

                    {/* Detailed Bytes & Speed / Status Row */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span className="truncate">
                        {isExtracting
                          ? 'Mengekstrak arsip ZIP ke workspace...'
                          : isCancelled
                          ? `Dibatalkan (${formatUploadBytes(item.loaded)} dari ${formatUploadBytes(item.size)})`
                          : isError
                          ? item.errorMessage || 'Gagal mengunggah berkas'
                          : `${formatUploadBytes(item.loaded)} dari ${formatUploadBytes(item.size)}`}
                      </span>
                      {isUploading && item.speedBps > 0 && (
                        <span className="text-emerald-700 font-semibold shrink-0 ml-2">
                          {formatUploadBytes(item.speedBps)}/dtk
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-emerald-600 font-sans font-semibold shrink-0 ml-2">
                          Selesai
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. In-App Page Navigation Warning Modal */}
      <ModalPortal isOpen={Boolean(pendingNav)}>
        {pendingNav && (
          <div
            onClick={cancelLeavePage}
            className="fixed inset-0 !mt-0 z-[10000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 text-slate-900 space-y-4"
              role="dialog"
              aria-modal="true"
              data-testid="upload-navigation-warning-modal"
            >
              <div className="flex items-start space-x-3.5">
                <div className="h-10 w-10 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    Proses Unggah Sedang Berlangsung
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Proses unggah sedang berlangsung. Yakin ingin meninggalkan halaman ini dan membatalkan unggahan?
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={cancelLeavePage}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  Tetap di Halaman Ini
                </button>
                <button
                  type="button"
                  onClick={confirmLeaveAndCancelUploads}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
                >
                  Ya, Tinggalkan & Batalkan
                </button>
              </div>
            </div>
          </div>
        )}
      </ModalPortal>
    </>
  )
}
