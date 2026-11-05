import React, { useState, useEffect } from 'react'
import { Plus, Play, Square, RotateCw, Trash2, Edit2, ExternalLink, Layers, AlertCircle, Terminal } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonTable, Spinner } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import FileManager from '../components/FileManager'
import ProjectDetailPage from './ProjectDetailPage'
import CreateProjectPage from './CreateProjectPage'
import ConsolePage from './ConsolePage'

export default function ProjectsView() {
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

  useEffect(() => {
    fetchProjects()
  }, [])

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
        project={activeProjectDetail}
        onBack={() => {
          setActiveProjectDetail(null)
        }}
        onUpdated={() => fetchProjects(true)}
        onOpenConsole={(proj) => setActiveConsoleProject(proj)}
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#26160F]">
            Konfigurasi Deploy
          </h2>
          <p className="text-xs text-[#5C3B29] mt-1 font-sans">
            Deploy kode praktikum (PHP, Python, Node.js) ke container terisolasi.
          </p>
        </div>
        <button
          onClick={() => setIsCreatingProject(true)}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#2B1810] hover:bg-[#3D2317] text-[#FAF5EC] border border-[#4D2D1E] shadow-lg shadow-black/10 transition shrink-0"
        >
          <Plus className="h-4 w-4 text-[#E8DCB8]" />
          <span>Buat Project Baru</span>
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
                {projects.map((proj) => {
                  const isRunning = proj.status === 'running'
                  const isBusy = controlLoadingId === proj.id
                  const appCfg = proj.app_config || {}
                  const appRoot = appCfg.app_root ? `/home/student/${proj.name}/${appCfg.app_root}` : `/home/student/${proj.name}`
                  const mode = appCfg.app_mode || 'development'

                  return (
                    <tr key={proj.id} className="hover:bg-[#361E13] transition group">
                      {/* 1. App URI */}
                      <td className="p-4">
                        <button
                          onClick={() => setActiveProjectDetail(proj)}
                          className="font-bold text-sm text-[#E8DCB8] hover:underline font-mono text-left flex items-center space-x-1.5"
                        >
                          <span>{proj.name}</span>
                          <ExternalLink className="h-3 w-3 text-[#A47E65]" />
                        </button>
                        <div className="text-[10px] font-mono text-[#DFCDB5]/60 mt-0.5 truncate max-w-xs">
                          {proj.access_url}
                        </div>
                      </td>

                      {/* 2. App Root Directory */}
                      <td className="p-4 font-mono text-[#DFCDB5]/80 text-[11px]">
                        {appRoot}
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

                      {/* 5. Actions (Stop/Start, Restart, Edit/Detail, Delete) */}
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          {/* Stop / Start Icon */}
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

                          {/* Restart Icon */}
                          <button
                            onClick={() => handleControl(proj.id, 'restart')}
                            title="Restart Application"
                            className="p-1.5 rounded-lg text-[#DFCDB5] hover:text-white hover:bg-[#3A2115] transition"
                          >
                            <RotateCw className="h-4 w-4" />
                          </button>

                          {/* Terminal / Console (CLI Halaman Terpisah) */}
                          <button
                            onClick={() => setActiveConsoleProject(proj)}
                            title="Buka Console Container (CLI)"
                            className="p-1.5 rounded-lg text-[#DFCDB5] hover:text-[#E8DCB8] hover:bg-[#3A2115] transition"
                          >
                            <Terminal className="h-4 w-4" />
                          </button>

                          {/* Edit / Detail Page (Pencil Icon) -> BUKAN MODAL! */}
                          <button
                            onClick={() => setActiveProjectDetail(proj)}
                            title="Buka Halaman Detail Konfigurasi"
                            className="p-1.5 rounded-lg text-[#E8DCB8] hover:text-white hover:bg-[#5A3521] transition"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          {/* Delete Icon (Trash) */}
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
                })}
              </tbody>
            </table>
          </div>
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
