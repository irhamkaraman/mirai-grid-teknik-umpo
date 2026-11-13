import React, { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Plus,
  Play,
  Square,
  RotateCw,
  Trash2,
  Edit2,
  ExternalLink,
  Layers,
  AlertCircle,
  Terminal,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Globe,
  Copy,
  Check,
  Folder,
  ShieldCheck,
  GraduationCap,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonTable, Spinner } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import FileManager from '../components/FileManager'
import ProjectDetailPage from './ProjectDetailPage'
import CreateProjectPage from './CreateProjectPage'
import ConsolePage from './ConsolePage'
import { useTheme } from '../context/ThemeContext'
import Button from '../components/Button'
import Card from '../components/Card'

export default function ProjectsView({ user: propUser }) {
  const { isV2 } = useTheme()
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

  // Grouping by Owner for Admin
  const accountGroups = useMemo(() => {
    if (!isAdmin) return []
    const groups = {}
    filteredProjects.forEach((p) => {
      const owner = p.owner_username || 'system'
      if (!groups[owner]) {
        groups[owner] = {
          username: owner,
          name: p.owner_name || owner,
          role: p.owner_role || 'student',
          projects: [],
        }
      }
      groups[owner].projects.push(p)
    })
    return Object.values(groups)
  }, [filteredProjects, isAdmin])

  const totalPages = Math.ceil(
    (isAdmin ? accountGroups.length : filteredProjects.length) / itemsPerPage
  ) || 1

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredProjects.slice(start, start + itemsPerPage)
  }, [filteredProjects, currentPage, itemsPerPage])

  const paginatedAccountGroups = useMemo(() => {
    if (!isAdmin) return []
    const start = (currentPage - 1) * itemsPerPage
    return accountGroups.slice(start, start + itemsPerPage)
  }, [accountGroups, currentPage, itemsPerPage, isAdmin])

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

  const handleControl = async (projectId, action) => {
    setControlLoadingId(projectId)
    const toastId = toast.loading(`Menjalankan perintah ${action}...`)
    try {
      await api.post(`/projects/${projectId}/${action}`)
      toast.success(`Aplikasi berhasil di-${action}!`, { id: toastId })
      await fetchProjects(true)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.detail || `Gagal me-${action} aplikasi.`, { id: toastId })
    } finally {
      setControlLoadingId(null)
    }
  }

  const triggerDelete = (id, name) => {
    setConfirmDelete({ open: true, id, name })
  }

  const executeDelete = async () => {
    const { id, name } = confirmDelete
    const toastId = toast.loading(`Menghapus ${name}...`)
    try {
      await api.delete(`/projects/${id}`)
      toast.success(`Aplikasi '${name}' berhasil dihapus.`, { id: toastId })
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.detail || 'Gagal menghapus aplikasi.', { id: toastId })
    }
  }

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
            initial_path: subpath,
          })
        }}
      />
    )
  }

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
    const isGitRepo =
      appCfg.is_git_repo || (appCfg.app_root && String(appCfg.app_root).includes('/repositories/'))
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

    if (isV2) {
      return (
        <tr
          key={proj.id}
          className={`hover:bg-slate-50/70 border-b border-slate-100 transition group ${
            isGrouped ? 'bg-slate-50/40' : ''
          }`}
        >
          {/* 1. App URI */}
          <td className={`p-4 ${isGrouped ? 'pl-6' : ''}`}>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveProjectDetail(proj)}
                className="font-bold text-sm text-slate-900 hover:text-emerald-700 hover:underline font-mono text-left flex items-center space-x-1.5"
              >
                <span>{proj.name}</span>
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </button>
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                {proj.language || 'static'}
              </span>
            </div>

            {proj.public_url ? (
              <div className="flex items-center space-x-1.5 mt-1 font-mono text-xs">
                <a
                  href={proj.public_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 hover:text-emerald-700 hover:underline flex items-center space-x-1 font-medium"
                >
                  <span>{proj.subdomain || proj.public_url.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyLink(proj.public_url, proj.id)}
                  className="text-slate-400 hover:text-slate-700 p-0.5 transition"
                  title="Salin Link Publik"
                >
                  {copiedId === proj.id ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            ) : (
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="xs"
                  icon={Globe}
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePublishWeb(proj.id)
                  }}
                  disabled={publishLoadingId === proj.id}
                  title="Generate subdomain & publikasikan web ini ke internet"
                >
                  {publishLoadingId === proj.id ? 'Mengenerate...' : 'Deploy / Publish Web'}
                </Button>
              </div>
            )}
          </td>

          {/* 2. App Root Directory */}
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
                  initial_path: subpath,
                })
              }}
              className="group inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition text-left cursor-pointer shadow-2xs"
              title="Buka direktori ini langsung di File Manager"
            >
              <Folder className="h-3.5 w-3.5 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate max-w-[220px] underline decoration-dotted decoration-slate-400 group-hover:decoration-solid">
                {appRoot}
              </span>
              <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-slate-700 transition-opacity ml-1 shrink-0" />
              {isGitRepo && (
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-200 text-slate-800 font-sans font-medium ml-1">
                  Git™ Repo
                </span>
              )}
            </button>
          </td>

          {/* 3. Mode */}
          <td className="p-4 font-mono text-xs text-slate-500">
            <span className="capitalize">{mode}</span>
          </td>

          {/* 4. Status */}
          <td className="p-4">
            <div className="flex items-center space-x-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              ></span>
              <span className="font-mono text-xs text-slate-700">
                {isRunning ? `started (v${proj.version})` : 'stopped'}
              </span>
            </div>
          </td>

          {/* 5. Actions */}
          <td className="p-4 text-right">
            <div className="inline-flex items-center space-x-1">
              {isBusy ? (
                <div className="p-1.5">
                  <Spinner size="xs" />
                </div>
              ) : isRunning ? (
                <button
                  type="button"
                  onClick={() => handleControl(proj.id, 'stop')}
                  title="Stop Application"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 transition"
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleControl(proj.id, 'start')}
                  title="Start Application"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 transition"
                >
                  <Play className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleControl(proj.id, 'restart')}
                title="Restart Application"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <RotateCw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setActiveConsoleProject(proj)}
                title="Buka Console Container (CLI)"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <Terminal className="h-4 w-4" />
              </button>

              {proj.deployment_id && (
                <button
                  type="button"
                  onClick={() => handleToggleDeployment(proj.deployment_id)}
                  title={
                    proj.is_published
                      ? 'Hentikan Publikasi Web (Subdomain Off)'
                      : 'Aktifkan Kembali Publikasi Web'
                  }
                  className={`p-1.5 rounded-lg transition ${
                    proj.is_published
                      ? 'text-emerald-600 hover:bg-emerald-50'
                      : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                  }`}
                >
                  <Globe className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveProjectDetail(proj)}
                title="Buka Halaman Detail Konfigurasi"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <Edit2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => triggerDelete(proj.id, proj.name)}
                title="Destroy Application"
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
      )
    }

    // V1 vintage row render
    return (
      <tr
        key={proj.id}
        className={`hover:bg-[#361E13] transition group ${isGrouped ? 'bg-[#23120A]/70' : ''}`}
      >
        <td className={`p-4 ${isGrouped ? 'pl-6' : ''}`}>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveProjectDetail(proj)}
              className="font-bold text-sm text-[#E8DCB8] hover:underline font-mono text-left flex items-center space-x-1.5"
            >
              <span>{proj.name}</span>
              <ExternalLink className="h-3 w-3 text-[#A47E65]" />
            </button>
            <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-lg bg-[#3A2216] text-[#DFCDB5] border border-[#523120]">
              {proj.language || 'static'}
            </span>
          </div>

          {proj.public_url ? (
            <div className="flex items-center space-x-1.5 mt-1 font-mono text-xs">
              <a
                href={proj.public_url}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline flex items-center space-x-1"
              >
                <span>{proj.subdomain || proj.public_url.replace(/^https?:\/\//, '')}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              <button
                onClick={() => handleCopyLink(proj.public_url, proj.id)}
                className="text-[#A47E65] hover:text-[#FAF5EC] p-0.5"
                title="Salin Link Publik"
              >
                {copiedId === proj.id ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
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
                title="Generate subdomain & publikasikan web ini ke internet"
              >
                <Globe className="h-3 w-3 text-amber-400" />
                <span>
                  {publishLoadingId === proj.id ? 'Mengenerate Subdomain...' : 'Deploy / Publish Web'}
                </span>
              </button>
            </div>
          )}
        </td>

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
                initial_path: subpath,
              })
            }}
            className="group inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-[#201008] hover:bg-[#341B0E] border border-[#4D2D1E] hover:border-[#C49767] text-[#DFCDB5] hover:text-[#FAF5EC] transition text-left cursor-pointer shadow-sm hover:shadow"
            title="Buka direktori ini langsung di File Manager"
          >
            <Folder className="h-3.5 w-3.5 text-[#C49767] group-hover:scale-110 transition-transform shrink-0" />
            <span className="truncate max-w-[220px] underline decoration-dotted decoration-[#C49767]/60 group-hover:decoration-solid">
              {appRoot}
            </span>
            <ExternalLink className="h-3 w-3 text-[#C49767] opacity-60 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />
            {isGitRepo && (
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#C49767]/20 border border-[#C49767]/40 text-[#E8DCB8] font-sans font-medium ml-1">
                Git™ Repo
              </span>
            )}
          </button>
        </td>

        <td className="p-4 font-mono text-xs text-[#DFCDB5]">
          <span className="capitalize">{mode}</span>
        </td>

        <td className="p-4">
          <div className="flex items-center space-x-2">
            <span
              className={`h-2 w-2 rounded-full ${
                isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            ></span>
            <span className="font-mono text-xs">
              {isRunning ? `started (v${proj.version})` : 'stopped'}
            </span>
          </div>
        </td>

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
                title={
                  proj.is_published
                    ? 'Hentikan Publikasi Web (Subdomain Off)'
                    : 'Aktifkan Kembali Publikasi Web'
                }
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

  // ----------------------------------------------------
  // V2 CLEAN WHITE & SOFT SLATE THEME
  // ----------------------------------------------------
  if (isV2) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 w-full font-sans">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-sans font-bold text-slate-900 tracking-tight">
              Konfigurasi Deploy
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-sans">
              Deploy kode praktikum (PHP, Python, Node.js) ke container terisolasi & publikasikan ke subdomain resmi.
            </p>
          </div>
          <div className="flex items-center space-x-2.5">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700 shadow-2xs">
              <Globe className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>
                Wildcard: <strong className="text-emerald-700">*.miraigrid.web.id</strong>
              </span>
            </div>
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => setIsCreatingProject(true)}
            >
              Buat Project Baru
            </Button>
          </div>
        </div>

        {/* Search, Filter & Control Toolbar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
            {/* Search Box */}
            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari project, subdomain, path..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition font-sans"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                Semua ({counts.all})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('running')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                  statusFilter === 'running'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'bg-white text-emerald-700 hover:bg-emerald-50/60 border border-slate-200'
                }`}
              >
                Running ({counts.running})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('stopped')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                  statusFilter === 'stopped'
                    ? 'bg-rose-600 text-white font-semibold shadow-xs'
                    : 'bg-white text-rose-700 hover:bg-rose-50/60 border border-slate-200'
                }`}
              >
                Stopped ({counts.stopped})
              </button>
              {counts.php > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('php')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition shrink-0 ${
                    statusFilter === 'php'
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                      : 'bg-white text-indigo-700 hover:bg-indigo-50/60 border border-slate-200'
                  }`}
                >
                  PHP ({counts.php})
                </button>
              )}
              {counts.node > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('node')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition shrink-0 ${
                    statusFilter === 'node'
                      ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                      : 'bg-white text-emerald-700 hover:bg-emerald-50/60 border border-slate-200'
                  }`}
                >
                  Node ({counts.node})
                </button>
              )}
              {counts.python > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('python')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition shrink-0 ${
                    statusFilter === 'python'
                      ? 'bg-amber-600 text-white font-semibold shadow-xs'
                      : 'bg-white text-amber-700 hover:bg-amber-50/60 border border-slate-200'
                  }`}
                >
                  Python ({counts.python})
                </button>
              )}
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => fetchProjects()}
            title="Muat Ulang Data"
            className={loading ? 'animate-spin' : ''}
          />
        </div>

        {/* Table */}
        {loading ? (
          <SkeletonTable rows={4} />
        ) : projects.length === 0 ? (
          <Card className="text-center py-16 p-8 shadow-xs">
            <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-900 font-sans">Belum Ada Aplikasi Terdaftar</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
              Klik tombol di bawah untuk membuat aplikasi baru di halaman khusus. Container akan langsung otomatis berjalan.
            </p>
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => setIsCreatingProject(true)}
            >
              Mulai Buat Aplikasi
            </Button>
          </Card>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-semibold">App URI</th>
                    <th className="p-4 font-semibold">App Root Directory</th>
                    <th className="p-4 font-semibold">Mode</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-400">
                        Tidak ada project yang cocok dengan pencarian atau filter yang dipilih.
                      </td>
                    </tr>
                  ) : isAdmin && paginatedAccountGroups ? (
                    paginatedAccountGroups.map((group) => {
                      const runningCount = group.projects.filter((p) => p.status === 'running').length
                      const onlineCount = group.projects.filter((p) => p.public_url).length

                      return (
                        <React.Fragment key={`group-${group.username}`}>
                          {/* Account Divider Bar */}
                          <tr className="bg-slate-50/90 border-t border-b border-slate-200">
                            <td colSpan="5" className="px-5 py-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center space-x-3">
                                  <div
                                    className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-2xs ${
                                      group.role === 'admin'
                                        ? 'bg-amber-50 border border-amber-200 text-amber-700'
                                        : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                    }`}
                                  >
                                    {group.role === 'admin' ? (
                                      <ShieldCheck className="h-4 w-4 text-amber-600" />
                                    ) : (
                                      <GraduationCap className="h-4 w-4 text-emerald-600" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-2 flex-wrap">
                                      <span className="font-bold text-sm text-slate-900 tracking-tight font-sans">
                                        {group.name}
                                      </span>
                                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200">
                                        {group.username}
                                      </span>
                                      <span
                                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                                          group.role === 'admin'
                                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        }`}
                                      >
                                        {group.role === 'admin' ? 'Administrator' : 'Mahasiswa'}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                                      Ruang terisolasi per akun • Sandbox cgroups v2 & alokasi resource mandiri
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2 self-end sm:self-auto flex-wrap">
                                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-white text-slate-700 border border-slate-200">
                                    {group.projects.length} Aplikasi
                                  </span>
                                  {runningCount > 0 && (
                                    <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      {runningCount} Berjalan
                                    </span>
                                  )}
                                  {onlineCount > 0 && (
                                    <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-white text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                                      <Globe className="h-3 w-3 text-emerald-600" />
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
                                        initial_path: '',
                                      })
                                    }}
                                    className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-700 transition shadow-2xs"
                                    title={`Buka File Manager /home/${group.username}`}
                                  >
                                    <Folder className="h-3 w-3 text-emerald-600" />
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
              <div className="bg-slate-50/70 px-5 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <span className="font-mono text-[11px] text-slate-500">
                  Menampilkan {(currentPage - 1) * itemsPerPage + 1} -{' '}
                  {Math.min(currentPage * itemsPerPage, filteredProjects.length)} dari {filteredProjects.length} project
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 disabled:opacity-40 transition shadow-2xs"
                      title="Halaman Sebelumnya"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`px-2.5 py-1 rounded-lg font-mono text-xs transition ${
                          currentPage === page
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 shadow-2xs'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 disabled:opacity-40 transition shadow-2xs"
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

  // ----------------------------------------------------
  // V1 VINTAGE THEME RENDER (100% PRESERVED AS ORIGINAL)
  // ----------------------------------------------------
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
            <span>
              Wildcard: <strong className="text-emerald-300">*.miraigrid.web.id</strong>
            </span>
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

      {/* Table */}
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
                    const runningCount = group.projects.filter((p) => p.status === 'running').length
                    const onlineCount = group.projects.filter((p) => p.public_url).length

                    return (
                      <React.Fragment key={`group-${group.username}`}>
                        <tr className="bg-gradient-to-r from-[#1E0F08] via-[#2A160D] to-[#1E0F08] border-t-2 border-b border-[#4D2D1E]">
                          <td colSpan="5" className="px-5 py-3.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center space-x-3">
                                <div
                                  className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-inner ${
                                    group.role === 'admin'
                                      ? 'bg-[#C49767]/20 border border-[#C49767]/50 text-[#FAF5EC]'
                                      : 'bg-[#5C3B29]/30 border border-[#8A5835]/50 text-[#E8DCB8]'
                                  }`}
                                >
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
                                    <span
                                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                                        group.role === 'admin'
                                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                      }`}
                                    >
                                      {group.role === 'admin' ? 'Administrator' : 'Mahasiswa'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[#A47E65] font-sans mt-0.5">
                                    Ruang terisolasi per akun • Sandbox cgroups v2 & alokasi resource mandiri
                                  </p>
                                </div>
                              </div>

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
                                      initial_path: '',
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
                Menampilkan {(currentPage - 1) * itemsPerPage + 1} -{' '}
                {Math.min(currentPage * itemsPerPage, filteredProjects.length)} dari {filteredProjects.length} project
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
