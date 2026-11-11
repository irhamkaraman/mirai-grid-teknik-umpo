import React, { useState, useEffect } from 'react'
import {
  User,
  HardDrive,
  Cpu,
  Layers,
  Database,
  Globe,
  Server,
  Terminal,
  Activity,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wifi,
  Folder,
  Sliders,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'

export default function CpanelSidepanel({ user }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copiedKey, setCopiedKey] = useState('')
  const [showAllPorts, setShowAllPorts] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await api.get('/quotas/cpanel-stats')
      setStats(res.data)
    } catch (err) {
      console.error('Failed to load cpanel stats', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchStats()
    toast.info('Memperbarui statistik cPanel...')
  }

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success(`Disalin: ${text}`)
    setTimeout(() => setCopiedKey(''), 2000)
  }

  const getProgressColor = (percent) => {
    if (percent >= 90) return 'bg-rose-500'
    if (percent >= 70) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  const gen = stats?.general_info
  const st = stats?.statistics

  const diskPct = st?.disk_usage?.percent ?? (stats ? 0 : 0)
  const procPct = st?.processes?.percent ?? (stats ? 0 : 0)
  const memPct = st?.memory?.percent ?? (stats ? 0 : 0)
  const entryPct = st?.entry_processes?.percent ?? (stats ? 0 : 0)
  const dbPct = st?.database_disk_usage?.percent ?? (stats ? 0 : 0)

  return (
    <aside className="w-full space-y-6 font-sans">
      {/* ======================================================== */}
      {/* 1. GENERAL INFORMATION CARD ALA CPANEL                   */}
      {/* ======================================================== */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-xl overflow-hidden transition-all duration-200">
        <div className="flex items-center justify-between px-5 py-4 bg-[#23130C] border-b border-[#3D2316]">
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#3A2116] border border-[#523120] flex items-center justify-center text-[#E8DCB8]">
              <User className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-serif font-bold text-[#FAF5EC] tracking-wide">
              General Information
            </h4>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh Statistik"
            className="p-1.5 rounded-lg bg-[#1C0F0A] hover:bg-[#341F14] border border-[#3E2316] text-[#DFCDB5] hover:text-[#FAF5EC] transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-[#C49767]' : ''}`} />
          </button>
        </div>

        <div className="p-4 sm:p-5 text-xs divide-y divide-[#3D2316]/70">
          {/* Current User */}
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[#A47E65] font-medium">Current User</span>
            <div className="text-right">
              <span className="font-mono font-bold text-[#FAF5EC] bg-[#1C0F0A] px-2 py-0.5 rounded border border-[#3E2316]">
                {gen?.current_user || user?.username || '-'}
              </span>
              <p className="text-[10px] text-[#A47E65] mt-0.5">
                {gen?.full_name || user?.name || ''}
              </p>
            </div>
          </div>

          {/* Primary Domain (Bebas Port) */}
          <div className="py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[#A47E65] font-medium flex items-center space-x-1.5">
                <Globe className="h-3.5 w-3.5 text-[#C49767]" />
                <span>Primary Domain</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 rounded-full">
                Bebas Port (HTTPS)
              </span>
            </div>
            <div className="flex items-center justify-between bg-[#1C0F0A] px-3 py-2 rounded-2xl border border-[#3E2316] mt-1">
              <a
                href={gen?.domain_url || `https://${gen?.primary_domain || 'miraigrid.web.id'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-emerald-300 hover:text-emerald-200 text-xs font-semibold truncate hover:underline flex items-center space-x-1.5 max-w-[210px]"
                title="Buka Website Resmi"
              >
                <span className="truncate">{gen?.primary_domain || 'miraigrid.web.id'}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
              </a>
              <button
                type="button"
                onClick={() => handleCopy(gen?.domain_url || `https://${gen?.primary_domain || 'miraigrid.web.id'}`, 'primary_domain')}
                title="Salin Domain Utama"
                className="p-1 text-[#A47E65] hover:text-[#FAF5EC] hover:bg-[#3E2316] rounded-lg transition shrink-0"
              >
                {copiedKey === 'primary_domain' ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>

          {/* Dedicated Ports (Database Remote & SSH) */}
          <div className="py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[#A47E65] font-medium">Dedicated Service Ports</span>
              <span className="text-[10px] text-[#C49767] font-mono">
                Remote & SSH
              </span>
            </div>
            <div className="space-y-1.5 bg-[#1C0F0A] p-2.5 rounded-2xl border border-[#3E2316]">
              {gen?.assigned_ports
                ?.filter((p) => p.port === 3306 || p.port === 5432 || p.port === 22 || (!String(p.service).includes('Reserved') && !String(p.service).includes('HTTP')))
                ?.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-1.5 overflow-hidden">
                      <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 shrink-0">
                        :{p.port}
                      </span>
                      <span className="text-[#DFCDB5] truncate" title={p.service}>
                        {p.service}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#A47E65] font-mono shrink-0 ml-1">
                      {p.type}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Shared IP Address */}
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[#A47E65] font-medium">Shared IP Address</span>
            <div className="flex items-center space-x-1.5">
              <span className="font-mono text-[#FAF5EC] text-[11px]">
                {gen?.shared_ip || '76.76.76.189'}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(gen?.shared_ip || '76.76.76.189', 'shared_ip')}
                title="Salin IP Publik"
                className="p-1 text-[#A47E65] hover:text-[#FAF5EC] hover:bg-[#3E2316] rounded transition"
              >
                {copiedKey === 'shared_ip' ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>

          {/* Home Directory */}
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[#A47E65] font-medium">Home Directory</span>
            <div className="flex items-center space-x-1.5">
              <span className="font-mono text-[#FAF5EC] text-[11px] truncate max-w-[150px]" title={gen?.home_directory}>
                {gen?.home_directory || `/home/${user?.username}`}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(gen?.home_directory || `/home/${user?.username}`, 'home_dir')}
                title="Salin Home Directory"
                className="p-1 text-[#A47E65] hover:text-[#FAF5EC] hover:bg-[#3E2316] rounded transition"
              >
                {copiedKey === 'home_dir' ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>

          {/* Last Login IP Address */}
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[#A47E65] font-medium">Last Login IP</span>
            <span className="font-mono text-[#FAF5EC] text-[11px]">
              {gen?.last_login_ip || '127.0.0.1'}
            </span>
          </div>

          {/* Server Hostname */}
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[#A47E65] font-medium">Host Server</span>
            <span className="font-mono text-emerald-400 text-[10px]">
              {gen?.server_hostname || 'labdocker'}
            </span>
          </div>

          {/* Theme */}
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[#A47E65] font-medium">Theme</span>
            <span className="text-[#DFCDB5] text-[11px] font-mono">
              {gen?.theme || 'MiG-DarkGold'}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. STATISTICS CARD ALA CPANEL                            */}
      {/* ======================================================== */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-xl overflow-hidden transition-all duration-200">
        <div className="flex items-center justify-between px-5 py-4 bg-[#23130C] border-b border-[#3D2316]">
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#3A2116] border border-[#523120] flex items-center justify-center text-[#E8DCB8]">
              <Activity className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-serif font-bold text-[#FAF5EC] tracking-wide">
              Statistics
            </h4>
          </div>
        </div>

        <div className="p-4 sm:p-5 text-xs divide-y divide-[#3D2316]/70">
          {/* Disk Usage */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[#A47E65] font-medium">Disk Usage</span>
              <span className="font-mono font-bold text-[#FAF5EC] text-[11px]">
                {st?.disk_usage?.label || `${st?.disk_usage?.used_mb ?? 0} MB / ${st?.disk_usage?.limit_mb ?? 500} MB (${diskPct}%)`}
              </span>
            </div>
            <div className="h-2 w-full bg-[#1C0F0A] rounded-full overflow-hidden border border-[#3E2316]/70">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(diskPct)}`}
                style={{ width: `${Math.min(100, Math.max(diskPct > 0 ? 3 : 0, diskPct))}%` }}
              />
            </div>
          </div>

          {/* Number of Processes */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[#A47E65] font-medium">Number Of Processes</span>
              <span className="font-mono font-bold text-[#FAF5EC] text-[11px]">
                {st?.processes?.label || `${st?.processes?.used ?? 0} / ${st?.processes?.limit ?? 100} (${procPct}%)`}
              </span>
            </div>
            <div className="h-2 w-full bg-[#1C0F0A] rounded-full overflow-hidden border border-[#3E2316]/70">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(procPct)}`}
                style={{ width: `${Math.min(100, Math.max(procPct > 0 ? 3 : 0, procPct))}%` }}
              />
            </div>
          </div>

          {/* Physical Memory Usage */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[#A47E65] font-medium">Physical Memory Usage</span>
              <span className="font-mono font-bold text-[#FAF5EC] text-[11px]">
                {st?.memory?.label || `${st?.memory?.used_mb ?? 0} MB / ${st?.memory?.limit_mb ?? 256} MB (${memPct}%)`}
              </span>
            </div>
            <div className="h-2 w-full bg-[#1C0F0A] rounded-full overflow-hidden border border-[#3E2316]/70">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(memPct)}`}
                style={{ width: `${Math.min(100, Math.max(memPct > 0 ? 3 : 0, memPct))}%` }}
              />
            </div>
          </div>

          {/* Entry Processes */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[#A47E65] font-medium">Entry Processes</span>
              <span className="font-mono font-bold text-[#FAF5EC] text-[11px]">
                {st?.entry_processes?.label || `${st?.entry_processes?.used ?? 0} / ${st?.entry_processes?.limit ?? 20} (${entryPct}%)`}
              </span>
            </div>
            <div className="h-2 w-full bg-[#1C0F0A] rounded-full overflow-hidden border border-[#3E2316]/70">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(entryPct)}`}
                style={{ width: `${Math.min(100, Math.max(entryPct > 0 ? 3 : 0, entryPct))}%` }}
              />
            </div>
          </div>

          {/* Database Disk Usage (PostgreSQL & MariaDB) */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[#A47E65] font-medium">Database Disk Usage</span>
              <span className="font-mono font-bold text-[#FAF5EC] text-[11px]">
                {st?.database_disk_usage?.label || `${st?.database_disk_usage?.used_mb ?? 0} MB / ${st?.database_disk_usage?.limit_mb ?? 100} MB (${dbPct}%)`}
              </span>
            </div>
            <div className="h-2 w-full bg-[#1C0F0A] rounded-full overflow-hidden border border-[#3E2316]/70">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(dbPct)}`}
                style={{ width: `${Math.min(100, Math.max(dbPct > 0 ? 3 : 0, dbPct))}%` }}
              />
            </div>
          </div>

          {/* Bandwidth */}
          <div className="py-3 flex items-center justify-between">
            <span className="text-[#A47E65] font-medium">Bandwidth</span>
            <span className="font-mono font-bold text-[#FAF5EC] text-[11px]">
              {st?.bandwidth?.label || '164.5 MB / ∞'}
            </span>
          </div>

          {/* Deployment (sebelumnya Web Projects) */}
          <div className="py-3 flex items-center justify-between">
            <span className="text-[#A47E65] font-medium">Deployment</span>
            <span className="font-mono font-bold text-cyan-300 text-[11px]">
              {st?.projects?.label || `${st?.projects?.used || 0} Aktif`}
            </span>
          </div>

          {/* Databases */}
          <div className="py-3 flex items-center justify-between">
            <span className="text-[#A47E65] font-medium">Active Databases</span>
            <span className="font-mono font-bold text-amber-300 text-[11px]">
              {st?.databases?.label || `${st?.databases?.used || 0} DBs`}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
