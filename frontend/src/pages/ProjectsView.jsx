import React, { useState, useEffect } from 'react'
import { Layers, Plus, Upload, Play, Square, RotateCw, Trash2, Terminal, ExternalLink, AlertCircle, FileCode } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonCard, Spinner } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import ModalPortal from '../components/ModalPortal'

export default function ProjectsView() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showLogsModal, setShowLogsModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [logsContent, setLogsContent] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)

  // Confirmation modal
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '' })

  // Form states
  const [projectName, setProjectName] = useState('')
  const [templateType, setTemplateType] = useState('php82')
  const [uploadFile, setUploadFile] = useState(null)
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

  const handleUploadAndDeploy = async (e) => {
    e.preventDefault()
    if (!uploadFile) {
      setError('Pilih file ZIP source code Anda.')
      return
    }

    setError('')
    setActionLoading(true)
    const toastId = toast.loading('Mengekstrak file ZIP & men-deploy via Portainer...')
    const formData = new FormData()
    formData.append('file', uploadFile)

    try {
      await api.post(`/projects/${selectedProject.id}/upload-and-deploy`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Aplikasi berhasil di-upload dan aktif!', { id: toastId })
      setShowUploadModal(false)
      setUploadFile(null)
      fetchProjects()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Gagal deploy aplikasi.'
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

  const handleOpenLogs = async (project) => {
    setSelectedProject(project)
    setShowLogsModal(true)
    setLogsLoading(true)
    try {
      const res = await api.get(`/projects/${project.id}/logs`)
      setLogsContent(res.data.logs || 'Belum ada log.')
    } catch (err) {
      setLogsContent('Gagal memuat log container.')
    } finally {
      setLogsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#26160F]">Project Aplikasi Web</h2>
          <p className="text-xs text-[#5C3B29] mt-1 font-sans">
            Deploy kode praktikum (PHP, Python, Node.js, HTML) ke container terisolasi.
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

      {/* Projects Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-8 shadow-xl">
          <Layers className="h-10 w-10 text-[#A47E65] mx-auto mb-3" />
          <h4 className="text-base font-serif font-bold text-[#FAF5EC]">Belum Ada Project</h4>
          <p className="text-xs text-[#DFCDB5] max-w-sm mx-auto mt-1 mb-6">
            Klik tombol di bawah untuk membuat project web pertama Anda dan meng-upload file praktikum.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] transition"
          >
            Mulai Buat Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => {
            const isRunning = proj.status === 'running'
            const isActionBusy = controlLoadingId === proj.id
            return (
              <div
                key={proj.id}
                className="bg-[#2B1810] border border-[#4D2D1E] hover:border-[#6D4029] rounded-3xl p-5 flex flex-col justify-between transition shadow-xl text-[#FAF5EC]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="text-base font-bold text-[#FAF5EC] leading-snug font-serif">{proj.name}</h4>
                      <span className="text-[10px] font-mono text-[#E8DCB8] uppercase tracking-wider block mt-0.5">
                        Runtime: {proj.template_type}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        isRunning
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-[#1C0F0A] text-[#DFCDB5]/60 border border-[#3E2316]'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-[#553826]'}`}></span>
                      {proj.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-[#DFCDB5] bg-[#1C0F0A] p-3.5 rounded-2xl border border-[#3E2316] mb-4">
                    <div className="flex justify-between">
                      <span className="text-[#A47E65]">Port Alokasi:</span>
                      <span className="font-mono text-[#FAF5EC] font-semibold">{proj.allocated_port}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#A47E65]">URL Akses:</span>
                      <a
                        href={proj.access_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[#E8DCB8] hover:underline flex items-center space-x-1"
                      >
                        <span>:{proj.allocated_port}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#A47E65]">Terakhir Deploy:</span>
                      <span className="text-[#DFCDB5]">{proj.last_deployed_at}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#3E2316] flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => { setSelectedProject(proj); setError(''); setShowUploadModal(true); }}
                      title="Upload ZIP & Deploy"
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#442718] text-[#FAF5EC] hover:bg-[#5A3521] border border-[#5C3825] flex items-center space-x-1.5 transition"
                    >
                      <Upload className="h-3.5 w-3.5 text-[#E8DCB8]" />
                      <span>Upload ZIP</span>
                    </button>

                    <button
                      onClick={() => handleOpenLogs(proj)}
                      title="Lihat Log Container"
                      className="p-1.5 rounded-xl text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"
                    >
                      <Terminal className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-1">
                    {isActionBusy ? (
                      <div className="p-1.5">
                        <Spinner size="xs" />
                      </div>
                    ) : (
                      <>
                        {isRunning ? (
                          <button
                            onClick={() => handleControl(proj.id, 'stop')}
                            title="Stop Container"
                            className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-xl transition"
                          >
                            <Square className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleControl(proj.id, 'start')}
                            title="Start Container"
                            className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          onClick={() => handleControl(proj.id, 'restart')}
                          title="Restart Container"
                          className="p-1.5 text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] rounded-xl transition"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => triggerDelete(proj.id, proj.name)}
                      title="Hapus Project"
                      className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Create Project with Full-Screen Portal */}
      <ModalPortal isOpen={showCreateModal}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 sm:p-7 text-[#FAF5EC]">
            <h3 className="text-lg font-serif font-bold text-[#FAF5EC] mb-1">Buat Project Web Baru</h3>
            <p className="text-xs text-[#DFCDB5] mb-5">Pilih runtime stack untuk aplikasi praktikum Anda.</p>

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

      {/* Modal: Upload ZIP & Deploy with Full-Screen Portal */}
      <ModalPortal isOpen={showUploadModal && Boolean(selectedProject)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 sm:p-7 text-[#FAF5EC]">
            <h3 className="text-lg font-serif font-bold text-[#FAF5EC] mb-1">
              Upload Kode: {selectedProject?.name}
            </h3>
            <p className="text-xs text-[#DFCDB5] mb-5">
              Kompres folder aplikasi praktikum Anda menjadi file <strong>.ZIP</strong> lalu upload di sini.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleUploadAndDeploy} className="space-y-4">
              <div className="border-2 border-dashed border-[#4D2D1E] hover:border-[#C49767] rounded-3xl p-6 text-center transition bg-[#1C0F0A]/70">
                <FileCode className="h-8 w-8 text-[#A47E65] mx-auto mb-2" />
                <input
                  type="file"
                  accept=".zip"
                  required
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="hidden"
                  id="zip-upload-input"
                />
                <label
                  htmlFor="zip-upload-input"
                  className="cursor-pointer text-xs font-semibold text-[#E8DCB8] hover:underline block"
                >
                  {uploadFile ? uploadFile.name : 'Pilih file .ZIP (Maksimal 25MB)'}
                </label>
                <p className="text-[11px] text-[#A47E65] mt-1 font-mono">Sistem otomatis menolak path traversal (Anti Zip-Slip).</p>
              </div>

              <div className="flex justify-end space-x-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-[#FAF5EC] border border-emerald-500/40 shadow-lg shadow-black/20 transition disabled:opacity-50"
                >
                  {actionLoading ? (
                    <span className="flex items-center space-x-1.5">
                      <Spinner size="xs" />
                      <span>Mengekstrak & Deploy...</span>
                    </span>
                  ) : (
                    'Deploy Sekarang'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* Modal: Live Logs with Full-Screen Portal */}
      <ModalPortal isOpen={showLogsModal && Boolean(selectedProject)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 sm:p-7 flex flex-col max-h-[85vh] text-[#FAF5EC]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
                  <Terminal className="h-5 w-5 text-[#E8DCB8]" />
                  <span>Log Container: {selectedProject?.name}</span>
                </h3>
                <p className="text-xs text-[#DFCDB5]">Output streaming langsung dari Portainer Docker API</p>
              </div>
              <button
                onClick={() => handleOpenLogs(selectedProject)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#3A2115] text-[#FAF5EC] hover:bg-[#482A1B] transition"
              >
                Refresh Log
              </button>
            </div>

            <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-4 font-mono text-xs text-[#FAF5EC] overflow-y-auto flex-1 whitespace-pre-wrap">
              {logsLoading ? (
                <div className="flex items-center space-x-2 text-[#DFCDB5]">
                  <Spinner size="xs" />
                  <span>Mengambil log container...</span>
                </div>
              ) : (
                logsContent
              )}
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>

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
