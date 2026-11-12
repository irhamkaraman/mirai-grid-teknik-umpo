import React, { useState, useEffect, useRef } from 'react'
import {
  ShieldCheck,
  ArrowLeft,
  Copy,
  Check,
  Terminal as TerminalIcon,
  Server,
  Lock,
  Eye,
  EyeOff,
  FolderTree,
  Cpu,
  Layers,
  HardDrive,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Package,
  Code
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'

export default function SSHAccessPage({ user, onNavigate }) {
  const [sshInfo, setSshInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copiedKey, setCopiedKey] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [activeTab, setActiveTab] = useState('connect') // 'connect' | 'terminal' | 'guide'

  // Web Terminal State
  const [terminalHistory, setTerminalHistory] = useState([])
  const [terminalInput, setTerminalInput] = useState('')
  const [cmdHistory, setCmdHistory] = useState([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [cwd, setCwd] = useState('')
  const [executing, setExecuting] = useState(false)

  const terminalInputRef = useRef(null)
  const terminalScrollRef = useRef(null)

  const username = user?.username || 'mahasiswa'
  const defaultSubdomain = `ssh-${username}.miraigrid.web.id`
  const defaultCommand = `ssh ${username}@${defaultSubdomain} -p 22`
  const defaultCommandIp = `ssh ${username}@76.76.76.189 -p 22`
  const defaultSftpCommand = `sftp -P 22 ${username}@${defaultSubdomain}`

  useEffect(() => {
    fetchSSHInfo()
  }, [user])

  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight
    }
  }, [terminalHistory, executing])

  const fetchSSHInfo = async () => {
    try {
      setLoading(true)
      const res = await api.get('/ssh/info')
      setSshInfo(res.data)
    } catch (err) {
      console.warn('Gagal memuat info SSH dari API, menggunakan fallback lokal:', err)
      setSshInfo({
        status: 'active',
        username: username,
        subdomain: defaultSubdomain,
        host: defaultSubdomain,
        public_ip: '76.76.76.189',
        lan_ip: '10.10.10.10',
        port: 22,
        ssh_command: defaultCommand,
        ssh_command_ip: defaultCommandIp,
        sftp_command: defaultSftpCommand,
        home_directory: `/home/${username}`,
        quota: {
          storage_mb: 500,
          ram_mb: 256,
          cpu_cores: 0.5
        }
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text, key, label = 'Teks') => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success(`${label} berhasil disalin ke clipboard!`, { duration: 3000 })
    setTimeout(() => {
      setCopiedKey(null)
    }, 2000)
  }

  const handleExecuteCommand = async (e) => {
    e?.preventDefault()
    const cmd = terminalInput.trim()
    if (!cmd || executing) return

    // Clear built-in
    if (cmd === 'clear') {
      setTerminalHistory([])
      setTerminalInput('')
      return
    }

    const newHistory = [...terminalHistory, { type: 'input', cmd, cwd }]
    setTerminalHistory(newHistory)
    setCmdHistory((prev) => [cmd, ...prev])
    setHistoryIdx(-1)
    setTerminalInput('')
    setExecuting(true)

    try {
      const res = await api.post('/ssh/exec', {
        command: cmd,
        cwd: cwd
      })
      const { stdout, stderr, exit_code, cwd: newCwd } = res.data
      setCwd(newCwd || '')
      setTerminalHistory((prev) => [
        ...prev,
        {
          type: 'output',
          stdout,
          stderr,
          exit_code
        }
      ])
    } catch (err) {
      const errDetail = err.response?.data?.detail || err.message || 'Kesalahan eksekusi'
      setTerminalHistory((prev) => [
        ...prev,
        {
          type: 'output',
          stdout: '',
          stderr: `bash: ${errDetail}\n`,
          exit_code: 1
        }
      ])
    } finally {
      setExecuting(false)
      setTimeout(() => terminalInputRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (cmdHistory.length > 0 && historyIdx < cmdHistory.length - 1) {
        const nextIdx = historyIdx + 1
        setHistoryIdx(nextIdx)
        setTerminalInput(cmdHistory[nextIdx])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIdx > 0) {
        const prevIdx = historyIdx - 1
        setHistoryIdx(prevIdx)
        setTerminalInput(cmdHistory[prevIdx])
      } else if (historyIdx === 0) {
        setHistoryIdx(-1)
        setTerminalInput('')
      }
    }
  }

  const currentHost = sshInfo?.host || defaultSubdomain
  const currentPort = sshInfo?.port || 22
  const currentSshCmd = sshInfo?.ssh_command || defaultCommand
  const currentSshIpCmd = sshInfo?.ssh_command_ip || defaultCommandIp
  const currentSftpCmd = sshInfo?.sftp_command || defaultSftpCommand

  return (
    <div className="space-y-6 animate-in fade-in duration-200 w-full">
      {/* Top Header Halaman Konsisten */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DECDBD]">
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="p-2.5 rounded-2xl bg-[#2B1810] hover:bg-[#3E2316] border border-[#4D2D1E] text-[#E8DCB8] hover:text-white transition shadow-md flex items-center justify-center shrink-0 group"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="h-4 w-4 text-[#C49767] group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-2xl font-serif font-bold text-[#26160F] flex items-center space-x-2.5">
                <ShieldCheck className="h-6 w-6 text-[#5A3521]" />
                <span>Akses SSH & Sandbox</span>
              </h2>
            </div>
            <p className="text-xs text-[#5C3B29] font-sans mt-0.5">
              Koneksi Secure Shell (SSH) & SFTP mandiri terisolasi per akun dengan dedicated subdomain resmi ({defaultSubdomain}).
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={fetchSSHInfo}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#2B1810] hover:bg-[#3D2316] border border-[#4D2D1E] text-xs font-semibold text-[#E8DCB8] hover:text-white transition shadow-sm"
          >
            <RotateCcw className={`h-3.5 w-3.5 text-[#C49767] ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation (Pill Style Konsisten MiraiGrid Dark) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('connect')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
            activeTab === 'connect'
              ? 'bg-[#2B1810] text-[#FAF5EC] shadow-md border border-[#4D2D1E] ring-1 ring-amber-500/30'
              : 'bg-[#24130C] hover:bg-[#2B1810] text-[#DFCDB5] hover:text-[#FAF5EC] border border-[#3E2316] shadow-sm'
          }`}
        >
          <Server className="h-3.5 w-3.5 text-amber-300" />
          <span>Kredensial & Koneksi Native</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('terminal')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
            activeTab === 'terminal'
              ? 'bg-[#2B1810] text-[#FAF5EC] shadow-md border border-[#4D2D1E] ring-1 ring-emerald-500/30'
              : 'bg-[#24130C] hover:bg-[#2B1810] text-[#DFCDB5] hover:text-[#FAF5EC] border border-[#3E2316] shadow-sm'
          }`}
        >
          <TerminalIcon className="h-3.5 w-3.5 text-emerald-400" />
          <span>Web Terminal Sandbox</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('guide')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
            activeTab === 'guide'
              ? 'bg-[#2B1810] text-[#FAF5EC] shadow-md border border-[#4D2D1E] ring-1 ring-amber-500/30'
              : 'bg-[#24130C] hover:bg-[#2B1810] text-[#DFCDB5] hover:text-[#FAF5EC] border border-[#3E2316] shadow-sm'
          }`}
        >
          <Package className="h-3.5 w-3.5 text-amber-300" />
          <span>Panduan Dependencies (NPM / Composer / PIP)</span>
        </button>
      </div>

      {/* TAB 1: KREDENSIAL & QUICK CONNECT */}
      {activeTab === 'connect' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Credentials Card (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#2B1810] rounded-3xl border border-[#3E2316] p-6 text-[#FAF5EC] shadow-md space-y-6">
              <div className="flex items-center justify-between border-b border-[#3E2316] pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-2xl bg-[#422216] border border-[#C49767]/30 text-amber-300">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#FAF5EC]">Parameter Otentikasi SSH</h3>
                    <p className="text-xs text-[#DFCDB5]">Gunakan kredensial berikut pada aplikasi Terminal, VS Code Remote, atau PuTTY</p>
                  </div>
                </div>
                <span className="font-mono text-xs text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                  Port 22 (SSH)
                </span>
              </div>

              {/* Grid of parameters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dedicated Subdomain */}
                <div className="bg-[#1C0F0A] p-4 rounded-2xl border border-[#3E2316] space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[#A47E65]">
                    <span className="font-medium">Subdomain Host</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentHost, 'host', 'Host Subdomain')}
                      className="p-1 hover:text-[#FAF5EC] text-[#A47E65] rounded transition"
                      title="Salin Host"
                    >
                      {copiedKey === 'host' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <div className="font-mono text-sm text-amber-300 font-semibold break-all">
                    {currentHost}
                  </div>
                  <div className="text-[10px] text-[#A47E65]">Infrastruktur ingress resmi MiraiGrid</div>
                </div>

                {/* Shared IP Address */}
                <div className="bg-[#1C0F0A] p-4 rounded-2xl border border-[#3E2316] space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[#A47E65]">
                    <span className="font-medium">Shared IP Publik</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('76.76.76.189', 'ip', 'IP Publik')}
                      className="p-1 hover:text-[#FAF5EC] text-[#A47E65] rounded transition"
                      title="Salin IP"
                    >
                      {copiedKey === 'ip' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <div className="font-mono text-sm text-[#FAF5EC] font-semibold">
                    76.76.76.189
                  </div>
                  <div className="text-[10px] text-[#A47E65]">Alamat IP publik gateway praktikum</div>
                </div>

                {/* Username */}
                <div className="bg-[#1C0F0A] p-4 rounded-2xl border border-[#3E2316] space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[#A47E65]">
                    <span className="font-medium">Username SSH / NIM</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(username, 'user', 'Username')}
                      className="p-1 hover:text-[#FAF5EC] text-[#A47E65] rounded transition"
                      title="Salin Username"
                    >
                      {copiedKey === 'user' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <div className="font-mono text-sm text-[#E8DCB8] font-bold">
                    {username}
                  </div>
                  <div className="text-[10px] text-[#A47E65]">UID terisolasi sandbox (GID 100)</div>
                </div>

                {/* Password Notice */}
                <div className="bg-[#1C0F0A] p-4 rounded-2xl border border-[#3E2316] space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[#A47E65]">
                    <span className="font-medium">Password SSH</span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 hover:text-[#FAF5EC] text-[#A47E65] rounded transition"
                      title={showPassword ? 'Sembunyikan' : 'Tampilkan petunjuk'}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <div className="font-mono text-sm text-emerald-400 font-semibold flex items-center space-x-1.5">
                    <Lock className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{showPassword ? 'Password Akun MiraiGrid' : '••••••••••••'}</span>
                  </div>
                  <div className="text-[10px] text-[#A47E65]">Sama persis dengan kata sandi login Anda</div>
                </div>
              </div>

              {/* One-Click Commands Section */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#A47E65]">
                  Perintah Akses Cepat (One-Click Copy)
                </h4>

                {/* Subdomain Command (Recommended) */}
                <div className="bg-[#1C0F0A] p-4 rounded-2xl border border-[#3E2316] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        REKOMENDASI (SUBDOMAIN)
                      </span>
                      <span className="text-xs text-[#DFCDB5]">Akses remote via DNS Dedicated</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentSshCmd, 'cmd_sub', 'Perintah SSH Subdomain')}
                      className="flex items-center space-x-1 px-3 py-1 rounded-xl bg-[#422216] hover:bg-[#522B1C] text-amber-300 text-xs font-medium border border-[#C49767]/30 transition"
                    >
                      {copiedKey === 'cmd_sub' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedKey === 'cmd_sub' ? 'Tersalin' : 'Salin Perintah'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-xs sm:text-sm text-[#FAF5EC] bg-[#24130C] p-3 rounded-xl border border-[#3E2316] overflow-x-auto select-all">
                    {currentSshCmd}
                  </pre>
                </div>

                {/* IP Command (Direct) */}
                <div className="bg-[#1C0F0A] p-4 rounded-2xl border border-[#3E2316] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-700/50 text-[#DFCDB5] border border-stone-600/30">
                        ALTERNATIF (IP PUBLIK)
                      </span>
                      <span className="text-xs text-[#DFCDB5]">Akses langsung menggunakan alamat IP</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentSshIpCmd, 'cmd_ip', 'Perintah SSH IP')}
                      className="flex items-center space-x-1 px-3 py-1 rounded-xl bg-[#361E14] hover:bg-[#422216] text-[#E8DCB8] text-xs font-medium border border-[#3E2316] transition"
                    >
                      {copiedKey === 'cmd_ip' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedKey === 'cmd_ip' ? 'Tersalin' : 'Salin Perintah'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-xs sm:text-sm text-[#E8DCB8] bg-[#24130C] p-3 rounded-xl border border-[#3E2316] overflow-x-auto select-all">
                    {currentSshIpCmd}
                  </pre>
                </div>

                {/* SFTP Command */}
                <div className="bg-[#1C0F0A] p-4 rounded-2xl border border-[#3E2316] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        SFTP FILE TRANSFER
                      </span>
                      <span className="text-xs text-[#DFCDB5]">FileZilla / WinSCP / Cyberduck / CLI</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentSftpCmd, 'cmd_sftp', 'Perintah SFTP')}
                      className="flex items-center space-x-1 px-3 py-1 rounded-xl bg-[#361E14] hover:bg-[#422216] text-[#E8DCB8] text-xs font-medium border border-[#3E2316] transition"
                    >
                      {copiedKey === 'cmd_sftp' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedKey === 'cmd_sftp' ? 'Tersalin' : 'Salin Perintah'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-xs sm:text-sm text-emerald-300 bg-[#24130C] p-3 rounded-xl border border-[#3E2316] overflow-x-auto select-all">
                    {currentSftpCmd}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Security & Environment Cards */}
          <div className="space-y-6">
            {/* Security Isolation Guarantee */}
            <div className="bg-[#2B1810] rounded-3xl border border-[#3E2316] p-6 text-[#FAF5EC] shadow-md space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h4 className="font-serif font-bold text-base text-[#FAF5EC]">Proteksi Keamanan Jail</h4>
              </div>

              <div className="space-y-3 text-xs text-[#DFCDB5]">
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#FAF5EC] block">Root System Read-Only</strong>
                    Direktori <code className="font-mono text-amber-300">/usr</code>, <code className="font-mono text-amber-300">/etc</code>, dan <code className="font-mono text-amber-300">/opt</code> dimount write-protected. Menghilangkan risiko korupsi sistem operasi.
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#FAF5EC] block">Isolasi User & Masking</strong>
                    Folder <code className="font-mono text-amber-300">/home</code> privat: akun lain tidak terlihat di filesystem. File sensitif <code className="font-mono text-amber-300">/etc/shadow</code> dimasking ke <code className="font-mono text-[#A47E65]">/dev/null</code>.
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#FAF5EC] block">Perintah Berbahaya Dinonaktifkan</strong>
                    Perintah <code className="font-mono text-rose-400">reboot</code>, <code className="font-mono text-rose-400">shutdown</code>, <code className="font-mono text-rose-400">sudo</code>, dan <code className="font-mono text-rose-400">docker</code> dilumpuhkan ke <code className="font-mono">/bin/false</code>.
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#FAF5EC] block">Alokasi Resource cgroups v2</strong>
                    RAM ({sshInfo?.quota?.ram_mb || 256} MB), Storage ({sshInfo?.quota?.storage_mb || 500} MB), dan CPU ({sshInfo?.quota?.cpu_cores || 0.5} Cores) dibatasi ketat agar server tidak overload.
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-[#2B1810] rounded-3xl border border-[#3E2316] p-6 text-[#FAF5EC] shadow-md space-y-4">
              <h4 className="font-serif font-bold text-sm text-[#FAF5EC]">Aksi Cepat Manajemen</h4>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('terminal')}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-[#1C0F0A] hover:bg-[#361E14] border border-[#3E2316] transition text-left"
                >
                  <div className="flex items-center space-x-3">
                    <TerminalIcon className="h-4 w-4 text-emerald-400" />
                    <div>
                      <span className="text-xs font-semibold text-[#FAF5EC] block">Buka Web Terminal</span>
                      <span className="text-[10px] text-[#A47E65]">Eksekusi perintah langsung di browser</span>
                    </div>
                  </div>
                  <Play className="h-3.5 w-3.5 text-[#C49767]" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('/files')}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-[#1C0F0A] hover:bg-[#361E14] border border-[#3E2316] transition text-left"
                >
                  <div className="flex items-center space-x-3">
                    <FolderTree className="h-4 w-4 text-amber-300" />
                    <div>
                      <span className="text-xs font-semibold text-[#FAF5EC] block">Buka File Manager</span>
                      <span className="text-[10px] text-[#A47E65]">Lihat dependencies di /home/{username}</span>
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-[#C49767]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WEB TERMINAL SANDBOX */}
      {activeTab === 'terminal' && (
        <div className="space-y-4">
          <div className="bg-[#1C0F0A] rounded-3xl border border-[#3E2316] shadow-2xl overflow-hidden">
            {/* Terminal Top Bar */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#2B1810] border-b border-[#3E2316]">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="font-mono text-xs text-[#DFCDB5] ml-2">
                  {username}@miraigrid:{cwd ? `~/${cwd}` : '~'}$
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setTerminalHistory([])}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#1C0F0A] text-[#A47E65] hover:text-[#FAF5EC] text-xs transition border border-[#3E2316]"
                  title="Bersihkan Layar"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            <div
              ref={terminalScrollRef}
              onClick={() => terminalInputRef.current?.focus()}
              className="p-5 font-mono text-xs sm:text-sm text-[#FAF5EC] min-h-[420px] max-h-[560px] overflow-y-auto space-y-2 cursor-text"
            >
              <div className="text-[#A47E65] text-xs pb-2 border-b border-[#3E2316]/50">
                MiraiGrid Dedicated SSH Terminal Sandbox v2.5 ({username})<br />
                Ketik <span className="text-amber-300">help</span> untuk daftar perintah, atau gunakan package manager Anda.
              </div>

              {terminalHistory.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  {item.type === 'input' && (
                    <div className="flex items-center space-x-2 text-emerald-400">
                      <span className="text-amber-300 select-none">{username}@miraigrid:{item.cwd ? `~/${item.cwd}` : '~'}$</span>
                      <span className="text-[#FAF5EC]">{item.cmd}</span>
                    </div>
                  )}
                  {item.type === 'output' && (
                    <div className="pl-4">
                      {item.stdout && (
                        <pre className="text-[#DFCDB5] whitespace-pre-wrap font-mono leading-relaxed">
                          {item.stdout}
                        </pre>
                      )}
                      {item.stderr && (
                        <pre className="text-rose-400 whitespace-pre-wrap font-mono leading-relaxed">
                          {item.stderr}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {executing && (
                <div className="flex items-center space-x-2 text-amber-300 pl-4 py-1">
                  <span className="animate-spin text-sm">⏳</span>
                  <span className="text-xs">Mengeksekusi perintah di sandbox...</span>
                </div>
              )}

              {/* Input Prompt */}
              <form onSubmit={handleExecuteCommand} className="flex items-center space-x-2 pt-1">
                <span className="text-amber-300 select-none shrink-0 font-bold">
                  {username}@miraigrid:{cwd ? `~/${cwd}` : '~'}$
                </span>
                <input
                  ref={terminalInputRef}
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={executing}
                  placeholder="Ketik perintah (contoh: ls -la, node -v, npm install, python3 -V)..."
                  className="flex-1 bg-transparent text-[#FAF5EC] focus:outline-none font-mono text-xs sm:text-sm placeholder-[#A47E65]/50 caret-amber-400"
                  autoFocus
                />
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PANDUAN DEPENDENCIES ISOLATION */}
      {activeTab === 'guide' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Node.js / NPM Card */}
          <div className="bg-[#2B1810] rounded-3xl border border-[#3E2316] p-6 text-[#FAF5EC] shadow-md space-y-4">
            <div className="flex items-center space-x-3 border-b border-[#3E2316] pb-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Code className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-base text-[#FAF5EC]">Node.js & NPM</h4>
                <span className="text-[10px] text-[#A47E65] font-mono">~/.npm-global/bin</span>
              </div>
            </div>
            <p className="text-xs text-[#DFCDB5] leading-relaxed">
              Saat Anda menjalankan <code className="font-mono text-amber-300">npm install -g</code>, modul global otomatis masuk ke direktori <code className="font-mono text-amber-300">/home/{username}/.npm-global</code> dan binary langsung dapat dieksekusi.
            </p>
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-semibold uppercase text-[#A47E65]">Contoh Perintah:</span>
              <pre className="font-mono text-xs text-[#FAF5EC] bg-[#1C0F0A] p-2.5 rounded-xl border border-[#3E2316] select-all">
                npm install express dotenv
              </pre>
              <pre className="font-mono text-xs text-amber-300 bg-[#1C0F0A] p-2.5 rounded-xl border border-[#3E2316] select-all">
                npm install -g nodemon
              </pre>
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center space-x-1 pt-1">
              <Check className="h-3.5 w-3.5" />
              <span>Langsung muncul di File Manager</span>
            </div>
          </div>

          {/* PHP / Composer Card */}
          <div className="bg-[#2B1810] rounded-3xl border border-[#3E2316] p-6 text-[#FAF5EC] shadow-md space-y-4">
            <div className="flex items-center space-x-3 border-b border-[#3E2316] pb-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-base text-[#FAF5EC]">PHP & Composer</h4>
                <span className="text-[10px] text-[#A47E65] font-mono">~/.composer</span>
              </div>
            </div>
            <p className="text-xs text-[#DFCDB5] leading-relaxed">
              Composer dikonfigurasi terisolasi per akun. Folder <code className="font-mono text-amber-300">vendor/</code> dan file <code className="font-mono text-amber-300">composer.json</code> dibuat di dalam folder aplikasi web Anda di File Manager.
            </p>
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-semibold uppercase text-[#A47E65]">Contoh Perintah:</span>
              <pre className="font-mono text-xs text-[#FAF5EC] bg-[#1C0F0A] p-2.5 rounded-xl border border-[#3E2316] select-all">
                composer require vlucas/phpdotenv
              </pre>
              <pre className="font-mono text-xs text-amber-300 bg-[#1C0F0A] p-2.5 rounded-xl border border-[#3E2316] select-all">
                composer init
              </pre>
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center space-x-1 pt-1">
              <Check className="h-3.5 w-3.5" />
              <span>Terisolasi per ruang kerja mahasiswa</span>
            </div>
          </div>

          {/* Python / PIP Card */}
          <div className="bg-[#2B1810] rounded-3xl border border-[#3E2316] p-6 text-[#FAF5EC] shadow-md space-y-4">
            <div className="flex items-center space-x-3 border-b border-[#3E2316] pb-3">
              <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-base text-[#FAF5EC]">Python & Virtualenv</h4>
                <span className="text-[10px] text-[#A47E65] font-mono">~/.local & venv</span>
              </div>
            </div>
            <p className="text-xs text-[#DFCDB5] leading-relaxed">
              Anda dapat menginstal package Python menggunakan opsi <code className="font-mono text-amber-300">pip install --user</code> atau membuat virtual environment mandiri di folder proyek Anda.
            </p>
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-semibold uppercase text-[#A47E65]">Contoh Perintah:</span>
              <pre className="font-mono text-xs text-[#FAF5EC] bg-[#1C0F0A] p-2.5 rounded-xl border border-[#3E2316] select-all">
                python3 -m venv venv
              </pre>
              <pre className="font-mono text-xs text-amber-300 bg-[#1C0F0A] p-2.5 rounded-xl border border-[#3E2316] select-all">
                pip install --user requests fastapi
              </pre>
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center space-x-1 pt-1">
              <Check className="h-3.5 w-3.5" />
              <span>Tidak menyentuh Python core OS</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
