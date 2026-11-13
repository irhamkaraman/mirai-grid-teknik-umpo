import React, { useState, useEffect, useRef } from 'react'
import {
  Terminal as TerminalIcon,
  ArrowLeft,
  Trash2,
  RotateCcw,
  Shield,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { useTheme } from '../context/ThemeContext'
import Button from '../components/Button'

export default function TerminalPage({ user, onNavigate }) {
  const { isV2 } = useTheme()
  const [history, setHistory] = useState([])
  const [inputVal, setInputVal] = useState('')
  const [cmdHistory, setCmdHistory] = useState([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [cwd, setCwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [serverIp, setServerIp] = useState('76.76.76.189')
  const [copied, setCopied] = useState(false)

  const inputRef = useRef(null)
  const bottomRef = useRef(null)
  const containerRef = useRef(null)
  const scrollRef = useRef(null)

  const username = user?.username || 'user'

  useEffect(() => {
    // Detect IP / hostname
    const host = window.location.hostname
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      setServerIp(host)
    }

    // Initial greeting: Clean terminal prompt directly (no banner text)
    setHistory([])

    // Focus input
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }, [user])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history, loading])

  const handleContainerClick = () => {
    // Only focus input if user is not selecting text to copy
    if (window.getSelection && window.getSelection().toString()) {
      return
    }
    inputRef.current?.focus()
  }

  const handleTabCompletion = async () => {
    try {
      const res = await api.post('/terminal/autocomplete', {
        command: inputVal,
        cwd: cwd
      })
      const { matches, common_prefix, token, has_multiple } = res.data

      if (!matches || matches.length === 0) {
        return
      }

      if (matches.length === 1) {
        // Single match: auto-complete inline
        const match = matches[0]
        let newInput = inputVal
        if (token) {
          newInput = inputVal.slice(0, inputVal.length - token.length) + match
        } else {
          newInput = inputVal + match
        }
        setInputVal(newInput)
      } else if (has_multiple) {
        // Multiple matches: complete common prefix if longer, and print candidates
        let newInput = inputVal
        if (common_prefix && common_prefix.length > token.length) {
          newInput = inputVal.slice(0, inputVal.length - token.length) + common_prefix
          setInputVal(newInput)
        }
        setHistory((prev) => [
          ...prev,
          {
            type: 'cmd',
            prompt: `${username}@${serverIp} $ `,
            cmd: inputVal
          },
          {
            type: 'stdout',
            content: matches.join('    ') + '\n'
          }
        ])
      }
    } catch (err) {
      console.warn('Tab completion error:', err)
    } finally {
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const cmd = inputVal.trim()
    if (!cmd) return

    // Add to command history list for arrow-up navigation
    setCmdHistory((prev) => [...prev, cmd])
    setHistoryIdx(-1)
    setInputVal('')

    // Client-side built-in: clear
    if (cmd === 'clear') {
      setHistory([])
      return
    }

    // Add prompt line to visible output history
    setHistory((prev) => [
      ...prev,
      {
        type: 'cmd',
        prompt: `${username}@${serverIp} $ `,
        cmd: cmd
      }
    ])

    setLoading(true)
    try {
      const res = await api.post('/terminal/exec', {
        command: cmd,
        cwd: cwd
      })

      const data = res.data
      setCwd(data.cwd || '')

      const outputLines = []
      if (data.stdout) {
        outputLines.push({ type: 'stdout', content: data.stdout })
      }
      if (data.stderr) {
        outputLines.push({ type: 'stderr', content: data.stderr })
      }
      if (!data.stdout && !data.stderr && data.exit_code !== 0) {
        outputLines.push({
          type: 'stderr',
          content: `bash: Perintah gagal (exit code: ${data.exit_code})\n`
        })
      }

      setHistory((prev) => [...prev, ...outputLines])
    } catch (err) {
      let errMsg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Gagal mengeksekusi perintah.'
      if (typeof errMsg === 'object') {
        try { errMsg = JSON.stringify(errMsg) } catch { errMsg = 'Terjadi kesalahan sistem' }
      }
      setHistory((prev) => [
        ...prev,
        {
          type: 'stderr',
          content: `bash: ${errMsg}\n`
        }
      ])
    } finally {
      setLoading(false)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      handleTabCompletion()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (cmdHistory.length === 0) return
      const nextIdx = historyIdx === -1 ? cmdHistory.length - 1 : Math.max(0, historyIdx - 1)
      setHistoryIdx(nextIdx)
      setInputVal(cmdHistory[nextIdx] || '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (cmdHistory.length === 0 || historyIdx === -1) return
      const nextIdx = historyIdx + 1
      if (nextIdx >= cmdHistory.length) {
        setHistoryIdx(-1)
        setInputVal('')
      } else {
        setHistoryIdx(nextIdx)
        setInputVal(cmdHistory[nextIdx] || '')
      }
    }
  }

  const handleResetSession = () => {
    setCwd('')
    setHistory((prev) => [
      ...prev,
      {
        type: 'stdout',
        content: `[Session Reset] Direktori kerja dikembalikan ke ruang root sandbox (/home/${username}).\n`
      }
    ])
    toast.success('Session terminal direset ke direktori awal.')
  }

  const handleCopyHistory = () => {
    const text = history
      .map((item) => {
        if (item.type === 'cmd') return `${item.prompt}${item.cmd}`
        return item.content
      })
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Log terminal berhasil disalin ke clipboard.')
  }

  if (isV2) {
    return (
      <div className="space-y-6 w-full animate-in fade-in duration-200 pb-12 font-sans">
        {/* Top Header Halaman Konsisten V2 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
          <div className="flex items-center space-x-3.5">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition shadow-xs flex items-center justify-center shrink-0 group"
              title="Kembali ke Dasbor"
            >
              <ArrowLeft className="h-4 w-4 text-slate-600 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-2xl font-sans font-bold text-slate-900 flex items-center space-x-2.5">
                  <TerminalIcon className="h-6 w-6 text-emerald-600" />
                  <span>Terminal Jail</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Sandboxed Cage
                </span>
              </div>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Command Line Interface (CLI) terisolasi mandiri per akun praktikum.
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={handleCopyHistory}
              title="Salin seluruh riwayat sesi"
            >
              {copied ? 'Tersalin' : 'Salin'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={RotateCcw}
              onClick={handleResetSession}
              title="Kembali ke root sandbox direktori awal"
            >
              Reset CWD
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => setHistory([])}
              title="Bersihkan layar terminal"
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Terminal Window Box */}
        <div
          ref={containerRef}
          onClick={handleContainerClick}
          className="bg-slate-950 border border-slate-800 rounded-xl shadow-xl overflow-hidden font-mono text-xs sm:text-sm text-slate-200 flex flex-col h-[560px] sm:h-[600px] lg:h-[calc(100vh-210px)] min-h-[460px] max-h-[720px] cursor-text select-text"
        >
          {/* Terminal Window Titlebar */}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 select-none shrink-0">
            <div className="flex items-center space-x-2">
              <span className="h-3 w-3 rounded-full bg-rose-500/80 border border-rose-600 inline-block"></span>
              <span className="h-3 w-3 rounded-full bg-amber-500/80 border border-amber-600 inline-block"></span>
              <span className="h-3 w-3 rounded-full bg-emerald-500/80 border border-emerald-600 inline-block"></span>
              <span className="text-xs text-slate-300 font-sans font-semibold ml-2">
                bash — {username}@{serverIp}
              </span>
            </div>
            <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
              <span className="hidden sm:inline text-slate-500">Scrollable Buffer</span>
              <span className="text-emerald-400">Strict Account Jail</span>
            </div>
          </div>

          {/* Scrollable Terminal Output */}
          <div
            ref={scrollRef}
            className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-2 overscroll-contain focus:outline-none"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#334155 #020617'
            }}
          >
            {history.map((item, idx) => {
              if (item.type === 'banner') {
                return (
                  <pre
                    key={idx}
                    className="text-amber-300 font-mono text-xs whitespace-pre-wrap leading-relaxed py-1"
                  >
                    {item.content}
                  </pre>
                )
              }
              if (item.type === 'cmd') {
                return (
                  <div key={idx} className="flex items-baseline space-x-1 py-0.5">
                    <span className="text-emerald-400 font-bold select-none shrink-0 font-mono">
                      {item.prompt}
                    </span>
                    <span className="text-white font-semibold break-all">
                      {item.cmd}
                    </span>
                  </div>
                )
              }
              if (item.type === 'stdout') {
                return (
                  <pre
                    key={idx}
                    className="text-slate-200 font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed pl-1"
                  >
                    {item.content}
                  </pre>
                )
              }
              if (item.type === 'stderr') {
                return (
                  <pre
                    key={idx}
                    className="text-rose-400 font-bold font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed pl-1"
                  >
                    {item.content}
                  </pre>
                )
              }
              return null
            })}

            {/* Active Prompt & Input Line */}
            <form onSubmit={handleSubmit} className="flex items-baseline space-x-1 pt-1">
              <span className="text-emerald-400 font-bold select-none shrink-0 font-mono">
                {username}@{serverIp} $
              </span>
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  id="terminal-input"
                  data-testid="terminal-input"
                  name="terminal-input"
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full bg-transparent text-white font-mono text-xs sm:text-sm outline-none border-none p-0 focus:ring-0 leading-normal"
                />
              </div>
              {loading && (
                <span className="text-xs text-amber-400 font-mono animate-pulse shrink-0">
                  menjalankan...
                </span>
              )}
            </form>

            <div ref={bottomRef} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-200 pb-12 font-sans">
      {/* Top Header Halaman Konsisten */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DECDBD]">
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="p-2.5 rounded-2xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#5A3521] hover:text-[#26160F] transition shadow-sm flex items-center justify-center shrink-0 group"
            title="Kembali ke Dasbor"
          >
            <ArrowLeft className="h-4 w-4 text-[#5A3521] group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-2xl font-serif font-bold text-[#26160F] flex items-center space-x-2.5">
                <TerminalIcon className="h-6 w-6 text-[#5A3521]" />
                <span>Terminal™</span>
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#DECDBD] text-[#5A3521] border border-[#BFAB96]">
                Sandboxed Cage
              </span>
            </div>
            <p className="text-xs text-[#5C3B29] font-sans mt-0.5">
              Command Line Interface (CLI) terisolasi mandiri per akun praktikum.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopyHistory}
            className="px-3.5 py-2 rounded-xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] border border-[#BFAB96] text-xs font-semibold transition shadow-sm flex items-center space-x-1.5"
            title="Salin seluruh riwayat sesi"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-[#5A3521]" />}
            <span>{copied ? 'Tersalin' : 'Salin'}</span>
          </button>
          <button
            type="button"
            onClick={handleResetSession}
            className="px-3.5 py-2 rounded-xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] border border-[#BFAB96] text-xs font-semibold transition shadow-sm flex items-center space-x-1.5"
            title="Kembali ke root sandbox direktori awal"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#5A3521]" />
            <span>Reset CWD</span>
          </button>
          <button
            type="button"
            onClick={() => setHistory([])}
            className="px-3.5 py-2 rounded-xl bg-[#2B1810] hover:bg-[#3D2317] border border-[#4D2D1E] text-xs font-semibold text-rose-300 hover:text-white transition shadow-sm flex items-center space-x-1.5"
            title="Bersihkan layar terminal"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Terminal Window Box ala Desktop Console: Fixed Height & Internal Scroll */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className="bg-[#120906] border border-[#4D2D1E] rounded-3xl shadow-2xl overflow-hidden font-mono text-xs sm:text-sm text-[#DFCDB5] flex flex-col h-[560px] sm:h-[600px] lg:h-[calc(100vh-210px)] min-h-[460px] max-h-[720px] cursor-text select-text"
      >
        {/* Terminal Window Titlebar */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#1B0D08] border-b border-[#3D2316] select-none shrink-0">
          <div className="flex items-center space-x-2">
            <span className="h-3 w-3 rounded-full bg-[#5C2317] border border-[#7A3322] inline-block"></span>
            <span className="h-3 w-3 rounded-full bg-[#6E4B1B] border border-[#8C6226] inline-block"></span>
            <span className="h-3 w-3 rounded-full bg-[#2B542C] border border-[#3E733F] inline-block"></span>
            <span className="text-xs text-[#A47E65] font-sans font-semibold ml-2">
              bash — {username}@{serverIp}
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px] font-mono text-[#A47E65]">
            <span className="hidden sm:inline text-[#7A5A43]">Scrollable Buffer</span>
            <span>Strict Account Jail</span>
          </div>
        </div>

        {/* Scrollable Terminal Output with Custom Dark Scrollbar */}
        <div
          ref={scrollRef}
          className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-2 overscroll-contain focus:outline-none"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#4D2D1E #140A07'
          }}
        >
          {history.map((item, idx) => {
            if (item.type === 'banner') {
              return (
                <pre
                  key={idx}
                  className="text-amber-300/80 font-mono text-xs whitespace-pre-wrap leading-relaxed py-1"
                >
                  {item.content}
                </pre>
              )
            }
            if (item.type === 'cmd') {
              return (
                <div key={idx} className="flex items-baseline space-x-1 py-0.5">
                  <span className="text-emerald-400 font-bold select-none shrink-0 font-mono">
                    {item.prompt}
                  </span>
                  <span className="text-[#FAF5EC] font-semibold break-all">
                    {item.cmd}
                  </span>
                </div>
              )
            }
            if (item.type === 'stdout') {
              return (
                <pre
                  key={idx}
                  className="text-[#DFCDB5] font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed pl-1"
                >
                  {item.content}
                </pre>
              )
            }
            if (item.type === 'stderr') {
              return (
                <pre
                  key={idx}
                  className="text-rose-400 font-bold font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed pl-1"
                >
                  {item.content}
                </pre>
              )
            }
            return null
          })}

          {/* Active Prompt & Input Line */}
          <form onSubmit={handleSubmit} className="flex items-baseline space-x-1 pt-1">
            <span className="text-emerald-400 font-bold select-none shrink-0 font-mono">
              {username}@{serverIp} $
            </span>
            <div className="relative flex-1">
              <input
                ref={inputRef}
                id="terminal-input"
                data-testid="terminal-input"
                name="terminal-input"
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                className="w-full bg-transparent text-[#FAF5EC] font-mono text-xs sm:text-sm outline-none border-none p-0 focus:ring-0 leading-normal"
              />
            </div>
            {loading && (
              <span className="text-xs text-amber-400 font-mono animate-pulse shrink-0">
                menjalankan...
              </span>
            )}
          </form>

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
