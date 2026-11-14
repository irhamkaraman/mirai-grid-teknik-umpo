import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ExternalLink, Play, Square, RotateCw, Trash2,
  Save, Sliders, Terminal, FileCode, Check, RefreshCw, AlertCircle, Globe, Copy,
  Boxes, Hammer, CheckCircle2, X, Folder
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner, SkeletonCard } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import ModalPortal from '../components/ModalPortal'
import { useTheme } from '../context/ThemeContext'
import Button from '../components/Button'
import Card from '../components/Card'

export default function ProjectDetailPage({ project: propProject, onBack, onUpdated, onOpenConsole, onOpenFile, user: propUser }) {
  const { isV2 } = useTheme()
  const currentUser = propUser || JSON.parse(localStorage.getItem('miraigrid_user') || '{}')
  const isAdmin = currentUser?.role === 'admin'
  const { id: paramId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(propProject || null)
  const [loading, setLoading] = useState(!propProject)

  const handleOpenInFileManager = (targetPath) => {
    if (onOpenFile) {
      onOpenFile(targetPath)
    } else {
      const subpath = (targetPath || '').replace(new RegExp('^/home/[^/]+/?'), '')
      navigate(`/files?dir=${encodeURIComponent(subpath || '')}`)
    }
  }

  useEffect(() => {
    if (!propProject && paramId) {
      fetchProject(paramId)
    } else if (propProject) {
      setProject(propProject)
    }
  }, [propProject, paramId])

  const fetchProject = async (projId) => {
    setLoading(true)
    try {
      const res = await api.get(`/projects/${projId}`)
      setProject(res.data)
    } catch (err) {
      toast.error('Gagal memuat detail project.')
      navigate('/deploy')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      navigate('/deploy')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (!project) return null

  const isPhp = project.language === 'php' || project.template_type?.startsWith('php')
  const isPython = project.language === 'python' || project.template_type?.startsWith('python')
  const isNode = project.language === 'node' || project.template_type?.startsWith('node')

  const initialCfg = project.app_config || {}
  const [activeTab, setActiveTab] = useState(isPhp ? 'directives' : isPython ? 'python' : 'node')

  // Status
  const isRunning = project.status === 'running'
  const [controlLoading, setControlLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [runningAction, setRunningAction] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handlePublishWeb = async () => {
    setPublishLoading(true)
    try {
      const res = await api.post('/deployments/publish', { project_id: project.id })
      toast.success(`Berhasil mem-publish web ke subdomain resmi: ${res.data.subdomain}`)
      await fetchProject(project.id)
      if (onUpdated) onUpdated()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.detail || 'Gagal mem-publish web.')
    } finally {
      setPublishLoading(false)
    }
  }

  const handleToggleDeployment = async (depId) => {
    try {
      const res = await api.post(`/deployments/${depId}/toggle`)
      toast.success(`Status publikasi diubah menjadi: ${res.data.status}`)
      await fetchProject(project.id)
      if (onUpdated) onUpdated()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.detail || 'Gagal mengubah status publikasi.')
    }
  }

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Link publik resmi disalin ke clipboard!')
    setTimeout(() => setCopied(false), 2500)
  }

  // PHP Directives State (Image 2)
  const [phpDirectives, setPhpDirectives] = useState(initialCfg.directives || {
    display_errors: 'Disabled',
    error_log: 'error_log',
    log_errors: 'Enabled',
    max_execution_time: 30,
    max_input_time: 60,
    max_input_vars: 1000,
    memory_limit: '256M',
    post_max_size: '128M',
    upload_max_filesize: '128M',
    session_gc_maxlifetime: 1440,
    session_save_path: '/tmp',
    zlib_output_compression: 'Disabled',
  })

  // PHP Extensions State (Image 3)
  const defaultExts = [
    'bcmath', 'brotli', 'bz2', 'calendar', 'core', 'ctype', 'curl', 'date',
    'dom', 'exif', 'fileinfo', 'filter', 'gd', 'hash', 'iconv', 'intl',
    'json', 'libxml', 'mbstring', 'mysqli', 'openssl', 'pcre', 'pdo',
    'pdo_mysql', 'pdo_pgsql', 'pdo_sqlite', 'phar', 'posix', 'readline',
    'session', 'simplexml', 'soap', 'sockets', 'sodium', 'spl', 'sqlite3',
    'standard', 'tokenizer', 'xml', 'xmlreader', 'xmlwriter', 'zip', 'zlib'
  ]
  const [phpExtensions, setPhpExtensions] = useState(initialCfg.extensions || [
    'pdo', 'pdo_mysql', 'pdo_pgsql', 'pdo_sqlite', 'curl', 'mbstring', 'gd', 'bcmath', 'intl', 'zip', 'json', 'sodium'
  ])
  const [phpAppRoot, setPhpAppRoot] = useState(initialCfg.app_root_subpath || initialCfg.app_root || initialCfg.display_app_root || '')

  // Python Settings State (Image 4)
  const [pyVersion, setPyVersion] = useState(project.version || '3.11')
  const [pyAppRoot, setPyAppRoot] = useState(initialCfg.app_root_subpath || initialCfg.app_root || initialCfg.display_app_root || '')
  const [pyStartupFile, setPyStartupFile] = useState(initialCfg.startup_file || 'app.py')
  const [pyEntryPoint, setPyEntryPoint] = useState(initialCfg.entry_point || 'app')
  const [pyCustomScript, setPyCustomScript] = useState('')

  // Node.js Settings State (Image 5)
  const [nodeVersion, setNodeVersion] = useState(project.version || '20')
  const [nodeAppMode, setNodeAppMode] = useState(initialCfg.app_mode || 'development')
  const [nodeAppRoot, setNodeAppRoot] = useState(initialCfg.app_root_subpath || initialCfg.app_root || initialCfg.display_app_root || '')
  const [nodeStartupFile, setNodeStartupFile] = useState(initialCfg.startup_file || 'server.js')
  const [nodeCustomScript, setNodeCustomScript] = useState('')

  // Build / Compiler Output Modal State
  const [buildOutput, setBuildOutput] = useState('')
  const [showBuildModal, setShowBuildModal] = useState(false)
  const [buildTitle, setBuildTitle] = useState('')

  // Toggle extension
  const toggleExtension = (ext) => {
    if (phpExtensions.includes(ext)) {
      setPhpExtensions(phpExtensions.filter((e) => e !== ext))
    } else {
      setPhpExtensions([...phpExtensions, ext])
    }
  }

  // Save full configuration
  const handleSaveConfig = async () => {
    setSaving(true)
    const toastId = toast.loading('Menyimpan konfigurasi engine dan me-restart container...')

    let app_config = {}
    if (isPhp) {
      app_config = {
        directives: phpDirectives,
        extensions: phpExtensions,
        app_root: phpAppRoot.trim(),
      }
    } else if (isPython) {
      app_config = {
        app_root: pyAppRoot.trim(),
        startup_file: pyStartupFile,
        entry_point: pyEntryPoint,
      }
    } else if (isNode) {
      app_config = {
        app_mode: nodeAppMode,
        app_root: nodeAppRoot.trim(),
        startup_file: nodeStartupFile,
      }
    }

    try {
      await api.post(`/projects/${project.id}/config`, {
        app_config,
        env_vars: project.env_vars || {}
      })
      toast.success('Konfigurasi berhasil disimpan dan container di-restart!', { id: toastId })
      onUpdated?.()
      if (paramId) fetchProject(paramId)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan konfigurasi.', { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  // Control container (start / stop / restart)
  const handleControl = async (action) => {
    setControlLoading(true)
    const toastId = toast.loading(`${action === 'start' ? 'Menyalakan' : action === 'stop' ? 'Menghentikan' : 'Me-restart'} container...`)
    try {
      await api.post(`/projects/${project.id}/control?action=${action}`)
      toast.success(`Container berhasil di-${action}!`, { id: toastId })
      onUpdated?.()
      if (paramId) fetchProject(paramId)
    } catch (err) {
      toast.error(err.response?.data?.detail || `Gagal ${action} project.`, { id: toastId })
    } finally {
      setControlLoading(false)
    }
  }

  // Delete project
  const executeDelete = async () => {
    const toastId = toast.loading(`Menghapus project ${project.name}...`)
    try {
      await api.delete(`/projects/${project.id}`)
      toast.success('Project berhasil dihapus.', { id: toastId })
      onUpdated?.()
      handleBack()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus project.', { id: toastId })
    }
  }

  // Run Pip Install
  const handleRunPipInstall = async () => {
    setRunningAction(true)
    const toastId = toast.loading('Menjalankan pip install -r requirements.txt di container...')
    try {
      const res = await api.post(`/projects/${project.id}/pip-install`)
      toast.success('Pip install selesai!', { id: toastId })
      if (res.data?.output) {
        setBuildTitle('Hasil Pip Install')
        setBuildOutput(res.data.output)
        setShowBuildModal(true)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menjalankan pip install.', { id: toastId })
    } finally {
      setRunningAction(false)
    }
  }

  // Run NPM Install
  const handleRunNpmInstall = async () => {
    setRunningAction(true)
    const toastId = toast.loading('Menjalankan npm install di container...')
    try {
      const res = await api.post(`/projects/${project.id}/npm-install`)
      toast.success('NPM install selesai!', { id: toastId })
      if (res.data?.output) {
        setBuildTitle('Hasil NPM Install')
        setBuildOutput(res.data.output)
        setShowBuildModal(true)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menjalankan npm install.', { id: toastId })
    } finally {
      setRunningAction(false)
    }
  }

  // Run Composer Install (PHP / Laravel / CI3)
  const handleRunComposerInstall = async () => {
    setRunningAction(true)
    const toastId = toast.loading('Menjalankan composer install & setup di container...')
    try {
      const res = await api.post(`/projects/${project.id}/composer-install`)
      toast.success('Composer install selesai!', { id: toastId })
      if (res.data?.output) {
        setBuildTitle('Hasil Composer Install & Setup')
        setBuildOutput(res.data.output)
        setShowBuildModal(true)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menjalankan composer install.', { id: toastId })
    } finally {
      setRunningAction(false)
    }
  }

  // Universal Build / Compiler
  const handleRunBuildProject = async () => {
    setRunningAction(true)
    const toastId = toast.loading('Menjalankan compiler & build pipeline...')
    try {
      const res = await api.post(`/projects/${project.id}/build`)
      toast.success('Kompilasi & Build Project selesai!', { id: toastId })
      if (res.data?.output) {
        setBuildTitle(`Hasil Kompilasi Build — ${project.name}`)
        setBuildOutput(res.data.output)
        setShowBuildModal(true)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menjalankan build project.', { id: toastId })
    } finally {
      setRunningAction(false)
    }
  }

  // Run Script
  const handleRunCustomScript = async (scriptCmd) => {
    if (!scriptCmd.trim()) return
    setRunningAction(true)
    const toastId = toast.loading(`Menjalankan script...`)
    try {
      await api.post(`/projects/${project.id}/console/exec`, {
        command: '/bin/sh',
        stdin_input: `${isPython ? 'python' : 'node'} ${scriptCmd}`,
        cwd: isPython || isNode ? '/app' : '/var/www/html'
      })
      toast.success('Script selesai dijalankan!', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menjalankan script.', { id: toastId })
    } finally {
      setRunningAction(false)
    }
  }

  if (isV2) {
    const runtimeLabel = isPhp ? 'PHP' : isPython ? 'Python' : 'Node.js'
    const runtimeLogo = isPhp ? '/logos/php.svg' : isPython ? '/logos/python.svg' : '/logos/node.svg'
    const inputClassV2 =
      'w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:border-slate-400 focus:outline-none transition-colors'

    return (
      <div className="space-y-6 font-sans pb-12 animate-in fade-in duration-200">
        {/* 1. Top Header & Standardized Button Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowLeft}
              onClick={handleBack}
              title="Kembali ke Daftar Aplikasi"
              aria-label="Kembali ke Daftar Aplikasi"
            />
            <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 p-2 flex items-center justify-center shrink-0">
              <img src={runtimeLogo} alt="Runtime Logo" className="h-6 w-6 object-contain" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight truncate">
                {runtimeLabel} — {project.name}
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
                URI: {project.public_url || project.access_url}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isRunning ? (
              <Button
                variant="danger"
                size="sm"
                icon={Square}
                onClick={() => handleControl('stop')}
                disabled={controlLoading}
              >
                Stop App
              </Button>
            ) : (
              <Button
                variant="emerald"
                size="sm"
                icon={Play}
                onClick={() => handleControl('start')}
                disabled={controlLoading}
              >
                Start App
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              icon={RotateCw}
              onClick={() => handleControl('restart')}
              disabled={controlLoading}
            >
              Restart
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={Terminal}
              onClick={() => {
                if (onOpenConsole) {
                  onOpenConsole(project)
                } else {
                  navigate(`/deploy/${project.id}/console`)
                }
              }}
              title="Buka Halaman Console CLI"
            >
              Console
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={Boxes}
              onClick={handleRunBuildProject}
              disabled={runningAction}
              title="Kompilasi Dependensi & Build Project (Composer, NPM, Pip)"
            >
              {runningAction ? 'Building...' : 'Build / Compile'}
            </Button>

            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => setConfirmDelete(true)}
              disabled={controlLoading}
            >
              Destroy
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={Save}
              onClick={handleSaveConfig}
              loading={saving}
            >
              Simpan
            </Button>
          </div>
        </div>

        {/* 2. Public Web Subdomain Card */}
        <Card padding="md" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="h-11 w-11 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Public Web Subdomain
                </h3>
                <span
                  className={
                    project.is_published
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md px-2.5 py-0.5 text-xs font-medium'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 rounded-md px-2.5 py-0.5 text-xs font-medium'
                  }
                >
                  {project.is_published ? 'Online & Terpublikasi' : 'Belum Publik / Stopped'}
                </span>
              </div>

              {project.public_url ? (
                <div className="mt-1.5 flex items-center space-x-2 flex-wrap">
                  <a
                    href={project.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs sm:text-sm text-emerald-700 hover:text-emerald-800 hover:underline flex items-center space-x-1 font-semibold"
                  >
                    <span>{project.public_url}</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                  </a>
                  <span className="text-xs text-slate-500 font-mono">
                    (Port: {project.allocated_port})
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-1">
                  Publikasikan aplikasi web ini ke domain resmi{' '}
                  <code className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-mono">*.miraigrid.web.id</code>{' '}
                  agar dapat diakses dari internet via Cloudflare Tunnel.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0">
            {project.public_url ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={copied ? Check : Copy}
                  onClick={() => handleCopyLink(project.public_url)}
                >
                  {copied ? 'Tersalin' : 'Salin Link'}
                </Button>

                {project.deployment_id && (
                  <Button
                    variant={project.is_published ? 'danger' : 'emerald'}
                    size="sm"
                    icon={Globe}
                    onClick={() => handleToggleDeployment(project.deployment_id)}
                  >
                    {project.is_published ? 'Hentikan Publikasi' : 'Aktifkan Kembali'}
                  </Button>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  icon={ExternalLink}
                  iconPosition="right"
                  onClick={() => window.open(project.public_url, '_blank', 'noopener,noreferrer')}
                >
                  Buka Web
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={Globe}
                loading={publishLoading}
                onClick={handlePublishWeb}
              >
                {publishLoading ? 'Mengenerate Subdomain...' : 'Deploy / Publish Web Sekarang'}
              </Button>
            )}
          </div>
        </Card>

        {/* 3. Main Configuration Container */}
        <Card padding="lg" className="space-y-6">
          {/* PHP Application Root */}
          {isPhp && (
            <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Application Root (Document Root)
                  <span className="text-emerald-700 font-normal ml-2">
                    {isAdmin ? '(Bisa Custom / Repositori Git)' : '(Bisa Diedit / Subfolder Sandbox)'}
                  </span>
                </label>
                <Button
                  variant="secondary"
                  size="xs"
                  icon={Folder}
                  onClick={() => handleOpenInFileManager(phpAppRoot || `/home/${project?.owner_username || 'nim'}/${project?.name}`)}
                  title="Buka folder ini langsung di File Manager"
                >
                  Buka di File Manager
                </Button>
              </div>
              <input
                type="text"
                placeholder={
                  isAdmin
                    ? 'contoh: public atau /home/admin/repositories/nama_repo (kosongkan untuk default root)'
                    : 'contoh: public atau public_html (kosongkan untuk default root project)'
                }
                value={phpAppRoot}
                onChange={(e) => setPhpAppRoot(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-400 transition-colors"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {isAdmin ? (
                  <span>
                    <strong className="text-slate-700">Akses Administrator:</strong> Anda dapat mengarahkan DocumentRoot ke subfolder (e.g. <code className="font-mono text-slate-800">public</code>) atau ke repositori Git di server seperti <code className="font-mono text-slate-800">/home/admin/repositories/nama_repo</code>.
                  </span>
                ) : (
                  <span>
                    <strong className="text-slate-700">Sandbox Mahasiswa:</strong> Anda dapat menyesuaikan DocumentRoot ke subfolder project Anda (misal <code className="font-mono text-slate-800">public</code> untuk Laravel / CodeIgniter 4, atau path lengkap <code className="font-mono text-slate-800">/home/{project.owner_username || 'nim'}/{project.name}/public</code>). Terisolasi aman di bawah akun Anda.
                  </span>
                )}
              </p>
            </div>
          )}

          {/* PHP Navigation Tabs */}
          {isPhp && (
            <div className="flex border-b border-slate-200 space-x-4">
              <button
                type="button"
                onClick={() => setActiveTab('directives')}
                className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'directives'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                PHP Directives (php.ini)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('extensions')}
                className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'extensions'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                PHP Extensions ({phpExtensions.length} Aktif)
              </button>
            </div>
          )}

          {/* A. PHP DIRECTIVES TABLE (Clean Minimalist Flat Style) */}
          {isPhp && activeTab === 'directives' && (
            <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-1/4">PHP Directive</th>
                    <th className="px-4 py-3 w-1/2">Information</th>
                    <th className="px-4 py-3 w-1/4 text-right">Setting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-900">display_errors</td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs">
                      This determines whether errors should be printed to the screen as part of the output or if they should be hidden from the user.
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setPhpDirectives({ ...phpDirectives, display_errors: phpDirectives.display_errors === 'Enabled' ? 'Disabled' : 'Enabled' })}
                        className={`rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                          phpDirectives.display_errors === 'Enabled'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/70'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200/70'
                        }`}
                      >
                        {phpDirectives.display_errors}
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-900">error_log</td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs">Path to the PHP error log file (e.g. error_log).</td>
                    <td className="px-4 py-3.5 text-right">
                      <input
                        type="text"
                        value={phpDirectives.error_log}
                        onChange={(e) => setPhpDirectives({ ...phpDirectives, error_log: e.target.value })}
                        className="w-40 border border-slate-200 rounded-lg bg-slate-50/50 px-3 py-1.5 text-xs text-slate-900 text-right font-mono focus:bg-white focus:border-slate-400 focus:outline-none transition-colors"
                      />
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-900">log_errors</td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs">Tells whether script error messages should be logged to the server error log or error_log.</td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setPhpDirectives({ ...phpDirectives, log_errors: phpDirectives.log_errors === 'Enabled' ? 'Disabled' : 'Enabled' })}
                        className={`rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                          phpDirectives.log_errors === 'Enabled'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/70'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200/70'
                        }`}
                      >
                        {phpDirectives.log_errors}
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-900">max_execution_time</td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs">Sets the maximum time in seconds a script is allowed to run before it is terminated by the parser. (Default: 30)</td>
                    <td className="px-4 py-3.5 text-right">
                      <input
                        type="number"
                        value={phpDirectives.max_execution_time}
                        onChange={(e) => setPhpDirectives({ ...phpDirectives, max_execution_time: parseInt(e.target.value) || 30 })}
                        className="w-28 border border-slate-200 rounded-lg bg-slate-50/50 px-3 py-1.5 text-xs text-slate-900 text-right font-mono focus:bg-white focus:border-slate-400 focus:outline-none transition-colors"
                      />
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-900">memory_limit</td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs">Sets the maximum amount of memory in bytes that a script is allowed to allocate (e.g. 256M, 512M).</td>
                    <td className="px-4 py-3.5 text-right">
                      <input
                        type="text"
                        value={phpDirectives.memory_limit}
                        onChange={(e) => setPhpDirectives({ ...phpDirectives, memory_limit: e.target.value })}
                        className="w-28 border border-slate-200 rounded-lg bg-slate-50/50 px-3 py-1.5 text-xs text-slate-900 text-right font-mono focus:bg-white focus:border-slate-400 focus:outline-none transition-colors"
                      />
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-900">post_max_size</td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs">Sets max size of post data allowed.</td>
                    <td className="px-4 py-3.5 text-right">
                      <input
                        type="text"
                        value={phpDirectives.post_max_size}
                        onChange={(e) => setPhpDirectives({ ...phpDirectives, post_max_size: e.target.value })}
                        className="w-28 border border-slate-200 rounded-lg bg-slate-50/50 px-3 py-1.5 text-xs text-slate-900 text-right font-mono focus:bg-white focus:border-slate-400 focus:outline-none transition-colors"
                      />
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-900">upload_max_filesize</td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs">The maximum size of an uploaded file.</td>
                    <td className="px-4 py-3.5 text-right">
                      <input
                        type="text"
                        value={phpDirectives.upload_max_filesize}
                        onChange={(e) => setPhpDirectives({ ...phpDirectives, upload_max_filesize: e.target.value })}
                        className="w-28 border border-slate-200 rounded-lg bg-slate-50/50 px-3 py-1.5 text-xs text-slate-900 text-right font-mono focus:bg-white focus:border-slate-400 focus:outline-none transition-colors"
                      />
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-900">zlib.output_compression</td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs">Whether to transparently compress pages with Gzip.</td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setPhpDirectives({ ...phpDirectives, zlib_output_compression: phpDirectives.zlib_output_compression === 'Enabled' ? 'Disabled' : 'Enabled' })}
                        className={`rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                          phpDirectives.zlib_output_compression === 'Enabled'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/70'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200/70'
                        }`}
                      >
                        {phpDirectives.zlib_output_compression}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* B. PHP EXTENSIONS */}
          {isPhp && activeTab === 'extensions' && (
            <div className="border border-slate-200/80 rounded-xl p-5 space-y-4 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Account PHP Settings</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Pilih ekstensi PHP yang aktif untuk aplikasi Anda.</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPhpExtensions(['pdo', 'pdo_mysql', 'pdo_pgsql', 'pdo_sqlite', 'curl', 'mbstring', 'gd', 'zip'])}
                >
                  Reset PHP Extensions to default
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {defaultExts.map((ext) => {
                  const isChecked = phpExtensions.includes(ext)
                  return (
                    <label
                      key={ext}
                      className={`flex items-center space-x-2.5 p-3 rounded-lg border cursor-pointer transition-colors select-none ${
                        isChecked
                          ? 'bg-emerald-50/50 border-emerald-300 text-slate-900 font-medium'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleExtension(ext)}
                        className="h-4 w-4 rounded accent-emerald-600 border-slate-300"
                      />
                      <span className="text-xs font-mono">{ext}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Composer & Framework Build Engine Card */}
          {isPhp && (
            <div className="border border-slate-200/80 rounded-xl p-5 sm:p-6 space-y-4 bg-slate-50/40">
              <div className="pb-3 border-b border-slate-200/70">
                <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Boxes className="h-4 w-4 text-emerald-600" />
                  <span>Composer & Framework Build Engine</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Otomatis mendeteksi composer.json, menginstal dependensi (Laravel, CodeIgniter, Filament), generate APP_KEY, dan optimasi runtime.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  icon={Boxes}
                  onClick={handleRunComposerInstall}
                  disabled={runningAction}
                >
                  {runningAction ? 'Installing...' : 'Run Composer Install'}
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  icon={Hammer}
                  onClick={handleRunBuildProject}
                  disabled={runningAction}
                >
                  {runningAction ? 'Compiling...' : 'Compile & Optimize Framework'}
                </Button>
              </div>

              <p className="text-xs text-slate-500">
                Tip: Jika Anda mengunggah project Laravel baru atau terjadi error missing vendor/autoload.php, klik tombol di atas untuk mengompilasi dependensi secara otomatis.
              </p>
            </div>
          )}

          {/* C. PYTHON APPLICATION SELECTOR */}
          {isPython && (
            <div className="space-y-5">
              <div className="border border-slate-200/80 rounded-xl p-5 space-y-4 bg-slate-50/40">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Python version</label>
                    <select
                      value={pyVersion}
                      onChange={(e) => setPyVersion(e.target.value)}
                      className={inputClassV2}
                    >
                      <option value="3.12">3.12 (Latest)</option>
                      <option value="3.11">3.11 (Recommended)</option>
                      <option value="3.10">3.10</option>
                      <option value="3.9">3.9</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Application Root {isAdmin ? <span className="text-emerald-700 font-normal">(Bisa Custom / Git Repo)</span> : null}
                      </label>
                      <Button
                        variant="secondary"
                        size="xs"
                        icon={Folder}
                        onClick={() => handleOpenInFileManager(pyAppRoot || `/home/${project?.owner_username || 'nim'}/${project?.name}`)}
                        title="Buka folder ini langsung di File Manager"
                      >
                        Buka File Manager
                      </Button>
                    </div>
                    <input
                      type="text"
                      placeholder={isAdmin ? 'e.g. app atau /home/admin/repositories/nama_repo' : 'e.g. app atau src (kosongkan untuk root)'}
                      value={pyAppRoot}
                      onChange={(e) => setPyAppRoot(e.target.value)}
                      className={inputClassV2}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      {isAdmin
                        ? 'Admin: Dapat mengarahkan root direktori ke subfolder atau repositori git /home/admin/repositories/nama_repo.'
                        : 'Sandbox Mahasiswa: Direktori aplikasi di dalam akun Anda. Terisolasi aman.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Application startup file</label>
                    <input
                      type="text"
                      required
                      placeholder="app.py atau passenger_wsgi.py"
                      value={pyStartupFile}
                      onChange={(e) => setPyStartupFile(e.target.value)}
                      className={inputClassV2}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Application Entry point</label>
                    <input
                      type="text"
                      required
                      placeholder="app atau application"
                      value={pyEntryPoint}
                      onChange={(e) => setPyEntryPoint(e.target.value)}
                      className={inputClassV2}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Setup WSGI callable object for your application.</p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200/80 rounded-xl p-5 space-y-4 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Configuration files</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Install paket Python dependensi langsung ke container.</p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Play}
                    onClick={handleRunPipInstall}
                    disabled={runningAction}
                  >
                    {runningAction ? 'Installing...' : 'Run Pip Install'}
                  </Button>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Execute python script</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Enter the path to the script file (e.g. manage.py migrate)"
                      value={pyCustomScript}
                      onChange={(e) => setPyCustomScript(e.target.value)}
                      className={`flex-1 ${inputClassV2}`}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRunCustomScript(pyCustomScript)}
                      disabled={runningAction || !pyCustomScript.trim()}
                    >
                      Run Script
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* D. NODE.JS APPLICATION SELECTOR */}
          {isNode && (
            <div className="space-y-5">
              <div className="border border-slate-200/80 rounded-xl p-5 space-y-4 bg-slate-50/40">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Node.js version</label>
                    <select
                      value={nodeVersion}
                      onChange={(e) => setNodeVersion(e.target.value)}
                      className={inputClassV2}
                    >
                      <option value="22">22 (Latest LTS)</option>
                      <option value="20">20 (Recommended LTS)</option>
                      <option value="18">18</option>
                      <option value="16">16</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Application mode</label>
                    <select
                      value={nodeAppMode}
                      onChange={(e) => setNodeAppMode(e.target.value)}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none transition-colors"
                    >
                      <option value="development">Development</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Application Root {isAdmin ? <span className="text-emerald-700 font-normal">(Bisa Custom / Git Repo)</span> : null}
                      </label>
                      <Button
                        variant="secondary"
                        size="xs"
                        icon={Folder}
                        onClick={() => handleOpenInFileManager(nodeAppRoot || `/home/${project?.owner_username || 'nim'}/${project?.name}`)}
                        title="Buka folder ini langsung di File Manager"
                      >
                        Buka File Manager
                      </Button>
                    </div>
                    <input
                      type="text"
                      placeholder={isAdmin ? 'e.g. task-nextjs atau /home/admin/repositories/nama_repo' : 'e.g. task-nextjs atau kosongkan untuk root'}
                      value={nodeAppRoot}
                      onChange={(e) => setNodeAppRoot(e.target.value)}
                      className={inputClassV2}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      {isAdmin
                        ? 'Admin: Dapat mengarahkan root direktori ke subfolder atau repositori git /home/admin/repositories/nama_repo.'
                        : 'Sandbox Mahasiswa: Direktori aplikasi di dalam akun Anda. Terisolasi aman.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Application startup file</label>
                    <input
                      type="text"
                      required
                      placeholder="server.js atau index.js atau app.js"
                      value={nodeStartupFile}
                      onChange={(e) => setNodeStartupFile(e.target.value)}
                      className={inputClassV2}
                    />
                  </div>
                </div>
              </div>

              <div className="border border-slate-200/80 rounded-xl p-5 space-y-4 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Detected configuration files</h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">package.json</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Play}
                    onClick={handleRunNpmInstall}
                    disabled={runningAction}
                  >
                    {runningAction ? 'Installing...' : 'Run NPM Install'}
                  </Button>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Run JS script</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="e.g. node build.js atau npm run migrate"
                      value={nodeCustomScript}
                      onChange={(e) => setNodeCustomScript(e.target.value)}
                      className={`flex-1 ${inputClassV2}`}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRunCustomScript(nodeCustomScript)}
                      disabled={runningAction || !nodeCustomScript.trim()}
                    >
                      Run Script
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200/80 rounded-xl p-5 sm:p-6 space-y-4 bg-slate-50/40">
                <div className="pb-3 border-b border-slate-200/70">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Boxes className="h-4 w-4 text-emerald-600" />
                    <span>Node.js NPM & Compiler Pipeline</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Otomatis mendeteksi package.json, menginstal modul (React, Next.js, Express, Vite), dan menjalankan npm run build.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="secondary"
                    size="md"
                    icon={Boxes}
                    onClick={handleRunNpmInstall}
                    disabled={runningAction}
                  >
                    {runningAction ? 'Installing...' : 'Run NPM Install'}
                  </Button>

                  <Button
                    variant="primary"
                    size="md"
                    icon={Hammer}
                    onClick={handleRunBuildProject}
                    disabled={runningAction}
                  >
                    {runningAction ? 'Building...' : 'Compile & Build Node.js Project'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Confirmation Modal */}
        <ConfirmModal
          isOpen={confirmDelete}
          title="Destroy Application?"
          message={`Apakah Anda yakin ingin menghapus aplikasi '${project.name}' beserta container dan seluruh filenya?`}
          confirmText="DESTROY APPLICATION"
          onConfirm={executeDelete}
          onClose={() => setConfirmDelete(false)}
        />

        {/* Build / Compilation Log Modal */}
        <ModalPortal isOpen={showBuildModal}>
          {showBuildModal && (
            <div
              onClick={() => setShowBuildModal(false)}
              className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[85vh]"
              >
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Boxes className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">{buildTitle || 'Execution Output'}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBuildModal(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-5 flex-1 overflow-auto bg-slate-900">
                  <pre className="font-mono text-xs text-slate-100 whitespace-pre-wrap leading-relaxed select-text">
                    {buildOutput || 'Tidak ada log output.'}
                  </pre>
                </div>
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowBuildModal(false)}
                  >
                    Tutup Log
                  </Button>
                </div>
              </div>
            </div>
          )}
        </ModalPortal>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Top Breadcrumb & Actions Bar (cPanel Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DECDBD]">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-2.5 rounded-2xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] transition shadow-sm cursor-pointer shrink-0"
            title="Kembali ke Daftar Aplikasi"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-2xl bg-[#24140C] border border-[#3E2316] p-2 flex items-center justify-center shrink-0 shadow-md">
                <img
                  src={isPhp ? '/logos/php.svg' : isPython ? '/logos/python.svg' : '/logos/node.svg'}
                  alt="Runtime Logo"
                  className="h-7 w-7 object-contain"
                />
              </div>
              <h2 className="text-2xl font-serif font-bold text-[#26160F]">
                {isPhp ? 'PHP' : isPython ? 'Python' : 'Node.js'} — {project.name}
              </h2>
            </div>
            <p className="text-xs text-[#5C3B29] font-mono mt-0.5">
              URI: {project.public_url || project.access_url}
            </p>
          </div>
        </div>

        {/* Action Controls (Stop/Restart/Console/Destroy/Save) */}
        <div className="flex items-center space-x-2">
          {isRunning ? (
            <button
              onClick={() => handleControl('stop')}
              disabled={controlLoading}
              className="px-4 py-2 rounded-2xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-amber-300 border border-[#543221] shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Square className="h-3.5 w-3.5" />
              <span>STOP APP</span>
            </button>
          ) : (
            <button
              onClick={() => handleControl('start')}
              disabled={controlLoading}
              className="px-4 py-2 rounded-2xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              <span>START APP</span>
            </button>
          )}

          <button
            onClick={() => handleControl('restart')}
            disabled={controlLoading}
            className="px-4 py-2 rounded-2xl text-xs font-semibold bg-[#2B1810] hover:bg-[#3D2317] text-[#FAF5EC] border border-[#4D2D1E] shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>RESTART</span>
          </button>

          <button
            onClick={() => {
              if (onOpenConsole) {
                onOpenConsole(project)
              } else {
                navigate(`/deploy/${project.id}/console`)
              }
            }}
            className="px-4 py-2 rounded-2xl text-xs font-semibold bg-[#2B1810] hover:bg-[#3D2317] text-[#E8DCB8] border border-[#4D2D1E] shadow-md transition flex items-center space-x-1.5"
            title="Buka Halaman Console CLI"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>CONSOLE</span>
          </button>

          <button
            onClick={handleRunBuildProject}
            disabled={runningAction}
            className="px-4 py-2 rounded-2xl text-xs font-semibold bg-[#4A2D1B] hover:bg-[#5C3822] text-[#F3E5D0] border border-[#6D4229] shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
            title="Kompilasi Dependensi & Build Project (Composer, NPM, Pip)"
          >
            <Boxes className="h-3.5 w-3.5 text-[#C49767]" />
            <span>{runningAction ? 'BUILDING...' : 'BUILD / COMPILE'}</span>
          </button>

          <button
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 rounded-2xl text-xs font-semibold bg-rose-700 hover:bg-rose-600 text-white shadow-md transition flex items-center space-x-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>DESTROY</span>
          </button>

          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="px-5 py-2 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] shadow-lg shadow-black/10 transition disabled:opacity-50 flex items-center space-x-1.5"
          >
            {saving ? <Spinner size="xs" /> : <Save className="h-3.5 w-3.5 text-[#E8DCB8]" />}
            <span>SAVE</span>
          </button>
        </div>
      </div>

      {/* Public Web Subdomain & Deployment Card */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-5 sm:p-6 shadow-xl text-[#FAF5EC] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] text-emerald-400 shrink-0">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-serif font-bold text-[#FAF5EC]">
                Public Web Subdomain
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                project.is_published
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                  : 'bg-stone-900 text-stone-400 border border-stone-700'
              }`}>
                {project.is_published ? 'Online & Terpublikasi' : 'Belum Publik / Stopped'}
              </span>
            </div>

            {project.public_url ? (
              <div className="mt-1.5 flex items-center space-x-2 flex-wrap">
                <a
                  href={project.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-emerald-300 hover:text-emerald-200 hover:underline flex items-center space-x-1 font-semibold"
                >
                  <span>{project.public_url}</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                </a>
                <span className="text-[11px] text-[#A47E65] font-mono">
                  (Port: {project.allocated_port})
                </span>
              </div>
            ) : (
              <p className="text-xs text-[#DFCDB5]/70 mt-1">
                Publikasikan aplikasi web ini ke domain resmi <code className="text-[#E8DCB8] font-mono">*.miraigrid.web.id</code> agar dapat diakses dari internet via Cloudflare Tunnel.
              </p>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center space-x-2 self-start md:self-center shrink-0">
          {project.public_url ? (
            <>
              <button
                type="button"
                onClick={() => handleCopyLink(project.public_url)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1C0F0A] hover:bg-[#382115] text-[#DFCDB5] border border-[#3E2316] transition flex items-center space-x-1.5"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-[#C49767]" />}
                <span>{copied ? 'Tersalin' : 'Salin Link'}</span>
              </button>

              {project.deployment_id && (
                <button
                  type="button"
                  onClick={() => handleToggleDeployment(project.deployment_id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition border flex items-center space-x-1.5 ${
                    project.is_published
                      ? 'bg-[#3A2115] hover:bg-[#4D2D1E] text-amber-300 border-[#5C341F]'
                      : 'bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border-emerald-700/60'
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>{project.is_published ? 'Hentikan Publikasi' : 'Aktifkan Kembali'}</span>
                </button>
              )}

              <a
                href={project.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#4A2D1B] hover:bg-[#5C3822] text-[#FAF5EC] border border-[#683E24] shadow-sm transition flex items-center space-x-1.5"
              >
                <span>Buka Web</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          ) : (
            <button
              type="button"
              onClick={handlePublishWeb}
              disabled={publishLoading}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#52301E] text-[#FAF5EC] border border-[#633A23] shadow-md transition disabled:opacity-50 flex items-center space-x-2"
            >
              <Globe className="h-4 w-4 text-emerald-400" />
              <span>{publishLoading ? 'Mengenerate Subdomain...' : 'Deploy / Publish Web Sekarang'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Body Tabs & Form (cPanel Web Application Selector Style) */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 shadow-2xl text-[#FAF5EC] space-y-6">
        {/* PHP Application Root (Document Root) */}
        {isPhp && (
          <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <label className="block text-xs font-semibold text-[#DFCDB5]">
                Application Root (Document Root)
                <span className="text-[#C49767] font-normal ml-2">
                  {isAdmin ? '(Bisa Custom / Repositori Git)' : '(Bisa Diedit / Subfolder Sandbox)'}
                </span>
              </label>
              <button
                type="button"
                onClick={() => handleOpenInFileManager(phpAppRoot || `/home/${project?.owner_username || 'nim'}/${project?.name}`)}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-[#2B1810] hover:bg-[#3E2316] border border-[#4D2D1E] hover:border-[#C49767] text-[#C49767] hover:text-[#FAF5EC] text-[11px] font-sans transition cursor-pointer"
                title="Buka folder ini langsung di File Manager"
              >
                <Folder className="h-3 w-3" />
                <span>Buka di File Manager</span>
                <ExternalLink className="h-2.5 w-2.5 opacity-70" />
              </button>
            </div>
            <input
              type="text"
              placeholder={
                isAdmin
                  ? 'contoh: public atau /home/admin/repositories/nama_repo (kosongkan untuk default root)'
                  : 'contoh: public atau public_html (kosongkan untuk default root project)'
              }
              value={phpAppRoot}
              onChange={(e) => setPhpAppRoot(e.target.value)}
              className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767] transition placeholder-[#553826]"
            />
            <p className="text-[10px] text-[#A47E65] mt-1.5 font-sans leading-relaxed">
              {isAdmin ? (
                <span>
                  <strong className="text-[#E8DCB8]">Akses Administrator:</strong> Anda dapat mengarahkan DocumentRoot ke subfolder (e.g. <code className="font-mono text-[#E8DCB8]">public</code>) atau ke repositori Git di server seperti <code className="font-mono text-[#E8DCB8]">/home/admin/repositories/nama_repo</code>.
                </span>
              ) : (
                <span>
                  <strong className="text-[#E8DCB8]">Sandbox Mahasiswa:</strong> Anda dapat menyesuaikan DocumentRoot ke subfolder project Anda (misal <code className="font-mono text-[#E8DCB8]">public</code> untuk Laravel / CodeIgniter 4, atau path lengkap <code className="font-mono text-[#E8DCB8]">/home/{project.owner_username || 'nim'}/{project.name}/public</code>). Terisolasi aman di bawah akun Anda.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Navigation Tabs for PHP */}
        {isPhp && (
          <div className="flex border-b border-[#3E2316] space-x-3 pb-2">
            <button
              onClick={() => setActiveTab('directives')}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                activeTab === 'directives' ? 'border-[#C49767] text-[#FAF5EC] font-bold' : 'border-transparent text-[#DFCDB5]/70 hover:text-[#FAF5EC]'
              }`}
            >
              PHP Directives (php.ini)
            </button>
            <button
              onClick={() => setActiveTab('extensions')}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                activeTab === 'extensions' ? 'border-[#C49767] text-[#FAF5EC] font-bold' : 'border-transparent text-[#DFCDB5]/70 hover:text-[#FAF5EC]'
              }`}
            >
              PHP Extensions ({phpExtensions.length} Aktif)
            </button>
          </div>
        )}

        {/* A. PHP DIRECTIVES (php.ini) (Image 2) */}
        {isPhp && activeTab === 'directives' && (
          <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl overflow-hidden shadow-inner">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#2B1810] text-[#DFCDB5] uppercase text-[10px] tracking-wider border-b border-[#3E2316]">
                <tr>
                  <th className="p-4 w-1/4">PHP Directive</th>
                  <th className="p-4 w-1/2">Information</th>
                  <th className="p-4 w-1/4 text-right">Setting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3E2316]">
                <tr className="hover:bg-[#2A170F]/50">
                  <td className="p-4 font-mono font-bold text-[#E8DCB8]">display_errors</td>
                  <td className="p-4 text-[#DFCDB5]/80 text-[11px]">
                    This determines whether errors should be printed to the screen as part of the output or if they should be hidden from the user.
                  </td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => setPhpDirectives({ ...phpDirectives, display_errors: phpDirectives.display_errors === 'Enabled' ? 'Disabled' : 'Enabled' })}
                      className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition ${
                        phpDirectives.display_errors === 'Enabled' ? 'bg-emerald-600 text-white' : 'bg-[#3A2115] text-[#DFCDB5]'
                      }`}
                    >
                      {phpDirectives.display_errors}
                    </button>
                  </td>
                </tr>

                <tr className="hover:bg-[#2A170F]/50">
                  <td className="p-4 font-mono font-bold text-[#E8DCB8]">error_log</td>
                  <td className="p-4 text-[#DFCDB5]/80 text-[11px]">Path to the PHP error log file (e.g. error_log).</td>
                  <td className="p-4 text-right">
                    <input
                      type="text"
                      value={phpDirectives.error_log}
                      onChange={(e) => setPhpDirectives({ ...phpDirectives, error_log: e.target.value })}
                      className="w-40 bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3 py-1 text-xs text-[#FAF5EC] text-right font-mono"
                    />
                  </td>
                </tr>

                <tr className="hover:bg-[#2A170F]/50">
                  <td className="p-4 font-mono font-bold text-[#E8DCB8]">log_errors</td>
                  <td className="p-4 text-[#DFCDB5]/80 text-[11px]">Tells whether script error messages should be logged to the server error log or error_log.</td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => setPhpDirectives({ ...phpDirectives, log_errors: phpDirectives.log_errors === 'Enabled' ? 'Disabled' : 'Enabled' })}
                      className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition ${
                        phpDirectives.log_errors === 'Enabled' ? 'bg-emerald-600 text-white' : 'bg-[#3A2115] text-[#DFCDB5]'
                      }`}
                    >
                      {phpDirectives.log_errors}
                    </button>
                  </td>
                </tr>

                <tr className="hover:bg-[#2A170F]/50">
                  <td className="p-4 font-mono font-bold text-[#E8DCB8]">max_execution_time</td>
                  <td className="p-4 text-[#DFCDB5]/80 text-[11px]">Sets the maximum time in seconds a script is allowed to run before it is terminated by the parser. (Default: 30)</td>
                  <td className="p-4 text-right">
                    <input
                      type="number"
                      value={phpDirectives.max_execution_time}
                      onChange={(e) => setPhpDirectives({ ...phpDirectives, max_execution_time: parseInt(e.target.value) || 30 })}
                      className="w-24 bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3 py-1 text-xs text-[#FAF5EC] text-right font-mono"
                    />
                  </td>
                </tr>

                <tr className="hover:bg-[#2A170F]/50">
                  <td className="p-4 font-mono font-bold text-[#E8DCB8]">memory_limit</td>
                  <td className="p-4 text-[#DFCDB5]/80 text-[11px]">Sets the maximum amount of memory in bytes that a script is allowed to allocate (e.g. 256M, 512M).</td>
                  <td className="p-4 text-right">
                    <input
                      type="text"
                      value={phpDirectives.memory_limit}
                      onChange={(e) => setPhpDirectives({ ...phpDirectives, memory_limit: e.target.value })}
                      className="w-28 bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3 py-1 text-xs text-[#FAF5EC] text-right font-mono"
                    />
                  </td>
                </tr>

                <tr className="hover:bg-[#2A170F]/50">
                  <td className="p-4 font-mono font-bold text-[#E8DCB8]">post_max_size</td>
                  <td className="p-4 text-[#DFCDB5]/80 text-[11px]">Sets max size of post data allowed.</td>
                  <td className="p-4 text-right">
                    <input
                      type="text"
                      value={phpDirectives.post_max_size}
                      onChange={(e) => setPhpDirectives({ ...phpDirectives, post_max_size: e.target.value })}
                      className="w-28 bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3 py-1 text-xs text-[#FAF5EC] text-right font-mono"
                    />
                  </td>
                </tr>

                <tr className="hover:bg-[#2A170F]/50">
                  <td className="p-4 font-mono font-bold text-[#E8DCB8]">upload_max_filesize</td>
                  <td className="p-4 text-[#DFCDB5]/80 text-[11px]">The maximum size of an uploaded file.</td>
                  <td className="p-4 text-right">
                    <input
                      type="text"
                      value={phpDirectives.upload_max_filesize}
                      onChange={(e) => setPhpDirectives({ ...phpDirectives, upload_max_filesize: e.target.value })}
                      className="w-28 bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3 py-1 text-xs text-[#FAF5EC] text-right font-mono"
                    />
                  </td>
                </tr>

                <tr className="hover:bg-[#2A170F]/50">
                  <td className="p-4 font-mono font-bold text-[#E8DCB8]">zlib.output_compression</td>
                  <td className="p-4 text-[#DFCDB5]/80 text-[11px]">Whether to transparently compress pages with Gzip.</td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => setPhpDirectives({ ...phpDirectives, zlib_output_compression: phpDirectives.zlib_output_compression === 'Enabled' ? 'Disabled' : 'Enabled' })}
                      className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition ${
                        phpDirectives.zlib_output_compression === 'Enabled' ? 'bg-emerald-600 text-white' : 'bg-[#3A2115] text-[#DFCDB5]'
                      }`}
                    >
                      {phpDirectives.zlib_output_compression}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* B. PHP EXTENSIONS (Image 3) */}
        {isPhp && activeTab === 'extensions' && (
          <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#3E2316]">
              <div>
                <h4 className="text-sm font-serif font-bold text-[#FAF5EC]">Account PHP Settings</h4>
                <p className="text-xs text-[#DFCDB5]/70">Pilih ekstensi PHP yang aktif untuk aplikasi Anda.</p>
              </div>
              <button
                type="button"
                onClick={() => setPhpExtensions(['pdo', 'pdo_mysql', 'pdo_pgsql', 'pdo_sqlite', 'curl', 'mbstring', 'gd', 'zip'])}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#E8DCB8] transition"
              >
                Reset PHP Extensions to default
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {defaultExts.map((ext) => {
                const isChecked = phpExtensions.includes(ext)
                return (
                  <label
                    key={ext}
                    className={`flex items-center space-x-2.5 p-3 rounded-xl border cursor-pointer transition select-none ${
                      isChecked ? 'bg-[#3A2115] border-[#C49767] text-[#FAF5EC]' : 'bg-[#2B1810]/40 border-[#3E2316] text-[#DFCDB5]/70 hover:bg-[#3A2115]/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleExtension(ext)}
                      className="h-4 w-4 rounded accent-[#C49767] bg-[#1C0F0A] border-[#4D2D1E]"
                    />
                    <span className="text-xs font-mono">{ext}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}



        {/* PHP Composer & Build Toolchain Card */}
        {isPhp && (
          <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#3E2316]">
              <div>
                <h4 className="text-sm font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
                  <Boxes className="h-4 w-4 text-[#C49767]" />
                  <span>Composer & Framework Build Engine</span>
                </h4>
                <p className="text-xs text-[#DFCDB5]/70">
                  Otomatis mendeteksi composer.json, menginstal dependensi (Laravel, CodeIgniter, Filament), generate APP_KEY, dan optimasi runtime.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleRunComposerInstall}
                disabled={runningAction}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#FAF5EC] border border-[#5A3521] shadow-md transition disabled:opacity-50 flex items-center space-x-2"
              >
                <Boxes className="h-4 w-4 text-[#C49767]" />
                <span>{runningAction ? 'Installing...' : 'Run Composer Install'}</span>
              </button>

              <button
                type="button"
                onClick={handleRunBuildProject}
                disabled={runningAction}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#4A2D1B] hover:bg-[#5C3822] text-[#F3E5D0] border border-[#6D4229] shadow-md transition disabled:opacity-50 flex items-center space-x-2"
              >
                <Hammer className="h-4 w-4 text-emerald-400" />
                <span>{runningAction ? 'Compiling...' : 'Compile & Optimize Framework'}</span>
              </button>
            </div>
            <p className="text-[11px] text-[#A47E65]">
              Tip: Jika Anda mengunggah project Laravel baru atau terjadi error missing vendor/autoload.php, klik tombol di atas untuk mengompilasi dependensi secara otomatis.
            </p>
          </div>
        )}

        {/* C. PYTHON APPLICATION SELECTOR (Image 4) */}
        {isPython && (
          <div className="space-y-6">
            <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">Python version</label>
                  <select
                    value={pyVersion}
                    onChange={(e) => setPyVersion(e.target.value)}
                    className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                  >
                    <option value="3.12">3.12 (Latest)</option>
                    <option value="3.11">3.11 (Recommended)</option>
                    <option value="3.10">3.10</option>
                    <option value="3.9">3.9</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                    <label className="block text-xs font-semibold text-[#DFCDB5]">
                      Application Root {isAdmin ? <span className="text-[#C49767] font-normal">(Bisa Custom / Git Repo)</span> : null}
                    </label>
                    <button
                      type="button"
                      onClick={() => handleOpenInFileManager(pyAppRoot || `/home/${project?.owner_username || 'nim'}/${project?.name}`)}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-xl bg-[#2B1810] hover:bg-[#3E2316] border border-[#4D2D1E] hover:border-[#C49767] text-[#C49767] hover:text-[#FAF5EC] text-[10px] font-sans transition cursor-pointer"
                      title="Buka folder ini langsung di File Manager"
                    >
                      <Folder className="h-3 w-3" />
                      <span>Buka File Manager</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={isAdmin ? 'e.g. app atau /home/admin/repositories/nama_repo' : 'e.g. app atau src (kosongkan untuk root)'}
                    value={pyAppRoot}
                    onChange={(e) => setPyAppRoot(e.target.value)}
                    className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                  />
                  <p className="text-[10px] text-[#A47E65] mt-1 font-sans">
                    {isAdmin
                      ? 'Admin: Dapat mengarahkan root direktori ke subfolder atau repositori git /home/admin/repositories/nama_repo.'
                      : 'Sandbox Mahasiswa: Direktori aplikasi di dalam akun Anda. Terisolasi aman.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">Application startup file</label>
                  <input
                    type="text"
                    required
                    placeholder="app.py atau passenger_wsgi.py"
                    value={pyStartupFile}
                    onChange={(e) => setPyStartupFile(e.target.value)}
                    className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">Application Entry point</label>
                  <input
                    type="text"
                    required
                    placeholder="app atau application"
                    value={pyEntryPoint}
                    onChange={(e) => setPyEntryPoint(e.target.value)}
                    className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                  />
                  <p className="text-[10px] text-[#A47E65] mt-1">Setup WSGI callable object for your application.</p>
                </div>
              </div>
            </div>

            {/* Configuration files & Pip install (Image 4) */}
            <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#FAF5EC]">Configuration files</h4>
                  <p className="text-[11px] text-[#DFCDB5]/70">Install paket Python dependensi langsung ke container.</p>
                </div>
                <button
                  type="button"
                  onClick={handleRunPipInstall}
                  disabled={runningAction}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] flex items-center space-x-1.5 transition disabled:opacity-50 shadow-md"
                >
                  <Play className="h-3.5 w-3.5 text-[#E8DCB8]" />
                  <span>{runningAction ? 'Installing...' : 'Run Pip Install'}</span>
                </button>
              </div>

              <div className="pt-3 border-t border-[#3E2316]">
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">Execute python script</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Enter the path to the script file (e.g. manage.py migrate)"
                    value={pyCustomScript}
                    onChange={(e) => setPyCustomScript(e.target.value)}
                    className="flex-1 bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRunCustomScript(pyCustomScript)}
                    disabled={runningAction || !pyCustomScript.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#E8DCB8] flex items-center space-x-1 transition disabled:opacity-50"
                  >
                    <span>Run Script</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* D. NODE.JS APPLICATION SELECTOR (Image 5) */}
        {isNode && (
          <div className="space-y-6">
            <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">Node.js version</label>
                  <select
                    value={nodeVersion}
                    onChange={(e) => setNodeVersion(e.target.value)}
                    className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                  >
                    <option value="22">22 (Latest LTS)</option>
                    <option value="20">20 (Recommended LTS)</option>
                    <option value="18">18</option>
                    <option value="16">16</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">Application mode</label>
                  <select
                    value={nodeAppMode}
                    onChange={(e) => setNodeAppMode(e.target.value)}
                    className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                  >
                    <option value="development">Development</option>
                    <option value="production">Production</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                    <label className="block text-xs font-semibold text-[#DFCDB5]">
                      Application Root {isAdmin ? <span className="text-[#C49767] font-normal">(Bisa Custom / Git Repo)</span> : null}
                    </label>
                    <button
                      type="button"
                      onClick={() => handleOpenInFileManager(nodeAppRoot || `/home/${project?.owner_username || 'nim'}/${project?.name}`)}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-xl bg-[#2B1810] hover:bg-[#3E2316] border border-[#4D2D1E] hover:border-[#C49767] text-[#C49767] hover:text-[#FAF5EC] text-[10px] font-sans transition cursor-pointer"
                      title="Buka folder ini langsung di File Manager"
                    >
                      <Folder className="h-3 w-3" />
                      <span>Buka File Manager</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={isAdmin ? 'e.g. task-nextjs atau /home/admin/repositories/nama_repo' : 'e.g. task-nextjs atau kosongkan untuk root'}
                    value={nodeAppRoot}
                    onChange={(e) => setNodeAppRoot(e.target.value)}
                    className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                  />
                  <p className="text-[10px] text-[#A47E65] mt-1 font-sans">
                    {isAdmin
                      ? 'Admin: Dapat mengarahkan root direktori ke subfolder atau repositori git /home/admin/repositories/nama_repo.'
                      : 'Sandbox Mahasiswa: Direktori aplikasi di dalam akun Anda. Terisolasi aman.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">Application startup file</label>
                  <input
                    type="text"
                    required
                    placeholder="server.js atau index.js atau app.js"
                    value={nodeStartupFile}
                    onChange={(e) => setNodeStartupFile(e.target.value)}
                    className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                  />
                </div>
              </div>
            </div>

            {/* Detected configuration files & NPM install (Image 5) */}
            <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#FAF5EC]">Detected configuration files</h4>
                  <p className="text-[11px] text-[#DFCDB5]/70 font-mono">package.json</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleRunNpmInstall}
                    disabled={runningAction}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] flex items-center space-x-1.5 transition disabled:opacity-50 shadow-md"
                  >
                    <Play className="h-3.5 w-3.5 text-[#E8DCB8]" />
                    <span>{runningAction ? 'Installing...' : 'Run NPM Install'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-[#3E2316]">
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">Run JS script</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="e.g. node build.js atau npm run migrate"
                    value={nodeCustomScript}
                    onChange={(e) => setNodeCustomScript(e.target.value)}
                    className="flex-1 bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRunCustomScript(nodeCustomScript)}
                    disabled={runningAction || !nodeCustomScript.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#E8DCB8] flex items-center space-x-1 transition disabled:opacity-50"
                  >
                    <span>Run Script</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Node.js NPM & Build Toolchain Card */}
          <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#3E2316]">
              <div>
                <h4 className="text-sm font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
                  <Boxes className="h-4 w-4 text-[#C49767]" />
                  <span>Node.js NPM & Compiler Pipeline</span>
                </h4>
                <p className="text-xs text-[#DFCDB5]/70">
                  Otomatis mendeteksi package.json, menginstal modul (React, Next.js, Express, Vite), dan menjalankan npm run build.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleRunNpmInstall}
                disabled={runningAction}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#FAF5EC] border border-[#5A3521] shadow-md transition disabled:opacity-50 flex items-center space-x-2"
              >
                <Boxes className="h-4 w-4 text-[#C49767]" />
                <span>{runningAction ? 'Installing...' : 'Run NPM Install'}</span>
              </button>

              <button
                type="button"
                onClick={handleRunBuildProject}
                disabled={runningAction}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#4A2D1B] hover:bg-[#5C3822] text-[#F3E5D0] border border-[#6D4229] shadow-md transition disabled:opacity-50 flex items-center space-x-2"
              >
                <Hammer className="h-4 w-4 text-emerald-400" />
                <span>{runningAction ? 'Building...' : 'Compile & Build Node.js Project'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete}
        title="Destroy Application?"
        message={`Apakah Anda yakin ingin menghapus aplikasi '${project.name}' beserta container dan seluruh filenya?`}
        confirmText="DESTROY APPLICATION"
        onConfirm={executeDelete}
        onClose={() => setConfirmDelete(false)}
      />

      {/* Build / Compilation Log Modal */}
      <ModalPortal isOpen={showBuildModal}>
        {showBuildModal && (
          <div
            onClick={() => setShowBuildModal(false)}
            className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1C0F0A] border border-[#4D2D1E] rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="px-6 py-4 bg-[#2B1810] border-b border-[#3E2316] flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <Boxes className="h-5 w-5 text-[#C49767]" />
                  <h3 className="text-sm font-serif font-bold text-[#FAF5EC]">{buildTitle || 'Execution Output'}</h3>
                </div>
                <button
                  onClick={() => setShowBuildModal(false)}
                  className="p-1 rounded-xl text-[#DFCDB5]/70 hover:text-white hover:bg-[#3A2115] transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5 flex-1 overflow-auto bg-[#140B07]">
                <pre className="font-mono text-xs text-[#E8DCB8] whitespace-pre-wrap leading-relaxed select-text">
                  {buildOutput || 'Tidak ada log output.'}
                </pre>
              </div>
              <div className="px-6 py-3.5 bg-[#2B1810] border-t border-[#3E2316] flex justify-end">
                <button
                  onClick={() => setShowBuildModal(false)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#4A2D1B] hover:bg-[#5C3822] text-[#FAF5EC] transition"
                >
                  Tutup Log
                </button>
              </div>
            </div>
          </div>
        )}
      </ModalPortal>
    </div>
  )
}
