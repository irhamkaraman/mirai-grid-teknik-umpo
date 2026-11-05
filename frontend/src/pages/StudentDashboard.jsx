import React, { useEffect, useState } from 'react'
import { Layers, Database, Cpu, HardDrive, ExternalLink, Plus, Sparkles } from 'lucide-react'
import { api } from '../api/client'
import { SkeletonCard, SkeletonBox } from '../components/Skeletons'

export default function StudentDashboard({ user, onNavigate }) {
  const [quota, setQuota] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQuota()
  }, [])

  const fetchQuota = async () => {
    try {
      const res = await api.get('/quotas/my-quota')
      setQuota(res.data)
    } catch (err) {
      console.error('Failed to load quota', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome Banner with Anthropic warm styling */}
      <div className="bg-gradient-to-br from-warmdark-850 via-warmdark-900 to-chocolate-950/70 border border-warmdark-700/80 rounded-3xl p-7 sm:p-9 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-chocolate-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-2xl relative z-10">
          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-terracotta-500/10 text-terracotta-400 border border-terracotta-500/20 mb-3.5">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Praktikum Teknik Informatika UMPO</span>
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-cream-50 leading-tight">
            Selamat Datang, {user?.name}!
          </h2>
          <p className="text-xs sm:text-sm text-cream-300/80 mt-2.5 leading-relaxed font-sans">
            Platform mandiri MiraiGrid siap menampung database praktikum dan men-deploy aplikasi web Anda (PHP, Python, Node.js, HTML) di lingkungan server terisolasi.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => onNavigate('projects')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-chocolate-700 hover:bg-chocolate-600 text-cream-100 border border-chocolate-500/50 shadow-lg shadow-chocolate-950/40 transition-all duration-150"
            >
              <Plus className="h-4 w-4 text-terracotta-400" />
              <span>Deploy Project Baru</span>
            </button>
            <button
              onClick={() => onNavigate('databases')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-warmdark-750 hover:bg-warmdark-700 text-cream-200 border border-warmdark-700 transition-all duration-150"
            >
              <Database className="h-4 w-4 text-emerald-400" />
              <span>Buat Database Saya</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quota & Resource Cards */}
      <div>
        <h3 className="text-base font-serif font-bold text-cream-100 mb-3.5">
          Alokasi Kuota Praktikum Anda
        </h3>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Projects Meter */}
            <div className="bg-warmdark-850/80 border border-warmdark-750/80 p-5 rounded-2xl hover:border-chocolate-500/40 transition">
              <div className="flex items-center justify-between text-cream-400 mb-2">
                <span className="text-xs font-semibold">Web Projects</span>
                <Layers className="h-4 w-4 text-terracotta-400" />
              </div>
              <div className="text-2xl font-black text-cream-50 font-sans">
                {quota?.used_projects ?? 0} <span className="text-xs text-cream-400/60 font-normal">/ {quota?.max_projects ?? 2} slot</span>
              </div>
              <div className="w-full bg-warmdark-950 h-1.5 rounded-full mt-3 overflow-hidden border border-warmdark-750">
                <div
                  className="bg-terracotta-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, ((quota?.used_projects || 0) / (quota?.max_projects || 2)) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Databases Meter */}
            <div className="bg-warmdark-850/80 border border-warmdark-750/80 p-5 rounded-2xl hover:border-chocolate-500/40 transition">
              <div className="flex items-center justify-between text-cream-400 mb-2">
                <span className="text-xs font-semibold">Databases</span>
                <Database className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-cream-50 font-sans">
                {quota?.used_databases ?? 0} <span className="text-xs text-cream-400/60 font-normal">/ {quota?.max_databases ?? 2} DB</span>
              </div>
              <div className="w-full bg-warmdark-950 h-1.5 rounded-full mt-3 overflow-hidden border border-warmdark-750">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, ((quota?.used_databases || 0) / (quota?.max_databases || 2)) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Memory Allocation */}
            <div className="bg-warmdark-850/80 border border-warmdark-750/80 p-5 rounded-2xl hover:border-chocolate-500/40 transition">
              <div className="flex items-center justify-between text-cream-400 mb-2">
                <span className="text-xs font-semibold">Limit RAM Container</span>
                <Cpu className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-cream-50 font-sans">
                {quota?.max_memory_mb ?? 256} <span className="text-xs text-cream-400/60 font-normal">MB / project</span>
              </div>
              <p className="text-[11px] text-cream-400/60 mt-2">Isolasi OOM killer aktif.</p>
            </div>

            {/* CPU Allocation */}
            <div className="bg-warmdark-850/80 border border-warmdark-750/80 p-5 rounded-2xl hover:border-chocolate-500/40 transition">
              <div className="flex items-center justify-between text-cream-400 mb-2">
                <span className="text-xs font-semibold">Alokasi CPU Core</span>
                <HardDrive className="h-4 w-4 text-cream-300" />
              </div>
              <div className="text-2xl font-black text-cream-50 font-sans">
                {quota?.max_cpu_cores ?? 0.5} <span className="text-xs text-cream-400/60 font-normal">vCPU</span>
              </div>
              <p className="text-[11px] text-cream-400/60 mt-2">Resource terisolasi per user.</p>
            </div>
          </div>
        )}
      </div>

      {/* Useful Lab Links in Warm Chocolate & Cream */}
      <div className="bg-warmdark-850/70 border border-warmdark-750/80 p-6 rounded-3xl">
        <h3 className="text-sm font-serif font-bold text-cream-100 mb-1">Layanan Pendukung Lab Praktikum</h3>
        <p className="text-xs text-cream-400/80 mb-4 font-sans">
          Gunakan web viewer database resmi lab untuk mengelola tabel & menjalankan query SQL langsung di browser:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="http://76.76.76.189:8978"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-4 rounded-2xl bg-warmdark-900/90 border border-warmdark-750 hover:border-chocolate-500/60 transition group shadow-sm"
          >
            <div>
              <p className="text-xs font-bold text-cream-100 group-hover:text-terracotta-400 transition">
                CloudBeaver Web GUI
              </p>
              <p className="text-[11px] text-cream-400/70 mt-0.5">Editor database visual ala DBeaver</p>
            </div>
            <ExternalLink className="h-4 w-4 text-cream-400/60 group-hover:text-terracotta-400 transition" />
          </a>

          <a
            href="http://76.76.76.189:8085"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-4 rounded-2xl bg-warmdark-900/90 border border-warmdark-750 hover:border-emerald-500/60 transition group shadow-sm"
          >
            <div>
              <p className="text-xs font-bold text-cream-100 group-hover:text-emerald-400 transition">
                Adminer Quick SQL
              </p>
              <p className="text-[11px] text-cream-400/70 mt-0.5">Ringan & kilat untuk cek query SQL</p>
            </div>
            <ExternalLink className="h-4 w-4 text-cream-400/60 group-hover:text-emerald-400 transition" />
          </a>
        </div>
      </div>
    </div>
  )
}
