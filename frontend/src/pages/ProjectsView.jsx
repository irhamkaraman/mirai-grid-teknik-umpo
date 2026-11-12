import React, { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Play, Square, RotateCw, Trash2, Edit2, ExternalLink, Layers, AlertCircle, Terminal, Search, RefreshCw, ChevronLeft, ChevronRight, Globe, Copy, Check, Folder, ShieldCheck, GraduationCap, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonTable, Spinner } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import FileManager from '../components/FileManager'
import ProjectDetailPage from './ProjectDetailPage'
import CreateProjectPage from './CreateProjectPage'
import ConsolePage from './ConsolePage'

export default function ProjectsView({ user: propUser }) {
  const currentUser = propUser || JSON.parse(localStorage.getItem('miraigrid_user') || '{}')
  const isAdmin = currentUser?.role === 'admin'
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  // Sub-environments (Full Page Views, BUKAN MODAL!)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [activeProjectDetail, setActiveProjectDetail] = useState(null)
  const [activeFileManagerProject, setActiveFileManagerProject] = useState(null)
  const [activeConsoleProject, setActiveConsoleProject] = useState(null)

  // Confirmation modal
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '' })
  const [controlLoadingId, setControlLoadingId] = useState(null)
  const [publishLoadingId, setPublishLoadingId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const location = useLocation()

  // Search, Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'running', 'stopped', 'php', 'node', 'python'
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    if (location.search.includes('create=true')) {
      setIsCreatingProject(true)
    }
  }, [location.search])

  useEffect(() => {
    fetchProjects()
  }, [])

  const handlePublishWeb = async (projectId) => {
    setPublishLoadingId(projectId)
    try {
      const res = await api.post('/deployments/publish', { project_id: projectId })
      toast.success(`Berhasil mem-publish web ke subdomain resmi: ${res.data.subdomain}`)
      await fetchProjects(true)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.detail || 'Gagal mem-publish web.')
    } finally {
      setPublishLoadingId(null)
    }
  }

  const handleToggleDeployment = async (deploymentId) => {
    try {
      const res = await api.post(`/deployments/${deploymentId}/toggle`)
      toast.success(`Status publikasi diubah menjadi: ${res.data.status}`)
      await fetchProjects(true)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.detail || 'Gagal mengubah status publikasi.')
    }
  }

  const handleCopyLink = (url, id) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast.success('Link publik resmi disalin ke clipboard!')
    setTimeout(() => setCopiedId(null), 2500)
  }

  const fetchProjects = async (updateDetail = false) => {
    try {
      const res = await api.get('/projects')
      setProjects(res.data)
      if (updateDetail && activeProjectDetail) {
        const updated = res.data.find((p) => p.id === activeProjectDetail.id)
        if (updated) setActiveProjectDetail(updated)
      }
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat daftar project.')
    } finally {
      setLoading(false)
    }
  }

  // Filter & Search Logic
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const q = searchQuery.toLowerCase().trim()
      const appCfg = p.app_config || {}
      const matchesSearch =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.subdomain?.toLowerCase().includes(q) ||
        p.owner_username?.toLowerCase().includes(q) ||
        String(appCfg.app_root || '').toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (statusFilter === 'all') return true
      if (statusFilter === 'running') return p.status === 'running'
      if (statusFilter === 'stopped') return p.status !== 'running'
      if (['php', 'node', 'python'].includes(statusFilter)) {
        return (p.language || '').toLowerCase() === statusFilter
      }
      return true
    })
  }, [projects, searchQuery, statusFilter])

  // Reset page on search or filter change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

  const counts = useMemo(() => {
    return {
      all: projects.length,
      running: projects.filter((p) => p.status === 'running').length,
      stopped: projects.filter((p) => p.status !== 'running').length,
      php: projects.filter((p) => (p.language || '').toLowerCase() === 'php').length,
      node: projects.filter((p) => (p.language || '').toLowerCase() === 'node').length,
      python: projects.filter((p) => (p.language || '').toLowerCase() === 'python').length,
    }
  }, [projects])

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / itemsPerPage))
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredProjects.slice(start, start + itemsPerPage)
  }, [filteredProjects, currentPage, itemsPerPage])

  // Grouping per Akun untuk Tampilan Administrator (Sekat Pemisah Antar Akun)
  const paginatedAccountGroups = useMemo(() => {
    if (!isAdmin) return null

    const map = new Map()
    paginatedProjects.forEach((proj) => {
      const uname = proj.owner_username || 'user'
      if (!map.has(uname)) {
        map.set(uname, {
          username: uname,
          name: proj.owner_name || uname,
          role: proj.owner_role || (uname === 'admin' ? 'admin' : 'student'),
          projects: []
        })
      }
      map.get(uname).projects.push(proj)
    })

    const groups = Array.from(map.values())
    groups.sort((a, b) => {
      if (a.username === 'admin') return -1
      if (b.username === 'admin') return 1
      return a.username.localeCompare(b.username)
    })
    return groups
  }, [paginatedProjects, isAdmin])

  const handleControl = async (projectId, action) => {
    setControlLoadingId(projectId)
    const actionLabel = action === 'start' ? 'Menyalakan' : action === 'stop' ? 'Menghentikan' : 'Me-restart'
    const toastId = toast.loading(`${actionLabel} container...`)
    try {
      await api.post(`/projects/${projectId}/control?action=${action}`)
      toast.success(`Container berhasil di-${action}!`, { id: toastId })
      fetchProjects()
    } catch (err) {
      toast.error(err.response?.data?.detail || `Gagal ${action} project.`, { id: toastId })
    } finally {
      setControlLoadingId(null)
    }
  }

  const triggerDelete = (projectId, name) => {
    setConfirmDelete({ open: true, id: projectId, name })
  }

  const executeDelete = async () => {
    const toastId = toast.loading(`Menghapus project ${confirmDelete.name}...`)
    try {
      await api.delete(`/projects/${confirmDelete.id}`)
      toast.success('Project berhasil dihapus.', { id: toastId })
      fetchProjects()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus project.', { id: toastId })
    }
  }

  // 1. If Create Project Page is Active (Dedicated Page View, BUKAN MODAL!)
  if (isCreatingProject) {
    return (
      <CreateProjectPage
        user={currentUser}
        onBack={() => setIsCreatingProject(false)}
        onCreated={(newProj) => {
          setIsCreatingProject(false)
          fetchProjects()
          setActiveProjectDetail(newProj)
        }}
      />
    )
  }

  // 2. If Detail Page is Active (Dedicated Page View, BUKAN MODAL!)
  if (activeProjectDetail) {
    return (
      <ProjectDetailPage
        user={currentUser}
        project={activeProjectDetail}
        onBack={() => {
          setActiveProjectDetail(null)
        }}
        onUpdated={() => fetchProjects(true)}
        onOpenConsole={(proj) => {
          setActiveProjectDetail(null)
          setActiveConsoleProject(proj)
        }}
        onOpenFile={(targetPath) => {
          const subpath = (targetPath || '').replace(new RegExp(`^/home/[^/]+/?`), '')
          setActiveProjectDetail(null)
          setActiveFileManagerProject({
            id: 'root',
            name: 'Storage',
            is_home_root: true,
            owner_username: activeProjectDetail.owner_username || currentUser.username,
            virtual_path: `/home/${activeProjectDetail.owner_username || currentUser.username}`,
            initial_path: subpath
          })
        }}
      />
    )
  }

  // 3. If File Manager is Active (Dedicated Page View, BUKAN MODAL!)
  if (activeFileManagerProject) {
    return (
      <FileManager
        project={activeFileManagerProject}
        onClose={() => {
          setActiveFileManagerProject(null)
          fetchProjects()
        }}
      />
    )
  }

  // 4. If Container Console is Active (Dedicated CLI Page, BUKAN MODAL!)
  if (activeConsoleProject) {
    return (
      <ConsolePage
        project={activeConsoleProject}
        onBack={() => {
          setActiveConsoleProject(null)
          fetchProjects()
        }}
      />
    )
  }

  // Helper Render Baris Project
  const renderProjectRow = (proj, isGrouped = false) => {
    const isRunning = proj.status === 'running'
    const isBusy = controlLoadingId === proj.id
    const appCfg = proj.app_config || {}
    const projOwner = proj.owner_username || 'user'
    const isGitRepo = appCfg.is_git_repo || (appCfg.app_root && String(appCfg.app_root).includes('/repositories/'))
    let appRoot = `/home/${projOwner}/${proj.name}`
    if (appCfg.display_app_root) {
      appRoot = appCfg.display_app_root
    } else if (appCfg.app_root) {
      if (String(appCfg.app_root).startsWith('/')) {
        appRoot = appCfg.app_root
      } else {
        appRoot = `/home/${projOwner}/${proj.name}/${String(appCfg.app_root).replace(/^\/+/g, '')}`
      }
    }
    const mode = appCfg.app_mode || 'development'

    return (
      <tr key={proj.id} className={`hover:bg-[#361E13] transition group ${isGrouped ? 'bg-[#23120A]/70' : ''}`}>
        {/* 1. App URI */}
        <td className={`p-4 ${isGrouped ? 'pl-6' : ''}`}>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveProjectDetail(proj)}
              className="font-bold text-sm text-[#E8DCB8] hover:underline font-mono text-left flex items-center space-x-1.5"
            >
              <span>{proj.name}</span>
              <ExternalLink className="h-3 w-3 text-[#A47E65]" />
            </button>
            {isGrouped && (
              <span className="font-mono text-[10px] text-[#C49767]/80 bg-[#140A05] px-2 py-0.5 rounded border border-[#3E2316]">
                Port :{proj.allocated_port}
              </span>
            )}
          </div>
          <div className="text-[10px] font-mono text-[#DFCDB5]/60 mt-0.5 truncate max-w-xs">
            {proj.public_url || proj.access_url}
          </div>

          {/* Public Web Subdomain / Publish Web Button */}
          {proj.public_url ? (
            <div className="mt-2 flex items-center space-x-1.5 flex-wrap">
              <a
                href={proj.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-mono transition border ${
                  proj.is_published
                    ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/80 hover:text-emerald-200 shadow-sm'
                    : 'bg-stone-900/60 border-stone-700/50 text-stone-400'
                }`}
                title="Buka Website Resmi Publik"
              >
                <Globe className={`h-3 w-3 ${proj.is_published ? 'text-emerald-400' : 'text-stone-400'} shrink-0`} />
                <span className="truncate max-w-[210px] font-semibold">{proj.public_subdomain}</span>
                <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
              </a>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopyLink(proj.public_url, proj.id)
                }}
                title="Salin Link Publik"
                className="p-1 rounded-lg bg-[#1C0F0A] hover:bg-[#382115] text-[#DFCDB5] border border-[#3E2316] transition"
              >
                {copiedId === proj.id ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3 text-[#C49767]" />
                )}
              </button>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                proj.is_published ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-stone-800 text-stone-400'
              }`}>
                {proj.is_published ? 'Online' : 'Stopped'}
              </span>
            </div>
          ) : (
            <div className="mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handlePublishWeb(proj.id)
                }}
                disabled={publishLoadingId === proj.id}
                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl text-[11px] font-semibold bg-[#3A2216] hover:bg-[#5A3521] text-[#FAF5EC] border border-[#683E24] transition shadow-sm"
                title="Generate subdomain & publikasikan web ini ke internet (web-xxxx-nim.miraigrid.web.id)"
              >
                <Globe className="h-3 w-3 text-amber-400" />
                <span>{publishLoadingId === proj.id ? 'Mengenerate Subdomain...' : 'Deploy / Publish Web'}</span>
              </button>
            </div>
          )}
        </td>

        {/* 2. App Root Directory (Clickable -> Direct to File Manager) */}
        <td className="p-4 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => {
              const subpath = appRoot.replace(new RegExp(`^/home/[^/]+/?`), '')
              setActiveFileManagerProject({
                id: 'root',
                name: 'Storage',
                is_home_root: true,
                owner_username: projOwner,
                virtual_path: `/home/${projOwner}`,
                initial_path: subpath
              })
            }}
            className="group inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-[#201008] hover:bg-[#341B0E] border border-[#4D2D1E] hover:border-[#C49767] text-[#DFCDB5] hover:text-[#FAF5EC] transition text-left cursor-pointer shadow-sm hover:shadow"
            title="Buka direktori ini langsung di File Manager"
          >
            <Folder className="h-3.5 w-3.5 text-[#C49767] group-hover:scale-110 transition-transform shrink-0" />
            <span className="truncate max-w-[220px] underline decoration-dotted decoration-[#C49767]/60 group-hover:decoration-solid">{appRoot}</span>
            <ExternalLink className="h-3 w-3 text-[#C49767] opacity-60 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />
            {isGitRepo && (
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#C49767]/20 border border-[#C49767]/40 text-[#E8DCB8] font-sans font-medium ml-1">
                Git™ Repo
              </span>
            )}
          </button>
        </td>

        {/* 3. Mode */}
        <td className="p-4 font-mono text-xs text-[#DFCDB5]">
          <span className="capitalize">{mode}</span>
        </td>

        {/* 4. Status */}
        <td className="p-4">
          <div className="flex items-center space-x-2">
            <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
            <span className="font-mono text-xs">
              {isRunning ? `started (v${proj.version})` : 'stopped'}
            </span>
          </div>
        </td>

        {/* 5. Actions */}
        <td className="p-4 text-right">
          <div className="inline-flex items-center space-x-1.5">
            {isBusy ? (
              <div className="p-1.5">
                <Spinner size="xs" />
              </div>
            ) : isRunning ? (
              <button
                onClick={() => handleControl(proj.id, 'stop')}
                title="Stop Application"
                className="p-1.5 rounded-lg text-[#DFCDB5] hover:text-amber-400 hover:bg-[#3A2115] transition"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => handleControl(proj.id, 'start')}
                title="Start Application"
                className="p-1.5 rounded-lg text-[#DFCDB5] hover:text-emerald-400 hover:bg-[#3A2115] transition"
              >
                <Play className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={() => handleControl(proj.id, 'restart')}
              title="Restart Application"
              className="p-1.5 rounded-lg text-[#DFCDB5] hover:text-white hover:bg-[#3A2115] transition"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            <button
              onClick={() => setActiveConsoleProject(proj)}
              title="Buka Console Container (CLI)"
              className="p-1.5 rounded-lg text-[#DFCDB5] hover:text-[#E8DCB8] hover:bg-[#3A2115] transition"
            >
              <Terminal className="h-4 w-4" />
            </button>

            {proj.deployment_id && (
              <button
                onClick={() => handleToggleDeployment(proj.deployment_id)}
                title={proj.is_published ? 'Hentikan Publikasi Web (Subdomain Off)' : 'Aktifkan Kembali Publikasi Web'}
                className={`p-1.5 rounded-lg transition ${
                  proj.is_published
                    ? 'text-emerald-400 hover:text-emerald-300 hover:bg-[#1E3022]'
                    : 'text-stone-400 hover:text-amber-400 hover:bg-[#3A2115]'
                }`}
              >
                <Globe className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={() => setActiveProjectDetail(proj)}
              title="Buka Halaman Detail Konfigurasi"
              className="p-1.5 rounded-lg text-[#E8DCB8] hover:text-white hover:bg-[#5A3521] transition"
            >
              <Edit2 className="h-4 w-4" />
            </button>

            <button
              onClick={() => triggerDelete(proj.id, proj.name)}
              title="Destroy Application"
              className="p-1.5 rounded-lg text-[#DFCDB5] hover:text-rose-400 hover:bg-[#3A2115] transition"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200 w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#26160F]">
            Konfigurasi Deploy
          </h2>
          <p className="text-xs text-[#5C3B29] mt-1 font-sans">
            Deploy kode praktikum (PHP, Python, Node.js) ke container terisolasi & publikasikan ke subdomain resmi.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <div className="hidden sm:flex items-center space-x-2 px-3.5 py-2 rounded-2xl bg-[#2B1810] border border-[#4D2D1E] text-xs font-mono text-[#E8DCB8] shadow-sm">
            <Globe className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>Wildcard: <strong className="text-emerald-300">*.miraigrid.web.id</strong></span>
          </div>
          <button
            onClick={() => setIsCreatingProject(true)}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#2B1810] hover:bg-[#3D2317] text-[#FAF5EC] border border-[#4D2D1E] shadow-lg shadow-black/10 transition shrink-0"
          >
            <Plus className="h-4 w-4 text-[#E8DCB8]" />
            <span>Buat Project Baru</span>
          </button>
        </div>
      </div>

      {/* Search, Filter & Control Toolbar */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 text-[#A47E65] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari project, subdomain, path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF5EC] placeholder-[#A47E65] focus:outline-none focus:border-[#C49767] transition font-sans"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-amber-600 text-amber-950 font-bold shadow'
                  : 'bg-[#1C0F0A] text-[#DFCDB5] hover:bg-[#382115] border border-[#3E2316]'
              }`}
            >
              Semua ({counts.all})
            </button>
            <button
              onClick={() => setStatusFilter('running')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                statusFilter === 'running'
                  ? 'bg-emerald-600 text-emerald-950 font-bold shadow'
                  : 'bg-[#1C0F0A] text-emerald-400/90 hover:bg-[#16271D] border border-emerald-900/40'
              }`}
            >
              Running ({counts.running})
            </button>
            <button
              onClick={() => setStatusFilter('stopped')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                statusFilter === 'stopped'
                  ? 'bg-rose-600 text-rose-950 font-bold shadow'
                  : 'bg-[#1C0F0A] text-rose-400/90 hover:bg-[#281518] border border-rose-900/40'
              }`}
            >
              Stopped ({counts.stopped})
            </button>
            {counts.php > 0 && (
              <button
                onClick={() => setStatusFilter('php')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition shrink-0 ${
                  statusFilter === 'php'
                    ? 'bg-indigo-600 text-indigo-950 font-bold shadow'
                    : 'bg-[#1C0F0A] text-indigo-300 hover:bg-[#241B33] border border-indigo-900/40'
                }`}
              >
                PHP ({counts.php})
              </button>
            )}
            {counts.node > 0 && (
              <button
                onClick={() => setStatusFilter('node')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition shrink-0 ${
                  statusFilter === 'node'
                    ? 'bg-emerald-600 text-emerald-950 font-bold shadow'
                    : 'bg-[#1C0F0A] text-emerald-300 hover:bg-[#152B1F] border border-emerald-900/40'
                }`}
              >
                Node ({counts.node})
              </button>
            )}
            {counts.python > 0 && (
              <button
                onClick={() => setStatusFilter('python')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition shrink-0 ${
                  statusFilter === 'python'
                    ? 'bg-amber-600 text-amber-950 font-bold shadow'
                    : 'bg-[#1C0F0A] text-amber-300 hover:bg-[#282116] border border-amber-900/40'
                }`}
              >
                Python ({counts.python})
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => fetchProjects()}
          title="Muat Ulang Data"
          className="p-2 rounded-xl bg-[#1C0F0A] hover:bg-[#3A2216] text-[#DFCDB5] border border-[#3E2316] transition shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 5-COLUMN TABLE ALA CPANEL (App URI, App Root Directory, Mode, Status, Actions) */}
      {loading ? (
        <SkeletonTable rows={4} />
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-8 shadow-xl text-[#FAF5EC]">
          <Layers className="h-10 w-10 text-[#A47E65] mx-auto mb-3" />
          <h4 className="text-base font-serif font-bold text-[#FAF5EC]">Belum Ada Aplikasi Terdaftar</h4>
          <p className="text-xs text-[#DFCDB5] max-w-sm mx-auto mt-1 mb-6">
            Klik tombol di bawah untuk membuat aplikasi baru di halaman khusus. Container akan langsung otomatis berjalan.
          </p>
          <button
            onClick={() => setIsCreatingProject(true)}
            className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] transition"
          >
            Mulai Buat Aplikasi
          </button>
        </div>
      ) : (
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl overflow-hidden shadow-2xl text-[#FAF5EC]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1C0F0A] text-[#DFCDB5] uppercase text-[10px] tracking-wider border-b border-[#3E2316]">
                <tr>
                  <th className="p-4 font-semibold">App URI</th>
                  <th className="p-4 font-semibold">App Root Directory</th>
                  <th className="p-4 font-semibold">Mode</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3E2316]">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-[#A47E65]">
                      Tidak ada project yang cocok dengan pencarian atau filter yang dipilih.
                    </td>
                  </tr>
                ) : isAdmin && paginatedAccountGroups ? (
                  paginatedAccountGroups.map((group) => {
                    const runningCount = group.projects.filter(p => p.status === 'running').length
                    const onlineCount = group.projects.filter(p => p.public_url).length

                    return (
                      <React.Fragment key={`group-${group.username}`}>
                        {/* Sekat Pemisah Antar Akun (Account Divider Bar) */}
                        <tr className="bg-gradient-to-r from-[#1E0F08] via-[#2A160D] to-[#1E0F08] border-t-2 border-b border-[#4D2D1E]">
                          <td colSpan="5" className="px-5 py-3.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {/* Identitas Akun */}
                              <div className="flex items-center space-x-3">
                                <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-inner ${
                                  group.role === 'admin'
                                    ? 'bg-[#C49767]/20 border border-[#C49767]/50 text-[#FAF5EC]'
                                    : 'bg-[#5C3B29]/30 border border-[#8A5835]/50 text-[#E8DCB8]'
                                }`}>
                                  {group.role === 'admin' ? (
                                    <ShieldCheck className="h-4 w-4 text-[#C49767]" />
                                  ) : (
                                    <GraduationCap className="h-4 w-4 text-emerald-400" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center space-x-2 flex-wrap">
                                    <span className="font-serif font-bold text-sm text-[#FAF5EC] tracking-wide">
                                      {group.name}
                                    </span>
                                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-lg bg-[#140A05] text-[#C49767] border border-[#3E2316]">
                                      {group.username}
                                    </span>
                                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                                      group.role === 'admin'
                                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    }`}>
                                      {group.role === 'admin' ? 'Administrator' : 'Mahasiswa'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[#A47E65] font-sans mt-0.5">
                                    Ruang terisolasi per akun • Sandbox cgroups v2 & alokasi resource mandiri
                                  </p>
                                </div>
                              </div>

                              {/* Metrik & Quick Shortcut Akun */}
                              <div className="flex items-center space-x-2 self-end sm:self-auto flex-wrap">
                                <span className="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-[#140A05] text-[#DFCDB5] border border-[#3E2316]">
                                  {group.projects.length} Aplikasi
                                </span>
                                {runningCount > 0 && (
                                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                                    {runningCount} Berjalan
                                  </span>
                                )}
                                {onlineCount > 0 && (
                                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-[#201008] text-amber-300 border border-amber-900/40 flex items-center space-x-1">
                                    <Globe className="h-3 w-3 text-amber-400" />
                                    <span>{onlineCount} Subdomain</span>
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveFileManagerProject({
                                      id: 'root',
                                      name: 'Storage',
                                      is_home_root: true,
                                      owner_username: group.username,
                                      virtual_path: `/home/${group.username}`,
                                      initial_path: ''
                                    })
                                  }}
                                  className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-[#2B1810] hover:bg-[#3D2317] border border-[#4D2D1E] hover:border-[#C49767] text-[11px] font-medium text-[#DFCDB5] hover:text-[#FAF5EC] transition shadow-sm"
                                  title={`Buka File Manager /home/${group.username}`}
                                >
                                  <Folder className="h-3 w-3 text-[#C49767]" />
                                  <span>Storage Akun</span>
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {group.projects.map((proj) => renderProjectRow(proj, true))}
                      </React.Fragment>
                    )
                  })
                ) : (
                  paginatedProjects.map((proj) => renderProjectRow(proj, false))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredProjects.length > 0 && (
            <div className="bg-[#1C0F0A] px-5 py-3.5 border-t border-[#3E2316] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#DFCDB5]">
              <span className="font-mono text-[11px] text-[#A47E65]">
                Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredProjects.length)} dari {filteredProjects.length} project
              </span>
              {totalPages > 1 && (
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-[#2B1810] hover:bg-[#3D2317] border border-[#4D2D1E] text-[#DFCDB5] disabled:opacity-40 transition"
                    title="Halaman Sebelumnya"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-2.5 py-1 rounded-lg font-mono text-xs transition ${
                        currentPage === page
                          ? 'bg-[#C49767] text-[#2B1810] font-bold shadow-sm'
                          : 'bg-[#2B1810] hover:bg-[#3D2317] border border-[#4D2D1E] text-[#DFCDB5]'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg bg-[#2B1810] hover:bg-[#3D2317] border border-[#4D2D1E] text-[#DFCDB5] disabled:opacity-40 transition"
                    title="Halaman Selanjutnya"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.open}
        title="Destroy Application?"
        message={`Apakah Anda yakin ingin menghapus aplikasi '${confirmDelete.name}' beserta container dan filenya?`}
        confirmText="Destroy Application"
        onConfirm={executeDelete}
        onClose={() => setConfirmDelete({ open: false, id: null, name: '' })}
      />
    </div>
  )
}
