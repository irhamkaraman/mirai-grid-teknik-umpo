import React, { useState, useEffect } from 'react'
import { Layers, Plus, Upload, Play, Square, RotateCw, Trash2, Terminal, ExternalLink, AlertCircle, FileCode } from 'lucide-react'
import { api } from '../api/client'

export default function ProjectsView() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showLogsModal, setShowLogsModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [logsContent, setLogsContent] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)

  // Form states
  const [projectName, setProjectName] = useState('')
  const [templateType, setTemplateType] = useState('php82')
  const [uploadFile, setUploadFile] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
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
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    setError('')
    setActionLoading(true)
    try {
      await api.post('/projects/create', {
        name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        template_type: templateType,
      })
      setShowCreateModal(false)
      setProjectName('')
      fetchProjects()
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal membuat project.')
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
    const formData = new FormData()
    formData.append('file', uploadFile)

    try {
      await api.post(`/projects/${selectedProject.id}/upload-and-deploy`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setShowUploadModal(false)
      setUploadFile(null)
      fetchProjects()
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal deploy aplikasi.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleControl = async (projectId, action) => {
    try {
      await api.post(`/projects/${projectId}/control?action=${action}`)
      fetchProjects()
    } catch (err) {
      alert(err.response?.data?.detail || `Gagal ${action} project.`)
    }
  }

  const handleDelete = async (projectId, name) => {
    if (!window.confirm(`Hapus project '${name}' beserta container dan filenya?`)) return
    try {
      await api.delete(`/projects/${projectId}`)
      fetchProjects()
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus project.')
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
          <h2 className="text-xl font-bold text-white">Project Aplikasi Web</h2>
          <p className="text-xs text-slate-400 mt-1">
            Deploy kode praktikum (PHP, Python, Node.js, HTML) ke container terisolasi.
          </p>
        </div>
        <button
          onClick={() => { setError(''); setShowCreateModal(true); }}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 transition shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Buat Project Baru</span>
        </button>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs">Memuat daftar project...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8">
          <Layers className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-300">Belum Ada Project</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
            Klik tombol di bawah untuk membuat project web pertama Anda dan meng-upload file praktikum.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition"
          >
            Mulai Buat Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => {
            const isRunning = proj.status === 'running'
            return (
              <div
                key={proj.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between transition shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="text-base font-bold text-white leading-snug">{proj.name}</h4>
                      <span className="text-[11px] font-mono text-sky-400 uppercase tracking-wider block mt-0.5">
                        Template: {proj.template_type}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        isRunning
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                      {proj.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Port Alokasi:</span>
                      <span className="font-mono text-slate-300 font-semibold">{proj.allocated_port}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">URL Akses:</span>
                      <a
                        href={proj.access_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-sky-400 hover:underline flex items-center space-x-1"
                      >
                        <span>:{proj.allocated_port}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Terakhir Deploy:</span>
                      <span className="text-slate-400">{proj.last_deployed_at}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => { setSelectedProject(proj); setError(''); setShowUploadModal(true); }}
                      title="Upload ZIP & Deploy"
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-600/20 text-sky-400 hover:bg-sky-600/30 border border-sky-500/30 flex items-center space-x-1.5 transition"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload ZIP</span>
                    </button>

                    <button
                      onClick={() => handleOpenLogs(proj)}
                      title="Lihat Log Container"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                    >
                      <Terminal className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-1">
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
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(proj.id, proj.name)}
                      title="Hapus Project"
                      className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
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

      {/* Modal: Create Project */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-white mb-1">Buat Project Web Baru</h3>
            <p className="text-xs text-slate-400 mb-4">Pilih runtime stack untuk aplikasi praktikum Anda.</p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Project (Slug)</label>
                <input
                  type="text"
                  required
                  placeholder="contoh: web-toko-buku"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Pilih Template Runtime</label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="php82">PHP 8.2 (Apache + PDO MySQL/PgSQL)</option>
                  <option value="python311">Python 3.11 (Flask / FastAPI / Gunicorn)</option>
                  <option value="node20">Node.js 20 (Express / NPM)</option>
                  <option value="static">Static HTML/CSS/JS (Nginx)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Menyimpan...' : 'Buat Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Upload ZIP & Deploy */}
      {showUploadModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-white mb-1">
              Upload Kode: {selectedProject.name}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Kompres folder aplikasi praktikum Anda menjadi file <strong>.ZIP</strong> lalu upload di sini.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleUploadAndDeploy} className="space-y-4">
              <div className="border-2 border-dashed border-slate-800 hover:border-sky-500/50 rounded-2xl p-6 text-center transition">
                <FileCode className="h-8 w-8 text-slate-500 mx-auto mb-2" />
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
                  className="cursor-pointer text-xs font-semibold text-sky-400 hover:underline block"
                >
                  {uploadFile ? uploadFile.name : 'Pilih file .ZIP (Maksimal 25MB)'}
                </label>
                <p className="text-[11px] text-slate-500 mt-1">Sistem otomatis menolak path traversal (Anti Zip-Slip).</p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Mengekstrak & Deploy via Portainer...' : 'Deploy Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Live Logs */}
      {showLogsModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Terminal className="h-4 w-4 text-sky-400" />
                  <span>Log Container: {selectedProject.name}</span>
                </h3>
                <p className="text-xs text-slate-400">Output streaming langsung dari Portainer Docker API</p>
              </div>
              <button
                onClick={() => handleOpenLogs(selectedProject)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Refresh Log
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-y-auto flex-1 whitespace-pre-wrap">
              {logsLoading ? 'Mengambil log container...' : logsContent}
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
