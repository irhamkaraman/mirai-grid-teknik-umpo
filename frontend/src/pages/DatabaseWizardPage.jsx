import React, { useState } from 'react'
import {
  Wand2,
  Database,
  ArrowLeft,
  Server,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { launchDatabaseSSO } from '../utils/sso'

export default function DatabaseWizardPage({ user, onNavigate }) {
  const [step, setStep] = useState(1)
  const [engine, setEngine] = useState('postgres') // 'postgres' or 'mariadb'
  const [dbName, setDbName] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdResult, setCreatedResult] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)

  const studentNim = user?.username || 'mahasiswa'
  const cleanDbName = dbName.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const previewFullDbName = cleanDbName ? `s${studentNim}_${cleanDbName}` : `s${studentNim}_...`

  const copyText = (text, key, label) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
    } catch (e) {}
    setCopiedKey(key)
    toast.success(`${label} disalin ke clipboard!`)
    setTimeout(() => setCopiedKey(null), 3000)
  }

  const handleCreateDatabase = async (e) => {
    if (e) e.preventDefault()
    if (!cleanDbName) {
      toast.error('Masukkan nama database terlebih dahulu!')
      return
    }

    setLoading(true)
    const toastId = toast.loading('Sedang membuat database mandiri di server...')

    try {
      const res = await api.post('/databases/create', {
        engine,
        db_name: cleanDbName,
      })

      setCreatedResult({
        ...res.data,
        engine,
        cleanName: cleanDbName,
        fullName: `s${studentNim}_${cleanDbName}`,
        username: `s${studentNim}`,
        port: engine === 'postgres' ? 5432 : 3306,
        host: window.location.hostname || '76.76.76.189',
      })

      setStep(3)
      toast.success('Database berhasil dibuat dengan isolasi penuh!', { id: toastId })
    } catch (err) {
      const msg = err.response?.data?.detail || 'Gagal membuat database.'
      toast.error(msg, { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setDbName('')
    setCreatedResult(null)
    setStep(1)
  }

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
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-700/60">
                Database Wizard
              </span>
              <span className="text-xs text-[#A47E65]">/ Tools</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#26160F] flex items-center space-x-2.5 mt-0.5">
              <Wand2 className="h-6 w-6 text-amber-600" />
              <span>Database Wizard (Panduan Pembuatan Basis Data)</span>
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/databases')}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#2B1810] hover:bg-[#3E2316] border border-[#4D2D1E] text-xs font-semibold text-[#E8DCB8] hover:text-white transition shadow-md"
        >
          <Database className="h-3.5 w-3.5 text-[#E8C58D]" />
          <span>Lihat Semua Database Saya</span>
        </button>
      </div>

      {/* Stepper Progress */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-5 shadow-xl text-[#FAF5EC]">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {/* Step 1 Indicator */}
          <div className="flex items-center space-x-2.5">
            <div
              className={`h-9 w-9 rounded-2xl flex items-center justify-center font-bold text-xs font-mono transition-all ${
                step >= 1
                  ? 'bg-gradient-to-tr from-amber-600 to-terracotta-500 text-white shadow-md border border-amber-500/50'
                  : 'bg-[#1C0F0A] text-[#A47E65] border border-[#3E2316]'
              }`}
            >
              1
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold font-serif">Pilih Engine</div>
              <div className="text-[10px] text-[#A47E65]">Postgres / MySQL</div>
            </div>
          </div>

          <div className={`flex-1 h-0.5 mx-4 transition-colors ${step >= 2 ? 'bg-amber-600' : 'bg-[#3E2316]'}`}></div>

          {/* Step 2 Indicator */}
          <div className="flex items-center space-x-2.5">
            <div
              className={`h-9 w-9 rounded-2xl flex items-center justify-center font-bold text-xs font-mono transition-all ${
                step >= 2
                  ? 'bg-gradient-to-tr from-amber-600 to-terracotta-500 text-white shadow-md border border-amber-500/50'
                  : 'bg-[#1C0F0A] text-[#A47E65] border border-[#3E2316]'
              }`}
            >
              2
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold font-serif">Nama Database</div>
              <div className="text-[10px] text-[#A47E65]">Prefix & Skema</div>
            </div>
          </div>

          <div className={`flex-1 h-0.5 mx-4 transition-colors ${step >= 3 ? 'bg-amber-600' : 'bg-[#3E2316]'}`}></div>

          {/* Step 3 Indicator */}
          <div className="flex items-center space-x-2.5">
            <div
              className={`h-9 w-9 rounded-2xl flex items-center justify-center font-bold text-xs font-mono transition-all ${
                step === 3
                  ? 'bg-emerald-600 text-white shadow-md border border-emerald-400/50'
                  : 'bg-[#1C0F0A] text-[#A47E65] border border-[#3E2316]'
              }`}
            >
              ✓
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold font-serif">Hasil & Web GUI</div>
              <div className="text-[10px] text-[#A47E65]">Selesai & Akses</div>
            </div>
          </div>
        </div>
      </div>

      {/* STEP 1: ENGINE SELECTION */}
      {step === 1 && (
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 text-[#FAF5EC] shadow-xl space-y-6">
          <div className="border-b border-[#3E2316] pb-4">
            <h3 className="text-lg font-serif font-bold text-[#FAF5EC]">
              Langkah 1: Pilih Teknologi Database Engine
            </h3>
            <p className="text-xs text-[#DFCDB5]/80 mt-1">
              Pilih engine basis data sesuai modul atau kebutuhan mata kuliah praktikum Anda.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PostgreSQL Card */}
            <div
              onClick={() => setEngine('postgres')}
              className={`p-5 rounded-3xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                engine === 'postgres'
                  ? 'bg-[#3A2216] border-cyan-500 shadow-xl shadow-cyan-950/30'
                  : 'bg-[#1C0F0A] border-[#3E2316] hover:border-[#5C3825]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="h-10 w-10 rounded-xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-[#FAF5EC]">PostgreSQL 16</h4>
                    <span className="text-[10px] text-cyan-400 font-mono">Port 5432 • Enterprise Edition</span>
                  </div>
                </div>
                {engine === 'postgres' && (
                  <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                )}
              </div>

              <p className="text-xs text-[#DFCDB5]/80 leading-relaxed mb-4">
                Sistem database relasional objek tangguh dengan dukungan JSONB, indexing tingkat lanjut, dan kepatuhan penuh ACID.
              </p>

              <div className="p-3 rounded-2xl bg-[#120A07] border border-[#2E1A11] text-[11px] font-mono space-y-1">
                <div className="text-[#A47E65]">Web GUI Terintegrasi:</div>
                <div className="text-cyan-300 font-bold flex items-center space-x-1.5">
                  <span>phpPgAdmin (Auto-Login Sesi)</span>
                </div>
              </div>
            </div>

            {/* MariaDB / MySQL Card */}
            <div
              onClick={() => setEngine('mariadb')}
              className={`p-5 rounded-3xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                engine === 'mariadb'
                  ? 'bg-[#3A2216] border-amber-500 shadow-xl shadow-amber-950/30'
                  : 'bg-[#1C0F0A] border-[#3E2316] hover:border-[#5C3825]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="h-10 w-10 rounded-xl bg-amber-950/80 border border-amber-700/60 flex items-center justify-center text-[#E8C58D]">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-[#FAF5EC]">MySQL / MariaDB 11</h4>
                    <span className="text-[10px] text-[#E8C58D] font-mono">Port 3306 • MySQL 8 Compatible</span>
                  </div>
                </div>
                {engine === 'mariadb' && (
                  <CheckCircle2 className="h-5 w-5 text-amber-400" />
                )}
              </div>

              <p className="text-xs text-[#DFCDB5]/80 leading-relaxed mb-4">
                Pilihan standar industri untuk aplikasi web PHP, Laravel, Node.js, dan WordPress dengan performa tinggi & replikasi cepat.
              </p>

              <div className="p-3 rounded-2xl bg-[#120A07] border border-[#2E1A11] text-[11px] font-mono space-y-1">
                <div className="text-[#A47E65]">Web GUI Terintegrasi:</div>
                <div className="text-[#E8C58D] font-bold flex items-center space-x-1.5">
                  <span>phpMyAdmin (Auto-Login Sesi)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[#3E2316]">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-chocolate-700 to-chocolate-600 hover:from-chocolate-600 hover:to-terracotta-600 text-xs font-bold text-[#FAF5EC] rounded-2xl shadow-lg border border-chocolate-500/40 transition active:scale-95"
            >
              <span>Lanjut ke Penamaan Database</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: DATABASE NAME INPUT & LIVE PREVIEW */}
      {step === 2 && (
        <form onSubmit={handleCreateDatabase} className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 text-[#FAF5EC] shadow-xl space-y-6">
          <div className="border-b border-[#3E2316] pb-4">
            <h3 className="text-lg font-serif font-bold text-[#FAF5EC]">
              Langkah 2: Tentukan Nama Database Praktikum
            </h3>
            <p className="text-xs text-[#DFCDB5]/80 mt-1">
              Nama database akan otomatis diawali dengan prefix NIM/ID Anda untuk menjamin privasi dan isolasi antarmahasiswa.
            </p>
          </div>

          <div className="max-w-xl space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#DFCDB5] mb-2 font-mono">
                NAMA DATABASE (HURUF KECIL, ANGKA, UNDERSCORE)
              </label>

              <div className="flex items-center rounded-2xl bg-[#1C0F0A] border border-[#3E2316] focus-within:border-[#C49767] overflow-hidden shadow-inner">
                <span className="px-4 py-3 bg-[#140A07] border-r border-[#3E2316] text-[#A47E65] font-mono text-sm font-bold select-none">
                  s{studentNim}_
                </span>
                <input
                  type="text"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  placeholder="tugas_web / final_project"
                  autoFocus
                  required
                  className="w-full bg-transparent px-4 py-3 text-sm text-[#FAF5EC] font-mono outline-none"
                />
              </div>

              <p className="text-[11px] text-[#A47E65] mt-2">
                Hanya gunakan karakter alfanumerik huruf kecil dan underscore. Contoh: <code className="text-[#E8DCB8] font-mono">tugas1</code>, <code className="text-[#E8DCB8] font-mono">ecommerce_api</code>
              </p>
            </div>

            {/* Live Name Preview Box */}
            <div className="p-4 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-2">
              <span className="text-[10px] text-[#A47E65] font-mono uppercase tracking-wider block">
                PRATINJAU IDENTITAS DATABASE LENGKAP
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-[#120A07] border border-[#2E1A11]">
                  <span className="text-[10px] text-[#A47E65] block">NAMA DATABASE SERVER:</span>
                  <strong className="text-emerald-400 font-bold truncate block">{previewFullDbName}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-[#120A07] border border-[#2E1A11]">
                  <span className="text-[10px] text-[#A47E65] block">USERNAME OTOMATIS:</span>
                  <strong className="text-[#FAF5EC] font-bold block">s{studentNim}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#3E2316]">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-5 py-2.5 bg-[#1C0F0A] hover:bg-[#341F14] border border-[#3E2316] text-xs font-semibold text-[#DFCDB5] rounded-xl transition"
            >
              ← Kembali ke Langkah 1
            </button>

            <button
              type="submit"
              disabled={loading || !cleanDbName}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-xs font-bold text-white rounded-2xl shadow-lg border border-emerald-500/40 transition active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Membuat Database di Server...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Buat Database Sekarang</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: CREATION RESULT & DIRECT WEB GUI LAUNCH */}
      {step === 3 && createdResult && (
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 text-[#FAF5EC] shadow-xl space-y-6">
          <div className="flex items-center space-x-3 border-b border-[#3E2316] pb-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-xl font-serif font-bold text-[#FAF5EC]">
                Database Berhasil Dibuat!
              </h3>
              <p className="text-xs text-[#DFCDB5]/80 mt-0.5">
                Basis data mandiri Anda telah aktif di server dan siap digunakan untuk query atau aplikasi web.
              </p>
            </div>
          </div>

          {/* Credentials Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-1">
              <span className="text-[10px] text-[#A47E65] block uppercase">ENGINE</span>
              <strong className="text-[#FAF5EC] block text-sm font-bold uppercase">{createdResult.engine}</strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-1">
              <span className="text-[10px] text-[#A47E65] block uppercase">NAMA DATABASE</span>
              <strong className="text-emerald-400 block text-sm font-bold truncate">{createdResult.fullName}</strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-1">
              <span className="text-[10px] text-[#A47E65] block uppercase">USERNAME</span>
              <strong className="text-[#FAF5EC] block text-sm font-bold">{createdResult.username}</strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-1">
              <span className="text-[10px] text-[#A47E65] block uppercase">PORT</span>
              <strong className="text-amber-400 block text-sm font-bold">{createdResult.port}</strong>
            </div>
          </div>

          {/* Direct Auto-Login Launcher CTA */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#3A2216] to-[#2B1810] border border-[#5E3926] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold font-serif text-[#FAF5EC] flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-[#C49767]" />
                <span>Buka Web GUI Resmi ({createdResult.engine === 'postgres' ? 'phpPgAdmin' : 'phpMyAdmin'})</span>
              </h4>
              <p className="text-xs text-[#DFCDB5]/80">
                Sistem akan otomatis mengotentikasi sesi Anda (Auto-Login SSO) tanpa prompt password.
              </p>
            </div>

            <button
              type="button"
              onClick={() => launchDatabaseSSO(createdResult.engine)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-terracotta-500 hover:from-amber-500 hover:to-terracotta-400 text-xs font-bold text-white shadow-lg transition active:scale-95 shrink-0"
            >
              <span>Masuk Otomatis ke Web GUI</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#3E2316]">
            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-2.5 bg-[#1C0F0A] hover:bg-[#341F14] border border-[#3E2316] text-xs font-semibold text-[#DFCDB5] rounded-xl transition"
            >
              + Buat Database Lain
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/databases')}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-[#3A2216] hover:bg-[#4D2E1F] border border-[#5A3521] text-xs font-bold text-[#FAF5EC] rounded-xl transition shadow-md"
            >
              <span>Buka Daftar Database Saya</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
