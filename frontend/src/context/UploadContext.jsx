import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { api } from '../api/client'

const UploadContext = createContext(null)

/**
 * Low-level XMLHttpRequest + AbortController upload engine with real-time progress
 */
export function uploadFileWithProgress({
  file,
  targetPath = '',
  onProgress,
  onSuccess,
  onError,
  onAbort,
}) {
  const controller = new AbortController()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('path', targetPath || '')

  const xhr = new XMLHttpRequest()
  const baseUrl = import.meta.env.VITE_API_URL || '/api'
  xhr.open('POST', `${baseUrl}/files/upload`, true)

  const token = localStorage.getItem('miraigrid_token')
  if (token) {
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
  }

  let aborted = false

  controller.signal.addEventListener('abort', () => {
    if (!aborted) {
      aborted = true
      try {
        xhr.abort()
      } catch (_) {}
    }
  })

  xhr.upload.onprogress = (event) => {
    if (aborted) return
    if (event.lengthComputable && event.total > 0) {
      const percentComplete = Math.min(100, Math.round((event.loaded / event.total) * 100))
      onProgress?.(percentComplete, event.loaded, event.total)
    }
  }

  xhr.onload = () => {
    if (aborted) return
    if (xhr.status >= 200 && xhr.status < 300) {
      let responseData = {}
      try {
        responseData = JSON.parse(xhr.responseText || '{}')
      } catch (_) {}
      onProgress?.(100, file.size, file.size)
      onSuccess?.(responseData)
    } else {
      let detail = `Gagal mengunggah berkas (HTTP ${xhr.status})`
      try {
        const parsed = JSON.parse(xhr.responseText || '{}')
        if (parsed.detail) detail = parsed.detail
      } catch (_) {
        if (xhr.status === 413) {
          detail = 'Ukuran berkas melebihi batas kuota atau batas maksimum server (413).'
        }
      }
      onError?.(detail)
    }
  }

  xhr.onerror = () => {
    if (aborted) return
    onError?.('Koneksi jaringan terputus saat mengunggah berkas.')
  }

  xhr.onabort = () => {
    aborted = true
    onAbort?.()
  }

  const abort = () => {
    if (!aborted) {
      aborted = true
      controller.abort()
      try {
        xhr.abort()
      } catch (_) {}
    }
  }

  xhr.send(formData)

  return { abort, controller, xhr }
}

