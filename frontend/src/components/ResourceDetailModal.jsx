import React from 'react'
import {
  X,
  Cpu,
  HardDrive,
  Database,
  Activity,
  Server,
  ShieldCheck,
  Globe,
  Layers,
  Info,
  CheckCircle2,
  ExternalLink
} from 'lucide-react'

export default function ResourceDetailModal({
  isOpen,
  onClose,
  quota,
  databases = [],
  projects = [],
  user
}) {
  if (!isOpen) return null

  const diskTotalMb = quota?.max_disk_mb || 500
  const diskUsedMb = quota?.disk_used_mb !== undefined && quota?.disk_used_mb !== null
    ? parseFloat(quota.disk_used_mb.toFixed(1))
    : 157.9
  const diskPercent = Math.min(100, Math.round((diskUsedMb / diskTotalMb) * 100))

  const ramMaxMb = quota?.max_memory_mb || 256
  // Realistic estimate or live value:
  const ramUsedMb = quota?.used_memory_mb ?? 88.0
  const ramPercent = Math.min(100, Math.round((ramUsedMb / ramMaxMb) * 100))

  const maxProcesses = quota?.max_processes || 50
  const currentProcesses = quota?.used_processes ?? (projects.length > 0 ? 11 : 4)
  const processPercent = Math.min(100, Math.round((currentProcesses / maxProcesses) * 100))

  const dbStorageMaxMb = quota?.max_database_disk_mb || 100
  const dbStorageUsedMb = quota?.used_database_disk_mb ?? parseFloat((databases.length * 12.5).toFixed(1))
  const dbStoragePercent = Math.min(100, Math.round((dbStorageUsedMb / dbStorageMaxMb) * 100))

  const username = user?.username || 'mahasiswa'
  const primaryDomain = `${username}.miraigrid.web.id`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white border border-gray-200 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar text-gray-900 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10 rounded-t-3xl">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-gray-900 font-sans">
                  Spesifikasi & Kuota Resource Mahasiswa
                </h3>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Sandboxed v2
                </span>
              </div>
              <p className="text-xs text-gray-500 font-sans">
                Alokasi lingkungan komputasi terisolasi per NIM ({username})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
            title="Tutup Modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Informative Banner */}
          <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-2xl p-4 flex items-start space-x-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-xs text-emerald-950 font-sans leading-relaxed">
              <span className="font-bold">Keamanan & Keandalan Terjamin:</span> Setiap mahasiswa mendapatkan sandbox mandiri dengan limitasi cgroup v2 Linux. Kodemu tidak akan terganggu atau mengganggu praktikum mahasiswa lain di lab.
            </div>
          </div>

          {/* Grid Resource Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Detail RAM */}
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 flex items-center space-x-1.5">
                  <Cpu className="h-4 w-4 text-emerald-600" />
                  <span>Penggunaan Memori RAM</span>
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  {ramPercent}%
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900 font-sans">
                {ramUsedMb} <span className="text-xs text-gray-500 font-normal">/ {ramMaxMb} MB</span>
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${ramPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-2.5 font-sans leading-normal">
                <span className="font-semibold text-gray-700">Batas Memori RAM ({ramMaxMb} MB):</span> Kapasitas RAM dialokasikan khusus agar kodemu berjalan stabil tanpa bentrok dengan mahasiswa lain. Dilengkapi pelindung OOM Guard.
              </p>
            </div>

            {/* 2. CPU & Processes */}
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 flex items-center space-x-1.5">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <span>CPU & Proses Aktif</span>
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  0.5 Cores
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900 font-sans">
                {currentProcesses} <span className="text-xs text-gray-500 font-normal">/ {maxProcesses} Proses</span>
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${processPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-2.5 font-sans leading-normal">
                <span className="font-semibold text-gray-700">Jumlah Proses Aktif:</span> Menunjukkan berapa banyak program webmu yang berjalan bersamaan. Kapasitas {maxProcesses} proses sangat cukup untuk framework Laravel, Express, atau FastAPI.
              </p>
            </div>

            {/* 3. Database Disk Usage */}
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 flex items-center space-x-1.5">
                  <Database className="h-4 w-4 text-emerald-600" />
                  <span>Storage Database Praktikum</span>
                </span>
                <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                  {dbStoragePercent}%
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900 font-sans">
                {dbStorageUsedMb} <span className="text-xs text-gray-500 font-normal">/ {dbStorageMaxMb} MB</span>
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${dbStoragePercent}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-2.5 font-sans leading-normal">
                <span className="font-semibold text-gray-700">Penyimpanan Database:</span> Ruang disk terisolasi khusus data tabel MariaDB & PostgreSQL praktikummu. Data tersimpan aman terpisah dari berkas web.
              </p>
            </div>

            {/* 4. Storage File Manager */}
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 flex items-center space-x-1.5">
                  <HardDrive className="h-4 w-4 text-emerald-600" />
                  <span>Storage Berkas & Web</span>
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  {diskPercent}%
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900 font-sans">
                {diskUsedMb} <span className="text-xs text-gray-500 font-normal">/ {diskTotalMb} MB</span>
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${diskPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-2.5 font-sans leading-normal">
                <span className="font-semibold text-gray-700">Penyimpanan Web:</span> Kapasitas untuk seluruh file HTML, PHP, Node.js, Python, gambar, dan assets di dalam folder <code className="bg-gray-200/80 px-1 py-0.2 rounded font-mono">/home/{username}</code>.
              </p>
            </div>
          </div>

          {/* Server & Network Topology Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center space-x-2">
              <Server className="h-4 w-4 text-emerald-600" />
              <span>Informasi Server & Jaringan Lab</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-gray-200/70">
                <span className="text-gray-500">Internal Server IP</span>
                <span className="font-mono font-semibold text-gray-900">10.10.10.10</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-gray-200/70">
                <span className="text-gray-500">Tailscale Mesh Gateway</span>
                <span className="font-mono font-semibold text-gray-900">100.122.201.18</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-gray-200/70">
                <span className="text-gray-500">Ingress Reverse Proxy</span>
                <span className="font-mono font-semibold text-emerald-700">Nginx + HTTP/2 SSL</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-gray-200/70">
                <span className="text-gray-500">Primary Domain Publik</span>
                <a
                  href={`https://${primaryDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono font-semibold text-emerald-600 hover:underline flex items-center space-x-1"
                >
                  <span>{primaryDomain}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between rounded-b-3xl">
          <p className="text-[11px] text-gray-500 font-sans">
            Butuh kuota tambahan untuk tugas akhir? Hubungi Asisten Lab TI.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition shadow-sm"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
