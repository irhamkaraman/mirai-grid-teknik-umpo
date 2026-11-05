import React, { useState } from 'react'
import { Terminal, ArrowRight, X, Play, RefreshCw, CornerDownLeft } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner } from './Skeletons'
import ModalPortal from './ModalPortal'

export default function ContainerConsole({ project, isOpen, onClose }) {
  const [command, setCommand] = useState('/bin/sh')
  const [useCustom, setUseCustom] = useState(false)
  const [customCommand, setCustomCommand] = useState('')
  const [user, setUser] = useState('root')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Interactive console state
  const [terminalHistory, setTerminalHistory] = useState([])
  const [currentInput, setCurrentInput] = useState('')
  const [executing, setExecuting] = useState(false)

  if (!isOpen) return null

  const handleConnect = async (e) => {
    e.preventDefault()
    setConnecting(true)
    const execCmd = useCustom ? customCommand.trim() : command

    try {
      // Test exec
      const res = await api.post(`/projects/${project.id}/console/exec`, {
        command: execCmd || '/bin/sh',
        user: user || 'root',
        stdin_input: 'whoami && pwd && uname -a'
      })
      setConnected(true)
      setTerminalHistory([
        { type: 'system', text: `Connected to container: app_${project.nim || 'student'}_${project.name}` },
        { type: 'system', text: `Session user: ${user || 'root'} | Shell: ${execCmd || '/bin/sh'}` },
        { type: 'output', text: res.data.output || '' }
      ])
      toast.success('Console terhubung!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal terhubung ke console container.')
    } finally {
      setConnecting(false)
    }
  }

  const handleSendInput = async (e) => {
    e.preventDefault()
    const inputCmd = currentInput.trim()
    if (!inputCmd || executing) return

    setExecuting(true)
    setCurrentInput('')
    const execShell = useCustom ? customCommand.trim() : command

    setTerminalHistory((prev) => [...prev, { type: 'input', text: `$ ${inputCmd}` }])

    try {
      const res = await api.post(`/projects/${project.id}/console/exec`, {
        command: execShell || '/bin/sh',
        user: user || 'root',
        stdin_input: inputCmd
      })
      setTerminalHistory((prev) => [
        ...prev,
        { type: 'output', text: res.data.output || '(No output)' }
      ])
    } catch (err) {
      setTerminalHistory((prev) => [
        ...prev,
        { type: 'error', text: err.response?.data?.detail || 'Execution failed.' }
      ])
    } finally {
      setExecuting(false)
    }
  }

  const handleDisconnect = () => {
    setConnected(false)
    setTerminalHistory([])
  }

  return (
    <ModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-3xl bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 sm:p-7 text-[#FAF5EC] flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#3E2316] mb-4">
            <div>
              <h3 className="text-lg font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
                <Terminal className="h-5 w-5 text-[#E8DCB8]" />
                <span>Container console: {project.name}</span>
              </h3>
              <p className="text-xs text-[#DFCDB5]">Portainer-compatible interactive container shell</p>
            </div>
            <button
              onClick={() => {
                handleDisconnect()
                onClose()
              }}
              className="p-2 rounded-xl text-[#DFCDB5] hover:text-white hover:bg-[#3E2316] transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {!connected ? (
            /* Portainer-like Connect Screen (Image 3) */
            <form onSubmit={handleConnect} className="space-y-5 py-2">
              <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-5 space-y-4">
                <div className="flex items-center space-x-2 text-xs font-semibold text-[#E8DCB8] uppercase tracking-wider">
                  <Terminal className="h-4 w-4" />
                  <span>Execute</span>
                </div>

                {/* Command Choice */}
                <div>
                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">Command</label>
                  {!useCustom ? (
                    <select
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                    >
                      <option value="/bin/sh">/bin/sh</option>
                      <option value="/bin/bash">/bin/bash</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="e.g. /bin/sh"
                      value={customCommand}
                      onChange={(e) => setCustomCommand(e.target.value)}
                      className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] placeholder-[#553826] focus:outline-none focus:border-[#C49767]"
                    />
                  )}
                </div>

                {/* Use Custom Command Toggle */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-medium text-[#DFCDB5]">Use custom command</span>
                  <button
                    type="button"
                    onClick={() => setUseCustom(!useCustom)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      useCustom ? 'bg-[#5A3521]' : 'bg-[#3A2115]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        useCustom ? 'translate-x-4 bg-[#E8DCB8]' : 'translate-x-0 bg-[#A47E65]'
                      }`}
                    />
                  </button>
                </div>

                {/* User */}
                <div>
                  <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">User</label>
                  <input
                    type="text"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="root"
                    className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] placeholder-[#553826] focus:outline-none focus:border-[#C49767]"
                  />
                  <p className="text-[10px] text-[#A47E65] mt-1 font-mono">Default: root (atau www-data / node)</p>
                </div>
              </div>

              <div className="flex justify-start">
                <button
                  type="submit"
                  disabled={connecting}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-[#FAF5EC] hover:bg-white text-[#2B1810] shadow-md transition disabled:opacity-50 flex items-center space-x-2"
                >
                  {connecting ? (
                    <>
                      <Spinner size="xs" className="border-[#2B1810]" />
                      <span>Menghubungkan...</span>
                    </>
                  ) : (
                    <span>Connect</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Active Interactive Terminal Screen */
            <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
              <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-4 flex-1 overflow-y-auto font-mono text-xs text-[#FAF5EC] space-y-2 h-80">
                {terminalHistory.map((item, idx) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                    {item.type === 'system' && <span className="text-amber-400 font-semibold">[SYSTEM] {item.text}</span>}
                    {item.type === 'input' && <span className="text-terracotta-400 font-bold">{item.text}</span>}
                    {item.type === 'output' && <span className="text-[#DFCDB5]">{item.text}</span>}
                    {item.type === 'error' && <span className="text-rose-400 font-bold">[ERROR] {item.text}</span>}
                  </div>
                ))}
                {executing && (
                  <div className="flex items-center space-x-2 text-[#DFCDB5] italic">
                    <Spinner size="xs" />
                    <span>Executing command...</span>
                  </div>
                )}
              </div>

              {/* Terminal Input Bar */}
              <form onSubmit={handleSendInput} className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-[#E8DCB8] font-mono">$</span>
                  <input
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    placeholder="Ketik perintah (e.g. ls -la, cat index.php, php -v)..."
                    className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl pl-8 pr-4 py-2.5 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767]"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={executing || !currentInput.trim()}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] transition disabled:opacity-50 flex items-center space-x-1"
                >
                  <CornerDownLeft className="h-3.5 w-3.5" />
                  <span>Kirim</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] transition"
                >
                  Disconnect
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}
