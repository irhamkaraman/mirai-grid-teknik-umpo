import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Folder,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Plus,
  Upload,
  Download,
  Trash2,
  Edit3,
  Copy,
  Move,
  Info,
  MoreVertical,
  Grid,
  List,
  Search,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Check,
  CheckSquare,
  Square,
  Sparkles,
  AlertCircle,
  FileSpreadsheet,
  HardDrive,
  RefreshCw,
  X,
  Save,
  ArrowUp,
  FilePlus,
  FolderPlus,
  Layers,
  ArrowRight,
  Share2
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner, SkeletonCard } from '../components/Skeletons'

export default function DashboardV2({
  user,
  onNavigate = () => {},
  searchQuery = '',
  setSearchQuery = () => {},
  onOpenResources = () => {}
}) {
  const username = user?.username || 'user'
  const primaryDomain = `${username}.miraigrid.web.id`

  // State
  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [quota, setQuota] = useState(null)
  const [databases, setDatabases] = useState([])
  const [projects, setProjects] = useState([])

  // View & Filter
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('mig_cloud_view_mode') || 'grid'
  })
  const [activeFilter, setActiveFilter] = useState('all') // all, folders, documents, media, archives
  const [localSearch, setLocalSearch] = useState('')

  // Multi-selection & Shift+Click
  const [selectedPaths, setSelectedPaths] = useState([])
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null)
  const [clipboard, setClipboard] = useState(null) // { action: 'copy', paths: [] }
  const [showCreateDropdown, setShowCreateDropdown] = useState(false)
  const createDropdownRef = useRef(null)

  // Drag and Drop
  const [isDragOverWindow, setIsDragOverWindow] = useState(false)
  const [draggingItem, setDraggingItem] = useState(null)
  const [dragOverFolder, setDragOverFolder] = useState(null)

  // Modals & Drawers
  const [activeModal, setActiveModal] = useState(null) // 'new_item', 'rename', 'delete', 'info', 'editor'
  const [selectedItem, setSelectedItem] = useState(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemIsDir, setNewItemIsDir] = useState(false)

  // Editor Modal
  const [editorFile, setEditorFile] = useState(null)
  const [editorContent, setEditorContent] = useState('')
  const [editorLoading, setEditorLoading] = useState(false)
  const [savingFile, setSavingFile] = useState(false)

  // Context Menu
  const [contextMenu, setContextMenu] = useState(null) // { x, y, item }

  // Mobile Bottom Sheet
  const [bottomSheetItem, setBottomSheetItem] = useState(null)

  // Mobile FAB menu
  const [fabOpen, setFabOpen] = useState(false)

  // File Upload input refs
  const fileInputRef = useRef(null)
  const zipInputRef = useRef(null)

  // Save view mode
  const handleToggleViewMode = (mode) => {
    setViewMode(mode)
    localStorage.setItem('mig_cloud_view_mode', mode)
  }

  // Initial load
  useEffect(() => {
    fetchDirectory(currentPath)
    fetchDashboardMeta()
  }, [currentPath])

  const fetchDashboardMeta = async () => {
    try {
      const [resQuota, resProj, resDb] = await Promise.allSettled([
        api.get('/quotas/my-quota'),
        api.get('/projects'),
        api.get('/databases'),
      ])
      if (resQuota.status === 'fulfilled') setQuota(resQuota.value.data)
      if (resProj.status === 'fulfilled') setProjects(resProj.value.data || [])
      if (resDb.status === 'fulfilled') setDatabases(resDb.value.data || [])
    } catch (e) {
      console.warn('Dashboard meta load notice:', e)
    }
  }

  const fetchDirectory = async (targetPath = '') => {
    setLoading(true)
    try {
      const res = await api.get('/files', {
        params: { path: targetPath }
      })
      const fetchedItems = res.data?.items || (Array.isArray(res.data) ? res.data : [])
      setItems(fetchedItems)
    } catch (err) {
      console.error('Failed to fetch files:', err)
      toast.error(err.response?.data?.detail || 'Gagal memuat berkas direktori.')
      setItems([])
    } finally {
      setLoading(false)
      setSelectedPaths([])
    }
  }

  // Close context menu & create dropdown on global click
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (contextMenu) setContextMenu(null)
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target)) {
        setShowCreateDropdown(false)
      }
    }
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [contextMenu])

  // Keyboard Shortcuts (Ctrl+C, Ctrl+V, Delete)
  useEffect(() => {
    const handleKeyDown = async (e) => {
      // Ignore if inside an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return

      // Ctrl + C / Cmd + C: Copy selected
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedPaths.length > 0) {
          e.preventDefault()
          setClipboard({ action: 'copy', paths: [...selectedPaths] })
          toast.success(`${selectedPaths.length} berkas disalin ke clipboard. Tekan Ctrl+V untuk menempel.`)
        }
      }

      // Ctrl + V / Cmd + V: Paste into current directory
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (clipboard && clipboard.paths.length > 0) {
          e.preventDefault()
          const toastId = toast.loading('Menempel berkas...')
          try {
            for (const src of clipboard.paths) {
              await api.post('/files/copy', {
                source_path: src,
                dest_dir: currentPath,
                destination_dir: currentPath
              })
            }
            toast.success('Berkas berhasil ditempel!', { id: toastId })
            fetchDirectory(currentPath)
          } catch (err) {
            toast.error(err.response?.data?.detail || 'Gagal menempel berkas.', { id: toastId })
          }
        }
      }

      // Delete key: prompt delete for selected paths
      if (e.key === 'Delete') {
        if (selectedPaths.length > 0) {
          e.preventDefault()
          setSelectedItem(null) // Clear individual selectedItem so delete modal targets selectedPaths!
          setActiveModal('delete')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPaths, clipboard, currentPath])

  // Breadcrumbs calculation
  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [{ name: 'Home', path: '' }]
    const parts = currentPath.split('/').filter(Boolean)
    const crumbs = [{ name: 'Home', path: '' }]
    let accumulated = ''
    parts.forEach((part) => {
      accumulated = accumulated ? `${accumulated}/${part}` : part
      crumbs.push({ name: part, path: accumulated })
    })
    return crumbs
  }, [currentPath])

  // Filtering items by filter tabs & search
  const filteredItems = useMemo(() => {
    let result = [...items]
    const q = (localSearch || searchQuery).trim().toLowerCase()
    if (q) {
      result = result.filter((it) => it.name.toLowerCase().includes(q))
    }

    if (activeFilter === 'folders') {
      result = result.filter((it) => it.is_dir)
    } else if (activeFilter === 'documents') {
      result = result.filter((it) => {
        if (it.is_dir) return false
        const ext = it.extension || ''
        return ['.php', '.html', '.css', '.js', '.py', '.txt', '.json', '.sql', '.md', '.env', '.ini'].includes(ext)
      })
    } else if (activeFilter === 'media') {
      result = result.filter((it) => {
        if (it.is_dir) return false
        const ext = it.extension || ''
        return ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.mp4'].includes(ext)
      })
    } else if (activeFilter === 'archives') {
      result = result.filter((it) => {
        if (it.is_dir) return false
        const ext = it.extension || ''
        return ['.zip', '.tar', '.gz', '.rar', '.7z'].includes(ext)
      })
    }
    return result
  }, [items, activeFilter, localSearch, searchQuery])

  // Suggested default folders (only when at root directory)
  const isAtRoot = currentPath === ''
  const suggestedFolderNames = ['public_html', 'database_backups', 'app_source', 'logs']

  const suggestedFolders = useMemo(() => {
    if (!isAtRoot) return []
    return suggestedFolderNames.map((name) => {
      const match = items.find((it) => it.is_dir && it.name === name)
      return {
        name,
        path: name,
        exists: Boolean(match),
        description:
          name === 'public_html'
            ? 'Root Web Hosting'
            : name === 'database_backups'
            ? 'Backup SQL Database'
            : name === 'app_source'
            ? 'Repositori & Source Code'
            : 'Server & Error Logs',
        size: match ? `${match.size || 4096} B` : 'Standar Folder',
      }
    })
  }, [isAtRoot, items])

  // Helpers
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return '-'
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getFileIcon = (item) => {
    if (item.is_dir) {
      return <Folder className="h-6 w-6 text-emerald-500 fill-emerald-500/20" />
    }
    const ext = (item.extension || '').toLowerCase()
    if (['.php', '.html', '.js', '.py', '.css', '.json', '.sql'].includes(ext)) {
      return <FileCode className="h-6 w-6 text-emerald-600" />
    }
    if (['.zip', '.tar', '.gz'].includes(ext)) {
      return <FileArchive className="h-6 w-6 text-amber-600" />
    }
    if (['.png', '.jpg', '.jpeg', '.svg', '.webp'].includes(ext)) {
      return <ImageIcon className="h-6 w-6 text-blue-500" />
    }
    return <FileText className="h-6 w-6 text-gray-500" />
  }

  // Navigation into directory
  const handleItemOpen = (item) => {
    if (item.is_dir) {
      setCurrentPath(item.path)
    } else {
      // Check if file is editable
      const ext = (item.extension || '').toLowerCase()
      if (['.php', '.html', '.css', '.js', '.py', '.txt', '.json', '.sql', '.md', '.env', '.ini'].includes(ext)) {
        handleOpenFileEditor(item)
      } else {
        handleDownloadFile(item)
      }
    }
  }

  // Selection toggle with Shift + Click support
  const handleToggleSelect = (itemPath, index, e) => {
    if (e) e.stopPropagation()
    if (e?.shiftKey && lastSelectedIndex !== null && typeof index === 'number') {
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)
      const rangePaths = filteredItems.slice(start, end + 1).map((it) => it.path)
      setSelectedPaths((prev) => Array.from(new Set([...prev, ...rangePaths])))
    } else {
      if (typeof index === 'number') setLastSelectedIndex(index)
      setSelectedPaths((prev) =>
        prev.includes(itemPath) ? prev.filter((p) => p !== itemPath) : [...prev, itemPath]
      )
    }
  }

  const handleSelectAll = () => {
    if (selectedPaths.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedPaths([])
      setLastSelectedIndex(null)
    } else {
      setSelectedPaths(filteredItems.map((i) => i.path))
    }
  }

  // Multi-Selection action: Share Selected
  const handleShareSelected = () => {
    if (selectedPaths.length === 0) return
    const links = selectedPaths.map((p) => {
      const clean = p.replace(/^public_html\/?/, '')
      return `https://${primaryDomain}/${clean}`
    }).join('\n')
    navigator.clipboard.writeText(links)
    toast.success(`${selectedPaths.length} tautan publik berkas disalin ke clipboard!`)
  }

  // Multi-Selection action: Download Zip Selected
  const handleDownloadZipSelected = async () => {
    if (selectedPaths.length === 0) return
    const toastId = toast.loading(`Mengompresi ${selectedPaths.length} berkas ke ZIP...`)
    try {
      const archiveName = `miraigrid_bundle_${Date.now()}.zip`
      await api.post('/files/compress', {
        paths: selectedPaths,
        destination_zip: archiveName,
        destination_dir: currentPath,
      })
      toast.success('Arsip ZIP berhasil dibuat, mengunduh...', { id: toastId })
      const zipPath = currentPath ? `${currentPath}/${archiveName}` : archiveName
      await handleDownloadFile({ name: archiveName, path: zipPath })
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengompresi dan mengunduh berkas.', { id: toastId })
    }
  }

  // Breadcrumb navigate up one level
  const handleGoUp = () => {
    if (!currentPath) return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    setCurrentPath(parts.join('/'))
  }

  // Context Menu
  const handleContextMenu = (e, item) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
    })
  }

  // Open file in clean code editor modal
  const handleOpenFileEditor = async (item) => {
    setEditorFile(item)
    setActiveModal('editor')
    setEditorLoading(true)
    try {
      const res = await api.get(`/files/content?path=${encodeURIComponent(item.path)}`)
      setEditorContent(res.data?.content ?? '')
    } catch (err) {
      toast.error('Gagal membuka berkas.')
      setActiveModal(null)
    } finally {
      setEditorLoading(false)
    }
  }

  // Save edited file
  const handleSaveFile = async () => {
    if (!editorFile) return
    setSavingFile(true)
    const toastId = toast.loading('Menyimpan perubahan...')
    try {
      await api.post('/files/save', {
        path: editorFile.path,
        content: editorContent,
      })
      toast.success('Berkas berhasil disimpan!', { id: toastId })
      setActiveModal(null)
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan berkas.', { id: toastId })
    } finally {
      setSavingFile(false)
    }
  }

  // Download
  const handleDownloadFile = async (item) => {
    const toastId = toast.loading(`Mengunduh ${item.name}...`)
    try {
      const res = await api.get(`/files/download?path=${encodeURIComponent(item.path)}`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', item.name)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Unduhan dimulai!', { id: toastId })
    } catch (err) {
      toast.error('Gagal mengunduh berkas.', { id: toastId })
    }
  }

  // Create New Item (File or Folder)
  const handleCreateNewItem = async (e) => {
    e.preventDefault()
    if (!newItemName.trim()) return
    const toastId = toast.loading(`Membuat ${newItemIsDir ? 'folder' : 'berkas'} baru...`)
    try {
      await api.post('/files/new', {
        path: currentPath,
        name: newItemName.trim(),
        is_dir: newItemIsDir,
      })
      toast.success(`${newItemIsDir ? 'Folder' : 'Berkas'} berhasil dibuat!`, { id: toastId })
      setActiveModal(null)
      setNewItemName('')
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membuat item baru.', { id: toastId })
    }
  }

  // Rename
  const handleRenameItem = async (e) => {
    e.preventDefault()
    if (!selectedItem || !newItemName.trim()) return
    const toastId = toast.loading('Mengganti nama...')
    try {
      await api.post('/files/rename', {
        old_path: selectedItem.path,
        new_name: newItemName.trim(),
      })
      toast.success('Nama berhasil diubah!', { id: toastId })
      setActiveModal(null)
      setNewItemName('')
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengganti nama.', { id: toastId })
    }
  }

  // Duplicate / Make a Copy
  const handleDuplicateItem = async (item) => {
    const toastId = toast.loading('Menggandakan berkas...')
    try {
      await api.post('/files/copy', {
        source_path: item.path,
        dest_dir: currentPath,
        destination_dir: currentPath,
      })
      toast.success('Salinan berhasil dibuat!', { id: toastId })
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menggandakan berkas.', { id: toastId })
    }
  }

  // Delete Item(s)
  const handleDeleteConfirmed = async () => {
    const targets = selectedItem ? [selectedItem.path] : selectedPaths
    if (targets.length === 0) return
    const toastId = toast.loading(`Menghapus ${targets.length} item...`)
    try {
      for (const p of targets) {
        await api.delete(`/files?path=${encodeURIComponent(p)}`)
      }
      toast.success('Item berhasil dihapus!', { id: toastId })
      setActiveModal(null)
      setSelectedItem(null)
      setSelectedPaths([])
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus item.', { id: toastId })
    }
  }

  // Upload Files
  const handleFilesUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return
    const toastId = toast.loading(`Mengunggah ${fileList.length} berkas...`)
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('path', currentPath)
        await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      toast.success('Semua berkas berhasil diunggah!', { id: toastId })
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengunggah berkas.', { id: toastId })
    }
  }

  // Upload ZIP with auto-extract option
  const handleZipUpload = async (file) => {
    if (!file) return
    const toastId = toast.loading('Mengunggah dan mengekstrak arsip ZIP...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('path', currentPath)
      const uploadRes = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const uploadedPath = currentPath ? `${currentPath}/${file.name}` : file.name
      // Auto-extract ZIP
      await api.post('/files/extract', {
        zip_path: uploadedPath,
        extract_to: currentPath,
      })
      toast.success('ZIP berhasil diunggah & diekstrak!', { id: toastId })
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memproses arsip ZIP.', { id: toastId })
    }
  }

  // Copy public link to clipboard
  const handleCopyPublicLink = (item) => {
    const publicUrl = `https://${primaryDomain}/${item.path.replace(/^public_html\/?/, '')}`
    navigator.clipboard.writeText(publicUrl)
    toast.success('Tautan publik disalin ke clipboard!', {
      description: publicUrl,
    })
  }

  // Drag and Drop move item to folder
  const handleDropOnFolder = async (targetFolder) => {
    if (!draggingItem || draggingItem.path === targetFolder.path) return
    const toastId = toast.loading(`Memindahkan ${draggingItem.name} ke ${targetFolder.name}...`)
    try {
      await api.post('/files/move', {
        source_path: draggingItem.path,
        dest_dir: targetFolder.path,
        destination_dir: targetFolder.path,
      })
      toast.success(`Berhasil dipindahkan ke ${targetFolder.name}!`, { id: toastId })
      setDraggingItem(null)
      setDragOverFolder(null)
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memindahkan berkas.', { id: toastId })
    }
  }

  return (
    <div
      className="space-y-6 animate-in fade-in duration-300 w-full relative"
      onDragEnter={(e) => {
        e.preventDefault()
        setIsDragOverWindow(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (e.relatedTarget === null) setIsDragOverWindow(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragOverWindow(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFilesUpload(e.dataTransfer.files)
        }
      }}
    >
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={(e) => handleFilesUpload(e.target.files)}
      />
      <input
        type="file"
        ref={zipInputRef}
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleZipUpload(e.target.files[0])
        }}
      />

      {/* External Drag and Drop Overlay */}
      {isDragOverWindow && (
        <div className="fixed inset-0 z-50 bg-emerald-600/20 backdrop-blur-sm border-4 border-dashed border-emerald-500 rounded-2xl flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150">
          <div className="bg-white p-8 rounded-xl shadow-2xl flex flex-col items-center space-y-3 border border-emerald-200">
            <Upload className="h-12 w-12 text-emerald-600 animate-bounce" />
            <h3 className="text-lg font-bold text-gray-900">
              Lepaskan berkas di sini untuk mengunggah
            </h3>
            <p className="text-xs text-gray-500">
              Berkas akan otomatis disimpan ke dalam folder:{' '}
              <span className="font-mono font-semibold text-emerald-700">
                /{currentPath || 'Home'}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* 1. TOP ACTION BAR (Quick Actions ala Google Drive) */}
      <div className="bg-white border border-gray-200/90 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* + Create Button with Dropdown (ala Google Drive) */}
            <div className="relative inline-block text-left" ref={createDropdownRef}>
              <button
                type="button"
                onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm hover:shadow transition-all active:scale-95 group"
              >
                <Plus className={`h-4 w-4 text-emerald-400 transition-transform duration-200 ${showCreateDropdown ? 'rotate-45' : 'group-hover:rotate-90'}`} />
                <span>+ Buat Baru</span>
                <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${showCreateDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showCreateDropdown && (
                <div className="absolute left-0 mt-2 w-56 rounded-xl bg-white border border-gray-200 shadow-2xl p-1.5 z-30 animate-in fade-in zoom-in-95 duration-150 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateDropdown(false)
                      setNewItemName('')
                      setNewItemIsDir(false)
                      setActiveModal('new_item')
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition text-left"
                  >
                    <FilePlus className="h-4 w-4 text-emerald-600" />
                    <span>Berkas Baru (File)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateDropdown(false)
                      setNewItemName('')
                      setNewItemIsDir(true)
                      setActiveModal('new_item')
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition text-left"
                  >
                    <FolderPlus className="h-4 w-4 text-emerald-600" />
                    <span>Folder Baru</span>
                  </button>
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateDropdown(false)
                      fileInputRef.current?.click()
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition text-left"
                  >
                    <Upload className="h-4 w-4 text-blue-600" />
                    <span>Unggah Berkas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateDropdown(false)
                      zipInputRef.current?.click()
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition text-left"
                  >
                    <FileArchive className="h-4 w-4 text-amber-500" />
                    <span>Unggah ZIP (Auto-Extract)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-white hover:bg-emerald-50/70 border border-gray-200 hover:border-emerald-300 text-gray-700 hover:text-emerald-700 text-xs font-semibold shadow-xs transition active:scale-95"
            >
              <Upload className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Unggah Berkas</span>
              <span className="inline sm:hidden">Unggah</span>
            </button>

            {/* Upload ZIP Auto-Extract */}
            <button
              type="button"
              onClick={() => zipInputRef.current?.click()}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-white hover:bg-emerald-50/70 border border-gray-200 hover:border-emerald-300 text-gray-700 hover:text-emerald-700 text-xs font-semibold shadow-xs transition active:scale-95"
              title="Unggah arsip ZIP dan otomatis ekstrak ke folder ini"
            >
              <FileArchive className="h-4 w-4 text-amber-500" />
              <span className="hidden sm:inline">Unggah ZIP (Auto-Extract)</span>
              <span className="inline sm:hidden">ZIP</span>
            </button>

            {/* Folder Baru Button */}
            <button
              type="button"
              onClick={() => {
                setNewItemName('')
                setNewItemIsDir(true)
                setActiveModal('new_item')
              }}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold shadow-xs transition"
            >
              <FolderPlus className="h-4 w-4 text-gray-500" />
              <span className="hidden md:inline">Folder Baru</span>
            </button>

            {/* Edit Code Button (if single editable file selected) */}
            {selectedPaths.length === 1 && (() => {
              const target = items.find((it) => it.path === selectedPaths[0])
              if (!target || target.is_dir) return null
              const ext = (target.extension || '').toLowerCase()
              if (!['.php', '.html', '.css', '.js', '.py', '.txt', '.json', '.sql', '.md', '.env', '.ini'].includes(ext)) return null
              return (
                <button
                  type="button"
                  onClick={() => handleOpenFileEditor(target)}
                  className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold shadow-xs transition"
                  title="Buka dan sunting kode berkas ini"
                >
                  <Edit3 className="h-4 w-4 text-emerald-600" />
                  <span>Edit Kode</span>
                </button>
              )
            })()}

            {/* Download Button (if file(s) selected) */}
            {selectedPaths.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (selectedPaths.length === 1) {
                    const target = items.find((it) => it.path === selectedPaths[0])
                    if (target) handleDownloadFile(target)
                  } else {
                    handleDownloadZipSelected()
                  }
                }}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold shadow-xs transition"
                title="Unduh berkas yang dipilih"
              >
                <Download className="h-4 w-4 text-emerald-600" />
                <span>Unduh {selectedPaths.length > 1 ? `ZIP (${selectedPaths.length})` : ''}</span>
              </button>
            )}
          </div>

          {/* Right Action: Search & View Switcher */}
          <div className="flex items-center space-x-3">
            {/* Quick Search in Current Folder */}
            <div className="relative w-full sm:w-56">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Saring berkas di sini..."
                className="w-full bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 outline-none transition font-sans"
              />
              {localSearch && (
                <button
                  onClick={() => setLocalSearch('')}
                  className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* View Mode Switcher Toggle */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200/80">
              <button
                type="button"
                onClick={() => handleToggleViewMode('grid')}
                className={`p-1.5 rounded-md transition ${
                  viewMode === 'grid'
                    ? 'bg-white text-emerald-700 shadow-sm font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
                title="Tampilan Kotak Grid"
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleToggleViewMode('list')}
                className={`p-1.5 rounded-md transition ${
                  viewMode === 'list'
                    ? 'bg-white text-emerald-700 shadow-sm font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
                title="Tampilan Tabel List"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Breadcrumb Path Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center space-x-1 overflow-x-auto py-1">
            {currentPath && (
              <button
                type="button"
                onClick={handleGoUp}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 transition border border-gray-200/80 mr-1.5 shrink-0 font-medium text-xs shadow-xs"
                title="Naik satu tingkat folder"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <span>Naik</span>
              </button>
            )}

            <nav className="flex items-center space-x-1.5 text-xs text-gray-600">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.path}>
                  {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => setCurrentPath(crumb.path)}
                    className={`hover:text-emerald-700 px-2 py-1 rounded-lg transition shrink-0 ${
                      idx === breadcrumbs.length - 1
                        ? 'font-bold text-gray-900 bg-gray-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </nav>
          </div>

          <button
            type="button"
            onClick={() => fetchDirectory(currentPath)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition shrink-0"
            title="Refresh Direktori"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. SUGGESTED FOLDERS (Grid Folder Hijau Segar ala Google Drive) */}
      {isAtRoot && !localSearch && !searchQuery && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center space-x-2">
              <Folder className="h-4 w-4 text-emerald-600" />
              <span>Direktori Standar Lab (Suggested Folders)</span>
            </h3>
            <span className="text-[11px] text-gray-400">Akses cepat direktori kerja</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {suggestedFolders.map((sug) => (
              <div
                key={sug.name}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverFolder(sug.name)
                }}
                onDragLeave={() => {
                  if (dragOverFolder === sug.name) setDragOverFolder(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDropOnFolder({ path: sug.name, name: sug.name })
                }}
                onClick={() => {
                  if (sug.exists) {
                    setCurrentPath(sug.path)
                  } else {
                    // Create folder if missing
                    setNewItemName(sug.name)
                    setNewItemIsDir(true)
                    setActiveModal('new_item')
                  }
                }}
                className={`bg-white rounded-xl p-4 shadow-xs transition-all duration-200 cursor-pointer group relative overflow-hidden ${
                  dragOverFolder === sug.name
                    ? 'border-emerald-600 ring-4 ring-emerald-300 bg-emerald-100/50 scale-105 shadow-md'
                    : 'border border-emerald-100/90 hover:border-emerald-400 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                    <Folder className="h-5 w-5 fill-emerald-500/20" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      const itemMatch = items.find((it) => it.name === sug.name)
                      if (itemMatch) {
                        setSelectedItem(itemMatch)
                        if (window.innerWidth < 768) {
                          setBottomSheetItem(itemMatch)
                        } else {
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            item: itemMatch,
                          })
                        }
                      } else {
                        toast.info(`Folder "${sug.name}" belum dibuat. Klik kartu untuk membuat sekarang.`)
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                    title="Opsi Direktori"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition truncate">
                    {sug.name}
                  </h4>
                  <p className="text-[11px] text-gray-500 truncate">{sug.description}</p>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-gray-400 pt-2 border-t border-gray-100">
                  <span>{sug.exists ? 'Tersedia' : 'Klik untuk buat'}</span>
                  <span className="text-emerald-600 font-semibold group-hover:translate-x-1 transition-transform">
                    Buka &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. HORIZONTAL SCROLLABLE PILL FILTERS */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 pt-1 no-scrollbar select-none">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition shrink-0 ${
            activeFilter === 'all'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Semua Berkas ({items.length})
        </button>
        <button
          onClick={() => setActiveFilter('folders')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition shrink-0 ${
            activeFilter === 'folders'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Folder ({items.filter((i) => i.is_dir).length})
        </button>
        <button
          onClick={() => setActiveFilter('documents')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition shrink-0 ${
            activeFilter === 'documents'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Dokumen & Kode
        </button>
        <button
          onClick={() => setActiveFilter('media')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition shrink-0 ${
            activeFilter === 'media'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Media & Gambar
        </button>
        <button
          onClick={() => setActiveFilter('archives')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition shrink-0 ${
            activeFilter === 'archives'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Arsip ZIP
        </button>
      </div>

      {/* 4. MULTI-SELECTION FLOATING ACTION BAR */}
      {selectedPaths.length > 0 && (
        <div className="sticky top-4 z-20 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center justify-between animate-in slide-in-from-top duration-200">
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-mono bg-emerald-500/30 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
              {selectedPaths.length} dipilih
            </span>
            <span className="hidden sm:inline text-gray-300">Berkas aktif</span>
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Share Selected */}
            <button
              type="button"
              onClick={handleShareSelected}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-emerald-300 hover:text-emerald-200 rounded-lg transition flex items-center space-x-1.5"
              title="Salin tautan publik berkas terpilih"
            >
              <Share2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Bagikan Tautan</span>
            </button>

            {/* Download Zip */}
            <button
              type="button"
              onClick={handleDownloadZipSelected}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-amber-300 hover:text-amber-200 rounded-lg transition flex items-center space-x-1.5"
              title="Kompresi dan unduh semua berkas terpilih sebagai ZIP"
            >
              <FileArchive className="h-3.5 w-3.5 text-amber-400" />
              <span>Unduh ZIP</span>
            </button>

            {/* Copy Ctrl+C */}
            <button
              type="button"
              onClick={() => {
                setClipboard({ action: 'copy', paths: [...selectedPaths] })
                toast.success(`${selectedPaths.length} berkas disalin ke clipboard!`)
              }}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition flex items-center space-x-1.5"
              title="Salin ke clipboard (Ctrl+C)"
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salin</span>
            </button>

            {/* Delete Selected */}
            <button
              type="button"
              onClick={() => {
                setSelectedItem(null) // Target selectedPaths
                setActiveModal('delete')
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition flex items-center space-x-1.5"
              title="Hapus semua berkas terpilih"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Hapus Terpilih</span>
            </button>

            {/* Cancel Selection */}
            <button
              type="button"
              onClick={() => {
                setSelectedPaths([])
                setLastSelectedIndex(null)
              }}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg transition"
              title="Batal Seleksi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. INTERACTIVE FILE LIST / GRID */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredItems.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-gray-200 rounded-xl p-8 sm:p-12 text-center text-gray-600 flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="h-16 w-16 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Folder className="h-8 w-8 stroke-[1.5]" />
          </div>
          <div className="max-w-md space-y-1">
            <h4 className="text-base font-bold text-gray-900">Folder ini masih kosong</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Tarik berkas PHP, HTML, JavaScript, atau ZIP kamu ke area ini atau klik tombol Unggah di atas untuk memulai praktikum!
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            Unggah Berkas Sekarang
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {filteredItems.map((item, index) => {
            const isSelected = selectedPaths.includes(item.path)
            const isDropTarget = dragOverFolder === item.path

            return (
              <div
                key={item.path}
                draggable
                onDragStart={() => setDraggingItem(item)}
                onDragEnd={() => setDraggingItem(null)}
                onDragOver={(e) => {
                  if (item.is_dir) {
                    e.preventDefault()
                    setDragOverFolder(item.path)
                  }
                }}
                onDragLeave={() => {
                  if (dragOverFolder === item.path) setDragOverFolder(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (item.is_dir) handleDropOnFolder(item)
                }}
                onClick={() => handleItemOpen(item)}
                onContextMenu={(e) => handleContextMenu(e, item)}
                className={`group relative bg-white rounded-xl p-4 border transition-all duration-200 cursor-pointer select-none hover:-translate-y-0.5 ${
                  isSelected
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40 shadow-sm'
                    : isDropTarget
                    ? 'border-emerald-600 ring-4 ring-emerald-300 bg-emerald-100/50 scale-105'
                    : 'border-gray-200/90 hover:border-emerald-300 hover:shadow-md'
                }`}
              >
                {/* Header Card: Checkbox + Icon + Options Menu */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={(e) => handleToggleSelect(item.path, index, e)}
                      className="p-0.5 rounded text-gray-400 hover:text-emerald-600 transition"
                      title="Pilih berkas (Tahan Shift untuk multi-seleksi)"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Square className="h-4 w-4 opacity-40 group-hover:opacity-100" />
                      )}
                    </button>
                    <div className="p-1 rounded-lg bg-gray-50 group-hover:bg-emerald-50 transition">
                      {getFileIcon(item)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedItem(item)
                      // On mobile opens bottom sheet, on desktop opens modal info
                      if (window.innerWidth < 768) {
                        setBottomSheetItem(item)
                      } else {
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          item,
                        })
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
                    title="Menu Aksi"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>

                {/* File Name & Info */}
                <div className="space-y-1">
                  <h4
                    className="text-xs font-bold text-gray-900 group-hover:text-emerald-700 transition truncate"
                    title={item.name}
                  >
                    {item.name}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                    <span>{item.is_dir ? 'Folder' : formatBytes(item.size)}</span>
                    <span>{item.permissions || '0755'}</span>
                  </div>
                </div>

                {/* Footer Modified Date */}
                <div className="mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-between">
                  <span>{formatDate(item.modified)}</span>
                  {!item.is_dir && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownloadFile(item)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-emerald-600 hover:text-emerald-800 transition"
                      title="Unduh Berkas"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* LIST VIEW (Table ala Google Drive) */
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
              <tr>
                <th className="p-3.5 w-10">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="p-0.5 rounded text-gray-400 hover:text-emerald-600"
                    title="Pilih Semua (Select All)"
                  >
                    {selectedPaths.length === filteredItems.length && filteredItems.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="p-3.5">Nama Berkas</th>
                <th className="p-3.5">Ukuran</th>
                <th className="p-3.5">Tipe / Ekstensi</th>
                <th className="p-3.5">Terakhir Diubah</th>
                <th className="p-3.5">Izin (Perm)</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map((item, index) => {
                const isSelected = selectedPaths.includes(item.path)
                const isDropTarget = dragOverFolder === item.path

                return (
                  <tr
                    key={item.path}
                    draggable
                    onDragStart={() => setDraggingItem(item)}
                    onDragEnd={() => setDraggingItem(null)}
                    onDragOver={(e) => {
                      if (item.is_dir) {
                        e.preventDefault()
                        setDragOverFolder(item.path)
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverFolder === item.path) setDragOverFolder(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (item.is_dir) handleDropOnFolder(item)
                    }}
                    onClick={() => handleItemOpen(item)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    className={`hover:bg-emerald-50/40 transition cursor-pointer select-none ${
                      isSelected
                        ? 'bg-emerald-50/70 font-semibold'
                        : isDropTarget
                        ? 'bg-emerald-100 ring-2 ring-emerald-400 font-semibold'
                        : ''
                    }`}
                  >
                    <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelect(item.path, index, e)}
                        className="p-0.5 text-gray-400 hover:text-emerald-600"
                        title="Pilih (Tahan Shift untuk multi-seleksi)"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center space-x-2.5">
                        <div className="shrink-0">{getFileIcon(item)}</div>
                        <span className="font-semibold text-gray-900 truncate max-w-xs sm:max-w-md">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-gray-500">
                      {item.is_dir ? '-' : formatBytes(item.size)}
                    </td>
                    <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                      {item.is_dir ? 'Direktori' : item.extension || 'File'}
                    </td>
                    <td className="p-3.5 text-gray-500">{formatDate(item.modified)}</td>
                    <td className="p-3.5 font-mono text-gray-500">{item.permissions || '0755'}</td>
                    <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1">
                        {!item.is_dir && (
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(item)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-gray-100 transition"
                            title="Unduh"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            setSelectedItem(item)
                            if (window.innerWidth < 768) {
                              setBottomSheetItem(item)
                            } else {
                              setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                item,
                              })
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
                          title="Menu Aksi"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. CONTEXT MENU (Floating Right-Click) */}
      {contextMenu && (
        <div
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 260),
            left: Math.min(contextMenu.x, window.innerWidth - 220),
          }}
          className="fixed z-50 w-52 bg-white border border-gray-200 rounded-2xl shadow-2xl p-1.5 text-xs text-gray-700 animate-in fade-in zoom-in-95 duration-150 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.item.is_dir && (
            <button
              onClick={() => {
                handleDownloadFile(contextMenu.item)
                setContextMenu(null)
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition text-left"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              <span>Unduh Berkas</span>
            </button>
          )}

          {!contextMenu.item.is_dir &&
            ['.php', '.html', '.css', '.js', '.py', '.txt', '.json', '.sql', '.md', '.env'].includes(
              contextMenu.item.extension
            ) && (
              <button
                onClick={() => {
                  handleOpenFileEditor(contextMenu.item)
                  setContextMenu(null)
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition text-left"
              >
                <Edit3 className="h-4 w-4 text-emerald-600" />
                <span>Edit Kode Sumber</span>
              </button>
            )}

          <button
            onClick={() => {
              setSelectedItem(contextMenu.item)
              setNewItemName(contextMenu.item.name)
              setActiveModal('rename')
              setContextMenu(null)
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-gray-100 transition text-left"
          >
            <Edit3 className="h-4 w-4 text-gray-500" />
            <span>Ganti Nama (Rename)</span>
          </button>

          {!contextMenu.item.is_dir && (
            <button
              onClick={() => {
                handleDuplicateItem(contextMenu.item)
                setContextMenu(null)
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-gray-100 transition text-left"
            >
              <Copy className="h-4 w-4 text-gray-500" />
              <span>Buat Salinan (Duplicate)</span>
            </button>
          )}

          <button
            onClick={() => {
              handleCopyPublicLink(contextMenu.item)
              setContextMenu(null)
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-gray-100 transition text-left"
          >
            <ExternalLink className="h-4 w-4 text-gray-500" />
            <span>Salin Tautan Publik</span>
          </button>

          <button
            onClick={() => {
              setSelectedItem(contextMenu.item)
              setActiveModal('info')
              setContextMenu(null)
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-gray-100 transition text-left"
          >
            <Info className="h-4 w-4 text-gray-500" />
            <span>Informasi Berkas</span>
          </button>

          <div className="my-1 border-t border-gray-100" />

          <button
            onClick={() => {
              setSelectedItem(contextMenu.item)
              setActiveModal('delete')
              setContextMenu(null)
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 transition text-left font-medium"
          >
            <Trash2 className="h-4 w-4" />
            <span>Hapus Berkas</span>
          </button>
        </div>
      )}

      {/* 7. MOBILE BOTTOM SHEET (Responsive Smartphone) */}
      {bottomSheetItem && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in"
            onClick={() => setBottomSheetItem(null)}
          />
          <div className="relative bg-white rounded-t-3xl p-5 shadow-2xl z-10 space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto" />

            <div className="flex items-center space-x-3 pb-3 border-b border-gray-100">
              <div className="p-2 rounded-xl bg-gray-50">{getFileIcon(bottomSheetItem)}</div>
              <div className="overflow-hidden">
                <h4 className="text-sm font-bold text-gray-900 truncate">
                  {bottomSheetItem.name}
                </h4>
                <p className="text-xs text-gray-500 font-mono">
                  {bottomSheetItem.is_dir ? 'Folder' : formatBytes(bottomSheetItem.size)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {!bottomSheetItem.is_dir && (
                <button
                  onClick={() => {
                    handleDownloadFile(bottomSheetItem)
                    setBottomSheetItem(null)
                  }}
                  className="p-3 bg-gray-50 hover:bg-emerald-50 rounded-2xl flex items-center space-x-2 text-gray-700 font-medium"
                >
                  <Download className="h-4 w-4 text-emerald-600" />
                  <span>Unduh</span>
                </button>
              )}

              {!bottomSheetItem.is_dir &&
                ['.php', '.html', '.css', '.js', '.py', '.txt', '.json', '.sql', '.md', '.env', '.ini'].includes(
                  bottomSheetItem.extension
                ) && (
                  <button
                    onClick={() => {
                      handleOpenFileEditor(bottomSheetItem)
                      setBottomSheetItem(null)
                    }}
                    className="p-3 bg-gray-50 hover:bg-emerald-50 rounded-2xl flex items-center space-x-2 text-gray-700 font-medium"
                  >
                    <Edit3 className="h-4 w-4 text-emerald-600" />
                    <span>Edit Kode</span>
                  </button>
                )}

              <button
                onClick={() => {
                  setSelectedItem(bottomSheetItem)
                  setNewItemName(bottomSheetItem.name)
                  setActiveModal('rename')
                  setBottomSheetItem(null)
                }}
                className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl flex items-center space-x-2 text-gray-700 font-medium"
              >
                <Edit3 className="h-4 w-4 text-gray-500" />
                <span>Ganti Nama</span>
              </button>

              {!bottomSheetItem.is_dir && (
                <button
                  onClick={() => {
                    handleDuplicateItem(bottomSheetItem)
                    setBottomSheetItem(null)
                  }}
                  className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl flex items-center space-x-2 text-gray-700 font-medium"
                >
                  <Copy className="h-4 w-4 text-gray-500" />
                  <span>Duplikat</span>
                </button>
              )}

              <button
                onClick={() => {
                  handleCopyPublicLink(bottomSheetItem)
                  setBottomSheetItem(null)
                }}
                className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl flex items-center space-x-2 text-gray-700 font-medium"
              >
                <ExternalLink className="h-4 w-4 text-gray-500" />
                <span>Salin Link</span>
              </button>

              <button
                onClick={() => {
                  setSelectedItem(bottomSheetItem)
                  setActiveModal('info')
                  setBottomSheetItem(null)
                }}
                className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl flex items-center space-x-2 text-gray-700 font-medium"
              >
                <Info className="h-4 w-4 text-gray-500" />
                <span>Detail Info</span>
              </button>

              <button
                onClick={() => {
                  setSelectedItem(bottomSheetItem)
                  setActiveModal('delete')
                  setBottomSheetItem(null)
                }}
                className="p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl flex items-center space-x-2 text-rose-600 font-medium"
              >
                <Trash2 className="h-4 w-4" />
                <span>Hapus</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setBottomSheetItem(null)}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-2xl transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* 8. MOBILE FLOATING ACTION BUTTON (+) */}
      <div className="fixed bottom-6 right-6 md:hidden z-40">
        {fabOpen && (
          <div className="mb-3 space-y-2 flex flex-col items-end animate-in slide-in-from-bottom-2 duration-150">
            <button
              onClick={() => {
                setFabOpen(false)
                fileInputRef.current?.click()
              }}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-full bg-white text-gray-800 text-xs font-semibold shadow-lg border border-gray-200"
            >
              <Upload className="h-4 w-4 text-emerald-600" />
              <span>Unggah Berkas</span>
            </button>
            <button
              onClick={() => {
                setFabOpen(false)
                zipInputRef.current?.click()
              }}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-full bg-white text-gray-800 text-xs font-semibold shadow-lg border border-gray-200"
            >
              <FileArchive className="h-4 w-4 text-amber-500" />
              <span>Unggah ZIP (Auto-Extract)</span>
            </button>
            <button
              onClick={() => {
                setFabOpen(false)
                setNewItemName('')
                setNewItemIsDir(true)
                setActiveModal('new_item')
              }}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-full bg-white text-gray-800 text-xs font-semibold shadow-lg border border-gray-200"
            >
              <FolderPlus className="h-4 w-4 text-emerald-600" />
              <span>Folder Baru</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setFabOpen(!fabOpen)}
          className={`h-14 w-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-transform duration-200 ${
            fabOpen ? 'bg-gray-800 rotate-45' : 'bg-emerald-600 active:scale-95'
          }`}
          title="Menu Aksi Cepat"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* 9. CODE VIEWER & EDITOR MODAL */}
      {activeModal === 'editor' && editorFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden text-gray-900">
            {/* Editor Header */}
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div className="flex items-center space-x-3 overflow-hidden">
                <FileCode className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="overflow-hidden">
                  <h4 className="text-sm font-bold text-gray-900 truncate font-mono">
                    {editorFile.name}
                  </h4>
                  <p className="text-[11px] text-gray-400 font-mono truncate">
                    /{editorFile.path}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSaveFile}
                  disabled={savingFile}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingFile ? 'Menyimpan...' : 'Simpan (Ctrl+S)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Editor Body */}
            <div className="flex-1 bg-[#1E1E1E] text-gray-100 font-mono text-xs overflow-hidden flex flex-col">
              {editorLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Spinner className="h-8 w-8 text-emerald-400" />
                </div>
              ) : (
                <div className="flex-1 flex overflow-hidden">
                  {/* Line numbers gutter */}
                  <div
                    aria-hidden="true"
                    className="w-12 bg-[#181818] py-4 text-right pr-3 select-none text-gray-600 font-mono text-xs border-r border-gray-800/80 overflow-hidden shrink-0"
                  >
                    {editorContent.split('\n').map((_, idx) => (
                      <div key={idx} className="leading-relaxed">
                        {idx + 1}
                      </div>
                    ))}
                  </div>

                  {/* Textarea code input */}
                  <textarea
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                        e.preventDefault()
                        handleSaveFile()
                      } else if (e.key === 'Tab') {
                        e.preventDefault()
                        const target = e.target
                        const start = target.selectionStart
                        const end = target.selectionEnd
                        const value = target.value
                        const newValue = value.substring(0, start) + '  ' + value.substring(end)
                        setEditorContent(newValue)
                        setTimeout(() => {
                          target.selectionStart = target.selectionEnd = start + 2
                        }, 0)
                      }
                    }}
                    className="flex-1 p-4 bg-transparent text-gray-100 resize-none outline-none font-mono text-xs leading-relaxed custom-scrollbar whitespace-pre"
                    spellCheck="false"
                    placeholder="Ketik kode di sini..."
                  />
                </div>
              )}
            </div>

            {/* Editor Footer */}
            <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-mono">
              <span>Encoding: UTF-8</span>
              <span>Baris: {editorContent.split('\n').length} baris</span>
            </div>
          </div>
        </div>
      )}

      {/* 10. PROPERTIES / GET INFO MODAL */}
      {activeModal === 'info' && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-xl shadow-2xl max-w-md w-full p-6 text-gray-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  {getFileIcon(selectedItem)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 truncate max-w-[200px]">
                    {selectedItem.name}
                  </h3>
                  <p className="text-[11px] text-gray-400">Informasi & Properti Berkas</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                <span className="text-gray-500">Tipe Berkas</span>
                <span className="font-semibold">{selectedItem.is_dir ? 'Direktori / Folder' : selectedItem.type || 'Berkas'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                <span className="text-gray-500">Ukuran</span>
                <span className="font-mono font-semibold">
                  {selectedItem.is_dir ? '-' : `${formatBytes(selectedItem.size)} (${selectedItem.size} Bytes)`}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                <span className="text-gray-500">Izin Linux (Octal)</span>
                <span className="font-mono font-semibold text-emerald-700">
                  {selectedItem.permissions || '0755'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                <span className="text-gray-500">Terakhir Dimodifikasi</span>
                <span className="font-semibold">{formatDate(selectedItem.modified)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 space-y-1">
                <span className="text-gray-500 block">Jalur Virtual (Path)</span>
                <code className="text-[11px] font-mono text-emerald-700 block break-all">
                  /home/{username}/{selectedItem.path}
                </code>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => handleCopyPublicLink(selectedItem)}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition"
              >
                Salin Tautan Publik
              </button>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-black transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. RENAME MODAL */}
      {activeModal === 'rename' && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={handleRenameItem}
            className="bg-white border border-gray-200 rounded-xl shadow-2xl max-w-sm w-full p-6 text-gray-900 space-y-4"
          >
            <h3 className="text-sm font-bold text-gray-900">Ganti Nama Berkas / Folder</h3>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500">Nama Baru</label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                autoFocus
                required
                className="w-full bg-gray-50 border border-gray-200 focus:border-emerald-500 rounded-lg px-3.5 py-2 text-xs text-gray-900 outline-none"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 12. NEW ITEM MODAL (File or Folder) */}
      {activeModal === 'new_item' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={handleCreateNewItem}
            className="bg-white border border-gray-200 rounded-xl shadow-2xl max-w-sm w-full p-6 text-gray-900 space-y-4"
          >
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setNewItemIsDir(false)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  !newItemIsDir
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Berkas Baru
              </button>
              <button
                type="button"
                onClick={() => setNewItemIsDir(true)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  newItemIsDir
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Folder Baru
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-500">
                Nama {newItemIsDir ? 'Folder' : 'Berkas (contoh: index.php, style.css)'}
              </label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={newItemIsDir ? 'nama_folder' : 'script.php'}
                autoFocus
                required
                className="w-full bg-gray-50 border border-gray-200 focus:border-emerald-500 rounded-lg px-3.5 py-2 text-xs text-gray-900 outline-none font-mono"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm"
              >
                Buat Sekarang
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 13. DELETE CONFIRMATION MODAL */}
      {activeModal === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-xl shadow-2xl max-w-sm w-full p-6 text-gray-900 space-y-4">
            <div className="h-12 w-12 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-gray-900">Konfirmasi Penghapusan</h3>
              <p className="text-xs text-gray-500">
                Apakah Anda yakin ingin menghapus {selectedItem ? `"${selectedItem.name}"` : `${selectedPaths.length} item terpilih`}? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null)
                  setSelectedItem(null)
                }}
                className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
