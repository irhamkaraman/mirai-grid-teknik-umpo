import React, { useState, useEffect } from 'react'
import { Layers, Plus, Play, Square, RotateCw, Trash2, Terminal, ExternalLink, AlertCircle, Folder, FileCode } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonTable, Spinner } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import ModalPortal from '../components/ModalPortal'
import FileManager from '../components/FileManager'
import ContainerConsole from '../components/ContainerConsole'

export default function ProjectsView() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Sub-environments
  const [activeFileManagerProject, setActiveFileManagerProject] = useState(null)
  const [activeConsoleProject, setActiveConsoleProject] = useState(null)

  // Confirmation modal
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '' })

  // Form states
  const [projectName, setProjectName] = useState('')
  const [templateType, setTemplateType] = useState('php82')
  const [actionLoading, setActionLoading] = useState(false)
  const [controlLoadingId, setControlLoadingId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects')
      setProjects(res.data)
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat daftar project.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    setError('')
    setActionLoading(true)
    const toastId = toast.loading('Membuat project dan menyiapkan container...')
    try {
      await api.post('/projects/create', {
        name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        template_type: templateType,
      })
      toast.success('Project berhasil dibuat dan container langsung aktif!', { id: toastId })
      setShowCreateModal(false)
      setProjectName('')
      fetchProjects()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Gagal membuat project.'
      setError(msg)
      toast.error(msg, { id: toastId })
    } finally {
      setActionLoading(false)
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

  // If File Manager sub-environment is active, render dedicated File Manager view
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#26160F]">Project Aplikasi Web</h2>
          <p className="text-xs text-[#5C3B29] mt-1 font-sans">
            Kelola aplikasi praktikum di container terisolasi. Gunakan File Manager untuk mengedit kode & Console untuk terminal.
          </p>
        </div>
        <button
          onClick={() => { setError(''); setShowCreateModal(true); }}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#2B1810] hover:bg-[#3D2317] text-[#FAF5EC] border border-[#4D2D1E] shadow-lg shadow-black/10 transition shrink-0"
        >
          <Plus className="h-4 w-4 text-[#E8DCB8]" />
          <span>Buat Project Baru</span>
        </button>
      </div>

      {/* Projects Table View (Bukan Card, Sesuai Instruksi!) */}
      {loading ? (
        <SkeletonTable rows={4} />
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-8 shadow-xl text-[#FAF5EC]">
          <Layers className="h-10 w-10 text-[#A47E65] mx-auto mb-3" />
          <h4 className="text-base font-serif font-bold text-[#FAF5EC]">Belum Ada Project</h4>
          <p className="text-xs text-[#DFCDB5] max-w-sm mx-auto mt-1 mb-6">
            Klik tombol di bawah untuk membuat project web pertama Anda. Container akan otomatis berjalan.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] transition"
          >
            Mulai Buat Project
          </button>
        </div>
      ) : (
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl overflow-hidden shadow-2xl text-[#FAF5EC]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1C0F0A] text-[#DFCDB5] uppercase text-[10px] tracking-wider border-b border-[#3E2316]">
                <tr>
                  <th className="p-4">Nama Project</th>
                  <th className="p-4">Runtime</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Port & URL Akses</th>
                  <th className="p-4">Terakhir Deploy</th>
                  <th className="p-4 text-right">Aksi & Manajemen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3E2316]">
                {projects.map((proj) => {
                  const isRunning = proj.status === 'running'
                  const isBusy = controlLoadingId === proj.id

                  return (
                    <tr key={proj.id} className="hover:bg-[#361E13] transition">
                      {/* Name */}
                      <td className="p-4">
                        <div className="font-bold text-sm text-[#FAF5EC] font-serif">{proj.name}</div>
                        <div className="text-[10px] font-mono text-[#DFCDB5]/70 truncate max-w-xs">{proj.subdomain}</div>
                      </td>

                      {/* Runtime */}
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-[#3A2115] text-[#E8DCB8] border border-[#543221]">
                          {proj.template_type}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            isRunning
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-[#1C0F0A] text-[#DFCDB5]/60 border border-[#3E2316]'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-[#553826]'}`}></span>
                          {proj.status}
                        </span>
                      </td>

                      {/* Port & URL */}
                      <td className="p-4">
                        <div className="flex items-center space-x-1.5 font-mono">
                          <span className="text-[#DFCDB5]/70">Port:</span>
                          <span className="text-[#FAF5EC] font-bold">{proj.allocated_port}</span>
                          <a
                            href={proj.access_url}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 px-2 py-0.5 rounded-lg bg-[#3A2115] hover:bg-[#482A1B] text-[#E8DCB8] text-[10px] inline-flex items-center space-x-1 transition"
                            title="Buka Website"
                          >
                            <span>Buka</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </td>

                      {/* Last deployed */}
                      <td className="p-4 font-mono text-[11px] text-[#DFCDB5]/70">
                        {proj.last_deployed_at}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          {/* File Manager Button (Lingkungan Terpisah) */}
                          <button
                            onClick={() => setActiveFileManagerProject(proj)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#442718] hover:bg-[#5A3521] text-[#FAF5EC] border border-[#5C3825] inline-flex items-center space-x-1.5 transition shadow-sm"
                            title="Buka File Manager Project"
                          >
                            <Folder className="h-3.5 w-3.5 text-[#E8DCB8]" />
                            <span>Files</span>
                          </button>

                          {/* Container Console Button (Portainer-style) */}
                          <button
                            onClick={() => setActiveConsoleProject(proj)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#E8DCB8] border border-[#543221] inline-flex items-center space-x-1.5 transition"
                            title="Buka Container Console (Shell Exec)"
                          >
                            <Terminal className="h-3.5 w-3.5" />
                            <span>Console</span>
                          </button>

                          {/* Power Toggle */}
                          {isBusy ? (
                            <div className="p-1.5">
                              <Spinner size="xs" />
                            </div>
                          ) : (
                            <>
                              {isRunning ? (
                                <button
                                  onClick={() => handleControl(proj.id, 'stop')}
                                  title="Stop Container"
                                  className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-lg transition"
                                >
                                  <Square className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleControl(proj.id, 'start')}
                                  title="Start Container"
                                  className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition"
                                >
                                  <Play className="h-4 w-4" />
                                </button>
                              )}

                              <button
                                onClick={() => handleControl(proj.id, 'restart')}
                                title="Restart Container"
                                className="p-1.5 text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] rounded-lg transition"
                              >
                                <RotateCw className="h-4 w-4" />
                              </button>
                            </>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => triggerDelete(proj.id, proj.name)}
                            title="Hapus Project"
                            className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
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

      {/* Modal: Create Project */}
      <ModalPortal isOpen={showCreateModal}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 sm:p-7 text-[#FAF5EC]">
            <h3 className="text-lg font-serif font-bold text-[#FAF5EC] mb-1">Buat Project Web Baru</h3>
            <p className="text-xs text-[#DFCDB5] mb-5">Pilih runtime stack. Container langsung aktif otomatis.</p>

            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Nama Project (Slug)</label>
                <input
                  type="text"
                  required
                  placeholder="contoh: web-toko-buku"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] placeholder-[#553826] focus:outline-none focus:border-[#C49767]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Pilih Template Runtime</label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                >
                  <option value="php82">PHP 8.2 (Apache + PDO MySQL/PgSQL)</option>
                  <option value="python311">Python 3.11 (Flask / FastAPI / Gunicorn)</option>
                  <option value="node20">Node.js 20 (Express / NPM)</option>
                  <option value="static">Static HTML/CSS/JS (Nginx)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] shadow-lg shadow-black/20 transition disabled:opacity-50"
                >
                  {actionLoading ? (
                    <span className="flex items-center space-x-1.5">
                      <Spinner size="xs" />
                      <span>Menyiapkan Container...</span>
                    </span>
                  ) : (
                    'Buat & Jalankan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* Container Console Modal (Portainer Style - Image 3) */}
      <ContainerConsole
        project={activeConsoleProject || {}}
        isOpen={Boolean(activeConsoleProject)}
        onClose={() => setActiveConsoleProject(null)}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.open}
        title="Hapus Project?"
        message={`Apakah Anda yakin ingin menghapus project '${confirmDelete.name}' beserta container dan filenya? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus Project"
        onConfirm={executeDelete}
        onClose={() => setConfirmDelete({ open: false, id: null, name: '' })}
      />
    </div>
  )
}
