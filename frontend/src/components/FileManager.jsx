import React, { useState, useEffect, useRef } from 'react'
import {
  Folder, FileText, ArrowLeft, Plus, Upload, Download, Trash2, Edit3,
  Copy, Move, Key, Eye, Archive, FileArchive, RefreshCw, X, ChevronRight,
  ChevronDown, Search, ArrowUp, CheckSquare, Square, CornerUpLeft, Settings,
  Check, FileCode, Sliders, AlertCircle, Save
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner, SkeletonTable } from './Skeletons'
import ConfirmModal from './ConfirmModal'
import ModalPortal from './ModalPortal'

export default function FileManager({ project, onClose }) {
  if (!project || !project.id) {
    return (
      <div className="text-center py-16 bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-8 shadow-xl text-[#FAF5EC]">
        <Folder className="h-10 w-10 text-[#A47E65] mx-auto mb-3" />
        <h4 className="text-base font-serif font-bold text-[#FAF5EC]">Project Belum Dipilih</h4>
        <p className="text-xs text-[#DFCDB5] max-w-sm mx-auto mt-1 mb-4">
          Silakan pilih project di atas untuk mulai mengelola file praktikum.
        </p>
      </div>
    )
  }

  const [currentPath, setCurrentPath] = useState('')
  const [pathHistory, setPathHistory] = useState([''])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [items, setItems] = useState([])
  const [dirTree, setDirTree] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Selected item state (Single or Multiple)
  const [selectedPaths, setSelectedPaths] = useState([])

  // Active Modals
  const [modalType, setModalType] = useState(null) // 'new_file', 'new_folder', 'rename', 'copy', 'move', 'permissions', 'compress', 'extract', 'view', 'edit', 'upload'

  // Form states for modals
  const [newItemName, setNewItemName] = useState('')
  const [targetDestination, setTargetDestination] = useState('')
  const [permUser, setPermUser] = useState({ r: true, w: true, x: true })
  const [permGroup, setPermGroup] = useState({ r: true, w: false, x: true })
  const [permWorld, setPermWorld] = useState({ r: true, w: false, x: true })
  const [permOctal, setPermOctal] = useState('0755')

  // Editor / Viewer states
  const [activeFile, setActiveFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [contentLoading, setContentLoading] = useState(false)
  const [savingFile, setSavingFile] = useState(false)

  // Upload states
  const [uploadFiles, setUploadFiles] = useState([])
  const [uploading, setUploading] = useState(false)

  // Confirm delete modal
  const [confirmDelete, setConfirmDelete] = useState({ open: false, paths: [] })

  useEffect(() => {
    fetchDirectory(currentPath)
    fetchTree()
  }, [currentPath])

  const fetchDirectory = async (subpath) => {
    setLoading(true)
    setSelectedPaths([])
    try {
      const res = await api.get(`/projects/${project.id}/files?path=${encodeURIComponent(subpath || '')}`)
      setItems(res.data.items || [])
      setCurrentPath(res.data.current_path || '')
    } catch (err) {
      toast.error('Gagal memuat direktori file.')
    } finally {
      setLoading(false)
    }
  }

  const fetchTree = async () => {
    try {
      const res = await api.get(`/projects/${project.id}/files/tree`)
      setDirTree(res.data.tree || null)
    } catch (err) {}
  }

  // Navigation helpers
  const navigateTo = (newPath) => {
    const nextIndex = historyIndex + 1
    const newHistory = pathHistory.slice(0, nextIndex)
    newHistory.push(newPath)
    setPathHistory(newHistory)
    setHistoryIndex(nextIndex)
    setCurrentPath(newPath)
  }

  const handleGoBack = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1
      setHistoryIndex(prevIndex)
      setCurrentPath(pathHistory[prevIndex])
    }
  }

  const handleGoForward = () => {
    if (historyIndex < pathHistory.length - 1) {
      const nextIndex = historyIndex + 1
      setHistoryIndex(nextIndex)
      setCurrentPath(pathHistory[nextIndex])
    }
  }

  const handleUpOneLevel = () => {
    if (!currentPath) return
    const parts = currentPath.split('/')
    parts.pop()
    navigateTo(parts.join('/'))
  }

  const handleGoHome = () => {
    if (currentPath !== '') {
      navigateTo('')
    }
  }

  // Selection toggle
  const toggleSelect = (path, e) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      if (selectedPaths.includes(path)) {
        setSelectedPaths(selectedPaths.filter((p) => p !== path))
      } else {
        setSelectedPaths([...selectedPaths, path])
      }
    } else {
      setSelectedPaths([path])
    }
  }

  const handleSelectAll = () => {
    setSelectedPaths(items.map((i) => i.path))
  }

  const handleUnselectAll = () => {
    setSelectedPaths([])
  }

  const selectedItem = items.find((i) => selectedPaths.includes(i.path))

  // Open / View / Edit File
  const handleOpenFile = async (item, mode = 'edit') => {
    setActiveFile(item)
    setContentLoading(true)
    setModalType(mode)
    try {
      const res = await api.get(`/projects/${project.id}/files/content?path=${encodeURIComponent(item.path)}`)
      setFileContent(res.data.content || '')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membaca konten file.')
      setModalType(null)
    } finally {
      setContentLoading(false)
    }
  }

  const handleSaveFile = async () => {
    if (!activeFile) return
    setSavingFile(true)
    const toastId = toast.loading('Menyimpan perubahan file...')
    try {
      await api.post(`/projects/${project.id}/files/save`, {
        path: activeFile.path,
        content: fileContent,
      })
      toast.success('File berhasil disimpan!', { id: toastId })
    } catch (err) {
      toast.error('Gagal menyimpan file.', { id: toastId })
    } finally {
      setSavingFile(false)
    }
  }

  // Download File
  const handleDownload = () => {
    if (!selectedItem || selectedItem.is_dir) return
    window.open(`/api/projects/${project.id}/files/download?path=${encodeURIComponent(selectedItem.path)}`, '_blank')
  }

  // Permissions Calculation
  const openPermissionsModal = () => {
    if (!selectedItem) return
    const oct = selectedItem.permissions.replace(/^0/, '') || '755'
    const u = parseInt(oct[0], 10) || 7
    const g = parseInt(oct[1], 10) || 5
    const w = parseInt(oct[2], 10) || 5

    setPermUser({ r: (u & 4) !== 0, w: (u & 2) !== 0, x: (u & 1) !== 0 })
    setPermGroup({ r: (g & 4) !== 0, w: (g & 2) !== 0, x: (g & 1) !== 0 })
    setPermWorld({ r: (w & 4) !== 0, w: (w & 2) !== 0, x: (w & 1) !== 0 })
    setPermOctal(selectedItem.permissions)
    setModalType('permissions')
  }

  const calculateOctal = (u, g, w) => {
    const uNum = (u.r ? 4 : 0) + (u.w ? 2 : 0) + (u.x ? 1 : 0)
    const gNum = (g.r ? 4 : 0) + (g.w ? 2 : 0) + (g.x ? 1 : 0)
    const wNum = (w.r ? 4 : 0) + (w.w ? 2 : 0) + (w.x ? 1 : 0)
    return `0${uNum}${gNum}${wNum}`
  }

  const handlePermChange = (role, perm) => {
    let nextU = permUser
    let nextG = permGroup
    let nextW = permWorld

    if (role === 'u') nextU = { ...permUser, [perm]: !permUser[perm] }
    if (role === 'g') nextG = { ...permGroup, [perm]: !permGroup[perm] }
    if (role === 'w') nextW = { ...permWorld, [perm]: !permWorld[perm] }

    setPermUser(nextU)
    setPermGroup(nextG)
    setPermWorld(nextW)
    setPermOctal(calculateOctal(nextU, nextG, nextW))
  }

  const handleSavePermissions = async () => {
    const toastId = toast.loading('Mengubah permission...')
    try {
      await api.post(`/projects/${project.id}/files/permissions`, {
        path: selectedItem.path,
        permissions: permOctal,
      })
      toast.success(`Permission diubah menjadi ${permOctal}`, { id: toastId })
      setModalType(null)
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error('Gagal mengubah permission.', { id: toastId })
    }
  }

  // Rename
  const handleRename = async (e) => {
    e.preventDefault()
    if (!selectedItem || !newItemName) return
    const toastId = toast.loading(`Mengubah nama menjadi ${newItemName}...`)
    try {
      await api.post(`/projects/${project.id}/files/rename`, {
        old_path: selectedItem.path,
        new_name: newItemName.trim(),
      })
      toast.success('Nama berhasil diubah!', { id: toastId })
      setModalType(null)
      fetchDirectory(currentPath)
      fetchTree()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengubah nama.', { id: toastId })
    }
  }

  // Copy / Move
  const handleCopyMove = async (isMove) => {
    const action = isMove ? 'move' : 'copy'
    const toastId = toast.loading(`${isMove ? 'Memindahkan' : 'Menyalin'} item...`)
    try {
      await api.post(`/projects/${project.id}/files/${action}`, {
        source_path: selectedItem.path,
        dest_dir: targetDestination.trim(),
      })
      toast.success(`Berhasil ${isMove ? 'dipindahkan' : 'disalin'}!`, { id: toastId })
      setModalType(null)
      fetchDirectory(currentPath)
      fetchTree()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operasi gagal.', { id: toastId })
    }
  }

  // Compress to ZIP
  const handleCompress = async (e) => {
    e.preventDefault()
    if (!targetDestination) return
    const zipName = targetDestination.endsWith('.zip') ? targetDestination : `${targetDestination}.zip`
    const destZip = currentPath ? `${currentPath}/${zipName}` : zipName
    const toastId = toast.loading(`Mengompresi ke ${zipName}...`)
    try {
      await api.post(`/projects/${project.id}/files/compress`, {
        paths: selectedPaths,
        destination_zip: destZip,
      })
      toast.success('File berhasil dikompresi!', { id: toastId })
      setModalType(null)
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengompresi.', { id: toastId })
    }
  }

  // Extract ZIP
  const handleExtract = async (e) => {
    e.preventDefault()
    if (!selectedItem) return
    const toastId = toast.loading('Mengekstrak file ZIP...')
    try {
      await api.post(`/projects/${project.id}/files/extract`, {
        zip_path: selectedItem.path,
        extract_to: targetDestination || currentPath,
      })
      toast.success('Arsip berhasil diekstrak!', { id: toastId })
      setModalType(null)
      fetchDirectory(currentPath)
      fetchTree()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengekstrak.', { id: toastId })
    }
  }

  // Create New File / Folder
  const handleCreateNewItem = async (e) => {
    e.preventDefault()
    const isDir = modalType === 'new_folder'
    const toastId = toast.loading(`Membuat ${isDir ? 'folder' : 'file'} baru...`)
    try {
      await api.post(`/projects/${project.id}/files/new`, {
        path: currentPath,
        name: newItemName.trim(),
        is_dir: isDir,
      })
      toast.success(`${isDir ? 'Folder' : 'File'} berhasil dibuat!`, { id: toastId })
      setModalType(null)
      setNewItemName('')
      fetchDirectory(currentPath)
      fetchTree()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membuat item.', { id: toastId })
    }
  }

  // Upload Files
  const handleUploadFiles = async (e) => {
    e.preventDefault()
    if (!uploadFiles || uploadFiles.length === 0) return
    setUploading(true)
    const toastId = toast.loading(`Meng-upload ${uploadFiles.length} file...`)

    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const formData = new FormData()
        formData.append('path', currentPath)
        formData.append('file', uploadFiles[i])
        await api.post(`/projects/${project.id}/files/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      toast.success('Upload selesai!', { id: toastId })
      setModalType(null)
      setUploadFiles([])
      fetchDirectory(currentPath)
      fetchTree()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal upload file.', { id: toastId })
    } finally {
      setUploading(false)
    }
  }

  // Delete Items
  const executeDelete = async () => {
    const toastId = toast.loading('Menghapus file yang dipilih...')
    try {
      for (const p of confirmDelete.paths) {
        await api.delete(`/projects/${project.id}/files?path=${encodeURIComponent(p)}`)
      }
      toast.success('Item berhasil dihapus.', { id: toastId })
      fetchDirectory(currentPath)
      fetchTree()
    } catch (err) {
      toast.error('Gagal menghapus.', { id: toastId })
    }
  }

  const formatBytes = (bytes) => {
    try {
      const num = Number(bytes)
      if (!num || num <= 0 || isNaN(num)) return '0 KB'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(num) / Math.log(k))
      return parseFloat((num / Math.pow(k, i)).toFixed(1)) + ' ' + (sizes[i] || 'KB')
    } catch (e) {
      return '0 KB'
    }
  }

  const formatDate = (timestamp) => {
    try {
      if (!timestamp) return '-'
      const d = new Date(Number(timestamp) * 1000)
      if (isNaN(d.getTime())) return '-'
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } catch (e) {
      return '-'
    }
  }

  // Filter items by search
  const filteredItems = (items || []).filter((i) => {
    if (!i || !i.name) return false
    return searchQuery ? i.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  })

  // Left Directory Tree Recursive Component
  const renderTree = (node, depth = 0) => {
    if (!node) return null
    const isCurrent = node.path === currentPath

    return (
      <div key={`${node.path || 'root'}-${depth}`} className="select-none text-xs">
        <div
          onClick={() => navigateTo(node.path)}
          className={`flex items-center space-x-1.5 py-1 px-2 rounded-lg cursor-pointer transition ${
            isCurrent
              ? 'bg-[#3A2115] text-[#E8DCB8] font-semibold border-l-2 border-[#C49767]'
              : 'text-[#DFCDB5]/80 hover:bg-[#341F14] hover:text-[#FAF5EC]'
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 16)}px` }}
        >
          <Folder className={`h-3.5 w-3.5 shrink-0 ${isCurrent ? 'text-[#E8DCB8]' : 'text-[#A47E65]'}`} />
          <span className="truncate">{node.name}</span>
        </div>
        {node.children && node.children.length > 0 && (
          <div>{node.children.map((child, idx) => renderTree(child, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. cPanel Top Navigation Header (Image 2) */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-4 shadow-xl text-[#FAF5EC]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-2.5 rounded-2xl bg-[#3A2115] hover:bg-[#482A1B] text-[#E8DCB8] transition shadow-sm"
              title="Kembali ke Daftar Aplikasi"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-xl bg-[#5A3521] flex items-center justify-center font-bold text-[#FAF5EC] text-xs font-mono">
                cP
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-[#FAF5EC]">
                  File Manager — {project.name}
                </h3>
                <p className="text-[10px] text-[#DFCDB5]/70 font-mono">
                  Sandbox: /home/student/{project.nim || 'lab'}/{project.name}
                </p>
              </div>
            </div>
          </div>

          {/* Search Bar & Setting */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search file name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#1C0F0A] border border-[#3E2316] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#FAF5EC] placeholder-[#553826] focus:outline-none focus:border-[#C49767] w-48 sm:w-64 font-sans"
              />
              <Search className="h-3.5 w-3.5 text-[#A47E65] absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
            <button
              onClick={() => fetchDirectory(currentPath)}
              className="p-2 rounded-xl bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] transition"
              title="Reload"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 2. cPanel Primary Action Toolbar (Image 2) */}
        <div className="flex items-center space-x-1 overflow-x-auto py-2.5 mt-3 border-t border-[#3E2316] text-xs">
          {/* + File */}
          <button
            onClick={() => { setNewItemName(''); setModalType('new_file'); }}
            className="px-2.5 py-1.5 rounded-xl hover:bg-[#3A2115] text-[#E8DCB8] inline-flex items-center space-x-1 transition shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>File</span>
          </button>

          {/* + Folder */}
          <button
            onClick={() => { setNewItemName(''); setModalType('new_folder'); }}
            className="px-2.5 py-1.5 rounded-xl hover:bg-[#3A2115] text-[#E8DCB8] inline-flex items-center space-x-1 transition shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Folder</span>
          </button>

          <span className="h-4 w-px bg-[#3E2316] mx-1"></span>

          {/* Copy */}
          <button
            onClick={() => { setTargetDestination(currentPath); setModalType('copy'); }}
            disabled={!selectedItem}
            className="px-2.5 py-1.5 rounded-xl hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-40 inline-flex items-center space-x-1 transition shrink-0"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Copy</span>
          </button>

          {/* Move */}
          <button
            onClick={() => { setTargetDestination(currentPath); setModalType('move'); }}
            disabled={!selectedItem}
            className="px-2.5 py-1.5 rounded-xl hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-40 inline-flex items-center space-x-1 transition shrink-0"
          >
            <Move className="h-3.5 w-3.5" />
            <span>Move</span>
          </button>

          {/* Upload */}
          <button
            onClick={() => setModalType('upload')}
            className="px-2.5 py-1.5 rounded-xl bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] inline-flex items-center space-x-1 transition shadow-sm shrink-0"
          >
            <Upload className="h-3.5 w-3.5 text-[#E8DCB8]" />
            <span>Upload</span>
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={!selectedItem || selectedItem.is_dir}
            className="px-2.5 py-1.5 rounded-xl hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-40 inline-flex items-center space-x-1 transition shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </button>

          {/* Delete */}
          <button
            onClick={() => setConfirmDelete({ open: true, paths: selectedPaths })}
            disabled={selectedPaths.length === 0}
            className="px-2.5 py-1.5 rounded-xl hover:bg-rose-500/20 text-rose-400 disabled:opacity-40 inline-flex items-center space-x-1 transition shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>

          <span className="h-4 w-px bg-[#3E2316] mx-1"></span>

          {/* Rename */}
          <button
            onClick={() => { setNewItemName(selectedItem?.name || ''); setModalType('rename'); }}
            disabled={!selectedItem}
            className="px-2.5 py-1.5 rounded-xl hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-40 inline-flex items-center space-x-1 transition shrink-0"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Rename</span>
          </button>

          {/* Edit */}
          <button
            onClick={() => handleOpenFile(selectedItem, 'edit')}
            disabled={!selectedItem || selectedItem.is_dir}
            className="px-2.5 py-1.5 rounded-xl hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-40 inline-flex items-center space-x-1 transition shrink-0"
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>

          {/* Permissions */}
          <button
            onClick={openPermissionsModal}
            disabled={!selectedItem}
            className="px-2.5 py-1.5 rounded-xl hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-40 inline-flex items-center space-x-1 transition shrink-0"
          >
            <Key className="h-3.5 w-3.5" />
            <span>Permissions</span>
          </button>

          {/* View */}
          <button
            onClick={() => handleOpenFile(selectedItem, 'view')}
            disabled={!selectedItem || selectedItem.is_dir}
            className="px-2.5 py-1.5 rounded-xl hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-40 inline-flex items-center space-x-1 transition shrink-0"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>View</span>
          </button>

          <span className="h-4 w-px bg-[#3E2316] mx-1"></span>

          {/* Extract */}
          <button
            onClick={() => { setTargetDestination(currentPath); setModalType('extract'); }}
            disabled={!selectedItem || !selectedItem.name || !selectedItem.name.endsWith('.zip')}
            className="px-2.5 py-1.5 rounded-xl hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-40 inline-flex items-center space-x-1 transition shrink-0"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Extract</span>
          </button>

          {/* Compress */}
          <button
            onClick={() => { setTargetDestination('archive.zip'); setModalType('compress'); }}
            disabled={selectedPaths.length === 0}
            className="px-2.5 py-1.5 rounded-xl hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-40 inline-flex items-center space-x-1 transition shrink-0"
          >
            <FileArchive className="h-3.5 w-3.5" />
            <span>Compress</span>
          </button>
        </div>

        {/* 3. cPanel Location Sub-bar (Image 2) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#3E2316] text-[11px] font-mono">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleGoHome}
              className="px-2 py-1 rounded-lg bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] transition"
              title="Home"
            >
              Home
            </button>
            <button
              onClick={handleUpOneLevel}
              disabled={!currentPath}
              className="px-2 py-1 rounded-lg bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] disabled:opacity-40 transition"
              title="Up One Level"
            >
              ↑ Up One Level
            </button>
            <button
              onClick={handleGoBack}
              disabled={historyIndex <= 0}
              className="px-2 py-1 rounded-lg bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] disabled:opacity-40 transition"
            >
              ← Back
            </button>
            <button
              onClick={handleGoForward}
              disabled={historyIndex >= pathHistory.length - 1}
              className="px-2 py-1 rounded-lg bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] disabled:opacity-40 transition"
            >
              → Forward
            </button>
            <button
              onClick={() => fetchDirectory(currentPath)}
              className="px-2 py-1 rounded-lg bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] transition"
            >
              Reload
            </button>
            <button
              onClick={handleSelectAll}
              className="px-2 py-1 rounded-lg bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] transition"
            >
              Select All
            </button>
            <button
              onClick={handleUnselectAll}
              className="px-2 py-1 rounded-lg bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] transition"
            >
              Unselect All
            </button>
          </div>

          <div className="flex items-center space-x-1 bg-[#1C0F0A] border border-[#3E2316] px-3 py-1 rounded-xl text-[#E8DCB8]">
            <span className="text-[#A47E65]">/home/{project.nim || 'student'}/{project.name}</span>
            <span>/{currentPath}</span>
          </div>
        </div>
      </div>

      {/* 4. cPanel Workspace: Left Directory Tree + Right File Table (Image 2) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Left Directory Tree View */}
        <div className="hidden md:block col-span-1 bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-4 shadow-xl text-[#FAF5EC] max-h-[600px] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#3E2316] text-xs font-semibold text-[#DFCDB5]">
            <span>Folder Tree</span>
            <button onClick={fetchTree} className="text-[#A47E65] hover:text-[#FAF5EC]">
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
          {dirTree ? (
            renderTree(dirTree)
          ) : (
            <div className="text-xs text-[#A47E65] p-2">Memuat tree direktori...</div>
          )}
        </div>

        {/* Right Main File Table (Matching Columns of Image 2) */}
        <div className="col-span-1 md:col-span-3 bg-[#2B1810] border border-[#4D2D1E] rounded-3xl overflow-hidden shadow-2xl text-[#FAF5EC] flex flex-col justify-between">
          <div className="overflow-x-auto min-h-[400px]">
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={6} />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-20 p-6">
                <Folder className="h-10 w-10 text-[#5A3521] mx-auto mb-2" />
                <p className="text-xs text-[#DFCDB5]">Folder ini kosong.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1C0F0A] text-[#DFCDB5] uppercase text-[10px] tracking-wider border-b border-[#3E2316]">
                  <tr>
                    <th className="p-3.5 pl-4">Name</th>
                    <th className="p-3.5">Size</th>
                    <th className="p-3.5">Last Modified</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5 pr-4 text-right">Permissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3E2316]">
                  {filteredItems.map((item) => {
                    const isSelected = selectedPaths.includes(item.path)

                    return (
                      <tr
                        key={item.path}
                        onClick={(e) => toggleSelect(item.path, e)}
                        onDoubleClick={() => {
                          if (item.is_dir) {
                            navigateTo(item.path)
                          } else {
                            handleOpenFile(item, 'edit')
                          }
                        }}
                        className={`cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-[#442718] text-[#FAF5EC] font-semibold'
                            : 'hover:bg-[#341F14] text-[#FAF5EC]'
                        }`}
                      >
                        {/* Name */}
                        <td className="p-3.5 pl-4">
                          <div className="flex items-center space-x-2.5">
                            {item.is_dir ? (
                              <Folder className="h-4 w-4 text-[#C49767] shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-[#A47E65] shrink-0" />
                            )}
                            <span className="font-mono text-xs">{item.name}</span>
                          </div>
                        </td>

                        {/* Size */}
                        <td className="p-3.5 font-mono text-[11px] text-[#DFCDB5]/80">
                          {item.is_dir ? '4 KB' : formatBytes(item.size)}
                        </td>

                        {/* Last Modified */}
                        <td className="p-3.5 text-[#DFCDB5]/80 font-mono text-[11px]">
                          {formatDate(item.modified)}
                        </td>

                        {/* Type */}
                        <td className="p-3.5 text-[#DFCDB5]/70 font-mono text-[11px]">
                          {item.type}
                        </td>

                        {/* Permissions (Octal e.g. 0755, 0644) */}
                        <td className="p-3.5 pr-4 text-right font-mono text-[11px] text-[#E8DCB8]">
                          {item.permissions}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer info */}
          <div className="p-3.5 bg-[#1C0F0A] border-t border-[#3E2316] text-[11px] font-mono text-[#DFCDB5]/70 flex items-center justify-between">
            <span>Total: {filteredItems.length} items ({filteredItems.filter((i) => i.is_dir).length} folders, {filteredItems.filter((i) => !i.is_dir).length} files)</span>
            <span>{selectedPaths.length} item dipilih</span>
          </div>
        </div>
      </div>

      {/* 5. EDIT CODE MODAL */}
      <ModalPortal isOpen={modalType === 'edit' && Boolean(activeFile)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 flex flex-col max-h-[85vh] text-[#FAF5EC]">
            <div className="flex items-center justify-between pb-3 border-b border-[#3E2316] mb-3">
              <div>
                <h4 className="text-base font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
                  <FileCode className="h-4 w-4 text-[#E8DCB8]" />
                  <span>Editor: {activeFile?.name}</span>
                </h4>
                <p className="text-[11px] text-[#DFCDB5] font-mono">/{activeFile?.path}</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveFile}
                  disabled={savingFile}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] flex items-center space-x-1.5 transition disabled:opacity-50"
                >
                  {savingFile ? <Spinner size="xs" /> : <Save className="h-3.5 w-3.5 text-[#E8DCB8]" />}
                  <span>Save (Ctrl+S)</span>
                </button>
                <button
                  onClick={() => setModalType(null)}
                  className="p-2 rounded-xl text-[#DFCDB5] hover:text-white hover:bg-[#3E2316] transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-2xl border border-[#3E2316]">
              {contentLoading ? (
                <div className="p-8 text-center text-xs text-[#DFCDB5]">Memuat isi file...</div>
              ) : (
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                      e.preventDefault()
                      handleSaveFile()
                    }
                  }}
                  className="w-full h-96 p-4 font-mono text-xs bg-[#1C0F0A] text-[#FAF5EC] focus:outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />
              )}
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* 6. VIEW FILE MODAL */}
      <ModalPortal isOpen={modalType === 'view' && Boolean(activeFile)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 flex flex-col max-h-[80vh] text-[#FAF5EC]">
            <div className="flex items-center justify-between pb-3 border-b border-[#3E2316] mb-3">
              <h4 className="text-base font-serif font-bold text-[#FAF5EC]">View: {activeFile?.name}</h4>
              <button onClick={() => setModalType(null)} className="p-2 text-[#DFCDB5] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="p-4 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] font-mono text-xs text-[#DFCDB5] overflow-auto flex-1 whitespace-pre-wrap">
              {fileContent}
            </pre>
          </div>
        </div>
      </ModalPortal>

      {/* 7. PERMISSIONS MODAL (cPanel Style Octal Matrix) */}
      <ModalPortal isOpen={modalType === 'permissions' && Boolean(selectedItem)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 text-[#FAF5EC] space-y-4">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC]">
              Change Permissions: {selectedItem?.name}
            </h4>
            <p className="text-xs text-[#DFCDB5]">Atur hak akses UNIX (chmod) untuk item ini.</p>

            {/* Matrix Table */}
            <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-4 text-xs font-mono">
              <div className="grid grid-cols-4 gap-2 pb-2 border-b border-[#3E2316] text-[#A47E65] font-semibold text-center">
                <span>Role</span>
                <span>Read (4)</span>
                <span>Write (2)</span>
                <span>Execute (1)</span>
              </div>

              {/* User */}
              <div className="grid grid-cols-4 gap-2 py-2 items-center text-center">
                <span className="text-left font-bold text-[#E8DCB8]">User</span>
                <input type="checkbox" checked={permUser.r} onChange={() => handlePermChange('u', 'r')} className="h-4 w-4 accent-[#C49767] mx-auto" />
                <input type="checkbox" checked={permUser.w} onChange={() => handlePermChange('u', 'w')} className="h-4 w-4 accent-[#C49767] mx-auto" />
                <input type="checkbox" checked={permUser.x} onChange={() => handlePermChange('u', 'x')} className="h-4 w-4 accent-[#C49767] mx-auto" />
              </div>

              {/* Group */}
              <div className="grid grid-cols-4 gap-2 py-2 items-center text-center">
                <span className="text-left font-bold text-[#E8DCB8]">Group</span>
                <input type="checkbox" checked={permGroup.r} onChange={() => handlePermChange('g', 'r')} className="h-4 w-4 accent-[#C49767] mx-auto" />
                <input type="checkbox" checked={permGroup.w} onChange={() => handlePermChange('g', 'w')} className="h-4 w-4 accent-[#C49767] mx-auto" />
                <input type="checkbox" checked={permGroup.x} onChange={() => handlePermChange('g', 'x')} className="h-4 w-4 accent-[#C49767] mx-auto" />
              </div>

              {/* World */}
              <div className="grid grid-cols-4 gap-2 py-2 items-center text-center">
                <span className="text-left font-bold text-[#E8DCB8]">World</span>
                <input type="checkbox" checked={permWorld.r} onChange={() => handlePermChange('w', 'r')} className="h-4 w-4 accent-[#C49767] mx-auto" />
                <input type="checkbox" checked={permWorld.w} onChange={() => handlePermChange('w', 'w')} className="h-4 w-4 accent-[#C49767] mx-auto" />
                <input type="checkbox" checked={permWorld.x} onChange={() => handlePermChange('w', 'x')} className="h-4 w-4 accent-[#C49767] mx-auto" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#DFCDB5]">Permission Code:</span>
              <span className="px-3 py-1 rounded-lg bg-[#1C0F0A] border border-[#3E2316] font-bold text-amber-300">{permOctal}</span>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] transition"
              >
                Change Permissions
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* 8. RENAME MODAL */}
      <ModalPortal isOpen={modalType === 'rename' && Boolean(selectedItem)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 text-[#FAF5EC]">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC] mb-1">Rename Item</h4>
            <p className="text-xs text-[#DFCDB5] mb-4">Nama baru untuk {selectedItem?.name}:</p>
            <form onSubmit={handleRename} className="space-y-4">
              <input
                type="text"
                required
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#DFCDB5] hover:bg-[#3A2115]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC]"
                >
                  Rename File
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* 9. COPY / MOVE MODAL */}
      <ModalPortal isOpen={(modalType === 'copy' || modalType === 'move') && Boolean(selectedItem)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 text-[#FAF5EC]">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC] mb-1">
              {modalType === 'move' ? 'Move File' : 'Copy File'}
            </h4>
            <p className="text-xs text-[#DFCDB5] mb-4">
              Tentukan path direktori tujuan untuk '{selectedItem?.name}':
            </p>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="e.g. app atau kosongkan untuk root"
                value={targetDestination}
                onChange={(e) => setTargetDestination(e.target.value)}
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#DFCDB5] hover:bg-[#3A2115]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyMove(modalType === 'move')}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC]"
                >
                  {modalType === 'move' ? 'Move File' : 'Copy File'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* 10. COMPRESS MODAL */}
      <ModalPortal isOpen={modalType === 'compress'}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 text-[#FAF5EC]">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC] mb-1">Compress Items</h4>
            <p className="text-xs text-[#DFCDB5] mb-4">Nama arsip ZIP yang akan dibuat:</p>
            <form onSubmit={handleCompress} className="space-y-4">
              <input
                type="text"
                required
                value={targetDestination}
                onChange={(e) => setTargetDestination(e.target.value)}
                placeholder="archive.zip"
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#DFCDB5] hover:bg-[#3A2115]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC]"
                >
                  Compress File(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* 11. EXTRACT MODAL */}
      <ModalPortal isOpen={modalType === 'extract' && Boolean(selectedItem)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 text-[#FAF5EC]">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC] mb-1">Extract Archive</h4>
            <p className="text-xs text-[#DFCDB5] mb-4">
              Ekstrak '{selectedItem?.name}' ke path direktori:
            </p>
            <form onSubmit={handleExtract} className="space-y-4">
              <input
                type="text"
                placeholder="e.g. app atau kosongkan untuk folder saat ini"
                value={targetDestination}
                onChange={(e) => setTargetDestination(e.target.value)}
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#DFCDB5] hover:bg-[#3A2115]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC]"
                >
                  Extract File(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* 12. NEW FILE / FOLDER MODAL */}
      <ModalPortal isOpen={modalType === 'new_file' || modalType === 'new_folder'}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 text-[#FAF5EC]">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC] mb-1">
              {modalType === 'new_folder' ? 'Create New Folder' : 'Create New File'}
            </h4>
            <p className="text-xs text-[#DFCDB5] mb-4">Lokasi: /{currentPath || ''}</p>
            <form onSubmit={handleCreateNewItem} className="space-y-4">
              <input
                type="text"
                required
                placeholder={modalType === 'new_folder' ? 'folder-name' : 'index.php'}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#DFCDB5] hover:bg-[#3A2115]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC]"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* 13. UPLOAD MODAL */}
      <ModalPortal isOpen={modalType === 'upload'}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 text-[#FAF5EC]">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC] mb-1">Upload Files</h4>
            <p className="text-xs text-[#DFCDB5] mb-4">
              Upload file atau arsip .ZIP ke folder /{currentPath || ''}.
            </p>
            <form onSubmit={handleUploadFiles} className="space-y-4">
              <div className="border-2 border-dashed border-[#4D2D1E] hover:border-[#C49767] rounded-3xl p-6 text-center transition bg-[#1C0F0A]/70">
                <Upload className="h-8 w-8 text-[#A47E65] mx-auto mb-2" />
                <input
                  type="file"
                  multiple
                  required
                  onChange={(e) => setUploadFiles(Array.from(e.target.files))}
                  className="hidden"
                  id="cpanel-upload-input"
                />
                <label
                  htmlFor="cpanel-upload-input"
                  className="cursor-pointer text-xs font-semibold text-[#E8DCB8] hover:underline block"
                >
                  {uploadFiles.length > 0
                    ? `${uploadFiles.length} file dipilih`
                    : 'Pilih file dari komputer Anda'}
                </label>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#DFCDB5] hover:bg-[#3A2115]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploading || uploadFiles.length === 0}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] disabled:opacity-50"
                >
                  {uploading ? 'Meng-upload...' : 'Upload Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.open}
        title="Delete File(s)?"
        message={`Apakah Anda yakin ingin menghapus ${confirmDelete.paths.length} item yang dipilih secara permanen?`}
        confirmText="Trash / Delete"
        onConfirm={executeDelete}
        onClose={() => setConfirmDelete({ open: false, paths: [] })}
      />
    </div>
  )
}
