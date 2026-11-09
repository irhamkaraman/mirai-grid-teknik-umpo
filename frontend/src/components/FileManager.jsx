import React, { useState, useEffect, useRef } from 'react'
import {
  Folder, FileText, ArrowLeft, Plus, Upload, Download, Trash2, Edit3,
  Copy, Move, Key, Eye, Archive, FileArchive, RefreshCw, X, ChevronRight,
  ChevronDown, Search, ArrowUp, CheckSquare, Square, CornerUpLeft, Settings,
  Check, FileCode, Sliders, AlertCircle, Save, HardDrive, Terminal,
  ExternalLink, FileSpreadsheet, Image as ImageIcon
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner, SkeletonTable } from './Skeletons'
import ConfirmModal from './ConfirmModal'
import ModalPortal from './ModalPortal'

export default function FileManager({ project: initialProject, projects: propProjects, onClose }) {
  const [projects, setProjects] = useState(propProjects || (initialProject ? [initialProject] : []))
  const [activeProject, setActiveProject] = useState(initialProject || (propProjects && propProjects.length > 0 ? propProjects[0] : null))
  const [projectTrees, setProjectTrees] = useState({})
  const [expandedProjects, setExpandedProjects] = useState({})
  const [expandedDirs, setExpandedDirs] = useState({})

  const [currentPath, setCurrentPath] = useState('')
  const [pathHistory, setPathHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPaths, setSelectedPaths] = useState([])

  // Active Modals
  const [modalType, setModalType] = useState(null)
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

  // 1. Initial Load: Projects & Trees
  useEffect(() => {
    if (!propProjects || propProjects.length === 0) {
      loadAllProjects()
    } else {
      setProjects(propProjects)
      if (!activeProject && propProjects.length > 0) {
        setActiveProject(propProjects[0])
      }
      fetchAllTrees(propProjects)
    }
  }, [propProjects])

  const loadAllProjects = async () => {
    try {
      const res = await api.get('/projects')
      const pList = res.data || []
      setProjects(pList)
      if (pList.length > 0) {
        const chosen = initialProject ? (pList.find(p => p.id === initialProject.id) || pList[0]) : pList[0]
        setActiveProject(chosen)
        fetchAllTrees(pList)
      }
    } catch (err) {
      toast.error('Gagal memuat daftar project deployment.')
    }
  }

  const fetchAllTrees = async (pList = projects) => {
    const trees = {}
    const exp = { ...expandedProjects }
    for (const p of pList) {
      try {
        const res = await api.get(`/projects/${p.id}/files/tree`)
        trees[p.id] = res.data.tree || null
        if (exp[p.id] === undefined) {
          exp[p.id] = true // auto expand root projects
        }
      } catch (err) {}
    }
    setProjectTrees(trees)
    setExpandedProjects(exp)
  }

  // 2. Fetch Directory when activeProject or currentPath changes
  useEffect(() => {
    if (activeProject && activeProject.id) {
      fetchDirectory(activeProject.id, currentPath)
    }
  }, [activeProject?.id, currentPath])

  const fetchDirectory = async (projectId, subpath) => {
    if (!projectId) return
    setLoading(true)
    setSelectedPaths([])
    try {
      const res = await api.get(`/projects/${projectId}/files?path=${encodeURIComponent(subpath || '')}`)
      setItems(res.data.items || [])
      setCurrentPath(res.data.current_path || '')
    } catch (err) {
      toast.error('Gagal memuat direktori file.')
    } finally {
      setLoading(false)
    }
  }

  // History Navigation Helpers
  const navigateTo = (newPath, targetProject = activeProject) => {
    if (!targetProject) return
    const entry = { projectId: targetProject.id, path: newPath }
    const nextIndex = historyIndex + 1
    const newHistory = pathHistory.slice(0, nextIndex)
    newHistory.push(entry)
    setPathHistory(newHistory)
    setHistoryIndex(nextIndex)
    if (activeProject?.id !== targetProject.id) {
      setActiveProject(targetProject)
    }
    setCurrentPath(newPath)
  }

  const handleGoBack = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1
      setHistoryIndex(prevIndex)
      const target = pathHistory[prevIndex]
      const p = projects.find(item => item.id === target.projectId) || activeProject
      setActiveProject(p)
      setCurrentPath(target.path)
    }
  }

  const handleGoForward = () => {
    if (historyIndex < pathHistory.length - 1) {
      const nextIndex = historyIndex + 1
      setHistoryIndex(nextIndex)
      const target = pathHistory[nextIndex]
      const p = projects.find(item => item.id === target.projectId) || activeProject
      setActiveProject(p)
      setCurrentPath(target.path)
    }
  }

  const handleUpOneLevel = () => {
    if (!currentPath) return
    const parts = currentPath.split('/')
    parts.pop()
    navigateTo(parts.join('/'), activeProject)
  }

  const handleGoHome = () => {
    if (currentPath !== '') {
      navigateTo('', activeProject)
    }
  }

  const handleSelectProject = (p) => {
    if (activeProject?.id === p.id && currentPath === '') return
    navigateTo('', p)
    setExpandedProjects(prev => ({ ...prev, [p.id]: true }))
  }

  const handleSelectSubfolder = (p, path) => {
    navigateTo(path, p)
  }

  const toggleExpandProject = (pId) => {
    setExpandedProjects(prev => ({ ...prev, [pId]: !prev[pId] }))
  }

  const toggleExpandDir = (key) => {
    setExpandedDirs(prev => ({ ...prev, [key]: !prev[key] }))
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

  // File Operations
  const handleOpenFile = async (item, mode = 'edit') => {
    if (!item || item.is_dir || !activeProject) return
    setActiveFile(item)
    setContentLoading(true)
    setModalType(mode)
    try {
      const res = await api.get(`/projects/${activeProject.id}/files/content?path=${encodeURIComponent(item.path)}`)
      setFileContent(res.data.content || '')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membaca konten file.')
      setModalType(null)
    } finally {
      setContentLoading(false)
    }
  }

  const handleSaveFile = async () => {
    if (!activeFile || !activeProject) return
    setSavingFile(true)
    const toastId = toast.loading('Menyimpan perubahan file...')
    try {
      await api.post(`/projects/${activeProject.id}/files/save`, {
        path: activeFile.path,
        content: fileContent,
      })
      toast.success('File berhasil disimpan!', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan file.', { id: toastId })
    } finally {
      setSavingFile(false)
    }
  }

  const handleDownload = () => {
    if (!selectedItem || selectedItem.is_dir || !activeProject) return
    window.open(`/api/projects/${activeProject.id}/files/download?path=${encodeURIComponent(selectedItem.path)}`, '_blank')
  }

  // Permissions helpers
  const openPermissionsModal = () => {
    if (!selectedItem) return
    const permStr = String(selectedItem.permissions || '0755').padStart(4, '0')
    const u = parseInt(permStr[1] || '7', 10)
    const g = parseInt(permStr[2] || '5', 10)
    const w = parseInt(permStr[3] || '5', 10)

    setPermUser({ r: (u & 4) !== 0, w: (u & 2) !== 0, x: (u & 1) !== 0 })
    setPermGroup({ r: (g & 4) !== 0, w: (g & 2) !== 0, x: (g & 1) !== 0 })
    setPermWorld({ r: (w & 4) !== 0, w: (w & 2) !== 0, x: (w & 1) !== 0 })
    setPermOctal(permStr)
    setModalType('permissions')
  }

  const handlePermChange = (role, action) => {
    const updateObj = (prev) => ({ ...prev, [action]: !prev[action] })
    let newU = permUser
    let newG = permGroup
    let newW = permWorld

    if (role === 'u') newU = updateObj(permUser)
    if (role === 'g') newG = updateObj(permGroup)
    if (role === 'w') newW = updateObj(permWorld)

    setPermUser(newU)
    setPermGroup(newG)
    setPermWorld(newW)

    const calcOctal = (o) => (o.r ? 4 : 0) + (o.w ? 2 : 0) + (o.x ? 1 : 0)
    const code = `0${calcOctal(newU)}${calcOctal(newG)}${calcOctal(newW)}`
    setPermOctal(code)
  }

  const handleSavePermissions = async () => {
    if (!selectedItem || !activeProject) return
    const toastId = toast.loading('Mengubah hak akses file...')
    try {
      await api.post(`/projects/${activeProject.id}/files/permissions`, {
        path: selectedItem.path,
        permissions: permOctal,
      })
      toast.success('Permissions berhasil diubah!', { id: toastId })
      setModalType(null)
      fetchDirectory(activeProject.id, currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengubah permissions.', { id: toastId })
    }
  }

  const handleRename = async (e) => {
    e.preventDefault()
    if (!selectedItem || !newItemName.trim() || !activeProject) return
    const toastId = toast.loading('Mengubah nama item...')
    try {
      await api.post(`/projects/${activeProject.id}/files/rename`, {
        old_path: selectedItem.path,
        new_name: newItemName.trim(),
      })
      toast.success('Item berhasil di-rename!', { id: toastId })
      setModalType(null)
      fetchDirectory(activeProject.id, currentPath)
      fetchAllTrees()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengubah nama item.', { id: toastId })
    }
  }

  const handleCopyMove = async (isMove) => {
    if (!selectedItem || !activeProject) return
    const action = isMove ? 'move' : 'copy'
    const toastId = toast.loading(`${isMove ? 'Memindahkan' : 'Menyalin'} item...`)
    try {
      await api.post(`/projects/${activeProject.id}/files/${action}`, {
        source_path: selectedItem.path,
        dest_dir: targetDestination.trim(),
      })
      toast.success(`Item berhasil di-${action}!`, { id: toastId })
      setModalType(null)
      fetchDirectory(activeProject.id, currentPath)
      fetchAllTrees()
    } catch (err) {
      toast.error(err.response?.data?.detail || `Gagal melakukan ${action}.`, { id: toastId })
    }
  }

  const handleCompress = async (e) => {
    e.preventDefault()
    if (selectedPaths.length === 0 || !activeProject) return
    const toastId = toast.loading('Mengompresi item ke arsip ZIP...')
    const destZip = targetDestination.endsWith('.zip') ? targetDestination : `${targetDestination}.zip`
    try {
      await api.post(`/projects/${activeProject.id}/files/compress`, {
        paths: selectedPaths,
        destination_zip: destZip,
      })
      toast.success('Arsip ZIP berhasil dibuat!', { id: toastId })
      setModalType(null)
      fetchDirectory(activeProject.id, currentPath)
      fetchAllTrees()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengompresi item.', { id: toastId })
    }
  }

  const handleExtract = async (e) => {
    e.preventDefault()
    if (!selectedItem || !activeProject) return
    const toastId = toast.loading('Mengekstrak arsip ZIP...')
    try {
      await api.post(`/projects/${activeProject.id}/files/extract`, {
        zip_path: selectedItem.path,
        extract_to: targetDestination || currentPath,
      })
      toast.success('Ekstraksi selesai!', { id: toastId })
      setModalType(null)
      fetchDirectory(activeProject.id, currentPath)
      fetchAllTrees()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengekstrak ZIP.', { id: toastId })
    }
  }

  const handleCreateNewItem = async (e) => {
    e.preventDefault()
    if (!newItemName.trim() || !activeProject) return
    const isDir = modalType === 'new_folder'
    const toastId = toast.loading(`Membuat ${isDir ? 'folder' : 'file'} baru...`)
    try {
      await api.post(`/projects/${activeProject.id}/files/new`, {
        path: currentPath,
        name: newItemName.trim(),
        is_dir: isDir,
      })
      toast.success(`${isDir ? 'Folder' : 'File'} berhasil dibuat!`, { id: toastId })
      setModalType(null)
      setNewItemName('')
      fetchDirectory(activeProject.id, currentPath)
      fetchAllTrees()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membuat item baru.', { id: toastId })
    }
  }

  const handleUploadFiles = async (e) => {
    e.preventDefault()
    if (uploadFiles.length === 0 || !activeProject) return
    setUploading(true)
    const toastId = toast.loading(`Meng-upload ${uploadFiles.length} file...`)
    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const formData = new FormData()
        formData.append('path', currentPath)
        formData.append('file', uploadFiles[i])
        await api.post(`/projects/${activeProject.id}/files/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      toast.success('Upload selesai!', { id: toastId })
      setModalType(null)
      setUploadFiles([])
      fetchDirectory(activeProject.id, currentPath)
      fetchAllTrees()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal meng-upload file.', { id: toastId })
    } finally {
      setUploading(false)
    }
  }

  const executeDelete = async () => {
    if (!activeProject) return
    const toastId = toast.loading('Menghapus item...')
    try {
      for (const p of confirmDelete.paths) {
        await api.delete(`/projects/${activeProject.id}/files?path=${encodeURIComponent(p)}`)
      }
      toast.success('Item berhasil dihapus.', { id: toastId })
      fetchDirectory(activeProject.id, currentPath)
      fetchAllTrees()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus item.', { id: toastId })
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

  const foldersCount = items.filter(i => i.is_dir).length
  const filesCount = items.filter(i => !i.is_dir).length

  // Recursive Tree Node Renderer for subdirectories
  const renderTreeNode = (node, projectObj, depth = 1) => {
    if (!node) return null
    const isCurrent = activeProject?.id === projectObj.id && currentPath === node.path
    const dirKey = `${projectObj.id}:${node.path}`
    const isExpanded = expandedDirs[dirKey]
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={`${dirKey}-${depth}`} className="select-none text-xs">
        <div
          onClick={() => handleSelectSubfolder(projectObj, node.path)}
          className={`flex items-center space-x-1.5 py-1 px-2 rounded cursor-pointer transition ${
            isCurrent
              ? 'bg-[#3E2316] text-[#FAF5EC] font-semibold'
              : 'text-[#DFCDB5]/85 hover:bg-[#2B1810] hover:text-[#FAF5EC]'
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 14)}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpandDir(dirKey)
              }}
              className="p-0.5 text-[#A47E65] hover:text-[#FAF5EC]"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <span className="w-3" />
          )}
          <Folder className={`h-3.5 w-3.5 shrink-0 ${isCurrent ? 'text-[#E8DCB8]' : 'text-[#A47E65]'}`} />
          <span className="truncate font-mono">{node.name}</span>
        </div>
        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {node.children.map((child) => renderTreeNode(child, projectObj, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-screen w-full flex flex-col bg-[#1C0F0A] text-[#FAF5EC] overflow-hidden select-none m-0 p-0 font-sans">
      {/* 1. CLASSIC TITLE BAR */}
      <div className="h-10 bg-[#24140C] border-b border-[#3E2316] px-3 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <Folder className="h-4 w-4 text-[#C49767] shrink-0" />
          <span className="font-semibold text-[#FAF5EC] tracking-wide">File Explorer</span>
          <span className="text-[#553826]">|</span>
          <span className="text-[#DFCDB5]/80 font-mono text-[11px] truncate">
            /home/student/{activeProject ? activeProject.name : 'lab'}{currentPath ? `/${currentPath}` : ''}
          </span>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#A47E65] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#140A07] border border-[#3E2316] rounded-lg pl-8 pr-3 py-1 text-xs text-[#FAF5EC] placeholder-[#553826] focus:outline-none focus:border-[#C49767] w-40 sm:w-60 font-sans"
            />
          </div>

          <button
            onClick={() => {
              if (activeProject) {
                fetchDirectory(activeProject.id, currentPath)
                fetchAllTrees()
              }
            }}
            className="p-1.5 rounded-lg bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] hover:text-[#FAF5EC] transition"
            title="Refresh All"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-2.5 py-1 rounded-lg bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] hover:text-[#FAF5EC] text-xs transition"
              title="Close File Explorer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* 2. CLASSIC ACTION RIBBON TOOLBAR */}
      <div className="h-10 bg-[#2B1810] border-b border-[#3E2316] px-3 flex items-center space-x-1 overflow-x-auto text-xs shrink-0">
        {/* + File */}
        <button
          onClick={() => { setNewItemName(''); setModalType('new_file') }}
          disabled={!activeProject}
          className="px-2.5 py-1 rounded-lg hover:bg-[#3A2115] text-[#E8DCB8] disabled:opacity-40 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Plus className="h-3.5 w-3.5 text-[#C49767]" />
          <span>File</span>
        </button>

        {/* + Folder */}
        <button
          onClick={() => { setNewItemName(''); setModalType('new_folder') }}
          disabled={!activeProject}
          className="px-2.5 py-1 rounded-lg hover:bg-[#3A2115] text-[#E8DCB8] disabled:opacity-40 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Plus className="h-3.5 w-3.5 text-[#C49767]" />
          <span>Folder</span>
        </button>

        <span className="h-4 w-px bg-[#3E2316] mx-1 shrink-0" />

        {/* Upload */}
        <button
          onClick={() => setModalType('upload')}
          disabled={!activeProject}
          className="px-3 py-1 rounded-lg bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] disabled:opacity-40 inline-flex items-center space-x-1.5 transition shadow-sm shrink-0"
        >
          <Upload className="h-3.5 w-3.5 text-[#E8DCB8]" />
          <span>Upload</span>
        </button>

        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={!selectedItem || selectedItem.is_dir}
          className="px-2.5 py-1 rounded-lg hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download</span>
        </button>

        {/* Delete */}
        <button
          onClick={() => setConfirmDelete({ open: true, paths: selectedPaths })}
          disabled={selectedPaths.length === 0}
          className="px-2.5 py-1 rounded-lg hover:bg-rose-500/20 text-rose-400 disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete</span>
        </button>

        <span className="h-4 w-px bg-[#3E2316] mx-1 shrink-0" />

        {/* Rename */}
        <button
          onClick={() => { setNewItemName(selectedItem?.name || ''); setModalType('rename') }}
          disabled={!selectedItem}
          className="px-2.5 py-1 rounded-lg hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Edit3 className="h-3.5 w-3.5" />
          <span>Rename</span>
        </button>

        {/* Edit */}
        <button
          onClick={() => handleOpenFile(selectedItem, 'edit')}
          disabled={!selectedItem || selectedItem.is_dir}
          className="px-2.5 py-1 rounded-lg hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <FileCode className="h-3.5 w-3.5" />
          <span>Edit</span>
        </button>

        {/* View */}
        <button
          onClick={() => handleOpenFile(selectedItem, 'view')}
          disabled={!selectedItem || selectedItem.is_dir}
          className="px-2.5 py-1 rounded-lg hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>View</span>
        </button>

        {/* Copy */}
        <button
          onClick={() => { setTargetDestination(currentPath); setModalType('copy') }}
          disabled={!selectedItem}
          className="px-2.5 py-1 rounded-lg hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Copy className="h-3.5 w-3.5" />
          <span>Copy</span>
        </button>

        {/* Move */}
        <button
          onClick={() => { setTargetDestination(currentPath); setModalType('move') }}
          disabled={!selectedItem}
          className="px-2.5 py-1 rounded-lg hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Move className="h-3.5 w-3.5" />
          <span>Move</span>
        </button>

        <span className="h-4 w-px bg-[#3E2316] mx-1 shrink-0" />

        {/* Permissions */}
        <button
          onClick={openPermissionsModal}
          disabled={!selectedItem}
          className="px-2.5 py-1 rounded-lg hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Key className="h-3.5 w-3.5" />
          <span>Permissions</span>
        </button>

        {/* Extract */}
        <button
          onClick={() => { setTargetDestination(currentPath); setModalType('extract') }}
          disabled={!selectedItem || !selectedItem.name || !selectedItem.name.endsWith('.zip')}
          className="px-2.5 py-1 rounded-lg hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Archive className="h-3.5 w-3.5" />
          <span>Extract</span>
        </button>

        {/* Compress */}
        <button
          onClick={() => { setTargetDestination('archive.zip'); setModalType('compress') }}
          disabled={selectedPaths.length === 0}
          className="px-2.5 py-1 rounded-lg hover:bg-[#3A2115] text-[#DFCDB5] disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <FileArchive className="h-3.5 w-3.5" />
          <span>Compress</span>
        </button>
      </div>

      {/* 3. CLASSIC ADDRESS & NAVIGATION BAR */}
      <div className="h-9 bg-[#20110A] border-b border-[#3E2316] px-3 flex items-center justify-between text-xs shrink-0 font-mono">
        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={handleGoHome}
            className="p-1 rounded bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] hover:text-[#FAF5EC] transition"
            title="Home"
          >
            Home
          </button>
          <button
            onClick={handleUpOneLevel}
            disabled={!currentPath}
            className="p-1 rounded bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] hover:text-[#FAF5EC] disabled:opacity-30 transition"
            title="Up One Level"
          >
            ↑ Up
          </button>
          <button
            onClick={handleGoBack}
            disabled={historyIndex <= 0}
            className="p-1 rounded bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] hover:text-[#FAF5EC] disabled:opacity-30 transition"
            title="Back"
          >
            ←
          </button>
          <button
            onClick={handleGoForward}
            disabled={historyIndex >= pathHistory.length - 1}
            className="p-1 rounded bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] hover:text-[#FAF5EC] disabled:opacity-30 transition"
            title="Forward"
          >
            →
          </button>
        </div>

        {/* Address Input Bar */}
        <div className="flex-1 mx-2.5 bg-[#140A07] border border-[#3E2316] rounded px-3 py-1 text-xs text-[#E8DCB8] flex items-center space-x-1.5 overflow-hidden">
          <span className="text-[#A47E65] shrink-0">/home/student/</span>
          <span className="text-[#FAF5EC] font-semibold shrink-0">{activeProject ? activeProject.name : ''}</span>
          <span className="text-[#DFCDB5] truncate">{currentPath ? `/${currentPath}` : ''}</span>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0 text-[11px]">
          <button
            onClick={handleSelectAll}
            className="px-2 py-0.5 rounded bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] hover:text-[#FAF5EC] transition"
          >
            Select All
          </button>
          <button
            onClick={handleUnselectAll}
            className="px-2 py-0.5 rounded bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] hover:text-[#FAF5EC] transition"
          >
            Unselect All
          </button>
        </div>
      </div>

      {/* 4. MAIN SPLIT PANE: ZERO GAP (Edge-to-Edge) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE: FOLDER TREE */}
        <div className="w-64 sm:w-72 bg-[#24140C] border-r border-[#3E2316] flex flex-col shrink-0 overflow-hidden">
          <div className="h-8 bg-[#1C0F0A] border-b border-[#3E2316] px-3 flex items-center justify-between text-[11px] font-semibold text-[#DFCDB5] uppercase tracking-wider shrink-0">
            <span>Folder Tree</span>
            <button
              onClick={() => fetchAllTrees()}
              className="text-[#A47E65] hover:text-[#FAF5EC]"
              title="Refresh Folder Tree"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 text-xs space-y-1 font-mono">
            {projects.length === 0 ? (
              <div className="text-[#A47E65] p-2 text-center text-xs">Belum ada project</div>
            ) : (
              projects.map((p) => {
                const isProjectActive = activeProject?.id === p.id && currentPath === ''
                const isExpanded = expandedProjects[p.id]
                const tree = projectTrees[p.id]

                return (
                  <div key={p.id} className="select-none text-xs">
                    {/* Project Folder Row */}
                    <div
                      onClick={() => handleSelectProject(p)}
                      className={`flex items-center justify-between py-1.5 px-2 rounded cursor-pointer transition ${
                        isProjectActive
                          ? 'bg-[#3E2316] text-[#FAF5EC] font-semibold'
                          : 'text-[#DFCDB5]/85 hover:bg-[#2B1810] hover:text-[#FAF5EC]'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpandProject(p.id)
                          }}
                          className="p-0.5 text-[#A47E65] hover:text-[#FAF5EC]"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-[#C49767]" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-[#A47E65]" />
                          )}
                        </button>
                        <Folder className={`h-4 w-4 shrink-0 ${isProjectActive ? 'text-[#E8DCB8]' : 'text-[#C49767]'}`} />
                        <span className="truncate">{`admin_${p.name}`}</span>
                      </div>
                      <span className="text-[10px] text-[#A47E65] font-sans shrink-0 ml-1">
                        {p.template_type || p.language || ''}
                      </span>
                    </div>

                    {/* Subdirectories inside this project */}
                    {isExpanded && tree && tree.children && tree.children.length > 0 && (
                      <div className="pl-3 border-l border-[#3E2316]/60 ml-3.5 my-0.5 space-y-0.5">
                        {tree.children.map((child) => renderTreeNode(child, p, 1))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: FILE DETAILS TABLE */}
        <div className="flex-1 bg-[#1C0F0A] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={8} />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-24 p-6">
                <Folder className="h-10 w-10 text-[#3E2316] mx-auto mb-2" />
                <p className="text-xs text-[#DFCDB5]">Folder ini kosong.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#20110A] text-[#DFCDB5] uppercase text-[10px] tracking-wider border-b border-[#3E2316] z-10 font-semibold select-none">
                  <tr>
                    <th className="p-2.5 pl-4">Name</th>
                    <th className="p-2.5 w-28">Size</th>
                    <th className="p-2.5 w-44">Last Modified</th>
                    <th className="p-2.5 w-36">Type</th>
                    <th className="p-2.5 pr-4 w-28 text-right">Permissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A160D]">
                  {filteredItems.map((item) => {
                    const isSelected = selectedPaths.includes(item.path)

                    return (
                      <tr
                        key={item.path}
                        onClick={(e) => toggleSelect(item.path, e)}
                        onDoubleClick={() => {
                          if (item.is_dir) {
                            navigateTo(item.path, activeProject)
                          } else {
                            handleOpenFile(item, 'edit')
                          }
                        }}
                        className={`cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-[#3E2316] text-[#FAF5EC] font-semibold'
                            : 'hover:bg-[#28150D] text-[#FAF5EC]'
                        }`}
                      >
                        {/* Name */}
                        <td className="p-2 pl-4">
                          <div className="flex items-center space-x-2.5">
                            {item.is_dir ? (
                              <Folder className="h-4 w-4 text-[#C49767] shrink-0" />
                            ) : item.name.endsWith('.py') ? (
                              <FileCode className="h-4 w-4 text-emerald-400 shrink-0" />
                            ) : item.name.endsWith('.php') ? (
                              <FileCode className="h-4 w-4 text-sky-400 shrink-0" />
                            ) : item.name.endsWith('.js') || item.name.endsWith('.jsx') ? (
                              <FileCode className="h-4 w-4 text-amber-400 shrink-0" />
                            ) : item.name.endsWith('.zip') || item.name.endsWith('.tar') ? (
                              <Archive className="h-4 w-4 text-rose-400 shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-[#A47E65] shrink-0" />
                            )}
                            <span className="font-mono text-xs truncate">{item.name}</span>
                          </div>
                        </td>

                        {/* Size */}
                        <td className="p-2 font-mono text-[11px] text-[#DFCDB5]/80">
                          {item.is_dir ? '4 KB' : formatBytes(item.size)}
                        </td>

                        {/* Last Modified */}
                        <td className="p-2 font-mono text-[11px] text-[#DFCDB5]/80">
                          {formatDate(item.last_modified)}
                        </td>

                        {/* Type */}
                        <td className="p-2 font-mono text-[11px] text-[#DFCDB5]/80 truncate">
                          {item.is_dir ? 'folder' : item.mime_type || 'text/plain'}
                        </td>

                        {/* Permissions */}
                        <td className="p-2 pr-4 font-mono text-[11px] text-[#DFCDB5]/80 text-right">
                          {item.permissions || '0755'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* 5. CLASSIC STATUS BAR */}
      <div className="h-7 bg-[#24140C] border-t border-[#3E2316] px-3 flex items-center justify-between text-[11px] font-mono text-[#DFCDB5]/70 shrink-0">
        <div>
          Total: {items.length} items ({foldersCount} folders, {filesCount} files)
        </div>
        <div>
          {selectedPaths.length > 0 ? `${selectedPaths.length} item dipilih` : ''}
        </div>
        <div>
          Root: /home/student/{activeProject ? activeProject.name : ''}
        </div>
      </div>

      {/* ===================== MODALS ===================== */}

      {/* 1. CODE EDITOR MODAL */}
      <ModalPortal isOpen={modalType === 'edit' && Boolean(activeFile)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-5xl bg-[#24140C] border border-[#4D2D1E] rounded-2xl shadow-2xl p-5 flex flex-col max-h-[90vh] text-[#FAF5EC]">
            <div className="flex items-center justify-between pb-3 border-b border-[#3E2316] mb-3">
              <div>
                <h4 className="text-base font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
                  <FileCode className="h-4 w-4 text-[#C49767]" />
                  <span>Editor: {activeFile?.name}</span>
                </h4>
                <p className="text-[11px] text-[#DFCDB5]/80 font-mono">/{activeFile?.path}</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveFile}
                  disabled={savingFile}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] flex items-center space-x-1.5 transition disabled:opacity-50 shadow"
                >
                  {savingFile ? <Spinner size="xs" /> : <Save className="h-3.5 w-3.5 text-[#E8DCB8]" />}
                  <span>Save (Ctrl+S)</span>
                </button>
                <button
                  onClick={() => setModalType(null)}
                  className="p-1.5 rounded-lg text-[#DFCDB5] hover:text-white hover:bg-[#3E2316] transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-xl border border-[#3E2316]">
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
                  className="w-full h-96 p-4 font-mono text-xs bg-[#140A07] text-[#FAF5EC] focus:outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />
              )}
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* 2. VIEW FILE MODAL */}
      <ModalPortal isOpen={modalType === 'view' && Boolean(activeFile)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-[#24140C] border border-[#4D2D1E] rounded-2xl shadow-2xl p-5 flex flex-col max-h-[80vh] text-[#FAF5EC]">
            <div className="flex items-center justify-between pb-3 border-b border-[#3E2316] mb-3">
              <h4 className="text-base font-serif font-bold text-[#FAF5EC]">View: {activeFile?.name}</h4>
              <button onClick={() => setModalType(null)} className="p-1.5 text-[#DFCDB5] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-[#140A07] border border-[#3E2316] font-mono text-xs text-[#DFCDB5] overflow-auto flex-1 whitespace-pre-wrap">
              {fileContent}
            </pre>
          </div>
        </div>
      </ModalPortal>

      {/* 3. PERMISSIONS MODAL */}
      <ModalPortal isOpen={modalType === 'permissions' && Boolean(selectedItem)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#24140C] border border-[#4D2D1E] rounded-2xl shadow-2xl p-5 text-[#FAF5EC] space-y-4">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC]">
              Change Permissions: {selectedItem?.name}
            </h4>
            <p className="text-xs text-[#DFCDB5]">Atur hak akses UNIX (chmod) untuk item ini.</p>

            <div className="bg-[#140A07] border border-[#3E2316] rounded-xl p-3 text-xs font-mono">
              <div className="grid grid-cols-4 gap-2 pb-2 border-b border-[#3E2316] text-[#A47E65] font-semibold text-center">
                <span>Role</span>
                <span>Read (4)</span>
                <span>Write (2)</span>
                <span>Execute (1)</span>
              </div>

              {/* User */}
              <div className="grid grid-cols-4 gap-2 py-1.5 items-center text-center">
                <span className="text-left font-bold text-[#E8DCB8]">User</span>
                <input type="checkbox" checked={permUser.r} onChange={() => handlePermChange('u', 'r')} className="h-4 w-4 accent-[#C49767] mx-auto cursor-pointer" />
                <input type="checkbox" checked={permUser.w} onChange={() => handlePermChange('u', 'w')} className="h-4 w-4 accent-[#C49767] mx-auto cursor-pointer" />
                <input type="checkbox" checked={permUser.x} onChange={() => handlePermChange('u', 'x')} className="h-4 w-4 accent-[#C49767] mx-auto cursor-pointer" />
              </div>

              {/* Group */}
              <div className="grid grid-cols-4 gap-2 py-1.5 items-center text-center">
                <span className="text-left font-bold text-[#E8DCB8]">Group</span>
                <input type="checkbox" checked={permGroup.r} onChange={() => handlePermChange('g', 'r')} className="h-4 w-4 accent-[#C49767] mx-auto cursor-pointer" />
                <input type="checkbox" checked={permGroup.w} onChange={() => handlePermChange('g', 'w')} className="h-4 w-4 accent-[#C49767] mx-auto cursor-pointer" />
                <input type="checkbox" checked={permGroup.x} onChange={() => handlePermChange('g', 'x')} className="h-4 w-4 accent-[#C49767] mx-auto cursor-pointer" />
              </div>

              {/* World */}
              <div className="grid grid-cols-4 gap-2 py-1.5 items-center text-center">
                <span className="text-left font-bold text-[#E8DCB8]">World</span>
                <input type="checkbox" checked={permWorld.r} onChange={() => handlePermChange('w', 'r')} className="h-4 w-4 accent-[#C49767] mx-auto cursor-pointer" />
                <input type="checkbox" checked={permWorld.w} onChange={() => handlePermChange('w', 'w')} className="h-4 w-4 accent-[#C49767] mx-auto cursor-pointer" />
                <input type="checkbox" checked={permWorld.x} onChange={() => handlePermChange('w', 'x')} className="h-4 w-4 accent-[#C49767] mx-auto cursor-pointer" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#DFCDB5]">Permission Code:</span>
              <span className="px-3 py-1 rounded bg-[#140A07] border border-[#3E2316] font-bold text-amber-300">{permOctal}</span>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] transition"
              >
                Change Permissions
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* 4. RENAME MODAL */}
      <ModalPortal isOpen={modalType === 'rename' && Boolean(selectedItem)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#24140C] border border-[#4D2D1E] rounded-2xl shadow-2xl p-5 text-[#FAF5EC]">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC] mb-1">Rename Item</h4>
            <p className="text-xs text-[#DFCDB5] mb-4">Nama baru untuk {selectedItem?.name}:</p>
            <form onSubmit={handleRename} className="space-y-4">
              <input
                type="text"
                required
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full bg-[#140A07] border border-[#3E2316] rounded-lg px-3 py-1.5 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#DFCDB5] hover:bg-[#3A2115]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC]"
                >
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* 5. COPY / MOVE MODAL */}
      <ModalPortal isOpen={(modalType === 'copy' || modalType === 'move') && Boolean(selectedItem)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#24140C] border border-[#4D2D1E] rounded-2xl shadow-2xl p-5 text-[#FAF5EC]">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC] mb-1">
              {modalType === 'move' ? 'Move File' : 'Copy File'}
            </h4>
            <p className="text-xs text-[#DFCDB5] mb-4">
              Tentukan path direktori tujuan untuk '{selectedItem?.name}':
            </p>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="e.g. app atau kosongkan untuk root project"
                value={targetDestination}
                onChange={(e) => setTargetDestination(e.target.value)}
                className="w-full bg-[#140A07] border border-[#3E2316] rounded-lg px-3 py-1.5 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#DFCDB5] hover:bg-[#3A2115]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyMove(modalType === 'move')}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC]"
                >
                  {modalType === 'move' ? 'Move' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* 6. COMPRESS MODAL */}
      <ModalPortal isOpen={modalType === 'compress'}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#24140C] border border-[#4D2D1E] rounded-2xl shadow-2xl p-5 text-[#FAF5EC]">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC] mb-1">Compress Items</h4>
            <p className="text-xs text-[#DFCDB5] mb-4">Nama arsip ZIP yang akan dibuat:</p>
            <form onSubmit={handleCompress} className="space-y-4">
              <input
                type="text"
                required
                value={targetDestination}
                onChange={(e) => setTargetDestination(e.target.value)}
                placeholder="archive.zip"
                className="w-full bg-[#140A07] border border-[#3E2316] rounded-lg px-3 py-1.5 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#DFCDB5] hover:bg-[#3A2115]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC]"
                >
                  Compress
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* 7. EXTRACT MODAL */}
      <ModalPortal isOpen={modalType === 'extract' && Boolean(selectedItem)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#24140C] border border-[#4D2D1E] rounded-2xl shadow-2xl p-5 text-[#FAF5EC]">
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
                className="w-full bg-[#140A07] border border-[#3E2316] rounded-lg px-3 py-1.5 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#DFCDB5] hover:bg-[#3A2115]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC]"
                >
                  Extract
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* 8. NEW FILE / FOLDER MODAL */}
      <ModalPortal isOpen={modalType === 'new_file' || modalType === 'new_folder'}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#24140C] border border-[#4D2D1E] rounded-2xl shadow-2xl p-5 text-[#FAF5EC]">
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
                className="w-full bg-[#140A07] border border-[#3E2316] rounded-lg px-3 py-1.5 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#DFCDB5] hover:bg-[#3A2115]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC]"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* 9. UPLOAD MODAL */}
      <ModalPortal isOpen={modalType === 'upload'}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#24140C] border border-[#4D2D1E] rounded-2xl shadow-2xl p-5 text-[#FAF5EC]">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC] mb-1">Upload Files</h4>
            <p className="text-xs text-[#DFCDB5] mb-4">
              Upload file atau arsip .ZIP ke folder /{currentPath || ''}.
            </p>
            <form onSubmit={handleUploadFiles} className="space-y-4">
              <div className="border-2 border-dashed border-[#4D2D1E] hover:border-[#C49767] rounded-xl p-6 text-center transition bg-[#140A07]">
                <Upload className="h-8 w-8 text-[#A47E65] mx-auto mb-2" />
                <input
                  type="file"
                  multiple
                  required
                  onChange={(e) => setUploadFiles(Array.from(e.target.files))}
                  className="hidden"
                  id="classic-upload-input"
                />
                <label
                  htmlFor="classic-upload-input"
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
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#DFCDB5] hover:bg-[#3A2115]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploading || uploadFiles.length === 0}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload Now'}
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
        confirmText="Delete"
        onConfirm={executeDelete}
        onClose={() => setConfirmDelete({ open: false, paths: [] })}
      />
    </div>
  )
}
