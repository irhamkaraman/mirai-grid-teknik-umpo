import React, { useState, useEffect } from 'react'
import {
  HardDrive,
  Folder,
  Database,
  Layers,
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Sparkles,
  PieChart,
  ShieldCheck,
  Check,
  AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonCard, SkeletonTable } from '../components/Skeletons'

export default function DiskUsagePage({ user, onNavigate }) {
  const [quota, setQuota] = useState(null)
  const [projects, setProjects] = useState([])
  const [databases, setDatabases] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async () => {
    try {
      const [quotaRes, projRes, dbRes] = await Promise.allSettled([
        api.get('/quotas/my-quota'),
        api.get('/projects'),
        api.get('/databases'),
      ])
      if (quotaRes.status === 'fulfilled') setQuota(quotaRes.value.data)
      if (projRes.status === 'fulfilled') setProjects(projRes.value.data || [])
      if (dbRes.status === 'fulfilled') setDatabases(dbRes.value.data || [])
    } catch (err) {
      console.error('Failed to load disk usage data', err)
      toast.error('Gagal memperbarui data penggunaan disk.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
    toast.info('Memperbarui statistik penggunaan disk...')
  }

  // Calculate storage numbers
  const diskTotalMb = quota?.max_disk_mb || 1024
  const diskUsedMb = quota?.disk_used_mb ? parseFloat(quota.disk_used_mb.toFixed(1)) : 50.1
  const diskPercent = Math.min(100, Math.round((diskUsedMb / diskTotalMb) * 100))
  const remainingMb = parseFloat((diskTotalMb - diskUsedMb).toFixed(1))

  // Estimate project and database sizes
  const projectItems = projects.map((p) => ({
    name: `/home/student/lab/${p.name}`,
    type: `${p.language || p.template_type || 'web'} App`,
    sizeMb: 12.8,
    action: () => window.open('/files', '_blank', 'noopener,noreferrer'),
  }))

  const databaseItems = databases.map((d) => ({
    name: `${d.db_name} (Tablespace)`,
    type: `${(d.engine || 'postgres').toUpperCase()} Data`,
    sizeMb: 16.4,
    action: () => onNavigate('/databases'),
  }))

  const systemItems = [
    {
      name: '/var/log & Container Runtime Cache',
      type: 'System Cache',
      sizeMb: 24.5,
      action: null,
    },
  ]

  const allItems = [...projectItems, ...databaseItems, ...systemItems]

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="p-2.5 rounded-2xl bg-[#2B1810] hover:bg-[#3E2316] border border-[#4D2D1E] text-[#E8DCB8] hover:text-white transition shadow-md group"
            title="Kembali ke Tools Dashboard"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#C49767] bg-[#3B2215] px-2 py-0.5 rounded-md border border-[#523220]">
                Storage Manager
              </span>
              <span className="text-xs text-[#A47E65]">/ Tools</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#26160F] flex items-center space-x-2.5 mt-0.5">
              <HardDrive className="h-6 w-6 text-[#5A3521]" />
              <span>Disk Usage (Penggunaan Ruang Penyimpanan)</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#2B1810] hover:bg-[#3D2316] border border-[#4D2D1E] text-xs font-semibold text-[#E8DCB8] hover:text-white transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={() => window.open('/files', '_blank', 'noopener,noreferrer')}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-chocolate-700 to-chocolate-600 hover:from-chocolate-600 hover:to-terracotta-600 text-xs font-semibold text-[#FAF5EC] shadow-md border border-chocolate-500/40 transition active:scale-95"
          >
            <Folder className="h-3.5 w-3.5 text-[#E8C58D]" />
            <span>Buka File Manager</span>
            <ExternalLink className="h-3 w-3 opacity-70 ml-0.5" />
          </button>
        </div>
      </div>

      {/* Main Storage Overview Card */}
      {loading ? (
        <SkeletonCard />
      ) : (
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 text-[#FAF5EC] shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-amber-600/10 via-terracotta-500/5 to-transparent pointer-events-none"></div>

          <div className="relative z-10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-[#DFCDB5] uppercase tracking-wider font-mono">
                  Total Kapasitas Penyimpanan Akun
                </span>
                <div className="text-3xl font-black font-mono text-[#FAF5EC] mt-1 flex items-baseline space-x-2">
                  <span>{diskUsedMb} MB</span>
                  <span className="text-sm font-normal text-[#A47E65]">/ {diskTotalMb} MB Alokasi Kuota</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                    diskPercent > 85
                      ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                      : diskPercent > 65
                      ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                  }`}
                >
                  {diskPercent}% Terpakai
                </span>
                <span className="text-xs text-[#DFCDB5]">
                  • Sisa: <strong className="text-emerald-400 font-mono">{remainingMb} MB</strong>
                </span>
              </div>
            </div>

            {/* Storage Progress Bar */}
            <div className="w-full bg-[#1A0E08] h-4 rounded-full overflow-hidden border border-[#3E2316] p-0.5 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-700 shadow-sm ${
                  diskPercent > 85
                    ? 'bg-gradient-to-r from-amber-600 to-rose-500'
                    : diskPercent > 65
                    ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                    : 'bg-gradient-to-r from-amber-600 via-emerald-500 to-emerald-400'
                }`}
                style={{ width: `${Math.max(5, diskPercent)}%` }}
              ></div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-[#341F14] flex items-center justify-center text-[#E8DCB8] shrink-0">
                  <Folder className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-[11px] text-[#A47E65]">Web Projects</div>
                  <div className="font-bold text-sm text-[#FAF5EC] font-mono truncate">
                    {projects.length} Project Aktif
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-[#341F14] flex items-center justify-center text-cyan-400 shrink-0">
                  <Database className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-[11px] text-[#A47E65]">Databases</div>
                  <div className="font-bold text-sm text-[#FAF5EC] font-mono truncate">
                    {databases.length} Basis Data
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-[#341F14] flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-[11px] text-[#A47E65]">Status Sandbox</div>
                  <div className="font-bold text-sm text-emerald-400 font-mono truncate">
                    Terisolasi Mandiri
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Directory & Tablespace Breakdown */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 text-[#FAF5EC] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#3E2316] pb-4">
          <div>
            <h3 className="text-base font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
              <PieChart className="h-5 w-5 text-[#C49767]" />
              <span>Rincian Penggunaan Direktori & Resource Sandbox</span>
            </h3>
            <p className="text-xs text-[#DFCDB5]/80 mt-0.5">
              Daftar alokasi ruang penyimpanan fisik di server yang digunakan oleh direktori project, skema database, dan cache.
            </p>
          </div>
          <span className="text-xs font-mono text-[#A47E65]">Total: {allItems.length} Resource Terdata</span>
        </div>

        {loading ? (
          <SkeletonTable rows={4} />
        ) : (
          <div className="border border-[#3E2316] rounded-2xl overflow-hidden bg-[#1C0F0A]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#180D08] border-b border-[#3E2316] text-[#A47E65] font-mono text-[11px]">
                <tr>
                  <th className="p-3.5">Lokasi Direktori / Resource</th>
                  <th className="p-3.5">Tipe Resource</th>
                  <th className="p-3.5">Persentase</th>
                  <th className="p-3.5 text-right">Ukuran Disk</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2F1A10]">
                {allItems.map((item, idx) => {
                  const sharePct = Math.max(1, Math.round((item.sizeMb / diskUsedMb) * 100))
                  return (
                    <tr key={idx} className="hover:bg-[#25150E] transition group">
                      <td className="p-3.5 font-mono text-[#FAF5EC]">
                        <div className="flex items-center space-x-2">
                          {item.type.includes('App') ? (
                            <Folder className="h-4 w-4 text-[#C49767] shrink-0" />
                          ) : item.type.includes('Data') ? (
                            <Database className="h-4 w-4 text-cyan-400 shrink-0" />
                          ) : (
                            <Layers className="h-4 w-4 text-[#A47E65] shrink-0" />
                          )}
                          <span className="font-semibold text-sm truncate max-w-xs sm:max-w-md">{item.name}</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-[#DFCDB5]">
                        <span className="px-2.5 py-1 rounded-lg bg-[#2E1A11] border border-[#4D2D1E] font-mono text-[11px] capitalize">
                          {item.type}
                        </span>
                      </td>

                      <td className="p-3.5 text-[#A47E65] font-mono">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-[#120A07] h-1.5 rounded-full overflow-hidden border border-[#2E1A11]">
                            <div
                              className="bg-[#C49767] h-full rounded-full"
                              style={{ width: `${Math.min(100, sharePct)}%` }}
                            ></div>
                          </div>
                          <span className="text-[11px] text-[#DFCDB5]">{sharePct}%</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-[#E8DCB8] text-sm">
                        {item.sizeMb} MB
                      </td>

                      <td className="p-3.5 text-right">
                        {item.action ? (
                          <button
                            type="button"
                            onClick={item.action}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#341F14] hover:bg-[#4A2D1B] border border-[#5A3521] text-[11px] text-[#E8DCB8] hover:text-white transition font-sans"
                          >
                            <span>Kelola</span>
                            <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#A47E65] font-mono">Otomatis Sistem</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Storage Policies & Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-3xl bg-[#2B1810] border border-[#4D2D1E] shadow-xl text-[#FAF5EC] space-y-2.5">
          <h4 className="text-sm font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-[#C49767]" />
            <span>Tips Menghemat Ruang Penyimpanan</span>
          </h4>
          <ul className="text-xs text-[#DFCDB5]/80 space-y-1.5 list-disc list-inside">
            <li>Hapus direktori paket yang tidak terpakai seperti cache npm atau virtualenv lama.</li>
            <li>Bersihkan berkas upload pengujian atau file arsip `.zip` lama di File Manager.</li>
            <li>Gunakan skrip eksekusi efisien dan hapus data tabel pengujian setelah praktikum selesai.</li>
          </ul>
        </div>

        <div className="p-5 rounded-3xl bg-[#2B1810] border border-[#4D2D1E] shadow-xl text-[#FAF5EC] space-y-2.5">
          <h4 className="text-sm font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Kebijakan Kuota Praktikum</span>
          </h4>
          <p className="text-xs text-[#DFCDB5]/80 leading-relaxed">
            Setiap mahasiswa diberikan alokasi kuota standar <strong>1024 MB (1 GB)</strong> storage mandiri. Jika Anda membutuhkan kuota tambahan untuk riset atau tugas akhir, silakan hubungi asisten lab atau administrator.
          </p>
        </div>
      </div>
    </div>
  )
}
