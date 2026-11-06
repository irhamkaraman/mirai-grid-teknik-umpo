import React, { useEffect, useRef, useState } from 'react'
import { Terminal as TerminalIcon, ArrowLeft, RefreshCw, Play, Square, Shield } from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner } from '../components/Skeletons'

export default function ConsolePage({ project, onBack }) {
  const terminalRef = useRef(null)
  const termInstance = useRef(null)
  const fitAddonRef = useRef(null)

  // Connection settings
  const [command, setCommand] = useState('/bin/sh')
  const [useCustom, setUseCustom] = useState(false)
  const [customCommand, setCustomCommand] = useState('')
  const [user, setUser] = useState('root')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Critical Refs to completely bypass React Stale Closure traps inside xterm.onData
  const connectedRef = useRef(false)
  const commandRef = useRef('/bin/sh')
  const useCustomRef = useRef(false)
  const customCommandRef = useRef('')
  const userRef = useRef('root')

  // Keep refs synchronized with state
  useEffect(() => {
    connectedRef.current = connected
  }, [connected])

  useEffect(() => {
    commandRef.current = command
  }, [command])

  useEffect(() => {
    useCustomRef.current = useCustom
  }, [useCustom])

  useEffect(() => {
    customCommandRef.current = customCommand
  }, [customCommand])

  useEffect(() => {
    userRef.current = user
  }, [user])

  // Terminal state buffers
  const currentLineRef = useRef('')
  const historyRef = useRef([])
  const historyIndexRef = useRef(-1)
  const isExecutingRef = useRef(false)
  const cwdRef = useRef('/var/www/html')

  useEffect(() => {
    if (!termInstance.current && terminalRef.current) {
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.3,
        theme: {
          background: '#180E09', // Deep Dark Chocolate
          foreground: '#FAF5EC', // Pure Cream
          cursor: '#E8DCB8',     // Warm Latte
          cursorAccent: '#180E09',
          selectionBackground: '#5A3521',
          selectionForeground: '#FFFFFF',
          black: '#180E09',
          red: '#E06C75',
          green: '#98C379',
          yellow: '#E5C07B',
          blue: '#C49767',
          magenta: '#D97757',
          cyan: '#56B6C2',
          white: '#FAF5EC',
          brightBlack: '#5C3825',
          brightRed: '#E88388',
          brightGreen: '#A9D18E',
          brightYellow: '#E8D49E',
          brightBlue: '#DFC6AF',
          brightMagenta: '#E58A6C',
          brightCyan: '#70D6E3',
          brightWhite: '#FFFFFF',
        },
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(terminalRef.current)
      setTimeout(() => {
        try {
          fitAddon.fit()
        } catch (e) {}
      }, 100)

      termInstance.current = term
      fitAddonRef.current = fitAddon

      // Handle window resize
      const handleResize = () => {
        try {
          fitAddon.fit()
        } catch (e) {}
      }
      window.addEventListener('resize', handleResize)

      // Key Listener for Terminal Emulation
      term.onData((data) => {
        handleTerminalInput(data, term)
      })

      // Welcome Banner in Xterm
      printBanner(term)

      return () => {
        window.removeEventListener('resize', handleResize)
        term.dispose()
        termInstance.current = null
      }
    }
  }, [])

  const printBanner = (term) => {
    term.writeln('\x1b[1;33m  __  __ _           _  ____      _     _ \x1b[0m')
    term.writeln('\x1b[1;33m |  \\/  (_)_ __ __ _(_)/ ___|_ __(_) __| |\x1b[0m')
    term.writeln('\x1b[1;33m | |\\/| | | \'__/ _` | | |  _| \'__| |/ _` |\x1b[0m')
    term.writeln('\x1b[1;33m | |  | | | | | (_| | | |_| | |  | | (_| |\x1b[0m')
    term.writeln('\x1b[1;33m |_|  |_|_|_|  \\__,_|_|\\____|_|  |_|\\__,_|\x1b[0m')
    term.writeln('\x1b[2m  Lab Teknik Informatika UMPO — Container Console\x1b[0m\r\n')
    term.writeln('\x1b[36mKlik tombol "Connect" di atas untuk menghubungkan sesi CLI ke container.\x1b[0m\r\n')
  }

  const printPrompt = (term) => {
    const u = userRef.current || 'root'
    const shortCwd = cwdRef.current.length > 25 ? '...' + cwdRef.current.slice(-22) : cwdRef.current
    term.write(`\r\n\x1b[1;32m${u}@${project.name}\x1b[0m:\x1b[1;34m${shortCwd}\x1b[0m# `)
  }

  // Handle Keystrokes & Shortcuts (Using Refs, NEVER blocked by closures!)
  const handleTerminalInput = (data, term) => {
    if (!connectedRef.current) {
      term.writeln('\r\n\x1b[1;33m[PERINGATAN] Terminal belum terhubung. Klik tombol "Connect" di atas terlebih dahulu.\x1b[0m')
      return
    }

    if (isExecutingRef.current) return

    const charCode = data.charCodeAt(0)

    // 1. Enter (Carriage Return)
    if (data === '\r') {
      const cmdToSend = currentLineRef.current.trim()
      term.write('\r\n')

      if (cmdToSend) {
        historyRef.current.push(cmdToSend)
        historyIndexRef.current = historyRef.current.length

        if (cmdToSend === 'clear') {
          term.clear()
          currentLineRef.current = ''
          printPrompt(term)
          return
        }

        executeCommand(cmdToSend, term)
      } else {
        printPrompt(term)
      }
      currentLineRef.current = ''
      return
    }

    // 2. Backspace
    if (data === '\x7F' || data === '\b') {
      if (currentLineRef.current.length > 0) {
        currentLineRef.current = currentLineRef.current.slice(0, -1)
        term.write('\b \b')
      }
      return
    }

    // 3. Ctrl + C (SIGINT / Cancel)
    if (charCode === 3) {
      term.write('^C\r\n')
      currentLineRef.current = ''
      printPrompt(term)
      return
    }

    // 4. Ctrl + L (Clear Screen)
    if (charCode === 12) {
      term.clear()
      printPrompt(term)
      term.write(currentLineRef.current)
      return
    }

    // 5. Ctrl + U (Clear line)
    if (charCode === 21) {
      while (currentLineRef.current.length > 0) {
        currentLineRef.current = currentLineRef.current.slice(0, -1)
        term.write('\b \b')
      }
      return
    }

    // 6. Arrow Up (History Previous)
    if (data === '\x1b[A') {
      if (historyRef.current.length > 0 && historyIndexRef.current > 0) {
        historyIndexRef.current -= 1
        const prevCmd = historyRef.current[historyIndexRef.current]
        while (currentLineRef.current.length > 0) {
          term.write('\b \b')
          currentLineRef.current = currentLineRef.current.slice(0, -1)
        }
        currentLineRef.current = prevCmd
        term.write(prevCmd)
      }
      return
    }

    // 7. Arrow Down (History Next)
    if (data === '\x1b[B') {
      if (historyRef.current.length > 0 && historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current += 1
        const nextCmd = historyRef.current[historyIndexRef.current]
        while (currentLineRef.current.length > 0) {
          term.write('\b \b')
          currentLineRef.current = currentLineRef.current.slice(0, -1)
        }
        currentLineRef.current = nextCmd
        term.write(nextCmd)
      } else {
        historyIndexRef.current = historyRef.current.length
        while (currentLineRef.current.length > 0) {
          term.write('\b \b')
          currentLineRef.current = currentLineRef.current.slice(0, -1)
        }
      }
      return
    }

    // 8. Tab Key (Insert 2 spaces)
    if (charCode === 9) {
      currentLineRef.current += '  '
      term.write('  ')
      return
    }

    // 9. Pasted Multi-character Text
    if (data.length > 1 && !data.startsWith('\x1b')) {
      currentLineRef.current += data
      term.write(data)
      return
    }

    // 10. Normal Printable Characters
    if (charCode >= 32 && charCode <= 126) {
      currentLineRef.current += data
      term.write(data)
    }
  }

  // Connect to Container
  const handleConnect = async (e) => {
    e?.preventDefault()
    setConnecting(true)
    const term = termInstance.current
    const execCmd = useCustomRef.current ? customCommandRef.current.trim() : commandRef.current

    try {
      const res = await api.post(`/projects/${project.id}/console/exec`, {
        command: execCmd || '/bin/sh',
        user: userRef.current || 'root',
        stdin_input: 'whoami && pwd && uname -sr'
      })

      connectedRef.current = true
      setConnected(true)

      const lines = (res.data.output || '').split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length >= 2) {
        cwdRef.current = lines[1]
      }

      term.writeln(`\x1b[1;32m✔ Connected to container: ${res.data.container}\x1b[0m`)
      term.writeln(`\x1b[36m  User: ${res.data.user} | Shell: ${res.data.command}\x1b[0m`)
      term.writeln(`\x1b[2m  Shortcuts: [Ctrl+C] Cancel, [Ctrl+L] Clear Screen, [Up/Down] History, [Tab] Indent\x1b[0m`)

      printPrompt(term)
      term.focus()
      toast.success('Console container berhasil terhubung!')
    } catch (err) {
      term.writeln(`\x1b[1;31m✖ Connection Error: ${err.response?.data?.detail || err.message}\x1b[0m`)
      toast.error('Gagal terhubung ke console container.')
    } finally {
      setConnecting(false)
    }
  }

  // Execute Command
  const executeCommand = async (cmd, term) => {
    isExecutingRef.current = true
    const execShell = useCustomRef.current ? customCommandRef.current.trim() : commandRef.current

    const fullInput = `cd ${cwdRef.current} 2>/dev/null; ${cmd}; echo "__MIRAIGRID_PWD__$(pwd)"`

    try {
      const res = await api.post(`/projects/${project.id}/console/exec`, {
        command: execShell || '/bin/sh',
        user: userRef.current || 'root',
        stdin_input: fullInput
      })

      let rawOutput = res.data.output || ''

      if (rawOutput.includes('__MIRAIGRID_PWD__')) {
        const parts = rawOutput.split('__MIRAIGRID_PWD__')
        rawOutput = parts[0]
        const newPwd = parts[1].split('\n')[0].trim()
        if (newPwd) {
          cwdRef.current = newPwd
        }
      }

      if (rawOutput) {
        const formatted = rawOutput.replace(/\r?\n/g, '\r\n')
        term.write(formatted)
        if (!formatted.endsWith('\r\n')) {
          term.write('\r\n')
        }
      }
    } catch (err) {
      term.writeln(`\x1b[1;31m${err.response?.data?.detail || 'Command execution error'}\x1b[0m`)
    } finally {
      isExecutingRef.current = false
      printPrompt(term)
    }
  }

  const handleDisconnect = () => {
    connectedRef.current = false
    setConnected(false)
    if (termInstance.current) {
      termInstance.current.writeln('\r\n\x1b[1;33m--- Disconnected from container session ---\x1b[0m\r\n')
    }
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Dedicated Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DECDBD]">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] transition shadow-sm cursor-pointer shrink-0"
            title="Kembali ke Daftar Aplikasi"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-2xl font-serif font-bold text-[#26160F] flex items-center space-x-2">
              <TerminalIcon className="h-6 w-6 text-[#5A3521]" />
              <span>Container Console: {project.name}</span>
            </h2>
            <p className="text-xs text-[#5C3B29] font-mono mt-0.5">
              Halaman CLI Interaktif — Mendukung shortcut keyboard (Ctrl+C, Ctrl+L, Arrow History).
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center space-x-2">
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold flex items-center space-x-1.5 ${
              connected
                ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30'
                : 'bg-[#DECDBD] text-[#5C3B29] border border-[#BFAB96]'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
            <span>{connected ? `CONNECTED (${user})` : 'DISCONNECTED'}</span>
          </span>
        </div>
      </div>

      {/* 2. Connection Settings Toolbar (Portainer Image 3 Style) */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-5 shadow-xl text-[#FAF5EC]">
        <form onSubmit={handleConnect} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          {/* Command Dropdown / Input */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#DFCDB5]">Command Shell</label>
              <button
                type="button"
                onClick={() => setUseCustom(!useCustom)}
                className="text-[10px] text-[#E8DCB8] hover:underline"
              >
                {useCustom ? 'Use preset (/bin/sh)' : 'Use custom command'}
              </button>
            </div>
            {!useCustom ? (
              <select
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                disabled={connected}
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767] disabled:opacity-50"
              >
                <option value="/bin/sh">/bin/sh (POSIX Shell)</option>
                <option value="/bin/bash">/bin/bash (GNU Bash)</option>
              </select>
            ) : (
              <input
                type="text"
                required
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                disabled={connected}
                placeholder="e.g. /bin/sh atau /bin/bash"
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767] disabled:opacity-50"
              />
            )}
          </div>

          {/* User */}
          <div>
            <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">User</label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              disabled={connected}
              placeholder="root"
              className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767] disabled:opacity-50"
            />
          </div>

          {/* Connect / Disconnect Buttons */}
          <div>
            {!connected ? (
              <button
                type="submit"
                disabled={connecting}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#FAF5EC] hover:bg-white text-[#2B1810] shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {connecting ? <Spinner size="xs" className="border-[#2B1810]" /> : <Play className="h-3.5 w-3.5" />}
                <span>Connect</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    if (termInstance.current) {
                      termInstance.current.clear()
                      printPrompt(termInstance.current)
                      termInstance.current.focus()
                    }
                  }}
                  className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] transition cursor-pointer"
                  title="Clear (Ctrl+L)"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* 3. Terminal Canvas (Click anywhere to focus!) */}
      <div
        onClick={() => termInstance.current?.focus()}
        className="bg-[#180E09] border-2 border-[#4D2D1E] rounded-3xl p-4 shadow-2xl overflow-hidden min-h-[520px] flex flex-col cursor-text"
      >
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#3E2316]/60 text-xs font-mono text-[#DFCDB5]/60 select-none">
          <span>TERMINAL • XTERM EMULATOR (KLIK UNTUK FOKUS KETIK)</span>
          <span>SHORTCUTS: CTRL+C (SIGINT) • CTRL+L (CLEAR) • UP/DOWN (HISTORY)</span>
        </div>
        <div ref={terminalRef} className="flex-1 w-full h-[460px] overflow-hidden" />
      </div>
    </div>
  )
}
