import React, { useState } from 'react'
import {
  ArrowLeft, ExternalLink, Play, Square, RotateCw, Trash2,
  Save, Sliders, Terminal, FileCode, Check, RefreshCw, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner } from '../components/Skeletons'
import ConfirmModal from '../components/ConfirmModal'
import ContainerConsole from '../components/ContainerConsole'

export default function ProjectDetailPage({ project, onBack, onUpdated }) {
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
  const [showConsole, setShowConsole] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  // Python Settings State (Image 4)
  const [pyVersion, setPyVersion] = useState(project.version || '3.11')
  const [pyAppRoot, setPyAppRoot] = useState(initialCfg.app_root || '')
  const [pyStartupFile, setPyStartupFile] = useState(initialCfg.startup_file || 'app.py')
  const [pyEntryPoint, setPyEntryPoint] = useState(initialCfg.entry_point || 'app')
  const [pyCustomScript, setPyCustomScript] = useState('')

  // Node.js Settings State (Image 5)
  const [nodeVersion, setNodeVersion] = useState(project.version || '20')
  const [nodeAppMode, setNodeAppMode] = useState(initialCfg.app_mode || 'development')
  const [nodeAppRoot, setNodeAppRoot] = useState(initialCfg.app_root || '')
  const [nodeStartupFile, setNodeStartupFile] = useState(initialCfg.startup_file || 'server.js')
  const [nodeCustomScript, setNodeCustomScript] = useState('')

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
      }
    } else if (isPython) {
      app_config = {
        app_root: pyAppRoot,
        startup_file: pyStartupFile,
        entry_point: pyEntryPoint,
      }
    } else if (isNode) {
      app_config = {
        app_mode: nodeAppMode,
        app_root: nodeAppRoot,
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
      onBack()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus project.', { id: toastId })
    }
  }

  // Run Pip Install
  const handleRunPipInstall = async () => {
    setRunningAction(true)
    const toastId = toast.loading('Menjalankan pip install -r requirements.txt di container...')
    try {
      await api.post(`/projects/${project.id}/pip-install`)
      toast.success('Pip install selesai!', { id: toastId })
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
      await api.post(`/projects/${project.id}/npm-install`)
      toast.success('NPM install selesai!', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menjalankan npm install.', { id: toastId })
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
        command: isPython ? 'python' : 'node',
        stdin_input: scriptCmd,
      })
      toast.success('Script selesai dijalankan!', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menjalankan script.', { id: toastId })
    } finally {
      setRunningAction(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Top Breadcrumb & Actions Bar (cPanel Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DECDBD]">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] transition shadow-sm"
            title="Kembali ke Daftar Aplikasi"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl">
                {isPhp ? '🐘' : isPython ? '🐍' : '🟩'}
              </span>
              <h2 className="text-2xl font-serif font-bold text-[#26160F]">
                {isPhp ? 'PHP' : isPython ? 'Python' : 'Node.js'} — {project.name}
              </h2>
            </div>
            <p className="text-xs text-[#5C3B29] font-mono mt-0.5">
              URI: {project.access_url}
            </p>
          </div>
        </div>

        {/* Action Controls (Stop/Restart/Destroy/Save) */}
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
            onClick={() => setShowConsole(true)}
            className="px-4 py-2 rounded-2xl text-xs font-semibold bg-[#2B1810] hover:bg-[#3D2317] text-[#E8DCB8] border border-[#4D2D1E] shadow-md transition flex items-center space-x-1.5"
            title="Buka Terminal Container"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>CONSOLE</span>
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

      {/* 2. Main Body Tabs & Form (cPanel Web Application Selector Style) */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 shadow-2xl text-[#FAF5EC] space-y-6">
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
                {/* display_errors */}
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

                {/* error_log */}
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

                {/* log_errors */}
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

                {/* max_execution_time */}
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

                {/* memory_limit */}
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

                {/* post_max_size */}
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

                {/* upload_max_filesize */}
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

                {/* zlib.output_compression */}
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
                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">Application root</label>
                  <input
                    type="text"
                    placeholder="e.g. app atau predictive-maintenance"
                    value={pyAppRoot}
                    onChange={(e) => setPyAppRoot(e.target.value)}
                    className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                  />
                  <p className="text-[10px] text-[#A47E65] mt-1">Physical address to your application on server that corresponds with its URI.</p>
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
                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">Application root</label>
                  <input
                    type="text"
                    placeholder="e.g. task-nextjs atau kosongkan untuk root"
                    value={nodeAppRoot}
                    onChange={(e) => setNodeAppRoot(e.target.value)}
                    className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                  />
                  <p className="text-[10px] text-[#A47E65] mt-1">Physical address to your application on server that corresponds with its URI.</p>
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
          </div>
        )}
      </div>

      {/* Container Console Modal */}
      <ContainerConsole
        project={project}
        isOpen={showConsole}
        onClose={() => setShowConsole(false)}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete}
        title="Destroy Application?"
        message={`Apakah Anda yakin ingin menghapus aplikasi '${project.name}' beserta container dan seluruh filenya?`}
        confirmText="DESTROY APPLICATION"
        onConfirm={executeDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}
