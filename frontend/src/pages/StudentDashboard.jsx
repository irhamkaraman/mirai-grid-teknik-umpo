import React, { useEffect, useState } from 'react'
import { Layers, Database, Cpu, HardDrive, ExternalLink, Plus, Sparkles } from 'lucide-react'
import { api } from '../api/client'
import { SkeletonCard } from '../components/Skeletons'

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
      {/* Welcome Banner: Coklat Mewah dengan Teks Krim */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-7 sm:p-9 shadow-2xl relative overflow-hidden text-[#FAF5EC]">
        {/* Subtle decorative glow coklat hangat */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#5A3521]/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-2xl relative z-10">
          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#442718] text-[#E8DCB8] border border-[#5C3825] mb-3.5">
            <Sparkles className="h-3.5 w-3.5 text-[#E8DCB8]" />
            <span>Praktikum Teknik Informatika UMPO</span>
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#FAF5EC] leading-tight">
            Selamat Datang, {user?.name}!
          </h2>
          <p className="text-xs sm:text-sm text-[#DFCDB5] mt-2.5 leading-relaxed font-sans">
            Platform mandiri MiraiGrid siap menampung database praktikum dan men-deploy aplikasi web Anda (PHP, Python, Node.js, HTML) di lingkungan server terisolasi.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => onNavigate('/deploy?create=true')}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] shadow-lg transition-all duration-150 cursor-pointer"
            >
              <Plus className="h-4 w-4 text-[#E8DCB8]" />
              <span>Deploy Project Baru</span>
            </button>
            <button
              onClick={() => onNavigate('/databases?create=true')}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#E8DCB8] border border-[#543221] transition-all duration-150 cursor-pointer"
            >
              <Database className="h-4 w-4 text-[#DFCDB5]" />
              <span>Buat Database Saya</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quota & Resource Cards: Judul Coklat Gelap Tebal di atas Krim */}
      <div>
        <h3 className="text-lg font-serif font-bold text-[#26160F] mb-3.5">
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
            <div className="bg-[#2B1810] border border-[#4D2D1E] p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
              <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                <span className="text-xs font-semibold">Web Projects</span>
                <Layers className="h-4 w-4 text-[#E8DCB8]" />
              </div>
              <div className="text-2xl font-black text-[#FAF5EC] font-sans">
                {quota?.used_projects ?? 0} <span className="text-xs text-[#DFCDB5]/70 font-normal">/ {quota?.max_projects ?? 2} slot</span>
              </div>
              <div className="w-full bg-[#1C0F0A] h-2 rounded-full mt-3 overflow-hidden border border-[#3D2316]">
                <div
                  className="bg-[#C49767] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, ((quota?.used_projects || 0) / (quota?.max_projects || 2)) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Databases Meter */}
            <div className="bg-[#2B1810] border border-[#4D2D1E] p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
              <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                <span className="text-xs font-semibold">Databases</span>
                <Database className="h-4 w-4 text-[#E8DCB8]" />
              </div>
              <div className="text-2xl font-black text-[#FAF5EC] font-sans">
                {quota?.used_databases ?? 0} <span className="text-xs text-[#DFCDB5]/70 font-normal">/ {quota?.max_databases ?? 2} DB</span>
              </div>
              <div className="w-full bg-[#1C0F0A] h-2 rounded-full mt-3 overflow-hidden border border-[#3D2316]">
                <div
                  className="bg-[#C49767] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, ((quota?.used_databases || 0) / (quota?.max_databases || 2)) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Memory Allocation */}
            <div className="bg-[#2B1810] border border-[#4D2D1E] p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
              <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                <span className="text-xs font-semibold">Limit RAM Container</span>
                <Cpu className="h-4 w-4 text-[#E8DCB8]" />
              </div>
              <div className="text-2xl font-black text-[#FAF5EC] font-sans">
                {quota?.max_memory_mb ?? 256} <span className="text-xs text-[#DFCDB5]/70 font-normal">MB / project</span>
              </div>
              <p className="text-[11px] text-[#DFCDB5]/70 mt-2 font-mono">Isolasi OOM killer aktif.</p>
            </div>

            {/* CPU Allocation */}
            <div className="bg-[#2B1810] border border-[#4D2D1E] p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
              <div className="flex items-center justify-between text-[#DFCDB5] mb-2">
                <span className="text-xs font-semibold">Alokasi CPU Core</span>
                <HardDrive className="h-4 w-4 text-[#E8DCB8]" />
              </div>
              <div className="text-2xl font-black text-[#FAF5EC] font-sans">
                {quota?.max_cpu_cores ?? 0.5} <span className="text-xs text-cream-200/70 font-normal">vCPU</span>
              </div>
              <p className="text-[11px] text-[#DFCDB5]/70 mt-2 font-mono">Resource terisolasi per user.</p>
            </div>
          </div>
        )}
      </div>

      {/* Useful Lab Links in Coklat & Krim */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] p-7 rounded-3xl shadow-2xl text-[#FAF5EC]">
        <h3 className="text-base font-serif font-bold text-[#FAF5EC] mb-1">Layanan Pendukung Lab Praktikum</h3>
        <p className="text-xs text-[#DFCDB5] mb-5 font-sans">
          Gunakan web viewer database resmi lab untuk mengelola tabel & menjalankan query SQL langsung di browser:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="http://76.76.76.189:8978"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-5 rounded-2xl bg-[#1F110B] border border-[#3E2316] hover:border-[#6D4029] transition group shadow-md"
          >
            <div>
              <p className="text-sm font-bold text-[#FAF5EC] group-hover:text-[#E8DCB8] transition">
                CloudBeaver Web GUI
              </p>
              <p className="text-xs text-[#DFCDB5]/80 mt-1">Editor database visual ala DBeaver</p>
            </div>
            <ExternalLink className="h-4 w-4 text-[#DFCDB5] group-hover:text-[#E8DCB8] transition" />
          </a>

          <a
            href={`http://${window.location.hostname}:8088`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-5 rounded-2xl bg-[#1F110B] border border-[#3E2316] hover:border-[#6D4029] transition group shadow-md"
          >
            <div>
              <p className="text-sm font-bold text-[#FAF5EC] group-hover:text-[#E8DCB8] transition">
                phpPgAdmin Studio
              </p>
              <p className="text-xs text-[#DFCDB5]/80 mt-1">Web GUI PostgreSQL terisolasi & terintegrasi</p>
            </div>
            <ExternalLink className="h-4 w-4 text-[#DFCDB5] group-hover:text-[#E8DCB8] transition" />
          </a>
        </div>
      </div>
    </div>
  )
}
