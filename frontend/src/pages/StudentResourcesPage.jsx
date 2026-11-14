import React, { useState, useEffect } from 'react'
import {
  Cpu,
  Server,
  HardDrive,
  Activity,
  ShieldCheck,
  Globe,
  Gauge,
  Database,
  Wifi,
  Lock,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Terminal
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { api } from '../api/client'

export default function StudentResourcesPage({ user, onNavigate }) {
  const { isV2 } = useTheme()
  const [data, setData] = useState(null)
  const [connectionMode, setConnectionMode] = useState('connecting') // 'ws' | 'polling' | 'connecting'
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const nim = user?.username || 'mahasiswa'
  const studentName = user?.name || user?.username || 'Mahasiswa Lab TI'

  const fetchMetricsRest = async () => {
    try {
      const res = await api.get('/resources/metrics')
      if (res.data) {
        setData(res.data)
        setLastUpdated(new Date())
      }
    } catch (err) {
      // Graceful fallback to my-quota if /resources/metrics unavailable
      try {
        const qRes = await api.get('/quotas/my-quota')
        if (qRes.data) {
          const q = qRes.data
          const ramMax = q.max_memory_mb ?? 512
          const ramUsed = q.used_memory_mb ?? 0.0
          const diskMax = q.max_disk_mb ?? 10240
          const diskUsed = q.disk_used_mb ?? 0.0
          const dbMax = q.max_database_disk_mb ?? 5120
          const dbUsed = q.used_database_disk_mb ?? 0.0
          const procMax = q.max_processes ?? 50
          const procUsed = q.used_processes ?? 0

          setData({
            nim,
            name: studentName,
            role: user?.role || 'student',
            sandbox_status: 'active',
            sandbox_badge: 'Terisolasi cgroup v2 Linux - OOM Protected',
            metrics: {
              ram: {
                used_mb: ramUsed,
                max_mb: ramMax,
                percent: Math.min(100, Math.round((ramUsed / ramMax) * 100)),
                description: 'Batas memori cgroup v2 per container. Dilindungi OOM Killer agar tidak saling mengganggu dengan mahasiswa lain.'
              },
              cpu: {
                cores: q.max_cpu_cores || 0.5,
                cores_label: `${q.max_cpu_cores || 0.5} Cores`,
                process_count: procUsed,
                max_processes: procMax,
                percent: Math.min(100, Math.round((procUsed / procMax) * 100)),
                description: 'Jumlah sub-proses PHP/Node.js/Python yang sedang berjalan bersamaan di dalam workspace.'
              },
              disk: {
                used_mb: diskUsed,
                max_mb: diskMax,
                percent: Math.min(100, Math.round((diskUsed / diskMax) * 100)),
                path: `/home/${nim}`,
                description: `Kapasitas penyimpanan untuk source code, assets, dan unggahan di folder /home/${nim}.`
              },
              database: {
                used_mb: dbUsed,
                max_mb: dbMax,
                percent: Math.min(100, Math.round((dbUsed / dbMax) * 100)),
                count: q.used_databases || 1,
                description: 'Alokasi ruang tabel mandiri pada MariaDB 11 & PostgreSQL 16.'
              }
            },
            specs: {
              domain: `${nim}.miraigrid.web.id`,
              reverse_proxy: 'Nginx Ingress + HTTP/2 SSL (Cloudflare Edge)',
              gateway_ip: '10.10.10.10 (LXC Virtual Container)',
              internal_port: 'Port dinamis terisolasi (PHP 8.x / Node / Python)',
              database_ports: '3306 (MariaDB) & 5432 (PostgreSQL)',
              bandwidth: '1 Gbps Intranet LAN Lab TI UMPO'
            },
            timestamp: Math.floor(Date.now() / 1000),
            is_live: false
          })
          setLastUpdated(new Date())
        }
      } catch (e) {
        console.warn('Fallback quota check warning:', e)
      }
    }
  }

  useEffect(() => {
    let ws = null
    let pollTimer = null
    let reconnectTimer = null
    let isUnmounted = false

    const connectWebSocket = () => {
      const token = localStorage.getItem('miraigrid_token')
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = `${protocol}//${host}/api/ws/resources?token=${encodeURIComponent(token || '')}`

      try {
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          if (isUnmounted) return
          setConnectionMode('ws')
          if (pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
          }
        }

        ws.onmessage = (event) => {
          if (isUnmounted) return
          try {
            const payload = JSON.parse(event.data)
            if (payload && payload.metrics) {
              setData(payload)
              setLastUpdated(new Date())
            }
          } catch (e) {
            console.error('WS parse error:', e)
          }
        }

        ws.onerror = () => {
          if (!isUnmounted) startRestPolling()
        }

        ws.onclose = () => {
          if (isUnmounted) return
          startRestPolling()
          reconnectTimer = setTimeout(() => {
            if (!isUnmounted) connectWebSocket()
          }, 8000)
        }
      } catch (err) {
        startRestPolling()
      }
    }

    const startRestPolling = () => {
      if (isUnmounted) return
      setConnectionMode('polling')
      fetchMetricsRest()
      if (!pollTimer) {
        pollTimer = setInterval(() => {
          if (!isUnmounted) fetchMetricsRest()
        }, 6000)
      }
    }

    // Initial immediate REST fetch + WS connect
    fetchMetricsRest()
    connectWebSocket()

    return () => {
      isUnmounted = true
      if (ws) ws.close()
      if (pollTimer) clearInterval(pollTimer)
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [nim])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await fetchMetricsRest()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  // Baseline default values while initial telemetry is establishing
  const ramMetric = data?.metrics?.ram || {
    used_mb: 0.0,
    max_mb: 256.0,
    percent: 0.0,
    description: 'Batas memori cgroup v2 per container. Dilindungi OOM Killer agar tidak saling mengganggu dengan mahasiswa lain.'
  }

  const cpuMetric = data?.metrics?.cpu || {
    cores: 0.5,
    cores_label: '0.5 Cores',
    process_count: 0,
    max_processes: 50,
    percent: 0.0,
    description: 'Jumlah sub-proses PHP/Node.js/Python yang sedang berjalan bersamaan di dalam workspace.'
  }

  const diskMetric = data?.metrics?.disk || {
    used_mb: 0.0,
    max_mb: 500.0,
    percent: 0.0,
    path: `/home/${nim}`,
    description: `Kapasitas penyimpanan untuk source code, assets, dan unggahan di folder /home/${nim}.`
  }

  const dbMetric = data?.metrics?.database || {
    used_mb: 0.0,
    max_mb: 100.0,
    percent: 0.0,
    count: 0,
    description: 'Alokasi ruang tabel mandiri pada MariaDB 11 & PostgreSQL 16.'
  }

  const specs = data?.specs || {
    domain: `${nim}.miraigrid.web.id`,
    reverse_proxy: 'Nginx Ingress + HTTP/2 SSL (Cloudflare Edge)',
    gateway_ip: '10.10.10.10 (LXC Virtual Container)',
    internal_port: 'Port dinamis terisolasi (PHP 8.x / Node / Python)',
    database_ports: '3306 (MariaDB) & 5432 (PostgreSQL)',
    bandwidth: '1 Gbps Intranet LAN Lab TI UMPO'
  }

  const getProgressColor = (percent) => {
    if (percent > 90) return 'bg-rose-500'
    if (percent > 80) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  const getProgressTrack = (percent) => {
    if (percent > 90) return 'bg-rose-100'
    if (percent > 80) return 'bg-amber-100'
    return isV2 ? 'bg-slate-100' : 'bg-[#3A2216]'
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 font-sans select-none">
      {/* 1. Breadcrumb Bar */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs">
        <button
          type="button"
          onClick={() => onNavigate('/dashboard')}
          className={`font-medium transition hover:underline ${
            isV2 ? 'text-slate-500 hover:text-slate-900' : 'text-[#D0B8A2] hover:text-[#FAF5EC]'
          }`}
        >
          Dashboard
        </button>
        <ChevronRight className={`h-3.5 w-3.5 ${isV2 ? 'text-slate-400' : 'text-[#8C6D58]'}`} />
        <span
          className={`font-semibold ${
            isV2 ? 'text-slate-800' : 'text-[#FAF5EC]'
          }`}
        >
          Resource &amp; Kuota Akun
        </span>
      </nav>

      {/* 2. Header Halaman & Status Bar (Floating Clean Card) */}
      <div
        className={`rounded-2xl p-6 transition-colors duration-150 ${
          isV2
            ? 'bg-white border border-slate-200/80'
            : 'bg-[#2B1810] border border-[#4D2D1E] shadow-sm text-[#FAF5EC]'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-3">
              <div
                className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                  isV2 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-[#3D2317] text-[#E8C58D] border border-[#5A3521]'
                }`}
              >
                <Gauge className="h-5 w-5" />
              </div>
              <h1
                className={`text-xl sm:text-2xl font-bold tracking-tight ${
                  isV2 ? 'text-slate-900' : 'text-[#FAF5EC]'
                }`}
              >
                Spesifikasi &amp; Kuota Resource Mahasiswa
              </h1>
            </div>
            <p className={`text-xs sm:text-sm pl-0 sm:pl-11 ${isV2 ? 'text-slate-500' : 'text-[#D0B8A2]'}`}>
              Alokasi lingkungan komputasi mandiri dan terisolasi untuk NIM:{' '}
              <span className={`font-mono font-semibold ${isV2 ? 'text-slate-800' : 'text-[#FAF5EC]'}`}>
                {nim}
              </span>
              {' '}&bull; {studentName}
            </p>
          </div>

          {/* Action & Status Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Sandbox Aktif */}
            <div
              className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium border ${
                isV2
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                  : 'bg-[#1E3A2B] text-emerald-300 border-emerald-800/60'
              }`}
            >
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Terisolasi cgroup v2 Linux - OOM Protected</span>
            </div>

            {/* Connection Telemetry Mode */}
            <div
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono border ${
                connectionMode === 'ws'
                  ? isV2
                    ? 'bg-sky-50 text-sky-800 border-sky-200/80'
                    : 'bg-[#142E3D] text-sky-300 border-sky-800/60'
                  : isV2
                  ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                  : 'bg-[#3D2F14] text-amber-300 border-amber-800/60'
              }`}
            >
              <Activity className="h-3 w-3 shrink-0" />
              <span>{connectionMode === 'ws' ? 'Live Telemetri (WebSocket)' : 'Telemetri Aktif (REST Polling)'}</span>
            </div>

            {/* Manual Refresh Button */}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Perbarui Data Resource"
              className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${
                isV2
                  ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  : 'bg-[#341F14] hover:bg-[#3D2518] border-[#4D2D1E] text-[#D0B8A2]'
              } ${isRefreshing ? 'opacity-50 cursor-wait' : ''}`}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Grid Metrik Utama Real-Time (Cards dengan Live Progress Bar) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Penggunaan Memori RAM */}
        <div
          className={`rounded-2xl p-5 flex flex-col justify-between transition-colors duration-150 ${
            isV2
              ? 'bg-white border border-slate-200/80 hover:border-slate-300'
              : 'bg-[#2B1810] border border-[#4D2D1E] shadow-sm text-[#FAF5EC]'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    isV2 ? 'bg-indigo-50 text-indigo-600' : 'bg-[#361E28] text-rose-300'
                  }`}
                >
                  <Cpu className="h-4 w-4" />
                </div>
                <span className={`text-xs font-semibold ${isV2 ? 'text-slate-700' : 'text-[#FAF5EC]'}`}>
                  Penggunaan Memori RAM
                </span>
              </div>
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                  ramMetric.percent > 80
                    ? 'bg-amber-100 text-amber-800'
                    : isV2
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-[#3D2317] text-[#E8C58D]'
                }`}
              >
                {ramMetric.percent}%
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-baseline justify-between">
                <span className={`text-xl sm:text-2xl font-bold font-mono ${isV2 ? 'text-slate-900' : 'text-[#FAF5EC]'}`}>
                  {ramMetric.used_mb} <span className="text-xs font-normal text-slate-400">MB</span>
                </span>
                <span className={`text-xs font-mono ${isV2 ? 'text-slate-500' : 'text-[#D0B8A2]'}`}>
                  / {ramMetric.max_mb} MB
                </span>
              </div>

              {/* Progress Bar */}
              <div className={`w-full h-2 rounded-full overflow-hidden ${getProgressTrack(ramMetric.percent)}`}>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(ramMetric.percent)}`}
                  style={{ width: `${Math.min(100, Math.max(3, ramMetric.percent))}%` }}
                />
              </div>
            </div>
          </div>

          <p className={`text-[11px] leading-relaxed pt-4 mt-3 border-t ${
            isV2 ? 'border-slate-100 text-slate-500' : 'border-[#3D2317] text-[#A47E65]'
          }`}>
            {ramMetric.description}
          </p>
        </div>

        {/* Card 2: CPU & Proses Aktif */}
        <div
          className={`rounded-2xl p-5 flex flex-col justify-between transition-colors duration-150 ${
            isV2
              ? 'bg-white border border-slate-200/80 hover:border-slate-300'
              : 'bg-[#2B1810] border border-[#4D2D1E] shadow-sm text-[#FAF5EC]'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    isV2 ? 'bg-sky-50 text-sky-600' : 'bg-[#182E3B] text-sky-300'
                  }`}
                >
                  <Activity className="h-4 w-4" />
                </div>
                <span className={`text-xs font-semibold ${isV2 ? 'text-slate-700' : 'text-[#FAF5EC]'}`}>
                  CPU &amp; Proses Aktif
                </span>
              </div>
              <span
                className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                  isV2 ? 'bg-slate-100 text-slate-700' : 'bg-[#3D2317] text-[#E8C58D]'
                }`}
              >
                {cpuMetric.cores_label}
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-baseline justify-between">
                <span className={`text-xl sm:text-2xl font-bold font-mono ${isV2 ? 'text-slate-900' : 'text-[#FAF5EC]'}`}>
                  {cpuMetric.process_count} <span className="text-xs font-normal text-slate-400">/ {cpuMetric.max_processes} Proses</span>
                </span>
                <span className={`text-xs font-mono font-medium ${isV2 ? 'text-slate-500' : 'text-[#D0B8A2]'}`}>
                  Alokasi: {cpuMetric.cores_label}
                </span>
              </div>

              {/* Progress Bar */}
              <div className={`w-full h-2 rounded-full overflow-hidden ${getProgressTrack(cpuMetric.percent)}`}>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(cpuMetric.percent)}`}
                  style={{ width: `${Math.min(100, Math.max(3, cpuMetric.percent))}%` }}
                />
              </div>
            </div>
          </div>

          <p className={`text-[11px] leading-relaxed pt-4 mt-3 border-t ${
            isV2 ? 'border-slate-100 text-slate-500' : 'border-[#3D2317] text-[#A47E65]'
          }`}>
            {cpuMetric.description}
          </p>
        </div>

        {/* Card 3: Penyimpanan Berkas & Web (Disk Usage) */}
        <div
          className={`rounded-2xl p-5 flex flex-col justify-between transition-colors duration-150 ${
            isV2
              ? 'bg-white border border-slate-200/80 hover:border-slate-300'
              : 'bg-[#2B1810] border border-[#4D2D1E] shadow-sm text-[#FAF5EC]'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    isV2 ? 'bg-amber-50 text-amber-600' : 'bg-[#3A2C18] text-amber-300'
                  }`}
                >
                  <HardDrive className="h-4 w-4" />
                </div>
                <span className={`text-xs font-semibold ${isV2 ? 'text-slate-700' : 'text-[#FAF5EC]'}`}>
                  Penyimpanan Berkas &amp; Web
                </span>
              </div>
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                  diskMetric.percent > 80
                    ? 'bg-amber-100 text-amber-800'
                    : isV2
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-[#3D2317] text-[#E8C58D]'
                }`}
              >
                {diskMetric.percent}%
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-baseline justify-between">
                <span className={`text-xl sm:text-2xl font-bold font-mono ${isV2 ? 'text-slate-900' : 'text-[#FAF5EC]'}`}>
                  {diskMetric.used_mb} <span className="text-xs font-normal text-slate-400">MB</span>
                </span>
                <span className={`text-xs font-mono ${isV2 ? 'text-slate-500' : 'text-[#D0B8A2]'}`}>
                  / {diskMetric.max_mb >= 1024 ? `${Math.round(diskMetric.max_mb / 1024)} GB` : `${diskMetric.max_mb} MB`}
                </span>
              </div>

              {/* Progress Bar */}
              <div className={`w-full h-2 rounded-full overflow-hidden ${getProgressTrack(diskMetric.percent)}`}>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(diskMetric.percent)}`}
                  style={{ width: `${Math.min(100, Math.max(3, diskMetric.percent))}%` }}
                />
              </div>
            </div>
          </div>

          <p className={`text-[11px] leading-relaxed pt-4 mt-3 border-t ${
            isV2 ? 'border-slate-100 text-slate-500' : 'border-[#3D2317] text-[#A47E65]'
          }`}>
            {diskMetric.description}
          </p>
        </div>

        {/* Card 4: Storage Database Praktikum */}
        <div
          className={`rounded-2xl p-5 flex flex-col justify-between transition-colors duration-150 ${
            isV2
              ? 'bg-white border border-slate-200/80 hover:border-slate-300'
              : 'bg-[#2B1810] border border-[#4D2D1E] shadow-sm text-[#FAF5EC]'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    isV2 ? 'bg-violet-50 text-violet-600' : 'bg-[#2B1D3A] text-violet-300'
                  }`}
                >
                  <Database className="h-4 w-4" />
                </div>
                <span className={`text-xs font-semibold ${isV2 ? 'text-slate-700' : 'text-[#FAF5EC]'}`}>
                  Storage Database
                </span>
              </div>
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                  dbMetric.percent > 80
                    ? 'bg-amber-100 text-amber-800'
                    : isV2
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-[#3D2317] text-[#E8C58D]'
                }`}
              >
                {dbMetric.percent}%
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-baseline justify-between">
                <span className={`text-xl sm:text-2xl font-bold font-mono ${isV2 ? 'text-slate-900' : 'text-[#FAF5EC]'}`}>
                  {dbMetric.used_mb} <span className="text-xs font-normal text-slate-400">MB</span>
                </span>
                <span className={`text-xs font-mono ${isV2 ? 'text-slate-500' : 'text-[#D0B8A2]'}`}>
                  / {dbMetric.max_mb >= 1024 ? `${Math.round(dbMetric.max_mb / 1024)} GB` : `${dbMetric.max_mb} MB`}
                </span>
              </div>

              {/* Progress Bar */}
              <div className={`w-full h-2 rounded-full overflow-hidden ${getProgressTrack(dbMetric.percent)}`}>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(dbMetric.percent)}`}
                  style={{ width: `${Math.min(100, Math.max(3, dbMetric.percent))}%` }}
                />
              </div>
            </div>
          </div>

          <p className={`text-[11px] leading-relaxed pt-4 mt-3 border-t ${
            isV2 ? 'border-slate-100 text-slate-500' : 'border-[#3D2317] text-[#A47E65]'
          }`}>
            {dbMetric.description}
          </p>
        </div>
      </div>

      {/* 4. Kartu Spesifikasi Jaringan, Port & Server */}
      <div
        className={`rounded-2xl p-6 transition-colors duration-150 ${
          isV2
            ? 'bg-white border border-slate-200/80'
            : 'bg-[#2B1810] border border-[#4D2D1E] shadow-sm text-[#FAF5EC]'
        }`}
      >
        <div className="flex items-center space-x-2.5 pb-5 border-b border-gray-100 dark:border-gray-800">
          <Server className={`h-5 w-5 ${isV2 ? 'text-slate-700' : 'text-[#FAF5EC]'}`} />
          <h2 className={`text-base font-bold tracking-tight ${isV2 ? 'text-slate-900' : 'text-[#FAF5EC]'}`}>
            Spesifikasi Jaringan, Port &amp; Server Sandbox
          </h2>
        </div>

        {/* 2-Column Technical Data Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 pt-5 text-xs">
          {/* Item 1: Domain Publik */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800/40 gap-1">
            <span className={`font-medium ${isV2 ? 'text-slate-500' : 'text-[#D0B8A2]'}`}>
              Domain Publik
            </span>
            <div className="flex items-center space-x-1.5">
              <span className={`font-mono text-xs px-2.5 py-1 rounded-md ${
                isV2 ? 'bg-slate-100 text-slate-800 font-semibold' : 'bg-[#341F14] text-[#FAF5EC]'
              }`}>
                {specs.domain}
              </span>
              <a
                href={`https://${specs.domain}`}
                target="_blank"
                rel="noreferrer"
                className={`p-1 rounded hover:bg-slate-100 transition ${isV2 ? 'text-slate-400 hover:text-slate-700' : 'text-[#A47E65] hover:text-[#FAF5EC]'}`}
                title="Buka Domain Publik"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Item 2: Port Internal Mahasiswa */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800/40 gap-1">
            <span className={`font-medium ${isV2 ? 'text-slate-500' : 'text-[#D0B8A2]'}`}>
              Port Internal Mahasiswa
            </span>
            <span className={`font-mono text-xs px-2.5 py-1 rounded-md ${
              isV2 ? 'bg-slate-100 text-slate-800 font-semibold' : 'bg-[#341F14] text-[#FAF5EC]'
            }`}>
              {specs.internal_port}
            </span>
          </div>

          {/* Item 3: Reverse Proxy */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800/40 gap-1">
            <span className={`font-medium ${isV2 ? 'text-slate-500' : 'text-[#D0B8A2]'}`}>
              Reverse Proxy
            </span>
            <span className={`font-sans text-xs font-semibold ${isV2 ? 'text-slate-700' : 'text-[#FAF5EC]'}`}>
              {specs.reverse_proxy}
            </span>
          </div>

          {/* Item 4: Port Database Dedicated */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800/40 gap-1">
            <span className={`font-medium ${isV2 ? 'text-slate-500' : 'text-[#D0B8A2]'}`}>
              Port Database Dedicated
            </span>
            <span className={`font-mono text-xs px-2.5 py-1 rounded-md ${
              isV2 ? 'bg-slate-100 text-slate-800 font-semibold' : 'bg-[#341F14] text-[#FAF5EC]'
            }`}>
              {specs.database_ports}
            </span>
          </div>

          {/* Item 5: Shared Gateway IP */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800/40 gap-1">
            <span className={`font-medium ${isV2 ? 'text-slate-500' : 'text-[#D0B8A2]'}`}>
              Shared Gateway IP
            </span>
            <span className={`font-mono text-xs px-2.5 py-1 rounded-md ${
              isV2 ? 'bg-slate-100 text-slate-800 font-semibold' : 'bg-[#341F14] text-[#FAF5EC]'
            }`}>
              {specs.gateway_ip}
            </span>
          </div>

          {/* Item 6: Bandwidth Jaringan */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800/40 gap-1">
            <span className={`font-medium ${isV2 ? 'text-slate-500' : 'text-[#D0B8A2]'}`}>
              Bandwidth Jaringan
            </span>
            <span className={`font-sans text-xs font-semibold ${isV2 ? 'text-slate-700' : 'text-[#FAF5EC]'}`}>
              {specs.bandwidth}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Jaminan Isolasi Multi-Tenant Banner */}
      <div
        className={`rounded-2xl p-4 sm:p-5 flex items-start space-x-3.5 border transition-all duration-200 ${
          isV2
            ? 'bg-slate-50/80 border-slate-200/70 text-slate-600'
            : 'bg-[#24140D] border-[#4D2D1E] text-[#D0B8A2]'
        }`}
      >
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h4 className={`font-semibold ${isV2 ? 'text-slate-900' : 'text-[#FAF5EC]'}`}>
            Jaminan Isolasi Multi-Tenant Tingkat Kernel &amp; Sandboxing
          </h4>
          <p className="leading-relaxed">
            Setiap mahasiswa memiliki alokasi memori terisolasi melalui cgroup v2 Linux, direktori kerja mandiri yang dilindungi dari sandbox escape, serta kuota database individual. Metrik di atas disajikan secara real-time langsung dari engine komputasi akun Anda.
          </p>
        </div>
      </div>
    </div>
  )
}
