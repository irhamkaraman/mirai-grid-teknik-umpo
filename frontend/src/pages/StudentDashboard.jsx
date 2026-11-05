import React, { useEffect, useState } from 'react'
import { Layers, Database, Cpu, HardDrive, ExternalLink, Plus, CheckCircle2 } from 'lucide-react'
import { api } from '../api/client'

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
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="max-w-2xl">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-3">
            Praktikum Teknik Informatika UMPO
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Selamat Datang, {user?.name}! 👋
          </h2>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Ini adalah platform MiraiGrid untuk mengelola database terisolasi dan men-deploy aplikasi web praktikum Anda (PHP, Python, Node.js, HTML) dengan aman.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => onNavigate('projects')}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Deploy Project Baru</span>
            </button>
            <button
              onClick={() => onNavigate('databases')}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <Database className="h-4 w-4 text-emerald-400" />
              <span>Buat Database Saya</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quota & Resource Cards */}
      <div>
        <h3 className="text-base font-bold text-white mb-3">Alokasi Kuota Praktikum Anda</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Projects Meter */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Web Projects</span>
              <Layers className="h-4 w-4 text-sky-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {quota?.used_projects ?? 0} <span className="text-xs text-slate-500 font-normal">/ {quota?.max_projects ?? 2} slot</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-sky-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, ((quota?.used_projects || 0) / (quota?.max_projects || 2)) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Databases Meter */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Databases (Postgres / MariaDB)</span>
              <Database className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {quota?.used_databases ?? 0} <span className="text-xs text-slate-500 font-normal">/ {quota?.max_databases ?? 2} DB</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, ((quota?.used_databases || 0) / (quota?.max_databases || 2)) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Memory Allocation */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Batas RAM per Container</span>
              <Cpu className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {quota?.max_memory_mb ?? 256} <span className="text-xs text-slate-500 font-normal">MB / project</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Isolasi OOM killer aktif.</p>
          </div>

          {/* CPU Allocation */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Alokasi CPU Core</span>
              <HardDrive className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {quota?.max_cpu_cores ?? 0.5} <span className="text-xs text-slate-500 font-normal">vCPU</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Prioritas seimbang per mahasiswa.</p>
          </div>
        </div>
      </div>

      {/* Useful Lab Links */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <h3 className="text-sm font-bold text-white mb-2">Layanan Pendukung Lab Praktikum</h3>
        <p className="text-xs text-slate-400 mb-4">
          Gunakan web viewer database resmi lab untuk mengelola tabel & query secara visual tanpa perlu install software di laptop:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="http://76.76.76.189:8978"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 transition group"
          >
            <div>
              <p className="text-sm font-bold text-slate-200 group-hover:text-sky-400 transition">
                CloudBeaver Web GUI
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Editor database visual ala DBeaver</p>
            </div>
            <ExternalLink className="h-4 w-4 text-slate-500 group-hover:text-sky-400 transition" />
          </a>

          <a
            href="http://76.76.76.189:8085"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 transition group"
          >
            <div>
              <p className="text-sm font-bold text-slate-200 group-hover:text-emerald-400 transition">
                Adminer Quick SQL
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Ringan & kilat untuk cek query SQL</p>
            </div>
            <ExternalLink className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition" />
          </a>
        </div>
      </div>
    </div>
  )
}
