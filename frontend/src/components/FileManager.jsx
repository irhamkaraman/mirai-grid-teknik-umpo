import React, { useState, useEffect, useRef } from 'react'
import {
  Folder, FileText, ArrowLeft, Plus, Upload, Download, Trash2, Edit3,
  Copy, Move, Key, Eye, Archive, FileArchive, RefreshCw, X, ChevronRight,
  ChevronDown, Search, ArrowUp, CheckSquare, Square, CornerUpLeft, Settings,
  Check, FileCode, Sliders, AlertCircle, Save, HardDrive, Terminal,
  FileSpreadsheet, Image as ImageIcon, GitBranch, Layers
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner, SkeletonBox, SkeletonTable } from './Skeletons'
import ConfirmModal from './ConfirmModal'
import ModalPortal from './ModalPortal'
import { syncFileRoute, checkUrlTampering, triggerRouteSecurityAlarm } from '../utils/securityRoute'

export default function FileManager({ project: initialProject, projects: propProjects, onClose, user: propUser, isHomeRoot = true }) {
  const [currentUser] = useState(() => {
    try {
      return propUser || JSON.parse(localStorage.getItem('miraigrid_user') || '{}')
    } catch (e) {
      return {}
    }
  })
  const currentUsername = propUser?.username || currentUser?.username || 'user'
  const homeRootProject = {
    id: 'root',
    name: currentUsername,
    owner_username: currentUsername,
    virtual_path: `/home/${currentUsername}`,
    is_home_root: true
  }

  const [projects, setProjects] = useState(propProjects || (initialProject ? [initialProject] : []))
  const [activeProject, setActiveProject] = useState(
    initialProject || (isHomeRoot ? homeRootProject : (propProjects && propProjects.length > 0 ? propProjects[0] : homeRootProject))
  )
  const projectOwner = activeProject?.owner_username || currentUsername
  const [homeTree, setHomeTree] = useState(null)
  const [expandedHomeRoot, setExpandedHomeRoot] = useState(true)
  const [projectTrees, setProjectTrees] = useState({})
  const [expandedProjects, setExpandedProjects] = useState({})
  const [expandedDirs, setExpandedDirs] = useState(() => {
    const init = {}
    let target = initialProject?.initial_path || ''
    if (!target) {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        target = urlParams.get('dir') || urlParams.get('path') || ''
      } catch (e) {}
    }
    if (target) {
      target = target.replace(new RegExp(`^/?home/[^/]+/?`), '').replace(/^\/+/, '').replace(/\/+$/, '')
      if (target) {
        const parts = target.split('/')
        let acc = ''
        parts.forEach(part => {
          acc = acc ? `${acc}/${part}` : part
          init[`home-${acc}`] = true
        })
      }
    }
    return init
  })

  const [currentPath, setCurrentPath] = useState(() => {
    if (initialProject?.initial_path) {
      return initialProject.initial_path.replace(/^\/+/, '').replace(/\/+$/, '')
    }
    try {
      const urlParams = new URLSearchParams(window.location.search)
      let p = urlParams.get('dir') || urlParams.get('path') || ''
      if (p) {
        p = p.replace(new RegExp(`^/?home/[^/]+/?`), '')
        return p.replace(/^\/+/, '').replace(/\/+$/, '')
      }
    } catch (e) {}
    return ''
  })
  const [pathHistory, setPathHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPaths, setSelectedPaths] = useState([])
  const [expandedReposDir, setExpandedReposDir] = useState(true)

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

  // Synchronize dynamic encrypted route hash on active project, path, or file change
  useEffect(() => {
    // 1. Check for URL manipulation / path traversal
    const check = checkUrlTampering(window.location.href)
    if (check.isTampered) {
      triggerRouteSecurityAlarm(check.reason)
      return
    }

    // 2. Synchronize current state to dynamic address bar hash
    if (activeProject) {
      syncFileRoute(activeProject.name, currentPath, activeFile ? activeFile.path : null)
    }
  }, [activeProject, currentPath, activeFile])

  // Listen for manual hash changes (e.g. student editing URL bar directly)
  useEffect(() => {
    const handleHashChange = () => {
      const check = checkUrlTampering(window.location.href)
      if (check.isTampered) {
        triggerRouteSecurityAlarm(check.reason)
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const getFileApiUrl = (endpoint = '', targetProj = activeProject) => {
    if (!targetProj || targetProj.is_home_root || targetProj.id === 'root') {
      return `/files${endpoint}`
    }
    if (targetProj?.is_git) {
      return `/git/repositories/${targetProj.id}/files${endpoint}`
    }
    return `/projects/${targetProj.id}/files${endpoint}`
  }

  // 1. Initial Load: Projects & Trees
  useEffect(() => {
    if (!propProjects || propProjects.length === 0) {
      loadAllProjects()
    } else {
      setProjects(propProjects)
      const urlParams = new URLSearchParams(window.location.search)
      const repoParam = urlParams.get('repo')
      if (repoParam) {
        const found = propProjects.find(item => item.is_git && String(item.id) === String(repoParam))
        if (found) {
          setActiveProject(found)
        } else if (!activeProject && propProjects.length > 0) {
          setActiveProject(propProjects[0])
        }
      } else if (!activeProject && propProjects.length > 0) {
        setActiveProject(propProjects[0])
      }
      fetchAllTrees(propProjects)
    }
  }, [propProjects])

  const loadAllProjects = async () => {
    try {
      const [resProj, resGit] = await Promise.all([
        api.get('/projects'),
        api.get('/git/repositories').catch(() => ({ data: { repositories: [] } }))
      ])
      const projList = resProj.data || []
      const repoList = resGit.data?.repositories || []
      
      const repos = repoList.map(r => {
        const matchingProj = projList.find(p => 
          (r.target_project_id && p.id === r.target_project_id) || 
          p.name === r.name ||
          (p.config_json && p.config_json.includes(r.name))
        )
        return {
          id: r.id,
          name: r.name,
          owner_username: r.owner_username || currentUser?.username || 'user',
          virtual_path: r.path || `/home/${currentUser?.username || 'user'}/repositories/${r.name}`,
          is_git: true,
          is_deployed: !!matchingProj,
          project_id: matchingProj?.id,
          template_type: matchingProj?.template_type,
          status: matchingProj?.status,
          language: matchingProj?.template_type || 'git',
          in_repositories: true
        }
      })

      const standalones = []
      projList.forEach(p => {
        const isRepo = repos.some(r => 
          r.name === p.name || 
          (r.project_id && r.project_id === p.id) ||
          (p.config_json && p.config_json.includes(r.name))
        )
        if (!isRepo) {
          standalones.push({
            id: p.id,
            project_id: p.id,
            name: p.name,
            owner_username: p.owner_username || currentUser?.username || 'user',
            virtual_path: `/home/${p.owner_username || currentUser?.username || 'user'}/${p.name}`,
            is_git: false,
            is_deployed: true,
            template_type: p.template_type,
            status: p.status,
            language: p.template_type || 'web',
            in_repositories: false
          })
        }
      })

      const combined = [...repos, ...standalones]
      setProjects(combined)
      if (initialProject) {
        setActiveProject(initialProject)
      } else if (!isHomeRoot && combined.length > 0) {
        setActiveProject(combined[0])
      } else {
        setActiveProject(homeRootProject)
      }
      fetchAllTrees(combined)
    } catch (err) {
      toast.error('Gagal memuat storage akun.')
    }
  }

  const fetchAllTrees = async (pList = projects) => {
    try {
      const resHome = await api.get('/files/tree')
      setHomeTree(resHome.data.tree || null)
    } catch (err) {}

    const trees = {}
    const exp = { ...expandedProjects }
    for (const p of pList) {
      if (!p || p.is_home_root || p.id === 'root') continue
      try {
        const url = p.is_git ? `/git/repositories/${p.id}/files/tree` : `/projects/${p.id}/files/tree`
        const res = await api.get(url)
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
    if (activeProject) {
      fetchDirectory(activeProject, currentPath)
    }
  }, [activeProject?.id, activeProject?.is_git, currentPath])

  const fetchDirectory = async (targetProjOrId, subpath) => {
    let proj = targetProjOrId
    if (typeof targetProjOrId === 'number' || typeof targetProjOrId === 'string') {
      if (targetProjOrId === 'root') {
        proj = homeRootProject
      } else {
        proj = projects.find(p => String(p.id) === String(targetProjOrId)) || activeProject
      }
    }
    if (!proj) proj = homeRootProject
    setLoading(true)
    setSelectedPaths([])
    try {
      const isHome = (!proj || proj.is_home_root || proj.id === 'root')
      const url = isHome
        ? `/files?path=${encodeURIComponent(subpath || '')}`
        : proj.is_git
          ? `/git/repositories/${proj.id}/files?path=${encodeURIComponent(subpath || '')}`
          : `/projects/${proj.id}/files?path=${encodeURIComponent(subpath || '')}`
      const res = await api.get(url)
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
    if (!currentPath) {
      if (activeProject && !activeProject.is_home_root && activeProject.id !== 'root') {
        setActiveProject(homeRootProject)
        navigateTo('', homeRootProject)
      }
      return
    }
    const parts = currentPath.split('/')
    parts.pop()
    navigateTo(parts.join('/'), activeProject)
  }

  const handleGoHome = () => {
    setActiveProject(homeRootProject)
    navigateTo('', homeRootProject)
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
      const res = await api.get(getFileApiUrl(`/content?path=${encodeURIComponent(item.path)}`))
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
      await api.post(getFileApiUrl('/save'), {
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

  const handleDownload = async () => {
    if (!selectedItem || selectedItem.is_dir || !activeProject) return
    const toastId = toast.loading(`Mengunduh ${selectedItem.name}...`)
    try {
      const res = await api.get(getFileApiUrl('/download'), {
        params: { path: selectedItem.path },
        responseType: 'blob',
      })
      const blob = new Blob([res.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = selectedItem.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success(`Berhasil mengunduh ${selectedItem.name}`, { id: toastId })
    } catch (err) {
      console.error('Download error:', err)
      toast.error(err.response?.data?.detail || 'Gagal mengunduh file.', { id: toastId })
    }
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
      await api.post(getFileApiUrl('/permissions'), {
        path: selectedItem.path,
        permissions: permOctal,
      })
      toast.success('Permissions berhasil diubah!', { id: toastId })
      setModalType(null)
      fetchDirectory(activeProject, currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengubah permissions.', { id: toastId })
    }
  }

  const handleRename = async (e) => {
    e.preventDefault()
    if (!selectedItem || !newItemName.trim() || !activeProject) return
    const toastId = toast.loading('Mengubah nama item...')
    try {
      await api.post(getFileApiUrl('/rename'), {
        old_path: selectedItem.path,
        new_name: newItemName.trim(),
      })
      toast.success('Item berhasil di-rename!', { id: toastId })
      setModalType(null)
      fetchDirectory(activeProject, currentPath)
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
      await api.post(getFileApiUrl(`/${action}`), {
        source_path: selectedItem.path,
        dest_dir: targetDestination.trim(),
      })
      toast.success(`Item berhasil di-${action}!`, { id: toastId })
      setModalType(null)
      fetchDirectory(activeProject, currentPath)
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
      await api.post(getFileApiUrl('/compress'), {
        paths: selectedPaths,
        destination_zip: destZip,
      })
      toast.success('Arsip ZIP berhasil dibuat!', { id: toastId })
      setModalType(null)
      fetchDirectory(activeProject, currentPath)
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
      await api.post(getFileApiUrl('/extract'), {
        zip_path: selectedItem.path,
        extract_to: targetDestination || currentPath,
      })
      toast.success('Ekstraksi selesai!', { id: toastId })
      setModalType(null)
      fetchDirectory(activeProject, currentPath)
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
      await api.post(getFileApiUrl('/new'), {
        path: currentPath,
        name: newItemName.trim(),
        is_dir: isDir,
      })
      toast.success(`${isDir ? 'Folder' : 'File'} berhasil dibuat!`, { id: toastId })
      setModalType(null)
      setNewItemName('')
      fetchDirectory(activeProject, currentPath)
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
        await api.post(getFileApiUrl('/upload'), formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      toast.success('Upload selesai!', { id: toastId })
      setModalType(null)
      setUploadFiles([])
      fetchDirectory(activeProject, currentPath)
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
        await api.delete(getFileApiUrl(`?path=${encodeURIComponent(p)}`))
      }
      toast.success('Item berhasil dihapus.', { id: toastId })
      fetchDirectory(activeProject, currentPath)
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
      let d
      if (typeof timestamp === 'number' || !isNaN(Number(timestamp))) {
        const num = Number(timestamp)
        d = num < 1e11 ? new Date(num * 1000) : new Date(num)
      } else {
        d = new Date(timestamp)
      }
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
              ? 'bg-[#DECDBD] text-[#1C0F0A] font-bold shadow-sm border border-[#CBB7A2]'
              : 'text-[#3D2316] hover:bg-[#E5D7C2]'
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
              className="p-0.5 text-[#8C6D58] hover:text-[#26160F]"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <span className="w-3" />
          )}
          <Folder className={`h-3.5 w-3.5 shrink-0 ${isCurrent ? 'text-[#946132]' : 'text-[#A47E65]'}`} />
          <span className="truncate font-mono">{node.name}</span>
        </div>
        {hasChildren && isExpanded && (
          <div className="space-y-0.5 border-l border-[#D4C1AC] ml-3.5 pl-1.5">
            {node.children.map((child) => renderTreeNode(child, projectObj, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderHomeTreeNode = (node, depth = 1) => {
    const isCurrent = (activeProject?.is_home_root || activeProject?.id === 'root') && currentPath === node.path
    const dirKey = `home-${node.path}`
    const isExpanded = !!expandedDirs[dirKey]
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.path} className="select-none text-xs">
        <div
          onClick={() => {
            if (activeProject?.id !== 'root') {
              setActiveProject(homeRootProject)
            }
            navigateTo(node.path, homeRootProject)
          }}
          className={`flex items-center space-x-1.5 py-1 px-2 rounded cursor-pointer transition ${
            isCurrent
              ? 'bg-[#DECDBD] text-[#1C0F0A] font-bold shadow-sm border border-[#CBB7A2]'
              : 'text-[#3D2316] hover:bg-[#E5D7C2]'
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
              className="p-0.5 text-[#8C6D58] hover:text-[#26160F]"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <span className="w-3" />
          )}
          <Folder className={`h-3.5 w-3.5 shrink-0 ${isCurrent ? 'text-[#946132]' : 'text-[#A47E65]'}`} />
          <span className="truncate font-mono">{node.name}</span>
        </div>
        {hasChildren && isExpanded && (
          <div className="space-y-0.5 border-l border-[#D4C1AC] ml-3.5 pl-1.5">
            {node.children.map((child) => renderHomeTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderProjectFolderItem = (p) => {
    const isProjectActive = activeProject?.id === p.id && activeProject?.is_git === p.is_git && currentPath === ''
    const isExpanded = expandedProjects[p.id]
    const tree = projectTrees[p.id]

    return (
      <div key={`${p.is_git ? 'git' : 'proj'}-${p.id}`} className="select-none text-xs">
        {/* Project / Repo Folder Row */}
        <div
          onClick={() => handleSelectProject(p)}
          className={`flex items-center justify-between py-1.5 px-2 rounded cursor-pointer transition ${
            isProjectActive
              ? 'bg-[#DECDBD] text-[#1C0F0A] font-bold shadow-sm border border-[#CBB7A2]'
              : 'text-[#3D2316] hover:bg-[#E5D7C2]'
          }`}
        >
          <div className="flex items-center space-x-1.5 overflow-hidden">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpandProject(p.id)
              }}
              className="p-0.5 text-[#8C6D58] hover:text-[#26160F]"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-[#946132]" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-[#8C6D58]" />
              )}
            </button>
            {p.is_git ? (
              <GitBranch className={`h-4 w-4 shrink-0 ${isProjectActive ? 'text-amber-700' : 'text-amber-600'}`} />
            ) : (
              <Folder className={`h-4 w-4 shrink-0 ${isProjectActive ? 'text-[#946132]' : 'text-[#B37D42]'}`} />
            )}
            {currentUser?.role === 'admin' && p.owner_username && p.owner_username !== currentUser?.username ? (
              <div className="flex items-center space-x-1 min-w-0">
                <span className="text-[10px] px-1 py-0.2 rounded bg-[#E5D7C2] text-[#5C3B25] border border-[#D4C1AC] font-mono shrink-0">
                  {p.owner_username}
                </span>
                <span className="truncate">{p.name}</span>
              </div>
            ) : (
              <span className="truncate">{p.name}</span>
            )}
          </div>
          <div className="flex items-center space-x-1 shrink-0 ml-1">
            {p.template_type && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] font-mono flex items-center space-x-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 inline-block animate-pulse" />
                <span>{p.template_type}</span>
              </span>
            )}
            {p.is_git && (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-mono">
                git
              </span>
            )}
            {!p.is_git && !p.template_type && (
              <span className="text-[#8C6D58] font-sans text-[10px]">
                {p.language || ''}
              </span>
            )}
          </div>
        </div>

        {/* Subdirectories inside this project/repo */}
        {isExpanded && tree && tree.children && tree.children.length > 0 && (
          <div className="pl-3 border-l border-[#D4C1AC] ml-3.5 my-0.5 space-y-0.5">
            {tree.children.map((child) => renderTreeNode(child, p, 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#FDFBF7] border border-[#D4C1AC] rounded-3xl shadow-2xl text-[#26160F] overflow-hidden select-none font-sans">
      {/* 1. CLASSIC TITLE BAR */}
      <div className="h-10 bg-[#EFE4D2] border-b border-[#D4C1AC] px-3 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <img
            src="/logos/miraigrid-logo.svg"
            alt="MiraiGrid"
            className="h-5 w-5 rounded-md object-contain shrink-0 bg-white p-0.5 shadow-sm border border-[#D4C1AC]"
          />
          <span className="font-bold text-[#26160F] tracking-wide">File Explorer</span>
          <span className="text-[#A47E65]">|</span>
          <span className="text-[#6A472E] font-mono text-[11px] truncate font-medium">
            {activeProject?.is_home_root || activeProject?.id === 'root'
              ? `/home/${projectOwner}`
              : activeProject?.is_git
                ? `/home/${projectOwner}/repositories/${activeProject.name}`
                : `/home/${projectOwner}/${activeProject ? activeProject.name : ''}`}
            {currentPath ? `/${currentPath}` : ''}
          </span>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#8C6D58] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#FFFFFF] border border-[#D4C1AC] rounded-lg pl-8 pr-3 py-1 text-xs text-[#26160F] placeholder-[#8C6D58] focus:outline-none focus:border-[#946132] w-40 sm:w-60 font-sans shadow-sm"
            />
          </div>

          <button
            onClick={() => {
              if (activeProject) {
                fetchDirectory(activeProject.id, currentPath)
                fetchAllTrees()
              }
            }}
            className="p-1.5 rounded-lg bg-[#E2D2BF] hover:bg-[#D5C2AD] border border-[#D4C1AC] text-[#26160F] transition shadow-xs"
            title="Refresh All"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-2.5 py-1 rounded-lg bg-[#E2D2BF] hover:bg-[#D5C2AD] border border-[#D4C1AC] text-[#26160F] font-semibold text-xs transition shadow-xs"
              title="Close File Explorer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* 2. CLASSIC ACTION RIBBON TOOLBAR */}
      <div className="h-10 bg-[#F7EFE4] border-b border-[#D4C1AC] px-3 flex items-center space-x-1 overflow-x-auto text-xs shrink-0">
        {/* + File */}
        <button
          onClick={() => { setNewItemName(''); setModalType('new_file') }}
          disabled={!activeProject}
          className="px-2.5 py-1 rounded-lg hover:bg-[#EBDCC8] text-[#3D2316] font-medium disabled:opacity-40 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Plus className="h-3.5 w-3.5 text-[#946132]" />
          <span>File</span>
        </button>

        {/* + Folder */}
        <button
          onClick={() => { setNewItemName(''); setModalType('new_folder') }}
          disabled={!activeProject}
          className="px-2.5 py-1 rounded-lg hover:bg-[#EBDCC8] text-[#3D2316] font-medium disabled:opacity-40 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Plus className="h-3.5 w-3.5 text-[#946132]" />
          <span>Folder</span>
        </button>

        <span className="h-4 w-px bg-[#D4C1AC] mx-1 shrink-0" />

        {/* Upload */}
        <button
          onClick={() => setModalType('upload')}
          disabled={!activeProject}
          className="px-3 py-1 rounded-lg bg-[#946132] hover:bg-[#7D5027] text-white disabled:opacity-40 inline-flex items-center space-x-1.5 transition shadow-sm shrink-0 font-semibold"
        >
          <Upload className="h-3.5 w-3.5 text-white" />
          <span>Upload</span>
        </button>

        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={!selectedItem || selectedItem.is_dir}
          className="px-2.5 py-1 rounded-lg hover:bg-[#EBDCC8] text-[#3D2316] font-medium disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Download className="h-3.5 w-3.5 text-[#704D36]" />
          <span>Download</span>
        </button>

        {/* Delete */}
        <button
          onClick={() => setConfirmDelete({ open: true, paths: selectedPaths })}
          disabled={selectedPaths.length === 0}
          className="px-2.5 py-1 rounded-lg hover:bg-rose-100 text-rose-700 disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0 font-medium"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete</span>
        </button>

        <span className="h-4 w-px bg-[#D4C1AC] mx-1 shrink-0" />

        {/* Rename */}
        <button
          onClick={() => { setNewItemName(selectedItem?.name || ''); setModalType('rename') }}
          disabled={!selectedItem}
          className="px-2.5 py-1 rounded-lg hover:bg-[#EBDCC8] text-[#3D2316] font-medium disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Edit3 className="h-3.5 w-3.5 text-[#704D36]" />
          <span>Rename</span>
        </button>

        {/* Edit */}
        <button
          onClick={() => handleOpenFile(selectedItem, 'edit')}
          disabled={!selectedItem || selectedItem.is_dir}
          className="px-2.5 py-1 rounded-lg hover:bg-[#EBDCC8] text-[#3D2316] font-medium disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <FileCode className="h-3.5 w-3.5 text-[#704D36]" />
          <span>Edit</span>
        </button>

        {/* View */}
        <button
          onClick={() => handleOpenFile(selectedItem, 'view')}
          disabled={!selectedItem || selectedItem.is_dir}
          className="px-2.5 py-1 rounded-lg hover:bg-[#EBDCC8] text-[#3D2316] font-medium disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Eye className="h-3.5 w-3.5 text-[#704D36]" />
          <span>View</span>
        </button>

        {/* Copy */}
        <button
          onClick={() => { setTargetDestination(currentPath); setModalType('copy') }}
          disabled={!selectedItem}
          className="px-2.5 py-1 rounded-lg hover:bg-[#EBDCC8] text-[#3D2316] font-medium disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Copy className="h-3.5 w-3.5 text-[#704D36]" />
          <span>Copy</span>
        </button>

        {/* Move */}
        <button
          onClick={() => { setTargetDestination(currentPath); setModalType('move') }}
          disabled={!selectedItem}
          className="px-2.5 py-1 rounded-lg hover:bg-[#EBDCC8] text-[#3D2316] font-medium disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Move className="h-3.5 w-3.5 text-[#704D36]" />
          <span>Move</span>
        </button>

        <span className="h-4 w-px bg-[#D4C1AC] mx-1 shrink-0" />

        {/* Permissions */}
        <button
          onClick={openPermissionsModal}
          disabled={!selectedItem}
          className="px-2.5 py-1 rounded-lg hover:bg-[#EBDCC8] text-[#3D2316] font-medium disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Key className="h-3.5 w-3.5 text-[#704D36]" />
          <span>Permissions</span>
        </button>

        {/* Extract */}
        <button
          onClick={() => { setTargetDestination(currentPath); setModalType('extract') }}
          disabled={!selectedItem || !selectedItem.name || !selectedItem.name.endsWith('.zip')}
          className="px-2.5 py-1 rounded-lg hover:bg-[#EBDCC8] text-[#3D2316] font-medium disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <Archive className="h-3.5 w-3.5 text-[#704D36]" />
          <span>Extract</span>
        </button>

        {/* Compress */}
        <button
          onClick={() => { setTargetDestination('archive.zip'); setModalType('compress') }}
          disabled={selectedPaths.length === 0}
          className="px-2.5 py-1 rounded-lg hover:bg-[#EBDCC8] text-[#3D2316] font-medium disabled:opacity-30 inline-flex items-center space-x-1.5 transition shrink-0"
        >
          <FileArchive className="h-3.5 w-3.5 text-[#704D36]" />
          <span>Compress</span>
        </button>
      </div>

      {/* 3. CLASSIC ADDRESS & NAVIGATION BAR */}
      <div className="h-9 bg-[#EFE4D2] border-b border-[#D4C1AC] px-3 flex items-center justify-between text-xs shrink-0 font-mono">
        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={handleGoHome}
            className="p-1 rounded bg-[#FDFBF7] hover:bg-[#EBDCC8] border border-[#D4C1AC] text-[#26160F] transition font-sans text-xs"
            title="Home"
          >
            Home
          </button>
          <button
            onClick={handleUpOneLevel}
            disabled={!currentPath}
            className="p-1 rounded bg-[#FDFBF7] hover:bg-[#EBDCC8] border border-[#D4C1AC] text-[#26160F] disabled:opacity-30 transition font-sans text-xs"
            title="Up One Level"
          >
            ↑ Up
          </button>
          <button
            onClick={handleGoBack}
            disabled={historyIndex <= 0}
            className="p-1 rounded bg-[#FDFBF7] hover:bg-[#EBDCC8] border border-[#D4C1AC] text-[#26160F] disabled:opacity-30 transition font-sans text-xs"
            title="Back"
          >
            ←
          </button>
          <button
            onClick={handleGoForward}
            disabled={historyIndex >= pathHistory.length - 1}
            className="p-1 rounded bg-[#FDFBF7] hover:bg-[#EBDCC8] border border-[#D4C1AC] text-[#26160F] disabled:opacity-30 transition font-sans text-xs"
            title="Forward"
          >
            →
          </button>
        </div>

        {/* Address Input Bar */}
        <div className="flex-1 mx-2.5 bg-[#FFFFFF] border border-[#D4C1AC] rounded px-3 py-1 text-xs text-[#26160F] flex items-center space-x-1 overflow-hidden shadow-inner font-mono">
          <span className="text-[#8C6D58] shrink-0 font-mono">
            /home/{projectOwner}
          </span>
          {activeProject && !activeProject.is_home_root && activeProject.id !== 'root' && (
            <span className="text-[#8C6D58] shrink-0 font-mono">
              {activeProject.is_git ? `/repositories/${activeProject.name}` : `/${activeProject.name}`}
            </span>
          )}
          <span className="text-[#26160F] font-bold truncate font-mono">
            {currentPath ? `/${currentPath}` : ''}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0 text-[11px]">
          <button
            onClick={handleSelectAll}
            className="px-2 py-0.5 rounded bg-[#FDFBF7] hover:bg-[#EBDCC8] border border-[#D4C1AC] text-[#26160F] font-medium transition font-sans"
          >
            Select All
          </button>
          <button
            onClick={handleUnselectAll}
            className="px-2 py-0.5 rounded bg-[#FDFBF7] hover:bg-[#EBDCC8] border border-[#D4C1AC] text-[#26160F] font-medium transition font-sans"
          >
            Unselect All
          </button>
        </div>
      </div>

      {/* 4. MAIN SPLIT PANE: ZERO GAP (Edge-to-Edge) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE: FOLDER TREE */}
        <div className="w-64 sm:w-72 bg-[#EFE4D2] border-r border-[#D4C1AC] flex flex-col shrink-0 overflow-hidden">
          <div className="h-8 bg-[#E5D7C2] border-b border-[#D4C1AC] px-3 flex items-center justify-between text-[11px] font-bold text-[#5C3B25] uppercase tracking-wider shrink-0">
            <span>{currentUser?.role === 'admin' ? 'Direktori Semua Akun' : 'Folder Tree'}</span>
            <button
              onClick={() => fetchAllTrees()}
              className="text-[#8C6D58] hover:text-[#26160F]"
              title="Refresh Folder Tree"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 text-xs space-y-1 font-mono">
            {/* cPanel-Style Isolated Home Root Node */}
            <div className="select-none text-xs">
              <div
                onClick={() => {
                  setActiveProject(homeRootProject)
                  navigateTo('', homeRootProject)
                }}
                className={`flex items-center justify-between py-1.5 px-2 rounded cursor-pointer transition ${
                  (activeProject?.is_home_root || activeProject?.id === 'root') && currentPath === ''
                    ? 'bg-[#DECDBD] text-[#1C0F0A] font-bold shadow-sm border border-[#CBB7A2]'
                    : 'text-[#3D2316] hover:bg-[#E5D7C2]'
                }`}
              >
                <div className="flex items-center space-x-1.5 overflow-hidden">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedHomeRoot(!expandedHomeRoot)
                    }}
                    className="p-0.5 text-[#8C6D58] hover:text-[#26160F]"
                  >
                    {expandedHomeRoot ? (
                      <ChevronDown className="h-3.5 w-3.5 text-[#946132]" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-[#8C6D58]" />
                    )}
                  </button>
                  <HardDrive className="h-4 w-4 text-[#946132] shrink-0" />
                  <span className="font-bold text-[#26160F]">Storage (/home/{projectOwner})</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E5D7C2] text-[#5C3B25] font-mono">
                  storage
                </span>
              </div>

              {expandedHomeRoot && homeTree?.children && (
                <div className="pl-3 border-l border-[#D4C1AC] ml-3.5 my-0.5 space-y-0.5">
                  {homeTree.children.map((child) => renderHomeTreeNode(child, 1))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANE: FILE DETAILS TABLE */}
        <div className="flex-1 bg-[#FDFBF7] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {loading ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#EFE4D2] text-[#5C3B25] uppercase text-[10px] tracking-wider border-b border-[#D4C1AC] z-10 font-bold select-none">
                  <tr>
                    <th className="p-2.5 pl-4">Name</th>
                    <th className="p-2.5 w-28">Size</th>
                    <th className="p-2.5 w-44">Last Modified</th>
                    <th className="p-2.5 w-36">Type</th>
                    <th className="p-2.5 pr-4 w-28 text-right">Permissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE4D2]">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <tr key={i} className="hover:bg-[#F9F5EC]">
                      <td className="p-2.5 pl-4">
                        <div className="flex items-center space-x-2.5">
                          <SkeletonBox light className="h-4 w-4 rounded shrink-0" />
                          <SkeletonBox light className={`h-3.5 ${i % 3 === 0 ? 'w-48' : i % 2 === 0 ? 'w-36' : 'w-56'} rounded`} />
                        </div>
                      </td>
                      <td className="p-2.5">
                        <SkeletonBox light className="h-3.5 w-14 rounded" />
                      </td>
                      <td className="p-2.5">
                        <SkeletonBox light className="h-3.5 w-32 rounded" />
                      </td>
                      <td className="p-2.5">
                        <SkeletonBox light className="h-3.5 w-20 rounded" />
                      </td>
                      <td className="p-2.5 pr-4 text-right flex justify-end">
                        <SkeletonBox light className="h-3.5 w-12 rounded" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-24 p-6">
                <Folder className="h-10 w-10 text-[#D4C1AC] mx-auto mb-2" />
                <p className="text-xs text-[#7A5844]">Folder ini kosong.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#EFE4D2] text-[#5C3B25] uppercase text-[10px] tracking-wider border-b border-[#D4C1AC] z-10 font-bold select-none">
                  <tr>
                    <th className="p-2.5 pl-4">Name</th>
                    <th className="p-2.5 w-28">Size</th>
                    <th className="p-2.5 w-44">Last Modified</th>
                    <th className="p-2.5 w-36">Type</th>
                    <th className="p-2.5 pr-4 w-28 text-right">Permissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE4D2]">
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
                            ? 'bg-[#EBDCC8] text-[#1C0F0A] font-bold border-l-2 border-l-[#946132]'
                            : 'hover:bg-[#F5ECE1] text-[#26160F]'
                        }`}
                      >
                        {/* Name */}
                        <td className="p-2 pl-4">
                          <div className="flex items-center space-x-2.5">
                            {item.is_dir ? (
                              <Folder className="h-4 w-4 text-[#B37D42] shrink-0" />
                            ) : item.name.endsWith('.py') ? (
                              <FileCode className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : item.name.endsWith('.php') ? (
                              <FileCode className="h-4 w-4 text-sky-600 shrink-0" />
                            ) : item.name.endsWith('.js') || item.name.endsWith('.jsx') ? (
                              <FileCode className="h-4 w-4 text-amber-600 shrink-0" />
                            ) : item.name.endsWith('.zip') || item.name.endsWith('.tar') ? (
                              <Archive className="h-4 w-4 text-rose-600 shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-[#8C6D58] shrink-0" />
                            )}
                            <span className="font-mono text-xs truncate text-[#26160F]">{item.name}</span>
                          </div>
                        </td>

                        {/* Size */}
                        <td className="p-2 font-mono text-[11px] text-[#704D36]">
                          {item.is_dir ? '4 KB' : formatBytes(item.size)}
                        </td>

                        {/* Last Modified */}
                        <td className="p-2 font-mono text-[11px] text-[#704D36]">
                          {formatDate(item.last_modified || item.modified || item.mtime)}
                        </td>

                        {/* Type */}
                        <td className="p-2 font-mono text-[11px] text-[#704D36] truncate">
                          {item.is_dir ? 'folder' : item.mime_type || 'text/plain'}
                        </td>

                        {/* Permissions */}
                        <td className="p-2 pr-4 font-mono text-[11px] text-[#704D36] text-right">
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
      <div className="h-7 bg-[#EFE4D2] border-t border-[#D4C1AC] px-3 flex items-center justify-between text-[11px] font-mono text-[#5C3B25] font-medium shrink-0">
        <div>
          Total: {items.length} items ({foldersCount} folders, {filesCount} files)
        </div>
        <div>
          {selectedPaths.length > 0 ? `${selectedPaths.length} item dipilih` : ''}
        </div>
        <div>
          Root: {activeProject?.id === 'root' ? `/home/${projectOwner}` : `/home/${projectOwner}/${activeProject?.is_git ? `repositories/${activeProject.name}` : activeProject?.name || ''}`}
        </div>
      </div>

      {/* ===================== MODALS ===================== */}

      {/* 1. CODE EDITOR MODAL */}
      <ModalPortal isOpen={modalType === 'edit' && Boolean(activeFile)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-5xl bg-[#FDFBF7] border border-[#D4C1AC] rounded-2xl shadow-2xl p-5 flex flex-col max-h-[90vh] text-[#26160F]">
            <div className="flex items-center justify-between pb-3 border-b border-[#D4C1AC] mb-3">
              <div>
                <h4 className="text-base font-serif font-bold text-[#26160F] flex items-center space-x-2">
                  <FileCode className="h-4 w-4 text-[#946132]" />
                  <span>Editor: {activeFile?.name}</span>
                </h4>
                <p className="text-[11px] text-[#704D36] font-mono">/{activeFile?.path}</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveFile}
                  disabled={savingFile}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#946132] hover:bg-[#7D5027] text-white flex items-center space-x-1.5 transition disabled:opacity-50 shadow"
                >
                  {savingFile ? <Spinner size="xs" /> : <Save className="h-3.5 w-3.5 text-white" />}
                  <span>Save (Ctrl+S)</span>
                </button>
                <button
                  onClick={() => setModalType(null)}
                  className="p-1.5 rounded-lg text-[#704D36] hover:text-[#26160F] hover:bg-[#EFE4D2] transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-xl border border-[#D4C1AC]">
              {contentLoading ? (
                <div className="p-8 text-center text-xs text-[#704D36]">Memuat isi file...</div>
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
                  className="w-full h-96 p-4 font-mono text-xs bg-[#FFFFFF] text-[#26160F] focus:outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />
              )}
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* 2. VIEW FILE MODAL */}
      <ModalPortal isOpen={modalType === 'view' && Boolean(activeFile)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-[#FDFBF7] border border-[#D4C1AC] rounded-2xl shadow-2xl p-5 flex flex-col max-h-[80vh] text-[#26160F]">
            <div className="flex items-center justify-between pb-3 border-b border-[#D4C1AC] mb-3">
              <h4 className="text-base font-serif font-bold text-[#26160F]">View: {activeFile?.name}</h4>
              <button onClick={() => setModalType(null)} className="p-1.5 rounded-lg text-[#704D36] hover:text-[#26160F] hover:bg-[#EFE4D2] transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-[#FFFFFF] border border-[#D4C1AC] font-mono text-xs text-[#26160F] overflow-auto flex-1 whitespace-pre-wrap">
              {fileContent}
            </pre>
          </div>
        </div>
      </ModalPortal>

      {/* 3. PERMISSIONS MODAL */}
      <ModalPortal isOpen={modalType === 'permissions' && Boolean(selectedItem)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#FDFBF7] border border-[#D4C1AC] rounded-2xl shadow-2xl p-5 text-[#26160F] space-y-4">
            <h4 className="text-base font-serif font-bold text-[#26160F]">
              Change Permissions: {selectedItem?.name}
            </h4>
            <p className="text-xs text-[#704D36]">Atur hak akses UNIX (chmod) untuk item ini.</p>

            <div className="bg-[#F7EFE4] border border-[#D4C1AC] rounded-xl p-3 text-xs font-mono">
              <div className="grid grid-cols-4 gap-2 pb-2 border-b border-[#D4C1AC] text-[#704D36] font-semibold text-center">
                <span>Role</span>
                <span>Read (4)</span>
                <span>Write (2)</span>
                <span>Execute (1)</span>
              </div>

              {/* User */}
              <div className="grid grid-cols-4 gap-2 py-1.5 items-center text-center">
                <span className="text-left font-bold text-[#26160F]">User</span>
                <input type="checkbox" checked={permUser.r} onChange={() => handlePermChange('u', 'r')} className="h-4 w-4 accent-[#946132] mx-auto cursor-pointer" />
                <input type="checkbox" checked={permUser.w} onChange={() => handlePermChange('u', 'w')} className="h-4 w-4 accent-[#946132] mx-auto cursor-pointer" />
                <input type="checkbox" checked={permUser.x} onChange={() => handlePermChange('u', 'x')} className="h-4 w-4 accent-[#946132] mx-auto cursor-pointer" />
              </div>

              {/* Group */}
              <div className="grid grid-cols-4 gap-2 py-1.5 items-center text-center">
                <span className="text-left font-bold text-[#26160F]">Group</span>
                <input type="checkbox" checked={permGroup.r} onChange={() => handlePermChange('g', 'r')} className="h-4 w-4 accent-[#946132] mx-auto cursor-pointer" />
                <input type="checkbox" checked={permGroup.w} onChange={() => handlePermChange('g', 'w')} className="h-4 w-4 accent-[#946132] mx-auto cursor-pointer" />
                <input type="checkbox" checked={permGroup.x} onChange={() => handlePermChange('g', 'x')} className="h-4 w-4 accent-[#946132] mx-auto cursor-pointer" />
              </div>

              {/* World */}
              <div className="grid grid-cols-4 gap-2 py-1.5 items-center text-center">
                <span className="text-left font-bold text-[#26160F]">World</span>
                <input type="checkbox" checked={permWorld.r} onChange={() => handlePermChange('w', 'r')} className="h-4 w-4 accent-[#946132] mx-auto cursor-pointer" />
                <input type="checkbox" checked={permWorld.w} onChange={() => handlePermChange('w', 'w')} className="h-4 w-4 accent-[#946132] mx-auto cursor-pointer" />
                <input type="checkbox" checked={permWorld.x} onChange={() => handlePermChange('w', 'x')} className="h-4 w-4 accent-[#946132] mx-auto cursor-pointer" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#704D36]">Permission Code:</span>
              <span className="px-3 py-1 rounded bg-[#EFE4D2] border border-[#D4C1AC] font-bold text-[#946132]">{permOctal}</span>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#5C3B25] hover:text-[#26160F] hover:bg-[#EFE4D2] border border-[#D4C1AC] transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#946132] hover:bg-[#7D5027] text-white shadow transition"
              >
                Change Permissions
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* 4. RENAME MODAL */}
      <ModalPortal isOpen={modalType === 'rename' && Boolean(selectedItem)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#FDFBF7] border border-[#D4C1AC] rounded-2xl shadow-2xl p-5 text-[#26160F]">
            <h4 className="text-base font-serif font-bold text-[#26160F] mb-1">Rename Item</h4>
            <p className="text-xs text-[#704D36] mb-4">Nama baru untuk {selectedItem?.name}:</p>
            <form onSubmit={handleRename} className="space-y-4">
              <input
                type="text"
                required
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full bg-[#FFFFFF] border border-[#D4C1AC] rounded-lg px-3 py-1.5 text-xs text-[#26160F] font-mono focus:outline-none focus:border-[#946132]"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#5C3B25] hover:bg-[#EFE4D2] border border-[#D4C1AC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#946132] hover:bg-[#7D5027] text-white shadow"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#FDFBF7] border border-[#D4C1AC] rounded-2xl shadow-2xl p-5 text-[#26160F]">
            <h4 className="text-base font-serif font-bold text-[#26160F] mb-1">
              {modalType === 'move' ? 'Move File / Folder' : 'Copy File / Folder'}
            </h4>
            <p className="text-xs text-[#704D36] mb-3">
              Tentukan path direktori tujuan di dalam storage akun Anda untuk <code className="font-mono bg-[#EFE4D2] px-1.5 py-0.5 rounded text-[#26160F]">{selectedItem?.name}</code>:
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="e.g. public_html atau kosongkan untuk root storage"
                value={targetDestination}
                onChange={(e) => setTargetDestination(e.target.value)}
                className="w-full bg-[#FFFFFF] border border-[#D4C1AC] rounded-lg px-3 py-2 text-xs text-[#26160F] font-mono focus:outline-none focus:border-[#946132] shadow-inner"
              />
              
              {/* Quick Destination Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-[#8C6D58] text-[10px] font-sans">Pilihan Cepat:</span>
                <button
                  type="button"
                  onClick={() => setTargetDestination('')}
                  className="px-2 py-0.5 rounded bg-[#EFE4D2] hover:bg-[#DECDBD] text-[#5C3B25] font-mono text-[10px] border border-[#D4C1AC] transition"
                  title="Root /home/{username}"
                >
                  / (Root)
                </button>
                <button
                  type="button"
                  onClick={() => setTargetDestination('public_html')}
                  className="px-2 py-0.5 rounded bg-[#EFE4D2] hover:bg-[#DECDBD] text-[#5C3B25] font-mono text-[10px] border border-[#D4C1AC] transition font-semibold"
                  title="Direktori Web Utama"
                >
                  public_html
                </button>
                <button
                  type="button"
                  onClick={() => setTargetDestination('logs')}
                  className="px-2 py-0.5 rounded bg-[#EFE4D2] hover:bg-[#DECDBD] text-[#5C3B25] font-mono text-[10px] border border-[#D4C1AC] transition"
                  title="Direktori Log Server"
                >
                  logs
                </button>
              </div>

              {/* Live Preview */}
              <div className="text-[11px] text-[#8C6D58] font-mono bg-[#F4EDE2] p-2.5 rounded-lg border border-[#D4C1AC]/60">
                <span className="text-[10px] font-sans text-[#704D36] block mb-0.5">Preview Path Tujuan:</span>
                <span className="text-[#26160F] font-semibold break-all">
                  /home/{projectOwner}/{targetDestination ? targetDestination.replace(/^\/+/, '') : ''}
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#5C3B25] hover:bg-[#EFE4D2] border border-[#D4C1AC]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyMove(modalType === 'move')}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#946132] hover:bg-[#7D5027] text-white shadow"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#FDFBF7] border border-[#D4C1AC] rounded-2xl shadow-2xl p-5 text-[#26160F]">
            <h4 className="text-base font-serif font-bold text-[#26160F] mb-1">Compress Items</h4>
            <p className="text-xs text-[#704D36] mb-4">Nama arsip ZIP yang akan dibuat:</p>
            <form onSubmit={handleCompress} className="space-y-4">
              <input
                type="text"
                required
                value={targetDestination}
                onChange={(e) => setTargetDestination(e.target.value)}
                placeholder="archive.zip"
                className="w-full bg-[#FFFFFF] border border-[#D4C1AC] rounded-lg px-3 py-1.5 text-xs text-[#26160F] font-mono focus:outline-none focus:border-[#946132]"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#5C3B25] hover:bg-[#EFE4D2] border border-[#D4C1AC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#946132] hover:bg-[#7D5027] text-white shadow"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#FDFBF7] border border-[#D4C1AC] rounded-2xl shadow-2xl p-5 text-[#26160F]">
            <h4 className="text-base font-serif font-bold text-[#26160F] mb-1">Extract Archive</h4>
            <p className="text-xs text-[#704D36] mb-4">
              Ekstrak '{selectedItem?.name}' ke path direktori:
            </p>
            <form onSubmit={handleExtract} className="space-y-4">
              <input
                type="text"
                placeholder="e.g. app atau kosongkan untuk folder saat ini"
                value={targetDestination}
                onChange={(e) => setTargetDestination(e.target.value)}
                className="w-full bg-[#FFFFFF] border border-[#D4C1AC] rounded-lg px-3 py-1.5 text-xs text-[#26160F] font-mono focus:outline-none focus:border-[#946132]"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#5C3B25] hover:bg-[#EFE4D2] border border-[#D4C1AC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#946132] hover:bg-[#7D5027] text-white shadow"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#FDFBF7] border border-[#D4C1AC] rounded-2xl shadow-2xl p-5 text-[#26160F]">
            <h4 className="text-base font-serif font-bold text-[#26160F] mb-1">
              {modalType === 'new_folder' ? 'Create New Folder' : 'Create New File'}
            </h4>
            <p className="text-xs text-[#704D36] mb-4">Lokasi: /{currentPath || ''}</p>
            <form onSubmit={handleCreateNewItem} className="space-y-4">
              <input
                type="text"
                required
                placeholder={modalType === 'new_folder' ? 'folder-name' : 'index.php'}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full bg-[#FFFFFF] border border-[#D4C1AC] rounded-lg px-3 py-1.5 text-xs text-[#26160F] font-mono focus:outline-none focus:border-[#946132]"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#5C3B25] hover:bg-[#EFE4D2] border border-[#D4C1AC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#946132] hover:bg-[#7D5027] text-white shadow"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#FDFBF7] border border-[#D4C1AC] rounded-2xl shadow-2xl p-5 text-[#26160F]">
            <h4 className="text-base font-serif font-bold text-[#26160F] mb-1">Upload Files</h4>
            <p className="text-xs text-[#704D36] mb-4">
              Upload file atau arsip .ZIP ke folder /{currentPath || ''}.
            </p>
            <form onSubmit={handleUploadFiles} className="space-y-4">
              <div className="border-2 border-dashed border-[#D4C1AC] hover:border-[#946132] rounded-xl p-6 text-center transition bg-[#F7EFE4]">
                <Upload className="h-8 w-8 text-[#946132] mx-auto mb-2" />
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
                  className="cursor-pointer text-xs font-semibold text-[#946132] hover:underline block"
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
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#5C3B25] hover:bg-[#EFE4D2] border border-[#D4C1AC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploading || uploadFiles.length === 0}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#946132] hover:bg-[#7D5027] text-white shadow disabled:opacity-50"
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
