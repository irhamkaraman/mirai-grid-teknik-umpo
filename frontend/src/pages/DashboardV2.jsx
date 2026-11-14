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
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  WrapText,
  Sun,
  Moon,
  Film,
  Music,
  FolderOpen,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner, SkeletonCard, SkeletonTable } from '../components/Skeletons'
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

  // Editor Modal (Fullscreen Notepad / IDE)
  const [editorFile, setEditorFile] = useState(null)
  const [editorContent, setEditorContent] = useState('')
  const [editorInitialContent, setEditorInitialContent] = useState('')
  const [editorLoading, setEditorLoading] = useState(false)
  const [savingFile, setSavingFile] = useState(false)
  const [editorWordWrap, setEditorWordWrap] = useState(true)
  const [editorDarkTheme, setEditorDarkTheme] = useState(false)
  const editorGutterRef = useRef(null)

  // In-Browser Media, PDF & Archive Previewer
  const [previewItem, setPreviewItem] = useState(null) // { item, category, url }
  const [previewLoading, setPreviewLoading] = useState(false)
  const [imageZoom, setImageZoom] = useState(1)
  const [imageRotation, setImageRotation] = useState(0)

  // File Info & Properties (Desktop Right Sidepanel + Mobile Bottom Sheet)
  const [infoItem, setInfoItem] = useState(null)
  const [infoTab, setInfoTab] = useState('detail') // 'detail' | 'aktivitas'
  const [infoPreviewUrl, setInfoPreviewUrl] = useState(null)

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

      // Escape key: close FAB, active dropdowns, context menu, modals, preview, drag overlay
      if (e.key === 'Escape') {
        dragCounter.current = 0
        setIsDragOverWindow(false)
        setFabOpen(false)
        setActiveDropdown(null)
        setContextMenu(null)
        setActiveModal(null)
        setBottomSheetItem(null)
        setPreviewItem((prev) => {
          if (prev?.url) window.URL.revokeObjectURL(prev.url)
          return null
        })
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

  const getFileExtension = (item) => {
    if (!item || item.is_dir) return ''
    if (item.extension) return item.extension.toLowerCase()
    const name = item.name || ''
    if (name.startsWith('.') && !name.slice(1).includes('.')) {
      return name.toLowerCase()
    }
    return name.includes('.') ? '.' + name.split('.').pop().toLowerCase() : ''
  }

  const getFileCategory = (item) => {
    if (!item) return 'unknown'
    if (item.is_dir) return 'folder'
    const ext = getFileExtension(item)
    const lowerName = (item.name || '').toLowerCase()

    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif'].includes(ext)) {
      return 'image'
    }
    if (ext === '.pdf') {
      return 'pdf'
    }
    if (['.mp4', '.webm', '.mov', '.m4v', '.ogv'].includes(ext)) {
      return 'video'
    }
    if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext)) {
      return 'audio'
    }
    if (['.zip', '.tar', '.gz', '.tgz', '.rar', '.7z'].includes(ext)) {
      return 'archive'
    }

    const textExtensions = [
      '.php', '.html', '.htm', '.css', '.scss', '.less', '.js', '.mjs', '.cjs',
      '.jsx', '.ts', '.tsx', '.py', '.txt', '.json', '.sql', '.md', '.markdown',
      '.env', '.ini', '.yml', '.yaml', '.xml', '.sh', '.bash', '.zsh', '.conf',
      '.cfg', '.toml', '.htaccess', '.gitignore', '.gitattributes', '.editorconfig',
      '.log', '.csv', '.tsv', '.vue', '.svelte', '.go', '.rs', '.java', '.c',
      '.cpp', '.h', '.rb', '.pl', '.lua', '.dockerfile',
    ]
    const textFilenames = [
      '.bashrc', '.bash_profile', '.bash_logout', '.profile', '.gitconfig',
      '.htaccess', '.imunify_patch_id', '.lastlogin', '.wget-hsts', '.vimrc',
      '.npmrc', 'dockerfile', 'makefile', 'procfile', 'readme', 'license',
      'access-logs', 'error-logs', 'error_log',
    ]

    if (
      textExtensions.includes(ext) ||
      textFilenames.includes(lowerName) ||
      lowerName.startsWith('.env') ||
      (!ext && (item.size || 0) <= 2 * 1024 * 1024)
    ) {
      return 'text'
    }

    return 'binary'
  }

  const getHumanFileType = (item) => {
    if (!item) return '-'
    if (item.is_dir) return 'Folder MiraiGrid'
    const ext = getFileExtension(item)
    const cat = getFileCategory(item)
    if (cat === 'pdf') return 'Dokumen PDF (.pdf)'
    if (cat === 'image') return `Gambar (${ext || 'Image'})`
    if (cat === 'video') return `Video (${ext || 'Media'})`
    if (cat === 'audio') return `Audio (${ext || 'Media'})`
    if (cat === 'archive') return `Arsip Terkompresi (${ext || 'Archive'})`
    if (cat === 'text') {
      if (['.php', '.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.sql', '.json', '.sh'].includes(ext)) {
        return `Kode Sumber (${ext})`
      }
      return `Dokumen Teks / Konfigurasi (${ext || 'UTF-8'})`
    }
    return item.type || `Berkas (${ext || 'Binary'})`
  }

  const getFileIcon = (item) => {
    if (item.is_dir) {
      return <Folder className="h-5 w-5 text-slate-500 fill-slate-100" />
    }
    const cat = getFileCategory(item)
    const ext = getFileExtension(item)
    if (cat === 'image') {
      return <ImageIcon className="h-5 w-5 text-blue-500" />
    }
    if (cat === 'pdf') {
      return <FileText className="h-5 w-5 text-rose-500" />
    }
    if (cat === 'video') {
      return <Film className="h-5 w-5 text-purple-500" />
    }
    if (cat === 'audio') {
      return <Music className="h-5 w-5 text-indigo-500" />
    }
    if (cat === 'archive') {
      return <FileArchive className="h-5 w-5 text-amber-600" />
    }
    if (['.php', '.html', '.htm', '.js', '.jsx', '.ts', '.tsx', '.py', '.css', '.json', '.sql', '.sh'].includes(ext)) {
      return <FileCode className="h-5 w-5 text-slate-700" />
    }
    return <FileText className="h-5 w-5 text-slate-500" />
  }

  // Open File Info & Properties (Right Sidepanel on Desktop, Bottom Sheet on Mobile)
  const handleOpenInfoPanel = async (item) => {
    if (!item) return
    setSelectedItem(item)
    setInfoItem(item)
    setInfoTab('detail')
    setActiveModal(null)

    if (infoPreviewUrl) {
      window.URL.revokeObjectURL(infoPreviewUrl)
      setInfoPreviewUrl(null)
    }

    if (!item.is_dir && getFileCategory(item) === 'image' && (item.size || 0) <= 10 * 1024 * 1024) {
      try {
        const res = await api.get('/files/download', {
          params: { path: item.path, inline: true },
          responseType: 'blob',
        })
        const ext = getFileExtension(item)
        const mime = ext === '.svg' ? 'image/svg+xml' : res.data?.type || 'image/png'
        const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }))
        setInfoPreviewUrl(url)
      } catch (e) {
        // Ignore thumbnail error
      }
    }
  }

  // Open In-Browser Preview for Media, PDF, Audio/Video, or Archive (Never auto-download on click!)
  const handleOpenPreview = async (item, categoryOverride = null) => {
    const category = categoryOverride || getFileCategory(item)
    if (previewItem?.url) {
      window.URL.revokeObjectURL(previewItem.url)
    }
    setImageZoom(1)
    setImageRotation(0)

    if (category === 'archive') {
      setPreviewItem({ item, category: 'archive', url: null })
      setPreviewLoading(false)
      return
    }

    setPreviewItem({ item, category, url: null })
    setPreviewLoading(true)
    try {
      const res = await api.get('/files/download', {
        params: { path: item.path, inline: true },
        responseType: 'blob',
      })
      const ext = getFileExtension(item)
      const mimeMap = {
        '.pdf': 'application/pdf',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.bmp': 'image/bmp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
      }
      const mimeType = mimeMap[ext] || res.headers?.['content-type'] || res.data?.type || 'application/octet-stream'
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: mimeType }))
      setPreviewItem({ item, category, url: blobUrl })
    } catch (err) {
      toast.error('Gagal memuat pratinjau berkas.')
      setPreviewItem(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleClosePreview = () => {
    if (previewItem?.url) {
      window.URL.revokeObjectURL(previewItem.url)
    }
    setPreviewItem(null)
    setImageZoom(1)
    setImageRotation(0)
  }

  // Extract Archive (.zip) directly in current directory
  const handleExtractArchive = async (item) => {
    if (!item) return
    const toastId = toast.loading(`Mengekstrak ${item.name}...`)
    try {
      await api.post('/files/extract', {
        zip_path: item.path,
        destination_dir: currentPath,
      })
      toast.success(`Arsip ${item.name} berhasil diekstrak!`, { id: toastId })
      handleClosePreview()
      fetchDirectory(currentPath)
      fetchDashboardMeta()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengekstrak arsip.', { id: toastId })
    }
  }

  // Navigation into directory or smart in-browser viewer (Never auto-downloads on click)
  const handleItemOpen = (item) => {
    if (item.is_dir) {
      setCurrentPath(item.path)
      return
    }
    const category = getFileCategory(item)
    if (category === 'text') {
      handleOpenFileEditor(item)
    } else if (['image', 'pdf', 'video', 'audio', 'archive'].includes(category)) {
      handleOpenPreview(item, category)
    } else {
      handleOpenInfoPanel(item)
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

  // Open file in Fullscreen Notepad / Code Editor
  const handleOpenFileEditor = async (item) => {
    setEditorFile(item)
    setActiveModal('editor')
    setEditorLoading(true)
    try {
      const res = await api.get(`/files/content?path=${encodeURIComponent(item.path)}`)
      const loadedContent = res.data?.content ?? ''
      setEditorContent(loadedContent)
      setEditorInitialContent(loadedContent)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membuka berkas.')
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
      setEditorInitialContent(editorContent)
      toast.success('Berkas berhasil disimpan!', { id: toastId })
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-xl px-4 py-2.5">
        {/* Breadcrumb Path Navigation */}
        <div className="flex items-center space-x-1 overflow-x-auto py-0.5 no-scrollbar">
          {currentPath && (
            <button
              type="button"
              onClick={handleGoUp}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition border border-slate-200 mr-1.5 shrink-0 font-medium text-xs"
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

          {/* Filter Chip: Pemilik (Single Isolated Owner: Saya) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'pemilik' ? null : 'pemilik')}
              className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span>Pemilik: Saya</span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${activeDropdown === 'pemilik' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'pemilik' && (
              <div className="absolute left-0 mt-1.5 w-48 rounded-xl bg-white border border-slate-200 p-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setOwnerFilter('me')
                    setActiveDropdown(null)
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left bg-slate-100 text-slate-900 font-semibold transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center">
                      S
                    </span>
                    <span>Saya</span>
                  </div>
                  <Check className="h-3.5 w-3.5 text-slate-800" />
                </button>
              </div>
            )}
          </div>

          {/* Reset Filters button */}
          {(typeFilter !== 'all' || dateFilter !== 'all') && (
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

        {/* Sisi Kanan: Tata Letak, View Switcher & Tombol Info Panel (Google Drive Style) */}
        <div className="flex items-center self-end sm:self-auto gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => handleToggleViewMode('list')}
              className={`p-1.5 rounded-md transition ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 font-semibold'
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
                  ? 'bg-white text-slate-900 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Kotak Grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (infoItem) {
                setInfoItem(null)
              } else {
                const target =
                  selectedItem ||
                  (selectedPaths.length > 0
                    ? items.find((i) => i.path === selectedPaths[0])
                    : null) || {
                    name: currentPath ? currentPath.split('/').pop() : 'Home (Root Sandbox)',
                    path: currentPath || '',
                    is_dir: true,
                    size: 0,
                    permissions: '0755',
                    modified: Math.floor(Date.now() / 1000),
                  }
                handleOpenInfoPanel(target)
              }
            }}
            className={`p-2 rounded-lg border transition ${
              infoItem
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title="Lihat Detail & Properti Berkas"
          >
            <Info className="h-4 w-4" />
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

      {/* 4. INTERACTIVE FILE LIST / GRID + DESKTOP GOOGLE DRIVE RIGHT SIDEPANEL */}
      <div className="flex items-start gap-4 relative">
        <div className="flex-1 min-w-0">
      {loading ? (
        viewMode === 'list' ? (
          <SkeletonTable rows={5} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )
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
        </div>

        {/* 5. DESKTOP RIGHT SIDEPANEL: INFORMASI & PROPERTI BERKAS (Google Drive Style) */}
        {infoItem && (
          <aside className="hidden md:flex w-80 lg:w-96 bg-white border border-slate-200/90 rounded-2xl shrink-0 flex-col overflow-hidden sticky top-4 max-h-[calc(100vh-5rem)] animate-in slide-in-from-right-4 duration-200">
            {/* Header Panel */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 shrink-0">
                  {getFileIcon(infoItem)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate" title={infoItem.name}>
                    {infoItem.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    {getHumanFileType(infoItem)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInfoItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition shrink-0"
                title="Tutup Panel Detail"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs Navigation (Detail & Aktivitas) */}
            <div className="grid grid-cols-2 border-b border-slate-200/80 text-xs font-medium bg-white shrink-0">
              <button
                type="button"
                onClick={() => setInfoTab('detail')}
                className={`py-3 text-center transition border-b-2 ${
                  infoTab === 'detail'
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/60'
                }`}
              >
                Detail
              </button>
              <button
                type="button"
                onClick={() => setInfoTab('aktivitas')}
                className={`py-3 text-center transition border-b-2 ${
                  infoTab === 'aktivitas'
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/60'
                }`}
              >
                Aktivitas
              </button>
            </div>

            {/* Body Content */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1 custom-scrollbar">
              {infoTab === 'detail' ? (
                <>
                  {/* Preview Box */}
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 flex flex-col items-center justify-center gap-3 text-center overflow-hidden">
                    {infoPreviewUrl && getFileCategory(infoItem) === 'image' ? (
                      <img
                        src={infoPreviewUrl}
                        alt={infoItem.name}
                        className="max-h-36 w-auto object-contain rounded-lg border border-slate-200 bg-white"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center">
                        {getFileIcon(infoItem)}
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      {!infoItem.is_dir && (
                        <button
                          type="button"
                          onClick={() => handleItemOpen(infoItem)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[11px] transition flex items-center gap-1.5"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>
                            {getFileCategory(infoItem) === 'text' ? 'Buka di Notepad' : 'Buka Pratinjau'}
                          </span>
                        </button>
                      )}
                      {!infoItem.is_dir && (
                        <button
                          type="button"
                          onClick={() => handleDownloadFile(infoItem)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium text-[11px] transition flex items-center gap-1.5"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Unduh</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Akses & Keamanan Sandbox */}
                  <div className="space-y-2.5 pb-4 border-b border-slate-100">
                    <h4 className="text-xs font-semibold text-slate-900">Siapa yang memiliki akses</h4>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        S
                      </div>
                      <div className="text-[11px] text-slate-600 leading-snug">
                        <span className="font-semibold text-slate-900 block">Milik Anda ({username})</span>
                        <span>Sandbox mahasiswa terisolasi penuh.</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-600">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Batasan keamanan: Chroot Sandbox Aktif</span>
                    </div>
                  </div>

                  {/* Detail Folder / Berkas (Persis Google Drive) */}
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                      <Info className="h-4 w-4 text-slate-500" />
                      <span>Detail {infoItem.is_dir ? 'folder' : 'berkas'}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-900 block">Jenis</span>
                      <span className="text-xs text-slate-600 block">{getHumanFileType(infoItem)}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-900 block">Ukuran</span>
                      <span className="text-xs text-slate-600 font-mono block">
                        {infoItem.is_dir
                          ? '- (Direktori)'
                          : `${formatBytes(infoItem.size)} (${(infoItem.size || 0).toLocaleString('id-ID')} Bytes)`}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-900 block">Lokasi</span>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800">
                        <Folder className="h-3.5 w-3.5 text-slate-600" />
                        <span className="truncate max-w-[180px]">
                          {currentPath ? currentPath.split('/').pop() : 'Home'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 mt-1">
                        <code className="text-[11px] font-mono text-slate-700 break-all">
                          /home/{username}/{infoItem.path}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`/home/${username}/${infoItem.path}`)
                            toast.success('Jalur berkas disalin!')
                          }}
                          className="p-1 text-slate-400 hover:text-slate-800 rounded transition shrink-0"
                          title="Salin Jalur Virtual"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-900 block">Izin Linux (Octal)</span>
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md font-semibold">
                        {infoItem.permissions || (infoItem.is_dir ? '0755' : '0644')}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-900 block">Pemilik</span>
                      <span className="text-xs text-slate-600 block">saya</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-900 block">Dimodifikasi</span>
                      <span className="text-xs text-slate-600 block">
                        {formatDate(infoItem.modified)} oleh saya
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-900 block">Dibuka</span>
                      <span className="text-xs text-slate-600 block">
                        {formatDate(infoItem.modified)} oleh saya
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-900 block">Dibuat</span>
                      <span className="text-xs text-slate-600 block">{formatDate(infoItem.modified)}</span>
                    </div>
                  </div>
                </>
              ) : (
                /* Tab Aktivitas */
                <div className="space-y-4">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Riwayat Aktivitas Terkini
                  </div>
                  <div className="relative pl-4 border-l-2 border-slate-200 space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                          S
                        </span>
                        <span className="font-semibold text-slate-900 text-xs">Anda memodifikasi item ini</span>
                      </div>
                      <p className="text-[11px] text-slate-500 pl-7">{formatDate(infoItem.modified)}</p>
                      <div className="ml-7 mt-1 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700">
                        {getFileIcon(infoItem)}
                        <span className="truncate max-w-[160px] font-medium">{infoItem.name}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-700 text-xs">Disinkronkan di Cloud Workspace</span>
                      </div>
                      <p className="text-[11px] text-slate-500 pl-6">
                        Lokasi: /home/{username}/{infoItem.path}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 6. CONTEXT MENU (Floating Right-Click) */}
      {contextMenu && (
        <div
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 280),
            left: Math.min(contextMenu.x, window.innerWidth - 230),
          }}
          className="fixed z-50 w-56 bg-white border border-slate-200 rounded-2xl p-1.5 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-150 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.item.is_dir && getFileCategory(contextMenu.item) === 'text' && (
            <button
              onClick={() => {
                handleOpenFileEditor(contextMenu.item)
                setContextMenu(null)
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition text-left font-medium"
            >
              <Edit3 className="h-4 w-4 text-emerald-600" />
              <span>Buka di Notepad / Editor</span>
            </button>
          )}

          {!contextMenu.item.is_dir &&
            ['image', 'pdf', 'video', 'audio'].includes(getFileCategory(contextMenu.item)) && (
              <button
                onClick={() => {
                  handleOpenPreview(contextMenu.item)
                  setContextMenu(null)
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition text-left font-medium"
              >
                <ExternalLink className="h-4 w-4 text-blue-600" />
                <span>Pratinjau di Browser</span>
              </button>
            )}

          {!contextMenu.item.is_dir && getFileExtension(contextMenu.item) === '.zip' && (
            <button
              onClick={() => {
                handleExtractArchive(contextMenu.item)
                setContextMenu(null)
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-amber-50 hover:text-amber-800 transition text-left font-medium"
            >
              <FolderOpen className="h-4 w-4 text-amber-600" />
              <span>Ekstrak di Sini</span>
            </button>
          )}

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

          <button
            onClick={() => {
              setSelectedItem(contextMenu.item)
              setNewItemName(contextMenu.item.name)
              setActiveModal('rename')
              setContextMenu(null)
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 transition text-left"
          >
            <Edit3 className="h-4 w-4 text-slate-500" />
            <span>Ganti Nama (Rename)</span>
          </button>

          {!contextMenu.item.is_dir && (
            <button
              onClick={() => {
                handleDuplicateItem(contextMenu.item)
                setContextMenu(null)
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 transition text-left"
            >
              <Copy className="h-4 w-4 text-slate-500" />
              <span>Buat Salinan (Duplicate)</span>
            </button>
          )}

          <button
            onClick={() => {
              handleOpenInfoPanel(contextMenu.item)
              setContextMenu(null)
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 transition text-left"
          >
            <Info className="h-4 w-4 text-slate-500" />
            <span>Informasi & Properti Berkas</span>
          </button>

          <div className="my-1 border-t border-slate-100" />

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

      {/* 7. MOBILE ACTION BOTTOM SHEET (Responsive Smartphone Menu) */}
      <ModalPortal isOpen={Boolean(bottomSheetItem)}>
        {bottomSheetItem && (
          <div
            onClick={() => setBottomSheetItem(null)}
            className="fixed inset-0 !mt-0 z-[9999] md:hidden flex flex-col justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white rounded-t-3xl p-5 border-t border-slate-200 z-10 space-y-4 animate-in slide-in-from-bottom duration-200"
            >
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto" />

              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                  {getFileIcon(bottomSheetItem)}
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {bottomSheetItem.name}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    {bottomSheetItem.is_dir ? 'Folder' : formatBytes(bottomSheetItem.size)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {!bottomSheetItem.is_dir && getFileCategory(bottomSheetItem) === 'text' && (
                  <button
                    onClick={() => {
                      handleOpenFileEditor(bottomSheetItem)
                      setBottomSheetItem(null)
                    }}
                    className="p-3 bg-slate-50 hover:bg-emerald-50 rounded-2xl flex items-center space-x-2 text-slate-700 font-medium"
                  >
                    <Edit3 className="h-4 w-4 text-emerald-600" />
                    <span>Buka Notepad</span>
                  </button>
                )}

                {!bottomSheetItem.is_dir &&
                  ['image', 'pdf', 'video', 'audio'].includes(getFileCategory(bottomSheetItem)) && (
                    <button
                      onClick={() => {
                        handleOpenPreview(bottomSheetItem)
                        setBottomSheetItem(null)
                      }}
                      className="p-3 bg-slate-50 hover:bg-blue-50 rounded-2xl flex items-center space-x-2 text-slate-700 font-medium"
                    >
                      <ExternalLink className="h-4 w-4 text-blue-600" />
                      <span>Pratinjau</span>
                    </button>
                  )}

                {!bottomSheetItem.is_dir && getFileExtension(bottomSheetItem) === '.zip' && (
                  <button
                    onClick={() => {
                      handleExtractArchive(bottomSheetItem)
                      setBottomSheetItem(null)
                    }}
                    className="p-3 bg-amber-50 hover:bg-amber-100 rounded-2xl flex items-center space-x-2 text-amber-800 font-medium"
                  >
                    <FolderOpen className="h-4 w-4 text-amber-600" />
                    <span>Ekstrak ZIP</span>
                  </button>
                )}

                {!bottomSheetItem.is_dir && (
                  <button
                    onClick={() => {
                      handleDownloadFile(bottomSheetItem)
                      setBottomSheetItem(null)
                    }}
                    className="p-3 bg-slate-50 hover:bg-emerald-50 rounded-2xl flex items-center space-x-2 text-slate-700 font-medium"
                  >
                    <Download className="h-4 w-4 text-emerald-600" />
                    <span>Unduh</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setSelectedItem(bottomSheetItem)
                    setNewItemName(bottomSheetItem.name)
                    setActiveModal('rename')
                    setBottomSheetItem(null)
                  }}
                  className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center space-x-2 text-slate-700 font-medium"
                >
                  <Edit3 className="h-4 w-4 text-slate-500" />
                  <span>Ganti Nama</span>
                </button>

                {!bottomSheetItem.is_dir && (
                  <button
                    onClick={() => {
                      handleDuplicateItem(bottomSheetItem)
                      setBottomSheetItem(null)
                    }}
                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center space-x-2 text-slate-700 font-medium"
                  >
                    <Copy className="h-4 w-4 text-slate-500" />
                    <span>Duplikat</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    const target = bottomSheetItem
                    setBottomSheetItem(null)
                    handleOpenInfoPanel(target)
                  }}
                  className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center space-x-2 text-slate-700 font-medium"
                >
                  <Info className="h-4 w-4 text-slate-500" />
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
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-2xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </ModalPortal>

      {/* 8. FLOATING ACTION BUTTON (FAB) EXPANDABLE (Google Drive Modern Minimalist Style) */}
      <div
        className={`fixed bottom-8 z-40 select-none transition-all duration-200 ${
          queue.length > 0 || infoItem ? 'right-8 md:right-[25rem]' : 'right-8'
        }`}
        ref={fabRef}
      >
        {/* Speed Dial Menu */}
        {fabOpen && (
          <div className="absolute bottom-16 right-0 mb-2 w-72 bg-white rounded-2xl border border-slate-200/90 p-1.5 z-50 animate-in slide-in-from-bottom-2 duration-150">
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
          className="w-14 h-14 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-all flex items-center justify-center focus:outline-none"
          title="Menu Aksi Buat & Unggah"
        >
          <Plus className={`h-6 w-6 transition-transform duration-200 ${fabOpen ? 'rotate-45' : ''}`} />
        </button>
      </div>

      {/* 9. FULLSCREEN NOTEPAD / CODE EDITOR (Desktop & Mobile Full Viewport) */}
      <ModalPortal isOpen={activeModal === 'editor' && Boolean(editorFile)}>
        {activeModal === 'editor' && editorFile && (
          <div className="fixed inset-0 !mt-0 z-[9999] bg-white flex flex-col w-screen h-screen h-[100dvh] overflow-hidden animate-in fade-in duration-150">
            {/* Fullscreen Editor Top Header Bar */}
            <div className="px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 shrink-0">
                  {getFileIcon(editorFile)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate font-mono">
                      {editorFile.name}
                    </h4>
                    {editorContent !== editorInitialContent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                        Belum disimpan
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono truncate">
                    /home/{username}/{editorFile.path}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Word Wrap Toggle */}
                <button
                  type="button"
                  onClick={() => setEditorWordWrap((prev) => !prev)}
                  className={`p-2 rounded-lg border text-xs font-medium transition hidden sm:inline-flex items-center gap-1.5 ${
                    editorWordWrap
                      ? 'bg-slate-100 border-slate-300 text-slate-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                  title="Toggle Word Wrap (Potong Baris Otomatis)"
                >
                  <WrapText className="h-4 w-4" />
                  <span className="hidden md:inline">Wrap</span>
                </button>

                {/* Light / Dark Editor Theme Toggle */}
                <button
                  type="button"
                  onClick={() => setEditorDarkTheme((prev) => !prev)}
                  className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium transition inline-flex items-center gap-1.5"
                  title={editorDarkTheme ? 'Beralih ke Mode Notepad Terang' : 'Beralih ke Mode IDE Gelap'}
                >
                  {editorDarkTheme ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-600" />}
                  <span className="hidden md:inline">{editorDarkTheme ? 'Terang' : 'Gelap'}</span>
                </button>

                {/* Download File Button */}
                <button
                  type="button"
                  onClick={() => handleDownloadFile(editorFile)}
                  className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition hidden sm:inline-flex"
                  title="Unduh Berkas"
                >
                  <Download className="h-4 w-4" />
                </button>

                {/* Save Button */}
                <button
                  type="button"
                  onClick={handleSaveFile}
                  disabled={savingFile}
                  className="px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingFile ? 'Menyimpan...' : 'Simpan (Ctrl+S)'}</span>
                </button>

                {/* Close Button (Reachable on Desktop & Mobile) */}
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-2 text-slate-500 hover:text-slate-900 rounded-lg border border-slate-200 hover:bg-slate-100 transition"
                  title="Tutup Editor (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Fullscreen Editor Body */}
            <div
              className={`flex-1 font-mono text-sm overflow-hidden flex flex-col ${
                editorDarkTheme ? 'bg-[#1E1E1E] text-slate-100' : 'bg-white text-slate-900'
              }`}
            >
              {editorLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Spinner className="h-8 w-8 text-emerald-500" />
                  <span className="text-xs text-slate-400 font-sans">Memuat isi berkas...</span>
                </div>
              ) : (
                <div className="flex-1 flex overflow-hidden">
                  {/* Line numbers gutter (Synced scroll) */}
                  <div
                    ref={editorGutterRef}
                    aria-hidden="true"
                    className={`w-12 sm:w-14 py-4 text-right pr-3 select-none font-mono text-xs sm:text-sm border-r overflow-hidden shrink-0 ${
                      editorDarkTheme
                        ? 'bg-[#181818] text-slate-500 border-slate-800'
                        : 'bg-slate-50/80 text-slate-400 border-slate-200/80'
                    }`}
                  >
                    {editorContent.split('\n').map((_, idx) => (
                      <div key={idx} className="leading-relaxed">
                        {idx + 1}
                      </div>
                    ))}
                  </div>

                  {/* Textarea code/text input */}
                  <textarea
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    onScroll={(e) => {
                      if (editorGutterRef.current) {
                        editorGutterRef.current.scrollTop = e.target.scrollTop
                      }
                    }}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
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
                    className={`flex-1 p-4 sm:p-5 bg-transparent resize-none outline-none font-mono text-xs sm:text-sm leading-relaxed custom-scrollbar ${
                      editorDarkTheme ? 'text-slate-100 placeholder-slate-600' : 'text-slate-900 placeholder-slate-400'
                    } ${editorWordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto'}`}
                    spellCheck="false"
                    autoFocus
                    placeholder="Ketik teks atau kode sumber di sini..."
                  />
                </div>
              )}
            </div>

            {/* Fullscreen Editor Footer Status Bar */}
            <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-600 font-mono shrink-0">
              <div className="flex items-center gap-4">
                <span>Encoding: UTF-8</span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span className="hidden sm:inline">{getHumanFileType(editorFile)}</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Baris: {editorContent.split('\n').length} baris</span>
                <span className="text-slate-300">|</span>
                <span>Karakter: {editorContent.length.toLocaleString('id-ID')}</span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span className="hidden sm:inline">
                  Ukuran: {formatBytes(new Blob([editorContent]).size)}
                </span>
              </div>
            </div>
          </div>
        )}
      </ModalPortal>

      {/* 9B. IN-BROWSER MEDIA, PDF & ARCHIVE PREVIEWER (No Auto-Download on Click) */}
      <ModalPortal isOpen={Boolean(previewItem)}>
        {previewItem && (
          <div
            onClick={handleClosePreview}
            className="fixed inset-0 !mt-0 z-[9999] bg-slate-950/90 backdrop-blur-md flex flex-col w-screen h-screen h-[100dvh] overflow-hidden animate-in fade-in duration-150"
          >
            {/* Previewer Top Toolbar */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="px-4 sm:px-6 py-3 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-3 text-white shrink-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 shrink-0">
                  {getFileIcon(previewItem.item)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">
                    {previewItem.item.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono truncate">
                    {getHumanFileType(previewItem.item)} • {formatBytes(previewItem.item.size)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Image Zoom & Rotate Controls */}
                {previewItem.category === 'image' && (
                  <div className="hidden sm:flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 mr-1">
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition"
                      title="Perkecil (Zoom Out)"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImageZoom(1)
                        setImageRotation(0)
                      }}
                      className="px-2.5 py-1 text-xs font-mono text-slate-200 hover:text-white transition"
                      title="Reset Zoom (100%)"
                    >
                      {Math.round(imageZoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition"
                      title="Perbesar (Zoom In)"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageRotation((r) => (r + 90) % 360)}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition"
                      title="Putar 90 Derajat"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Open PDF/Image in New Tab */}
                {previewItem.url && ['pdf', 'image'].includes(previewItem.category) && (
                  <a
                    href={previewItem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition hidden sm:inline-flex items-center gap-1.5"
                    title="Buka di Tab Baru"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Tab Baru</span>
                  </a>
                )}

                {/* Info Button inside Previewer */}
                <button
                  type="button"
                  onClick={() => {
                    const target = previewItem.item
                    handleClosePreview()
                    handleOpenInfoPanel(target)
                  }}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition"
                  title="Informasi & Properti Berkas"
                >
                  <Info className="h-4 w-4" />
                </button>

                {/* Explicit Download Button */}
                <button
                  type="button"
                  onClick={() => handleDownloadFile(previewItem.item)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Unduh</span>
                </button>

                {/* Close Previewer */}
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition"
                  title="Tutup Pratinjau (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Previewer Body */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex-1 flex items-center justify-center overflow-auto p-4 sm:p-6 relative"
            >
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 text-slate-300">
                  <Spinner className="h-9 w-9 text-emerald-400" />
                  <span className="text-xs">Memuat pratinjau berkas...</span>
                </div>
              ) : previewItem.category === 'image' && previewItem.url ? (
                <div className="flex items-center justify-center w-full h-full overflow-auto">
                  <img
                    src={previewItem.url}
                    alt={previewItem.item.name}
                    style={{
                      transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                      transition: 'transform 150ms ease-out',
                    }}
                    className="max-h-[82vh] max-w-[92vw] object-contain rounded-lg select-none"
                  />
                </div>
              ) : previewItem.category === 'pdf' && previewItem.url ? (
                <iframe
                  src={previewItem.url}
                  title={previewItem.item.name}
                  className="w-full h-full rounded-xl bg-white border border-slate-700"
                />
              ) : previewItem.category === 'video' && previewItem.url ? (
                <video
                  src={previewItem.url}
                  controls
                  autoPlay
                  className="max-h-[82vh] max-w-[92vw] rounded-2xl border border-slate-800 bg-black"
                />
              ) : previewItem.category === 'audio' && previewItem.url ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center space-y-5">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                    <Music className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{previewItem.item.name}</h4>
                    <p className="text-xs text-slate-500 font-mono">{formatBytes(previewItem.item.size)}</p>
                  </div>
                  <audio src={previewItem.url} controls autoPlay className="w-full" />
                </div>
              ) : previewItem.category === 'archive' ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-md w-full text-center space-y-5 text-slate-900">
                  <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center mx-auto">
                    <FileArchive className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-slate-900 break-all">{previewItem.item.name}</h4>
                    <p className="text-xs text-slate-500">
                      {getHumanFileType(previewItem.item)} • {formatBytes(previewItem.item.size)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Pilih tindakan untuk arsip ini. Anda dapat mengekstrak langsung isinya ke direktori{' '}
                    <code className="font-mono font-semibold text-slate-900">
                      /{currentPath || 'Home'}
                    </code>{' '}
                    atau mengunduhnya ke perangkat Anda.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                    {getFileExtension(previewItem.item) === '.zip' && (
                      <button
                        type="button"
                        onClick={() => handleExtractArchive(previewItem.item)}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center justify-center gap-2"
                      >
                        <FolderOpen className="h-4 w-4" />
                        <span>Ekstrak di Sini</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(previewItem.item)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition flex items-center justify-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Unduh Arsip</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </ModalPortal>

      {/* 10. MOBILE BOTTOM SHEET: INFORMASI & PROPERTI BERKAS (Slide-Up Drawer on Smartphone < 768px) */}
      <ModalPortal isOpen={Boolean(infoItem)}>
        {infoItem && (
          <div
            onClick={() => setInfoItem(null)}
            className="fixed inset-0 !mt-0 z-[9999] md:hidden flex flex-col justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-x-0 bottom-0 z-[9999] rounded-t-2xl bg-white border-t border-slate-200 p-5 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 space-y-4 text-slate-900"
            >
              {/* Drag Handle Bar */}
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1" />

              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-slate-50 border border-slate-200/80 rounded-xl shrink-0">
                    {getFileIcon(infoItem)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {infoItem.name}
                    </h3>
                    <p className="text-[11px] text-slate-500">{getHumanFileType(infoItem)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs (Detail & Aktivitas) */}
              <div className="grid grid-cols-2 border-b border-slate-200 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setInfoTab('detail')}
                  className={`py-2.5 text-center border-b-2 transition ${
                    infoTab === 'detail'
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500'
                  }`}
                >
                  Detail
                </button>
                <button
                  type="button"
                  onClick={() => setInfoTab('aktivitas')}
                  className={`py-2.5 text-center border-b-2 transition ${
                    infoTab === 'aktivitas'
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500'
                  }`}
                >
                  Aktivitas
                </button>
              </div>

              {infoTab === 'detail' ? (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                    <span className="text-slate-500">Jenis</span>
                    <span className="font-semibold text-slate-900">{getHumanFileType(infoItem)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                    <span className="text-slate-500">Ukuran</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {infoItem.is_dir
                        ? '- (Direktori)'
                        : `${formatBytes(infoItem.size)} (${(infoItem.size || 0).toLocaleString('id-ID')} B)`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                    <span className="text-slate-500">Pemilik</span>
                    <span className="font-semibold text-slate-900">saya ({username})</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                    <span className="text-slate-500">Izin Linux (Octal)</span>
                    <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      {infoItem.permissions || (infoItem.is_dir ? '0755' : '0644')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                    <span className="text-slate-500">Dimodifikasi</span>
                    <span className="font-semibold text-slate-900">{formatDate(infoItem.modified)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Lokasi (Jalur Virtual)</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`/home/${username}/${infoItem.path}`)
                          toast.success('Jalur berkas disalin!')
                        }}
                        className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Salin</span>
                      </button>
                    </div>
                    <code className="text-[11px] font-mono text-emerald-700 block break-all">
                      /home/{username}/{infoItem.path}
                    </code>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 py-2 text-xs">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                    <div className="h-6 w-6 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      S
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900">Dimodifikasi oleh saya</p>
                      <p className="text-[11px] text-slate-500">{formatDate(infoItem.modified)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                {!infoItem.is_dir && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = infoItem
                      setInfoItem(null)
                      handleItemOpen(target)
                    }}
                    className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
                  >
                    {getFileCategory(infoItem) === 'text' ? 'Buka Notepad' : 'Pratinjau'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInfoItem(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
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