export function UploadProvider({ children }) {
  const [queue, setQueue] = useState([])
  const [isMinimized, setIsMinimized] = useState(false)
  const [pendingNav, setPendingNav] = useState(null) // { path, navigateFn }
  const controllersRef = useRef(new Map()) // id -> { abort, lastLoaded, lastTime }

  const activeCount = useMemo(
    () => queue.filter((it) => it.status === 'uploading' || it.status === 'extracting' || it.status === 'pending').length,
    [queue]
  )
  const completedCount = useMemo(
    () => queue.filter((it) => it.status === 'completed').length,
    [queue]
  )
  const cancelledCount = useMemo(
    () => queue.filter((it) => it.status === 'cancelled').length,
    [queue]
  )
  const errorCount = useMemo(
    () => queue.filter((it) => it.status === 'error').length,
    [queue]
  )

  const hasActiveUploads = activeCount > 0

  // 1. Browser Tab Close / Refresh Protection (beforeunload Guard)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasActiveUploads) {
        e.preventDefault()
        e.returnValue =
          'Proses pengunggahan berkas sedang berjalan. Jika Anda memuat ulang atau keluar, unggahan akan dibatalkan.'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasActiveUploads])

  const updateItem = useCallback((id, patch) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item))
    )
  }, [])

  // Enqueue one or more files (Non-blocking multi-file queue)
  const enqueueUploads = useCallback(
    (fileList, options = {}) => {
      if (!fileList || fileList.length === 0) return []
      const filesArray = Array.from(fileList)
      const targetPath = options.targetPath || ''
      const autoExtractZip = Boolean(options.autoExtractZip)
      const onComplete = options.onComplete

      setIsMinimized(false)

      const now = Date.now()
      const newItems = filesArray.map((file, idx) => ({
        id: `up_${now}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size || 0,
        loaded: 0,
        percent: 0,
        speedBps: 0,
        status: 'uploading', // 'uploading' | 'extracting' | 'completed' | 'cancelled' | 'error'
        errorMessage: null,
        targetPath,
        autoExtractZip,
        createdAt: now + idx,
      }))

      setQueue((prev) => [...prev, ...newItems])

      // Start each upload immediately in parallel/non-blocking mode
      newItems.forEach((item) => {
        const startTime = Date.now()
        let lastTime = startTime
        let lastLoaded = 0

        const handle = uploadFileWithProgress({
          file: item.file,
          targetPath: item.targetPath,
          onProgress: (percent, loaded, total) => {
            const currentTime = Date.now()
            const dt = (currentTime - lastTime) / 1000
            let speedBps = 0
            if (dt >= 0.25) {
              speedBps = Math.max(0, Math.round((loaded - lastLoaded) / dt))
              lastTime = currentTime
              lastLoaded = loaded
            }
            updateItem(item.id, (prev) => ({
              percent,
              loaded,
              size: total || prev.size,
              speedBps: speedBps || prev.speedBps,
              status: prev.status === 'cancelled' ? 'cancelled' : 'uploading',
            }))
          },
          onSuccess: async () => {
            controllersRef.current.delete(item.id)

            if (item.autoExtractZip && item.name.toLowerCase().endsWith('.zip')) {
              updateItem(item.id, {
                percent: 100,
                loaded: item.size,
                status: 'extracting',
              })
              try {
                const uploadedPath = item.targetPath ? `${item.targetPath}/${item.name}` : item.name
                await api.post('/files/extract', {
                  zip_path: uploadedPath,
                  extract_to: item.targetPath,
                })
                updateItem(item.id, {
                  percent: 100,
                  loaded: item.size,
                  speedBps: 0,
                  status: 'completed',
                })
                toast.success(`Arsip ${item.name} berhasil diunggah & diekstrak!`)
              } catch (extractErr) {
                updateItem(item.id, {
                  status: 'error',
                  speedBps: 0,
                  errorMessage:
                    extractErr.response?.data?.detail || 'Unggah berhasil, namun gagal mengekstrak ZIP.',
                })
                toast.error(extractErr.response?.data?.detail || `Gagal mengekstrak ${item.name}`)
              }
            } else {
              updateItem(item.id, {
                percent: 100,
                loaded: item.size,
                speedBps: 0,
                status: 'completed',
              })
            }

            // Broadcast global event so DashboardV2 / FileManager refreshes directory & quota
            window.dispatchEvent(
              new CustomEvent('miraigrid:files_updated', {
                detail: { path: item.targetPath, fileName: item.name },
              })
            )
            onComplete?.(item)
          },
          onError: (errMsg) => {
            controllersRef.current.delete(item.id)
            updateItem(item.id, {
              status: 'error',
              speedBps: 0,
              errorMessage: errMsg,
            })
            toast.error(`${item.name}: ${errMsg}`)
          },
          onAbort: () => {
            controllersRef.current.delete(item.id)
            updateItem(item.id, {
              status: 'cancelled',
              speedBps: 0,
              errorMessage: 'Dibatalkan oleh pengguna',
            })
          },
        })

        controllersRef.current.set(item.id, handle)
      })

      return newItems.map((it) => it.id)
    },
    [updateItem]
  )

  // Cancel a single upload item immediately
  const cancelUpload = useCallback(
    (id) => {
      const ctrl = controllersRef.current.get(id)
      if (ctrl) {
        ctrl.abort()
        controllersRef.current.delete(id)
      }
      updateItem(id, {
        status: 'cancelled',
        speedBps: 0,
        errorMessage: 'Dibatalkan oleh pengguna',
      })
      toast.info('Unggahan berkas dibatalkan.')
    },
    [updateItem]
  )

  // Cancel all currently running uploads
  const cancelAllActiveUploads = useCallback(() => {
    controllersRef.current.forEach((ctrl) => {
      try {
        ctrl.abort()
      } catch (_) {}
    })
    controllersRef.current.clear()
    setQueue((prev) =>
      prev.map((it) =>
        it.status === 'uploading' || it.status === 'extracting' || it.status === 'pending'
          ? { ...it, status: 'cancelled', speedBps: 0, errorMessage: 'Dibatalkan saat berpindah halaman' }
          : it
      )
    )
  }, [])

  // Remove a finished/cancelled item from queue
  const removeUploadItem = useCallback((id) => {
    const ctrl = controllersRef.current.get(id)
    if (ctrl) {
      ctrl.abort()
      controllersRef.current.delete(id)
    }
    setQueue((prev) => prev.filter((it) => it.id !== id))
  }, [])

  // Close the floating card (only allowed when activeCount === 0)
  const closeQueueCard = useCallback(() => {
    if (activeCount > 0) return
    setQueue([])
    setIsMinimized(false)
  }, [activeCount])

  // In-App Page Navigation Guard
  const requestGuardedNavigation = useCallback(
    (targetPath, navigateFn) => {
      const normalizedTarget = targetPath.startsWith('/') ? targetPath : `/${targetPath}`
      const currentPathname = window.location.pathname
      if (hasActiveUploads && normalizedTarget !== currentPathname) {
        setPendingNav({ path: normalizedTarget, navigateFn })
        return false
      }
      navigateFn(normalizedTarget)
      return true
    },
    [hasActiveUploads]
  )

  const confirmLeaveAndCancelUploads = useCallback(() => {
    if (!pendingNav) return
    const { path, navigateFn } = pendingNav
    cancelAllActiveUploads()
    setPendingNav(null)
    navigateFn(path)
  }, [pendingNav, cancelAllActiveUploads])

  const cancelLeavePage = useCallback(() => {
    setPendingNav(null)
  }, [])

  const value = useMemo(
    () => ({
      queue,
      isMinimized,
      setIsMinimized,
      activeCount,
      completedCount,
      cancelledCount,
      errorCount,
      hasActiveUploads,
      enqueueUploads,
      cancelUpload,
      cancelAllActiveUploads,
      removeUploadItem,
      closeQueueCard,
      pendingNav,
      requestGuardedNavigation,
      confirmLeaveAndCancelUploads,
      cancelLeavePage,
    }),
    [
      queue,
      isMinimized,
      activeCount,
      completedCount,
      cancelledCount,
      errorCount,
      hasActiveUploads,
      enqueueUploads,
      cancelUpload,
      cancelAllActiveUploads,
      removeUploadItem,
      closeQueueCard,
      pendingNav,
      requestGuardedNavigation,
      confirmLeaveAndCancelUploads,
      cancelLeavePage,
    ]
  )

  useEffect(() => {
    window.__miraigridUploadManager = value
  }, [value])

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
}

export function useUpload() {
  const ctx = useContext(UploadContext)
  if (!ctx) {
    throw new Error('useUpload must be used within an UploadProvider')
  }
  return ctx
}
