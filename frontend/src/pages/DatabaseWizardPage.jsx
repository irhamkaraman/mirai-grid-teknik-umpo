import React, { useState, useEffect } from 'react'
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
  RefreshCw,
  Plus
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { launchDatabaseSSO } from '../utils/sso'
import { useTheme } from '../context/ThemeContext'
import Button from '../components/Button'
import Card from '../components/Card'

export default function DatabaseWizardPage({ user, onNavigate }) {
  const { isV2 } = useTheme()
  const [step, setStep] = useState(1)
  const [engine, setEngine] = useState('postgres') // 'postgres' or 'mariadb'
  const [dbName, setDbName] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdResult, setCreatedResult] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const [quota, setQuota] = useState(null)

  useEffect(() => {
    api.get('/quotas/my-quota')
      .then(res => setQuota(res.data))
      .catch(() => {})
  }, [])

  const dbStorageMaxMb = quota?.max_database_disk_mb || 5120
  const dbStorageUsedMb = quota?.used_database_disk_mb || 0
  const dbStorageRemainingMb = Math.max(0, parseFloat((dbStorageMaxMb - dbStorageUsedMb).toFixed(1)))

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

  if (isV2) {
    return (
      <div className="space-y-6 font-sans pb-12 animate-in fade-in duration-200">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                Database Wizard
              </span>
              <span className="text-xs text-slate-500">/ Tools</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2 mt-1">
              <Wand2 className="h-5 w-5 text-emerald-600" />
              <span>Panduan Pembuatan Database Mandiri</span>
            </h1>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={Database}
            onClick={() => onNavigate('/databases')}
          >
            Lihat Semua Database Saya
          </Button>
        </div>

        {/* Storage Quota Info Banner */}
        <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <Database className="h-4 w-4" />
            </div>
            <span className="text-slate-700">
              Storage Database: <strong className="font-mono text-slate-900">{dbStorageUsedMb} MB</strong> / {dbStorageMaxMb} MB (Sisa Ruang: <span className="text-emerald-600 font-bold font-mono">{dbStorageRemainingMb} MB</span>)
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Bebas membuat banyak database hingga kapasitas penyimpanan 5 GB penuh.
          </span>
        </Card>

        {/* Stepper Progress */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            {/* Step 1 Indicator */}
            <div className="flex items-center space-x-2.5">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs font-mono transition-colors ${
                  step >= 1
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                1
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-bold text-slate-900">Pilih Engine</div>
                <div className="text-[10px] text-slate-500">Postgres / MySQL</div>
              </div>
            </div>

            <div className={`flex-1 h-0.5 mx-3 transition-colors ${step >= 2 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

            {/* Step 2 Indicator */}
            <div className="flex items-center space-x-2.5">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs font-mono transition-colors ${
                  step >= 2
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                2
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-bold text-slate-900">Nama Database</div>
                <div className="text-[10px] text-slate-500">Prefix & Skema</div>
              </div>
            </div>

            <div className={`flex-1 h-0.5 mx-3 transition-colors ${step >= 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

            {/* Step 3 Indicator */}
            <div className="flex items-center space-x-2.5">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs font-mono transition-colors ${
                  step === 3
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                ✓
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-bold text-slate-900">Hasil & Web GUI</div>
                <div className="text-[10px] text-slate-500">Selesai & Akses</div>
              </div>
            </div>
          </div>
        </Card>

        {/* STEP 1: ENGINE SELECTION */}
        {step === 1 && (
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Langkah 1: Pilih Teknologi Database Engine
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Pilih engine basis data sesuai modul atau kebutuhan mata kuliah praktikum Anda.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PostgreSQL Card */}
              <div
                onClick={() => setEngine('postgres')}
                className={`p-5 rounded-xl border-2 transition-colors cursor-pointer relative overflow-hidden ${
                  engine === 'postgres'
                    ? 'bg-cyan-50/30 border-cyan-500 ring-2 ring-cyan-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-10 w-10 rounded-lg bg-cyan-100/80 border border-cyan-200 flex items-center justify-center text-cyan-600">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">PostgreSQL 16</h4>
                      <span className="text-[10px] text-cyan-600 font-mono">Port 5432 • Enterprise Edition</span>
                    </div>
                  </div>
                  {engine === 'postgres' && (
                    <CheckCircle2 className="h-5 w-5 text-cyan-600" />
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Sistem database relasional objek tangguh dengan dukungan JSONB, indexing tingkat lanjut, dan kepatuhan penuh ACID.
                </p>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] font-mono space-y-0.5">
                  <div className="text-slate-500">Web GUI Terintegrasi:</div>
                  <div className="text-cyan-700 font-bold flex items-center space-x-1.5">
                    <span>phpPgAdmin (Auto-Login Sesi)</span>
                  </div>
                </div>
              </div>

              {/* MariaDB / MySQL Card */}
              <div
                onClick={() => setEngine('mariadb')}
                className={`p-5 rounded-xl border-2 transition-colors cursor-pointer relative overflow-hidden ${
                  engine === 'mariadb'
                    ? 'bg-amber-50/30 border-amber-500 ring-2 ring-amber-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-10 w-10 rounded-lg bg-amber-100/80 border border-amber-200 flex items-center justify-center text-amber-600">
                      <Server className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">MySQL / MariaDB 11</h4>
                      <span className="text-[10px] text-amber-600 font-mono">Port 3306 • MySQL 8 Compatible</span>
                    </div>
                  </div>
                  {engine === 'mariadb' && (
                    <CheckCircle2 className="h-5 w-5 text-amber-600" />
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Pilihan standar industri untuk aplikasi web PHP, Laravel, Node.js, dan WordPress dengan performa tinggi & replikasi cepat.
                </p>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] font-mono space-y-0.5">
                  <div className="text-slate-500">Web GUI Terintegrasi:</div>
                  <div className="text-amber-700 font-bold flex items-center space-x-1.5">
                    <span>phpMyAdmin (Auto-Login Sesi)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => onNavigate('/databases')}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => setStep(2)}
              >
                Lanjut ke Penamaan Database
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 2: DATABASE NAME INPUT & LIVE PREVIEW */}
        {step === 2 && (
          <form onSubmit={handleCreateDatabase}>
            <Card className="p-6 sm:p-8 space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  Langkah 2: Tentukan Nama Database Praktikum
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Nama database akan otomatis diawali dengan prefix NIM/ID Anda untuk menjamin privasi dan isolasi antarmahasiswa.
                </p>
              </div>

              <div className="max-w-xl space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2 font-mono">
                    NAMA DATABASE (HURUF KECIL, ANGKA, UNDERSCORE)
                  </label>

                  <div className="flex items-center rounded-lg bg-white border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 overflow-hidden">
                    <span className="px-3.5 py-2.5 bg-slate-50 border-r border-slate-200 text-slate-500 font-mono text-sm font-bold select-none">
                      s{studentNim}_
                    </span>
                    <input
                      type="text"
                      value={dbName}
                      onChange={(e) => setDbName(e.target.value)}
                      placeholder="tugas_web / final_project"
                      autoFocus
                      required
                      className="w-full bg-transparent px-3.5 py-2 text-sm text-slate-900 font-mono outline-none"
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Hanya gunakan karakter alfanumerik huruf kecil dan underscore. Contoh: <code className="text-emerald-700 bg-emerald-50 px-1 rounded font-mono">tugas1</code>, <code className="text-emerald-700 bg-emerald-50 px-1 rounded font-mono">ecommerce_api</code>
                  </p>
                </div>

                {/* Live Name Preview Box */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block font-semibold">
                    PRATINJAU IDENTITAS DATABASE LENGKAP
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">NAMA DATABASE SERVER:</span>
                      <strong className="text-emerald-600 font-bold truncate block">{previewFullDbName}</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">USERNAME OTOMATIS:</span>
                      <strong className="text-slate-900 font-bold block">s{studentNim}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setStep(1)}
                >
                  Sebelumnya
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={Sparkles}
                  loading={loading}
                  disabled={!cleanDbName}
                >
                  Buat & Inisialisasi Database
                </Button>
              </div>
            </Card>
          </form>
        )}

        {/* STEP 3: CREATION RESULT & DIRECT WEB GUI LAUNCH */}
        {step === 3 && createdResult && (
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
              <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Database Berhasil Dibuat!
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Basis data mandiri Anda telah aktif di server dan siap digunakan untuk query atau aplikasi web.
                </p>
              </div>
            </div>

            {/* Credentials Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase">ENGINE</span>
                <strong className="text-slate-900 block text-sm font-bold uppercase">{createdResult.engine}</strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase">NAMA DATABASE</span>
                <strong className="text-emerald-600 block text-sm font-bold truncate">{createdResult.fullName}</strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase">USERNAME</span>
                <strong className="text-slate-900 block text-sm font-bold">{createdResult.username}</strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase">PORT</span>
                <strong className="text-amber-600 block text-sm font-bold">{createdResult.port}</strong>
              </div>
            </div>

            {/* Direct Auto-Login Launcher CTA */}
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>Buka Web GUI Resmi ({createdResult.engine === 'postgres' ? 'phpPgAdmin' : 'phpMyAdmin'})</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Sistem akan otomatis mengotentikasi sesi Anda (Auto-Login SSO) tanpa prompt password.
                </p>
              </div>

              <Button
                variant="emerald"
                size="md"
                icon={ExternalLink}
                iconPosition="right"
                onClick={() => launchDatabaseSSO(createdResult.engine)}
              >
                Masuk Otomatis ke Web GUI
              </Button>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                size="md"
                icon={Plus}
                onClick={handleReset}
              >
                Buat Database Lain
              </Button>

              <Button
                variant="primary"
                size="md"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => onNavigate('/databases')}
              >
                Buka Daftar Database Saya
              </Button>
            </div>
          </Card>
        )}
      </div>
    )
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

      {/* Storage Quota Info Banner */}
      <div className="p-4 rounded-2xl bg-[#2B1810] border border-[#4D2D1E] text-[#FAF5EC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
        <div className="flex items-center space-x-2.5">
          <Database className="h-4 w-4 text-[#E8C58D] shrink-0" />
          <span>
            Storage Database: <strong className="font-mono text-[#FAF5EC]">{dbStorageUsedMb} MB</strong> / {dbStorageMaxMb} MB (Sisa Ruang: <span className="text-emerald-400 font-bold font-mono">{dbStorageRemainingMb} MB</span>)
          </span>
        </div>
        <span className="text-[11px] text-[#DFCDB5]/80 font-sans">
          Bebas membuat banyak database hingga kapasitas penyimpanan 5 GB penuh.
        </span>
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
              className="inline-flex items-center space-x-2 px-6 py-3 bg-[#1C0F0A] hover:bg-[#341F14] border border-[#4D2D1E] hover:border-[#6B3F2B] text-xs font-bold text-[#DFCDB5] hover:text-[#FAF5EC] rounded-2xl transition shadow-md active:scale-95 group"
            >
              <ArrowLeft className="h-4 w-4 text-[#A47E65] group-hover:text-[#FAF5EC] transition-transform group-hover:-translate-x-0.5" />
              <span>Kembali ke Langkah 1</span>
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
              className="inline-flex items-center space-x-2 px-6 py-3 bg-[#1C0F0A] hover:bg-[#341F14] border border-[#4D2D1E] hover:border-[#6B3F2B] text-xs font-bold text-[#DFCDB5] hover:text-[#FAF5EC] rounded-2xl transition shadow-md active:scale-95 group"
            >
              <Plus className="h-4 w-4 text-[#A47E65] group-hover:text-[#FAF5EC]" />
              <span>Buat Database Lain</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/databases')}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-chocolate-700 to-chocolate-600 hover:from-chocolate-600 hover:to-terracotta-600 text-xs font-bold text-[#FAF5EC] rounded-2xl shadow-lg border border-chocolate-500/40 transition active:scale-95"
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
