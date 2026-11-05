import React, { useState, useEffect } from 'react'
import { Layers, Plus, Play, Square, RotateCw, Trash2, Terminal, ExternalLink, AlertCircle, Folder, Settings2, Sliders, Check } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonTable, Spinner } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import ModalPortal from '../components/ModalPortal'
import FileManager from '../components/FileManager'
import ContainerConsole from '../components/ContainerConsole'
import ProjectConfigModal from '../components/ProjectConfigModal'

export default function ProjectsView() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Sub-environments
  const [activeFileManagerProject, setActiveFileManagerProject] = useState(null)
  const [activeConsoleProject, setActiveConsoleProject] = useState(null)
  const [activeConfigProject, setActiveConfigProject] = useState(null)

  // Confirmation modal
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '' })

  // Form states for Create Project
  const [projectName, setProjectName] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('php') // 'php', 'python', 'node'
  const [selectedVersion, setSelectedVersion] = useState('8.2')
  const [actionLoading, setActionLoading] = useState(false)
  const [controlLoadingId, setControlLoadingId] = useState(null)
  const [error, setError] = useState('')

  // Language options and versions
  const languageOptions = [
    {
      id: 'php',
      name: 'PHP',
      icon: '🐘',
      badge: 'Apache + PDO',
      defaultVer: '8.2',
      versions: [
        { val: '8.3', label: 'PHP 8.3 (Terbaru)' },
        { val: '8.2', label: 'PHP 8.2 (Recommended)' },
        { val: '8.1', label: 'PHP 8.1' },
        { val: '8.0', label: 'PHP 8.0' },
        { val: '7.4', label: 'PHP 7.4 (Legacy)' }
      ]
    },
    {
      id: 'python',
      name: 'Python',
      icon: '🐍',
      badge: 'Flask / Gunicorn',
      defaultVer: '3.11',
      versions: [
        { val: '3.12', label: 'Python 3.12 (Terbaru)' },
        { val: '3.11', label: 'Python 3.11 (Recommended)' },
        { val: '3.10', label: 'Python 3.10' },
        { val: '3.9', label: 'Python 3.9' }
      ]
    },
    {
      id: 'node',
      name: 'Node.js',
      icon: '🟩',
      badge: 'Express / NPM',
      defaultVer: '20',
      versions: [
        { val: '22', label: 'Node.js 22 (Current)' },
        { val: '20', label: 'Node.js 20 (Recommended LTS)' },
        { val: '18', label: 'Node.js 18 (LTS)' },
        { val: '16', label: 'Node.js 16' }
      ]
    }
  ]

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

  const handleLanguageSelect = (langId) => {
    setSelectedLanguage(langId)
    const found = languageOptions.find((l) => l.id === langId)
    if (found) {
      setSelectedVersion(found.defaultVer)
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    setError('')
    setActionLoading(true)
    const toastId = toast.loading(`Membuat project ${projectName} (${selectedLanguage.toUpperCase()} ${selectedVersion})...`)

    try {
      await api.post('/projects/create', {
        name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        language: selectedLanguage,
        version: selectedVersion,
        app_config: {
          startup_file: selectedLanguage === 'python' ? 'app.py' : selectedLanguage === 'node' ? 'server.js' : 'index.php'
        }
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

  const currentLangConfig = languageOptions.find((l) => l.id === selectedLanguage) || languageOptions[0]

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#26160F]">
            "Project Aplikasi Web" Konfigurasi Deploy
          </h2>
          <p className="text-xs text-[#5C3B29] mt-1 font-sans">
            Deploy kode praktikum (PHP, Python, Node.js) ke container terisolasi.
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

      {/* Projects Table View */}
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
                  <th className="p-4">Engine Runtime</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Port & URL Akses</th>
                  <th className="p-4">Terakhir Deploy</th>
                  <th className="p-4 text-right">Aksi & Konfigurasi</th>
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

                      {/* Runtime Engine */}
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-[#3A2115] text-[#E8DCB8] border border-[#543221]">
                          {proj.language || proj.template_type} {proj.version || ''}
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
                          {/* Konfigurasi Engine Button (cPanel Style) */}
                          <button
                            onClick={() => setActiveConfigProject(proj)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] inline-flex items-center space-x-1.5 transition shadow-sm"
                            title="Konfigurasi Engine (php.ini, pip/npm, startup file)"
                          >
                            <Sliders className="h-3.5 w-3.5 text-[#E8DCB8]" />
                            <span>Konfigurasi</span>
                          </button>

                          {/* File Manager Button */}
                          <button
                            onClick={() => setActiveFileManagerProject(proj)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#442718] hover:bg-[#5A3521] text-[#FAF5EC] border border-[#5C3825] inline-flex items-center space-x-1.5 transition shadow-sm"
                            title="Buka File Manager Project"
                          >
                            <Folder className="h-3.5 w-3.5 text-[#E8DCB8]" />
                            <span>Files</span>
                          </button>

                          {/* Container Console Button (Portainer-style) */}
                          <button
                            onClick={() => setActiveConsoleProject(proj)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#E8DCB8] border border-[#543221] inline-flex items-center space-x-1.5 transition"
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

      {/* Modal: Create Project with 3 Language Cards (PHP, Python, Node.js) */}
      <ModalPortal isOpen={showCreateModal}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 sm:p-7 text-[#FAF5EC]">
            <h3 className="text-lg font-serif font-bold text-[#FAF5EC] mb-1">Buat Project Web Baru</h3>
            <p className="text-xs text-[#DFCDB5] mb-5">Pilih bahasa pemrograman & versi engine untuk container terisolasi Anda.</p>

            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Nama Project (Slug)</label>
                <input
                  type="text"
                  required
                  placeholder="contoh: sistem-kasir-praktikum"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] placeholder-[#553826] focus:outline-none focus:border-[#C49767]"
                />
              </div>

              {/* 3 LANGUAGE CARDS (PHP, Python, Node.js Saja Sesuai Instruksi!) */}
              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-2">
                  Pilih Bahasa Pemrograman
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {languageOptions.map((lang) => {
                    const isSelected = selectedLanguage === lang.id
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => handleLanguageSelect(lang.id)}
                        className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all duration-150 relative ${
                          isSelected
                            ? 'bg-[#3A2115] border-[#C49767] shadow-lg ring-1 ring-[#C49767]'
                            : 'bg-[#1C0F0A] border-[#3E2316] hover:bg-[#25150E] text-[#DFCDB5]'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-[#C49767] text-[#2B1810] flex items-center justify-center">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                        <div>
                          <div className="text-2xl mb-1">{lang.icon}</div>
                          <h4 className="text-sm font-bold text-[#FAF5EC] font-serif">{lang.name}</h4>
                          <p className="text-[10px] text-[#E8DCB8] font-mono mt-0.5">{lang.badge}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Version Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">
                  Pilih Versi {currentLangConfig.name}
                </label>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                >
                  {currentLangConfig.versions.map((ver) => (
                    <option key={ver.val} value={ver.val}>
                      {ver.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#A47E65] mt-1 font-mono">
                  Container Docker resmi {currentLangConfig.name} akan otomatis di-pull dan dijalankan.
                </p>
              </div>

              <div className="flex justify-end space-x-2.5 pt-3 border-t border-[#3E2316]">
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
                  className="px-6 py-2.5 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] shadow-lg shadow-black/20 transition disabled:opacity-50"
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

      {/* Project Configuration Modal (cPanel Style - Image 2, 3, 4, 5) */}
      <ProjectConfigModal
        project={activeConfigProject}
        isOpen={Boolean(activeConfigProject)}
        onClose={() => setActiveConfigProject(null)}
        onUpdated={fetchProjects}
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
