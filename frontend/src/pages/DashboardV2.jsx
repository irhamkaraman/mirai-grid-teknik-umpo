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
  LayoutGrid,
  Search,
  ChevronRight,
  ChevronDown,
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
  ArrowDown,
  ArrowUpDown,
  FilePlus,
  FolderPlus,
  Layers,
  ArrowRight,
  User,
  Calendar,
  SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner, SkeletonCard } from '../components/Skeletons'
import ModalPortal from '../components/ModalPortal'
import { useUpload } from '../context/UploadContext'

export default function DashboardV2({
  user,
  onNavigate = () => {},
  searchQuery = '',
  setSearchQuery = () => {},
  onOpenResources = () => {}
}) {
  const username = user?.username || 'user'
  const { enqueueUploads, queue } = useUpload()

  // State
  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [quota, setQuota] = useState(null)
  const [databases, setDatabases] = useState([])
  const [projects, setProjects] = useState([])

  // View & Filter (Google Drive Style)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('mig_cloud_view_mode') || 'grid'
  })
  const [typeFilter, setTypeFilter] = useState('all') // all, folders, documents, media, archives
  const [dateFilter, setDateFilter] = useState('all') // all, today, 7days, 30days
  const [ownerFilter, setOwnerFilter] = useState('all') // all, me
  const [activeDropdown, setActiveDropdown] = useState(null) // 'jenis', 'dimodifikasi', 'pemilik', null
  const [localSearch, setLocalSearch] = useState('')

  // Sorting
  const [sortField, setSortField] = useState('name') // name, modified, size
  const [sortOrder, setSortOrder] = useState('asc') // asc, desc

  // Multi-selection & Shift+Click
  const [selectedPaths, setSelectedPaths] = useState([])
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null)
  const [clipboard, setClipboard] = useState(null) // { action: 'copy', paths: [] }
  const fabRef = useRef(null)
  const filterDropdownRef = useRef(null)

  // Drag and Drop
  const dragCounter = useRef(0)
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

  // Initial load & auto-refresh when background upload queue completes an item
  useEffect(() => {
    fetchDirectory(currentPath)
    fetchDashboardMeta()
  }, [currentPath])

  useEffect(() => {
    const handleFilesUpdated = () => {
      fetchDirectory(currentPath)
      fetchDashboardMeta()
    }
    window.addEventListener('miraigrid:files_updated', handleFilesUpdated)
    return () => window.removeEventListener('miraigrid:files_updated', handleFilesUpdated)
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

  // Close context menu, FAB, and filter dropdown on global click
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (contextMenu) setContextMenu(null)
      if (fabRef.current && !fabRef.current.contains(e.target)) {
        setFabOpen(false)
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setActiveDropdown(null)
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

      // Escape key: close FAB, active dropdowns, context menu, modals, drag overlay
      if (e.key === 'Escape') {
        dragCounter.current = 0
        setIsDragOverWindow(false)
        setFabOpen(false)
        setActiveDropdown(null)
        setContextMenu(null)
        setActiveModal(null)
        setBottomSheetItem(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPaths, clipboard, currentPath])

  // Global escape hatches for external drag-and-drop overlay
  useEffect(() => {
    const resetDragState = () => {
      dragCounter.current = 0
      setIsDragOverWindow(false)
    }

    const handleWindowDragLeave = (e) => {
      if (!e.relatedTarget && !e.toElement) {
        resetDragState()
      }
    }

    const handleWindowKeyDown = (e) => {
      if (e.key === 'Escape') {
        resetDragState()
      }
    }

    window.addEventListener('dragleave', handleWindowDragLeave)
    window.addEventListener('drop', resetDragState)
    window.addEventListener('dragend', resetDragState)
    window.addEventListener('blur', resetDragState)
    window.addEventListener('keydown', handleWindowKeyDown)

    return () => {
      window.removeEventListener('dragleave', handleWindowDragLeave)
      window.removeEventListener('drop', resetDragState)
      window.removeEventListener('dragend', resetDragState)
      window.removeEventListener('blur', resetDragState)
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [])

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

  // Sort click handlers
  const handleSortByName = () => {
    if (sortField === 'name') {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField('name')
      setSortOrder('asc')
    }
  }

  const handleSortByModified = () => {
    if (sortField === 'modified') {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField('modified')
      setSortOrder('desc')
    }
  }

  const handleSortBySize = () => {
    if (sortField === 'size') {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField('size')
      setSortOrder('desc')
    }
  }

  // Filtering & Sorting items by filter chips, search & sort state (Google Drive Real-time)
  const filteredItems = useMemo(() => {
    let result = [...items]
    const q = (localSearch || searchQuery).trim().toLowerCase()
    if (q) {
      result = result.filter((it) => it.name.toLowerCase().includes(q))
    }

    // 1. Jenis Filter
    if (typeFilter === 'folders') {
      result = result.filter((it) => it.is_dir)
    } else if (typeFilter === 'documents') {
      result = result.filter((it) => {
        if (it.is_dir) return false
        const ext = (it.extension || (it.name?.includes('.') ? '.' + it.name.split('.').pop() : '')).toLowerCase()
        return ['.php', '.html', '.css', '.js', '.py', '.txt', '.json', '.sql', '.md', '.env', '.ini'].includes(ext)
      })
    } else if (typeFilter === 'media') {
      result = result.filter((it) => {
        if (it.is_dir) return false
        const ext = (it.extension || (it.name?.includes('.') ? '.' + it.name.split('.').pop() : '')).toLowerCase()
        return ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.mp4'].includes(ext)
      })
    } else if (typeFilter === 'archives') {
      result = result.filter((it) => {
        if (it.is_dir) return false
        const ext = (it.extension || (it.name?.includes('.') ? '.' + it.name.split('.').pop() : '')).toLowerCase()
        return ['.zip', '.tar', '.gz', '.rar', '.7z'].includes(ext)
      })
    }

    // 2. Dimodifikasi Filter
    if (dateFilter !== 'all') {
      const nowSeconds = Math.floor(Date.now() / 1000)
      if (dateFilter === 'today') {
        const oneDayAgo = nowSeconds - 86400
        result = result.filter((it) => (it.modified || it.last_modified || 0) >= oneDayAgo)
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = nowSeconds - 7 * 86400
        result = result.filter((it) => (it.modified || it.last_modified || 0) >= sevenDaysAgo)
      } else if (dateFilter === '30days') {
        const thirtyDaysAgo = nowSeconds - 30 * 86400
        result = result.filter((it) => (it.modified || it.last_modified || 0) >= thirtyDaysAgo)
      }
    }

    // 3. Pemilik Filter (All items in student workspace belong to student "me")
    // If ownerFilter === 'me' or 'all', items are shown

    // 4. Sorting (Folders stay on top or sorted)
    result.sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1
      if (!a.is_dir && b.is_dir) return 1

      if (sortField === 'name') {
        const cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        return sortOrder === 'asc' ? cmp : -cmp
      }
      if (sortField === 'modified') {
        const aMod = a.modified || a.last_modified || 0
        const bMod = b.modified || b.last_modified || 0
        const diff = aMod - bMod
        return sortOrder === 'asc' ? diff : -diff
      }
      if (sortField === 'size') {
        const diff = (a.size || 0) - (b.size || 0)
        return sortOrder === 'asc' ? diff : -diff
      }
      return 0
    })

    return result
  }, [items, typeFilter, dateFilter, ownerFilter, localSearch, searchQuery, sortField, sortOrder])

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
      return <Folder className="h-5 w-5 text-slate-500 fill-slate-100" />
    }
    const ext = (item.extension || (item.name?.includes('.') ? '.' + item.name.split('.').pop() : '')).toLowerCase()
    if (['.php', '.html', '.js', '.py', '.css', '.json', '.sql'].includes(ext)) {
      return <FileCode className="h-5 w-5 text-slate-700" />
    }
    if (['.zip', '.tar', '.gz'].includes(ext)) {
      return <FileArchive className="h-5 w-5 text-amber-600" />
    }
    if (['.png', '.jpg', '.jpeg', '.svg', '.webp'].includes(ext)) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />
    }
    return <FileText className="h-5 w-5 text-slate-500" />
  }

  // Navigation into directory
  const handleItemOpen = (item) => {
    if (item.is_dir) {
      setCurrentPath(item.path)
    } else {
      // Check if file is editable
      const ext = (item.extension || (item.name?.includes('.') ? '.' + item.name.split('.').pop() : '')).toLowerCase()
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

  // Upload Files via Google Drive Floating Upload Manager (Non-blocking Queue + Progress + AbortController)
  const handleFilesUpload = (fileList) => {
    if (!fileList || fileList.length === 0) return
    enqueueUploads(fileList, {
      targetPath: currentPath,
      autoExtractZip: false,
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Upload ZIP with auto-extract option via Floating Upload Manager
  const handleZipUpload = (file) => {
    if (!file) return
    enqueueUploads([file], {
      targetPath: currentPath,
      autoExtractZip: true,
    })
    if (zipInputRef.current) {
      zipInputRef.current.value = ''
    }
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

  // Robust External File Drag & Drop Handlers (Drag Counter Logic)
  const hasDraggedFiles = (dataTransfer) => {
    if (!dataTransfer) return false
    const hasFileType = dataTransfer.types && Array.from(dataTransfer.types).includes('Files')
    const hasFileItem = dataTransfer.items && Array.from(dataTransfer.items).some((item) => item.kind === 'file')
    return Boolean(hasFileType || hasFileItem)
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggingItem || !hasDraggedFiles(e.dataTransfer)) return
    dragCounter.current += 1
    setIsDragOverWindow(true)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggingItem) return
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragOverWindow(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragOverWindow(false)
    if (draggingItem) return
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files)
    }
  }

  return (
    <div
      className="space-y-6 animate-in fade-in duration-300 w-full relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
      <ModalPortal isOpen={isDragOverWindow}>
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            dragCounter.current = 0
            setIsDragOverWindow(false)
          }}
          className="fixed inset-0 !mt-0 z-[9999] bg-emerald-600/20 backdrop-blur-sm border-4 border-dashed border-emerald-500 flex flex-col items-center justify-center animate-in fade-in duration-150 p-4"
        >
          <div className="relative pointer-events-none bg-white p-6 sm:p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-3 text-center max-w-sm border border-emerald-200">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsDragOverWindow(false)
                dragCounter.current = 0
              }}
              className="pointer-events-auto absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title="Batalkan Drag & Drop"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Upload className="h-6 w-6 animate-bounce" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Lepaskan berkas di sini untuk mengunggah
            </h3>
            <p className="text-xs text-slate-500">
              Berkas akan otomatis disimpan ke dalam folder:{' '}
              <span className="font-mono font-semibold text-emerald-700">
                /{currentPath || 'Home'}
              </span>
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                dragCounter.current = 0
                setIsDragOverWindow(false)
              }}
              className="pointer-events-auto mt-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-[11px] font-medium transition cursor-pointer"
            >
              Tekan ESC atau klik untuk batal
            </button>
          </div>
        </div>
      </ModalPortal>

      {/* 1. BREADCRUMB PATH & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-xl px-4 py-2.5 shadow-xs">
        {/* Breadcrumb Path Navigation */}
        <div className="flex items-center space-x-1 overflow-x-auto py-0.5 no-scrollbar">
          {currentPath && (
            <button
              type="button"
              onClick={handleGoUp}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition border border-slate-200 mr-1.5 shrink-0 font-medium text-xs shadow-xs"
              title="Naik satu tingkat folder"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              <span>Naik</span>
            </button>
          )}

          <nav className="flex items-center space-x-1.5 text-xs text-slate-600">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.path}>
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                <button
                  type="button"
                  onClick={() => setCurrentPath(crumb.path)}
                  className={`hover:text-slate-900 px-2 py-1 rounded-lg transition shrink-0 ${
                    idx === breadcrumbs.length - 1
                      ? 'font-bold text-slate-900 bg-slate-100'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {/* Quick Search in Current Folder */}
          <div className="relative w-full sm:w-56">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Saring berkas di sini..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white rounded-lg pl-9 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition font-sans"
            />
            {localSearch && (
              <button
                onClick={() => setLocalSearch('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchDirectory(currentPath)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
            title="Refresh Direktori"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-slate-700' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. HEADER KONTROL, FILTER CHIPS, & TOGGLE TATA LETAK (Google Drive Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative select-none">
        {/* Sisi Kiri: Filter Chips Dropdown Real-time */}
        <div className="flex items-center flex-wrap gap-2" ref={filterDropdownRef}>
          {/* Filter Chip: Jenis */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'jenis' ? null : 'jenis')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition ${
                typeFilter !== 'all'
                  ? 'border-slate-400 bg-slate-100 text-slate-900 font-semibold'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              <span>
                {typeFilter === 'all'
                  ? 'Jenis'
                  : typeFilter === 'folders'
                  ? 'Jenis: Folder'
                  : typeFilter === 'documents'
                  ? 'Jenis: Dokumen & Kode'
                  : typeFilter === 'media'
                  ? 'Jenis: Gambar/Media'
                  : 'Jenis: Arsip ZIP'}
              </span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${activeDropdown === 'jenis' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'jenis' && (
              <div className="absolute left-0 mt-1.5 w-52 rounded-xl bg-white border border-slate-200 shadow-xl p-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'folders', label: 'Folder' },
                  { id: 'documents', label: 'Dokumen & Kode' },
                  { id: 'media', label: 'Gambar/Media' },
                  { id: 'archives', label: 'Arsip ZIP' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setTypeFilter(opt.id)
                      setActiveDropdown(null)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition ${
                      typeFilter === opt.id
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {typeFilter === opt.id && <Check className="h-3.5 w-3.5 text-slate-800" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter Chip: Dimodifikasi */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'dimodifikasi' ? null : 'dimodifikasi')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition ${
                dateFilter !== 'all'
                  ? 'border-slate-400 bg-slate-100 text-slate-900 font-semibold'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>
                {dateFilter === 'all'
                  ? 'Dimodifikasi'
                  : dateFilter === 'today'
                  ? 'Dimodifikasi: Hari Ini'
                  : dateFilter === '7days'
                  ? 'Dimodifikasi: 7 Hari Terakhir'
                  : 'Dimodifikasi: 30 Hari Terakhir'}
              </span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${activeDropdown === 'dimodifikasi' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'dimodifikasi' && (
              <div className="absolute left-0 mt-1.5 w-52 rounded-xl bg-white border border-slate-200 shadow-xl p-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs">
                {[
                  { id: 'all', label: 'Semua Waktu' },
                  { id: 'today', label: 'Hari Ini' },
                  { id: '7days', label: '7 Hari Terakhir' },
                  { id: '30days', label: '30 Hari Terakhir' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setDateFilter(opt.id)
                      setActiveDropdown(null)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition ${
                      dateFilter === opt.id
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {dateFilter === opt.id && <Check className="h-3.5 w-3.5 text-slate-800" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter Chip: Pemilik */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'pemilik' ? null : 'pemilik')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition ${
                ownerFilter !== 'all'
                  ? 'border-slate-400 bg-slate-100 text-slate-900 font-semibold'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span>{ownerFilter === 'all' ? 'Pemilik' : 'Pemilik: Saya / Mahasiswa'}</span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${activeDropdown === 'pemilik' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'pemilik' && (
              <div className="absolute left-0 mt-1.5 w-52 rounded-xl bg-white border border-slate-200 shadow-xl p-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs">
                {[
                  { id: 'all', label: 'Semua Pemilik' },
                  { id: 'me', label: 'Saya / Mahasiswa' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setOwnerFilter(opt.id)
                      setActiveDropdown(null)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition ${
                      ownerFilter === opt.id
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {ownerFilter === opt.id && <Check className="h-3.5 w-3.5 text-slate-800" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reset Filters button */}
          {(typeFilter !== 'all' || dateFilter !== 'all' || ownerFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter('all')
                setDateFilter('all')
                setOwnerFilter('all')
              }}
              className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              title="Reset semua filter"
            >
              Reset
            </button>
          )}
        </div>

        {/* Sisi Kanan: Tata Letak & View Switcher */}
        <div className="flex items-center self-end sm:self-auto bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => handleToggleViewMode('list')}
            className={`p-1.5 rounded-md transition ${
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Tampilan Tabel List"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleViewMode('grid')}
            className={`p-1.5 rounded-md transition ${
              viewMode === 'grid'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Tampilan Kotak Grid"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 3. MULTI-SELECTION FLOATING ACTION BAR */}
      {selectedPaths.length > 0 && (
        <div className="sticky top-4 z-20 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center justify-between animate-in slide-in-from-top duration-200">
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-mono bg-slate-800 text-slate-200 font-bold px-2.5 py-0.5 rounded-full border border-slate-700">
              {selectedPaths.length} dipilih
            </span>
            <span className="hidden sm:inline text-slate-300">Berkas aktif</span>
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Download Zip */}
            <button
              type="button"
              onClick={handleDownloadZipSelected}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 rounded-lg transition flex items-center space-x-1.5"
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
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition flex items-center space-x-1.5"
              title="Salin ke clipboard (Ctrl+C)"
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salin</span>
            </button>

            {/* Delete Selected */}
            <button
              type="button"
              onClick={() => {
                setSelectedItem(null)
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
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              title="Batal Seleksi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. INTERACTIVE FILE LIST / GRID */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredItems.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center text-slate-600 flex flex-col items-center justify-center space-y-4 shadow-xs">
          <div className="h-16 w-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
            <Folder className="h-8 w-8 stroke-[1.5]" />
          </div>
          <div className="max-w-md space-y-1">
            <h4 className="text-base font-bold text-slate-900">
              {items.length === 0 ? 'Folder ini masih kosong' : 'Tidak ada berkas yang cocok dengan filter'}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              {items.length === 0
                ? 'Tarik berkas PHP, HTML, JavaScript, atau ZIP kamu ke area ini atau gunakan tombol aksi di pojok kanan bawah untuk memulai praktikum!'
                : 'Coba sesuaikan jenis berkas, rentang tanggal diubah, atau kata kunci pencarian kamu.'}
            </p>
          </div>
          {items.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              Unggah Berkas Sekarang
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTypeFilter('all')
                setDateFilter('all')
                setOwnerFilter('all')
                setLocalSearch('')
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold shadow-xs transition"
            >
              Reset Semua Filter
            </button>
          )}
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
                className={`group relative bg-white rounded-xl p-4 border transition-colors duration-150 cursor-pointer select-none ${
                  isSelected
                    ? 'border-slate-400 ring-2 ring-slate-200 bg-slate-50/70'
                    : isDropTarget
                    ? 'border-emerald-600 ring-2 ring-emerald-200 bg-emerald-50'
                    : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                {/* Header Card: Checkbox + Icon + Options Menu */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={(e) => handleToggleSelect(item.path, index, e)}
                      className="p-0.5 rounded text-slate-400 hover:text-slate-700 transition"
                      title="Pilih berkas (Tahan Shift untuk multi-seleksi)"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-slate-900" />
                      ) : (
                        <Square className="h-4 w-4 opacity-40 group-hover:opacity-100" />
                      )}
                    </button>
                    <div className="p-1 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition">
                      {getFileIcon(item)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
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
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                    title="Menu Aksi"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>

                {/* File Name & Info */}
                <div className="space-y-1">
                  <h4
                    className="text-xs font-semibold text-slate-900 group-hover:text-slate-700 transition truncate"
                    title={item.name}
                  >
                    {item.name}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>{item.is_dir ? 'Folder' : formatBytes(item.size)}</span>
                    <span>{item.permissions || '0755'}</span>
                  </div>
                </div>

                {/* Footer Modified Date */}
                <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>{formatDate(item.modified)}</span>
                  {!item.is_dir && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownloadFile(item)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-900 transition"
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
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 font-medium">
              <tr>
                <th className="py-3 px-4 w-10">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-700"
                    title="Pilih Semua (Select All)"
                  >
                    {selectedPaths.length === filteredItems.length && filteredItems.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-slate-900" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer select-none group text-xs font-medium text-slate-500 uppercase tracking-wider"
                  onClick={handleSortByName}
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Nama</span>
                    {sortField === 'name' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-slate-700" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-slate-700" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 hidden md:table-cell text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Pemilik
                </th>
                <th
                  className="py-3 px-4 hidden md:table-cell cursor-pointer select-none group text-xs font-medium text-slate-500 uppercase tracking-wider"
                  onClick={handleSortByModified}
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Tanggal Diubah</span>
                    {sortField === 'modified' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-slate-700" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-slate-700" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-4 hidden md:table-cell cursor-pointer select-none group text-xs font-medium text-slate-500 uppercase tracking-wider"
                  onClick={handleSortBySize}
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Ukuran File</span>
                    {sortField === 'size' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-slate-700" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-slate-700" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
                    className={`py-3 px-4 border-b border-slate-100 hover:bg-slate-50/80 transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-slate-100/80 font-medium'
                        : isDropTarget
                        ? 'bg-emerald-50 ring-2 ring-emerald-400'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-4 w-10" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelect(item.path, index, e)}
                        className="p-0.5 text-slate-400 hover:text-slate-700"
                        title="Pilih (Tahan Shift untuk multi-seleksi)"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-slate-900" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="shrink-0">{getFileIcon(item)}</div>
                        <div className="overflow-hidden">
                          <span className="font-medium text-slate-900 truncate block max-w-xs sm:max-w-md">
                            {item.name}
                          </span>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 md:hidden">
                            {formatDate(item.modified)} | {item.is_dir ? 'Folder' : formatBytes(item.size)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <div className="flex items-center space-x-2">
                        <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0">
                          S
                        </div>
                        <span className="text-slate-600 text-xs">Saya</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell font-mono text-slate-500 text-xs">
                      {formatDate(item.modified)}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell font-mono text-slate-500 text-xs">
                      {item.is_dir ? '-' : formatBytes(item.size)}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1">
                        {!item.is_dir && (
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(item)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition hidden sm:inline-flex"
                            title="Unduh Berkas"
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
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
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
      <ModalPortal isOpen={Boolean(bottomSheetItem)}>
        {bottomSheetItem && (
          <div
            onClick={() => setBottomSheetItem(null)}
            className="fixed inset-0 !mt-0 z-[9999] md:hidden flex flex-col justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white rounded-t-3xl p-5 shadow-2xl z-10 space-y-4 animate-in slide-in-from-bottom duration-200"
            >
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
      </ModalPortal>

      {/* 8. FLOATING ACTION BUTTON (FAB) EXPANDABLE (Google Drive Modern Minimalist Style) */}
      <div
        className={`fixed bottom-8 z-50 select-none transition-all duration-200 ${
          queue.length > 0 ? 'right-8 sm:right-[26rem]' : 'right-8'
        }`}
        ref={fabRef}
      >
        {/* Speed Dial Menu */}
        {fabOpen && (
          <div className="absolute bottom-16 right-0 mb-2 w-72 bg-white rounded-2xl border border-slate-200/90 shadow-2xl p-1.5 z-50 animate-in slide-in-from-bottom-2 duration-150">
            <button
              type="button"
              onClick={() => {
                setFabOpen(false)
                setNewItemName('')
                setNewItemIsDir(true)
                setActiveModal('new_item')
              }}
              className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition text-left text-xs font-medium"
            >
              <FolderPlus className="h-4 w-4 text-slate-700" />
              <span>Folder Baru</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFabOpen(false)
                fileInputRef.current?.click()
              }}
              className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition text-left text-xs font-medium"
            >
              <Upload className="h-4 w-4 text-slate-700" />
              <span>Upload File</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFabOpen(false)
                zipInputRef.current?.click()
              }}
              className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition text-left text-xs font-medium"
            >
              <FileArchive className="h-4 w-4 text-slate-700" />
              <span className="whitespace-nowrap">Upload Folder / ZIP (Auto-Extract)</span>
            </button>
          </div>
        )}

        {/* Circular Floating Action Button */}
        <button
          type="button"
          onClick={() => setFabOpen(!fabOpen)}
          className="w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center focus:outline-none"
          title="Menu Aksi Buat & Unggah"
        >
          <Plus className={`h-6 w-6 transition-transform duration-200 ${fabOpen ? 'rotate-45' : ''}`} />
        </button>
      </div>

      {/* 9. CODE VIEWER & EDITOR MODAL */}
      <ModalPortal isOpen={activeModal === 'editor' && Boolean(editorFile)}>
        {activeModal === 'editor' && editorFile && (
          <div
            onClick={() => setActiveModal(null)}
            className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-gray-200 rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden text-gray-900"
            >
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
      </ModalPortal>

      {/* 10. PROPERTIES / GET INFO MODAL */}
      <ModalPortal isOpen={activeModal === 'info' && Boolean(selectedItem)}>
        {activeModal === 'info' && selectedItem && (
          <div
            onClick={() => setActiveModal(null)}
            className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-gray-200 rounded-xl shadow-2xl max-w-md w-full p-6 text-gray-900 space-y-4"
            >
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

            <div className="pt-2 flex justify-end">
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
      </ModalPortal>

      {/* 11. RENAME MODAL */}
      <ModalPortal isOpen={activeModal === 'rename' && Boolean(selectedItem)}>
        {activeModal === 'rename' && selectedItem && (
          <div
            onClick={() => setActiveModal(null)}
            className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          >
            <form
              onSubmit={handleRenameItem}
              onClick={(e) => e.stopPropagation()}
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
      </ModalPortal>

      {/* 12. NEW ITEM MODAL (File or Folder) */}
      <ModalPortal isOpen={activeModal === 'new_item'}>
        {activeModal === 'new_item' && (
          <div
            onClick={() => setActiveModal(null)}
            className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          >
            <form
              onSubmit={handleCreateNewItem}
              onClick={(e) => e.stopPropagation()}
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
      </ModalPortal>

      {/* 13. DELETE CONFIRMATION MODAL */}
      <ModalPortal isOpen={activeModal === 'delete'}>
        {activeModal === 'delete' && (
          <div
            onClick={() => {
              setActiveModal(null)
              setSelectedItem(null)
            }}
            className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-gray-200 rounded-xl shadow-2xl max-w-sm w-full p-6 text-gray-900 space-y-4"
            >
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
      </ModalPortal>
    </div>
  )
}
