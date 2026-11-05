import React, { useState } from 'react'
import { Settings, Play, Check, X, Sliders, Package, Terminal, ExternalLink, RefreshCw, AlertCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner } from './Skeletons'
import ModalPortal from './ModalPortal'

export default function ProjectConfigModal({ project, isOpen, onClose, onUpdated }) {
  if (!isOpen || !project) return null

  const isPhp = project.language === 'php' || project.template_type?.startsWith('php')
  const isPython = project.language === 'python' || project.template_type?.startsWith('python')
  const isNode = project.language === 'node' || project.template_type?.startsWith('node')

  const initialCfg = project.app_config || {}

  // Active Tab
  const [activeTab, setActiveTab] = useState(isPhp ? 'directives' : isPython ? 'python' : 'node')

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

  // Loading states
  const [saving, setSaving] = useState(false)
  const [runningAction, setRunningAction] = useState(false)

  // Toggle extension
  const toggleExtension = (ext) => {
    if (phpExtensions.includes(ext)) {
      setPhpExtensions(phpExtensions.filter((e) => e !== ext))
    } else {
      setPhpExtensions([...phpExtensions, ext])
    }
  }

  // Save full configuration
  const handleSaveConfig = async (e) => {
    e.preventDefault()
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
      toast.success('Konfigurasi berhasil disimpan dan container diperbarui!', { id: toastId })
      onUpdated?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan konfigurasi.', { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  // Run Pip Install (Image 4)
  const handleRunPipInstall = async () => {
    setRunningAction(true)
    const toastId = toast.loading('Menjalankan pip install -r requirements.txt di container...')
    try {
      const res = await api.post(`/projects/${project.id}/pip-install`)
      toast.success('Pip install selesai!', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menjalankan pip install.', { id: toastId })
    } finally {
      setRunningAction(false)
    }
  }

  // Run NPM Install (Image 5)
  const handleRunNpmInstall = async () => {
    setRunningAction(true)
    const toastId = toast.loading('Menjalankan npm install di container...')
    try {
      const res = await api.post(`/projects/${project.id}/npm-install`)
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
    const toastId = toast.loading(`Menjalankan: ${scriptCmd}...`)
    try {
      const res = await api.post(`/projects/${project.id}/console/exec`, {
        command: isPython ? 'python' : 'node',
        stdin_input: scriptCmd,
      })
      toast.success('Script selesai dijalankan! Periksa log untuk hasilnya.', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menjalankan script.', { id: toastId })
    } finally {
      setRunningAction(false)
    }
  }

  return (
    <ModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-4xl bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 sm:p-7 text-[#FAF5EC] flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#3E2316] mb-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-2xl bg-[#3A2115] border border-[#543221] flex items-center justify-center text-[#E8DCB8]">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-[#FAF5EC]">
                  Konfigurasi Engine: {project.name}
                </h3>
                <p className="text-xs text-[#DFCDB5]">
                  Runtime: <span className="font-mono uppercase font-bold text-[#E8DCB8]">{project.language} {project.version}</span> • Ala cPanel Web Application Selector
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-[#DFCDB5] hover:text-white hover:bg-[#3A2115] transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Sub Tabs */}
          <div className="flex border-b border-[#3E2316] space-x-2 mb-4 overflow-x-auto">
            {isPhp && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('directives')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'directives' ? 'border-[#C49767] text-[#FAF5EC] font-bold' : 'border-transparent text-[#DFCDB5]/70 hover:text-[#FAF5EC]'
                  }`}
                >
                  PHP Directives (php.ini)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('extensions')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'extensions' ? 'border-[#C49767] text-[#FAF5EC] font-bold' : 'border-transparent text-[#DFCDB5]/70 hover:text-[#FAF5EC]'
                  }`}
                >
                  PHP Extensions ({phpExtensions.length} Aktif)
                </button>
              </>
            )}

            {isPython && (
              <button
                type="button"
                onClick={() => setActiveTab('python')}
                className="px-4 py-2 text-xs font-semibold border-b-2 border-[#C49767] text-[#FAF5EC] font-bold"
              >
                Python Application Settings
              </button>
            )}

            {isNode && (
              <button
                type="button"
                onClick={() => setActiveTab('node')}
                className="px-4 py-2 text-xs font-semibold border-b-2 border-[#C49767] text-[#FAF5EC] font-bold"
              >
                Node.js Application Settings
              </button>
            )}
          </div>

          {/* Tab Contents: Scrollable */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-5">
            {/* 1. PHP DIRECTIVES TAB (Image 2) */}
            {isPhp && activeTab === 'directives' && (
              <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl overflow-hidden shadow-inner">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#2B1810] text-[#DFCDB5] uppercase text-[10px] tracking-wider border-b border-[#3E2316]">
                    <tr>
                      <th className="p-3.5 w-1/4">PHP Directive</th>
                      <th className="p-3.5 w-1/2">Information</th>
                      <th className="p-3.5 w-1/4 text-right">Setting</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3E2316]">
                    {/* display_errors */}
                    <tr className="hover:bg-[#2A170F]/50">
                      <td className="p-3.5 font-mono font-bold text-[#E8DCB8]">display_errors</td>
                      <td className="p-3.5 text-[#DFCDB5]/80 text-[11px]">
                        Menentukan apakah pesan error PHP akan dicetak langsung ke layar output.
                      </td>
                      <td className="p-3.5 text-right">
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
                      <td className="p-3.5 font-mono font-bold text-[#E8DCB8]">error_log</td>
                      <td className="p-3.5 text-[#DFCDB5]/80 text-[11px]">Nama file log error script PHP.</td>
                      <td className="p-3.5 text-right">
                        <input
                          type="text"
                          value={phpDirectives.error_log}
                          onChange={(e) => setPhpDirectives({ ...phpDirectives, error_log: e.target.value })}
                          className="w-36 bg-[#2B1810] border border-[#4D2D1E] rounded-lg px-2.5 py-1 text-xs text-[#FAF5EC] text-right font-mono"
                        />
                      </td>
                    </tr>

                    {/* log_errors */}
                    <tr className="hover:bg-[#2A170F]/50">
                      <td className="p-3.5 font-mono font-bold text-[#E8DCB8]">log_errors</td>
                      <td className="p-3.5 text-[#DFCDB5]/80 text-[11px]">Aktifkan pencatatan pesan error ke file error_log.</td>
                      <td className="p-3.5 text-right">
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
                      <td className="p-3.5 font-mono font-bold text-[#E8DCB8]">max_execution_time</td>
                      <td className="p-3.5 text-[#DFCDB5]/80 text-[11px]">Batas waktu maksimum eksekusi script sebelum dihentikan (detik).</td>
                      <td className="p-3.5 text-right">
                        <input
                          type="number"
                          value={phpDirectives.max_execution_time}
                          onChange={(e) => setPhpDirectives({ ...phpDirectives, max_execution_time: parseInt(e.target.value) || 30 })}
                          className="w-24 bg-[#2B1810] border border-[#4D2D1E] rounded-lg px-2.5 py-1 text-xs text-[#FAF5EC] text-right font-mono"
                        />
                      </td>
                    </tr>

                    {/* memory_limit */}
                    <tr className="hover:bg-[#2A170F]/50">
                      <td className="p-3.5 font-mono font-bold text-[#E8DCB8]">memory_limit</td>
                      <td className="p-3.5 text-[#DFCDB5]/80 text-[11px]">Batas alokasi memori script PHP (contoh: 256M, 512M).</td>
                      <td className="p-3.5 text-right">
                        <input
                          type="text"
                          value={phpDirectives.memory_limit}
                          onChange={(e) => setPhpDirectives({ ...phpDirectives, memory_limit: e.target.value })}
                          className="w-24 bg-[#2B1810] border border-[#4D2D1E] rounded-lg px-2.5 py-1 text-xs text-[#FAF5EC] text-right font-mono"
                        />
                      </td>
                    </tr>

                    {/* post_max_size */}
                    <tr className="hover:bg-[#2A170F]/50">
                      <td className="p-3.5 font-mono font-bold text-[#E8DCB8]">post_max_size</td>
                      <td className="p-3.5 text-[#DFCDB5]/80 text-[11px]">Ukuran data POST maksimum yang diizinkan (contoh: 128M).</td>
                      <td className="p-3.5 text-right">
                        <input
                          type="text"
                          value={phpDirectives.post_max_size}
                          onChange={(e) => setPhpDirectives({ ...phpDirectives, post_max_size: e.target.value })}
                          className="w-24 bg-[#2B1810] border border-[#4D2D1E] rounded-lg px-2.5 py-1 text-xs text-[#FAF5EC] text-right font-mono"
                        />
                      </td>
                    </tr>

                    {/* upload_max_filesize */}
                    <tr className="hover:bg-[#2A170F]/50">
                      <td className="p-3.5 font-mono font-bold text-[#E8DCB8]">upload_max_filesize</td>
                      <td className="p-3.5 text-[#DFCDB5]/80 text-[11px]">Ukuran maksimum satu file upload (contoh: 128M).</td>
                      <td className="p-3.5 text-right">
                        <input
                          type="text"
                          value={phpDirectives.upload_max_filesize}
                          onChange={(e) => setPhpDirectives({ ...phpDirectives, upload_max_filesize: e.target.value })}
                          className="w-24 bg-[#2B1810] border border-[#4D2D1E] rounded-lg px-2.5 py-1 text-xs text-[#FAF5EC] text-right font-mono"
                        />
                      </td>
                    </tr>

                    {/* zlib.output_compression */}
                    <tr className="hover:bg-[#2A170F]/50">
                      <td className="p-3.5 font-mono font-bold text-[#E8DCB8]">zlib.output_compression</td>
                      <td className="p-3.5 text-[#DFCDB5]/80 text-[11px]">Kompresi output halaman otomatis via Gzip.</td>
                      <td className="p-3.5 text-right">
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

            {/* 2. PHP EXTENSIONS TAB (Image 3) */}
            {isPhp && activeTab === 'extensions' && (
              <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#3E2316]">
                  <div>
                    <h4 className="text-sm font-serif font-bold text-[#FAF5EC]">Account PHP Extensions</h4>
                    <p className="text-xs text-[#DFCDB5]/70">Pilih ekstensi PHP yang diperlukan untuk modul praktikum mahasiswa.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhpExtensions(['pdo', 'pdo_mysql', 'pdo_pgsql', 'pdo_sqlite', 'curl', 'mbstring', 'gd', 'zip'])}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#E8DCB8] transition"
                  >
                    Reset ke Default
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {defaultExts.map((ext) => {
                    const isChecked = phpExtensions.includes(ext)
                    return (
                      <label
                        key={ext}
                        className={`flex items-center space-x-2.5 p-2.5 rounded-xl border cursor-pointer transition select-none ${
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

            {/* 3. PYTHON SETTINGS TAB (Image 4) */}
            {isPython && activeTab === 'python' && (
              <div className="space-y-4">
                <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Python Version</label>
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
                      <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Application Root</label>
                      <input
                        type="text"
                        placeholder="e.g. app atau kosongkan untuk root"
                        value={pyAppRoot}
                        onChange={(e) => setPyAppRoot(e.target.value)}
                        className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Application Startup File</label>
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
                      <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Application Entry Point</label>
                      <input
                        type="text"
                        required
                        placeholder="app atau application"
                        value={pyEntryPoint}
                        onChange={(e) => setPyEntryPoint(e.target.value)}
                        className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                      />
                    </div>
                  </div>
                </div>

                {/* Configuration Files & Pip Install (Image 4) */}
                <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-[#FAF5EC]">Configuration files (requirements.txt)</h4>
                      <p className="text-[11px] text-[#DFCDB5]/70">Install paket Python dependensi langsung ke container.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunPipInstall}
                      disabled={runningAction}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] flex items-center space-x-1.5 transition disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5 text-[#E8DCB8]" />
                      <span>{runningAction ? 'Installing...' : 'Run Pip Install'}</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-[#3E2316] flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="e.g. python manage.py migrate"
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
            )}

            {/* 4. NODE.JS SETTINGS TAB (Image 5) */}
            {isNode && activeTab === 'node' && (
              <div className="space-y-4">
                <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Node.js Version</label>
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
                      <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Application Mode</label>
                      <select
                        value={nodeAppMode}
                        onChange={(e) => setNodeAppMode(e.target.value)}
                        className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                      >
                        <option value="development">Development (NODE_ENV=development)</option>
                        <option value="production">Production (NODE_ENV=production)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Application Root</label>
                      <input
                        type="text"
                        placeholder="e.g. app atau kosongkan untuk root"
                        value={nodeAppRoot}
                        onChange={(e) => setNodeAppRoot(e.target.value)}
                        className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Application Startup File</label>
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

                {/* Configuration Files & NPM Install (Image 5) */}
                <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-[#FAF5EC]">Detected configuration files (package.json)</h4>
                      <p className="text-[11px] text-[#DFCDB5]/70">Install paket npm dependensi langsung ke container.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunNpmInstall}
                      disabled={runningAction}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] flex items-center space-x-1.5 transition disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5 text-[#E8DCB8]" />
                      <span>{runningAction ? 'Installing...' : 'Run NPM Install'}</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-[#3E2316] flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="e.g. npm run build atau node migrate.js"
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
            )}
          </div>

          {/* Footer Save Button */}
          <div className="flex justify-between items-center pt-4 border-t border-[#3E2316] mt-4">
            <span className="text-[11px] text-[#DFCDB5]/70 font-mono">
              Perubahan konfigurasi akan men-generate ulang compose & me-restart container secara aman.
            </span>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={saving}
                className="px-6 py-2.5 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] shadow-lg transition disabled:opacity-50 flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <Spinner size="xs" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Konfigurasi</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
