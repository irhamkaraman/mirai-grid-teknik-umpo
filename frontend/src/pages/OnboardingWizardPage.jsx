import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Database,
  Server,
  Globe,
  Copy,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  Cpu,
  HardDrive,
  Layers,
  Terminal,
  Check,
  AlertCircle,
  FileCode,
  FolderArchive,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import Button from '../components/Button'
import { formatMBSize } from '../utils/formatters'
import { isDosenRole, getRoleLabel } from '../utils/roleHelper'

export default function OnboardingWizardPage({ user, onComplete }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Step 1 State: Profile & Resource (Always starts completely empty for new registration)
  const [displayName, setDisplayName] = useState('')
  const [quotas, setQuotas] = useState({
    max_disk_mb: 10240,
    max_memory_mb: 512,
    max_cpu_cores: 0.5,
    max_databases: 2
  })

  // Step 2 State: Database Provisioning
  const [selectedEngine, setSelectedEngine] = useState('mariadb')
  const [dbSuffix, setDbSuffix] = useState('praktikum')
  const [provisionedDb, setProvisionedDb] = useState(null)
  const [copiedKey, setCopiedKey] = useState('')
  const [isProvisioningDb, setIsProvisioningDb] = useState(false)
  const [dbStatusText, setDbStatusText] = useState('')

  // Step 3 State: Runtime & File Upload
  const [selectedRuntime, setSelectedRuntime] = useState('php83')
  const [uploadedFile, setUploadedFile] = useState(null)
  const [useStarterTemplate, setUseStarterTemplate] = useState(true)
  const [provisionedProject, setProvisionedProject] = useState(null)

  // Step 4 State: Subdomain & Celebration
  const [subdomainData, setSubdomainData] = useState(null)

  // Preparation & Direct Deploy Spinner Modal States
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployProgress, setDeployProgress] = useState(0)
  const [deployStepIndex, setDeployStepIndex] = useState(0)
  const [deployStatusText, setDeployStatusText] = useState('')

  const username = user?.username || 'mahasiswa'

  useEffect(() => {
    fetchOnboardingStatus()
  }, [])

  const fetchOnboardingStatus = async () => {
    setLoading(true)
    try {
      const res = await api.get('/onboarding/status')
      const data = res.data
      if (data.onboarding_completed) {
        onComplete(data.user)
        return
      }

      const step = data.onboarding_step || 1
      setCurrentStep(step)
      // Step 1 input must stay blank so user enters their own name
      if (step > 1 && data.user?.name) {
        setDisplayName(data.user.name)
      } else {
        setDisplayName('')
      }
      if (data.quotas) setQuotas(data.quotas)
      if (data.provisioned_database) setProvisionedDb(data.provisioned_database)
      if (data.provisioned_project) {
        setProvisionedProject({
          ...data.provisioned_project,
          project_id: data.provisioned_project.project_id || data.provisioned_project.id
        })
        if (data.provisioned_project.public_url) {
          setSubdomainData({
            subdomain: data.provisioned_project.public_subdomain,
            public_url: data.provisioned_project.public_url,
            status: 'active'
          })
        }
      }
    } catch (err) {
      console.error('Failed to fetch onboarding status', err)
    } finally {
      setLoading(false)
    }
  }

  // --- STEP 1: Profile & Resources ---
  const handleStep1Submit = async (e) => {
    e.preventDefault()
    if (!displayName.trim()) {
      toast.error('Silakan masukkan nama lengkap Anda.')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/onboarding/step1', { name: displayName.trim() })
      toast.success('Profil berhasil dikonfirmasi!')
      setCurrentStep(2)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan profil.')
    } finally {
      setSubmitting(false)
    }
  }

  // --- STEP 2: Database Provisioning with Live Animated Feedback ---
  const handleStep2Provision = async () => {
    setIsProvisioningDb(true)
    setDbStatusText('Menghubungi klaster database lab...')
    try {
      await new Promise((r) => setTimeout(r, 600))
      setDbStatusText(`Membuat database terisolasi s${username}_${dbSuffix || 'praktikum'}...`)

      const res = await api.post('/onboarding/step2', {
        engine: selectedEngine,
        db_name_suffix: dbSuffix
      })

      setDbStatusText('Menyimpan kredensial mandiri & hak akses terisolasi...')
      await new Promise((r) => setTimeout(r, 600))

      setProvisionedDb(res.data.database)
      toast.success(res.data.message || 'Database nyata berhasil diprovisi!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memprovisi database.')
    } finally {
      setIsProvisioningDb(false)
    }
  }

  // --- STEP 3: Runtime Stack & Direct Automated Deployment ---
  const handleStep3Deploy = async () => {
    setIsDeploying(true)
    setDeployProgress(15)
    setDeployStepIndex(0)
    setDeployStatusText('Mengalokasikan direktori workspace & resource sandboxed...')

    try {
      const formData = new FormData()
      formData.append('runtime', selectedRuntime)
      formData.append('project_name', 'public_html')
      if (uploadedFile && !useStarterTemplate) {
        formData.append('file', uploadedFile)
      }

      // Step 3 execution
      setDeployProgress(35)
      setDeployStepIndex(1)
      setDeployStatusText(`Menginisialisasi container runtime ${selectedRuntime.toUpperCase()}...`)

      const resStep3 = await api.post('/onboarding/step3', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setProvisionedProject(resStep3.data)

      // Step 4 automated chain: Subdomain registration & Nginx host routing
      setDeployProgress(65)
      setDeployStepIndex(2)
      setDeployStatusText('Mendaftarkan routing reverse proxy Nginx host & SSL...')

      const projectId = resStep3.data.project_id || resStep3.data.id
      const resStep4 = await api.post('/onboarding/step4', {
        project_id: projectId
      })

      setDeployProgress(90)
      setDeployStepIndex(3)
      setDeployStatusText('Memverifikasi status HTTP 200 service publik...')

      await new Promise((r) => setTimeout(r, 700))
      setDeployProgress(100)
      setDeployStatusText('Deployment sukses! Semua infrastruktur telah live.')

      setSubdomainData(resStep4.data)
      await new Promise((r) => setTimeout(r, 500))

      // Direct transition to Step 4 Celebration Card
      setCurrentStep(4)
      toast.success('Infrastruktur live! Aplikasi Anda berhasil di-deploy.')
    } catch (err) {
      console.error('Deploy error', err)
      toast.error(err.response?.data?.detail || 'Gagal menyiapkan deployment.')
    } finally {
      setIsDeploying(false)
    }
  }

  // --- STEP 4: Subdomain & Publish (Fallback if arrived at Step 4 manually) ---
  const handleStep4Publish = async () => {
    if (!provisionedProject?.project_id) {
      toast.error('Project ID tidak ditemukan.')
      return
    }

    setIsDeploying(true)
    setDeployProgress(60)
    setDeployStepIndex(2)
    setDeployStatusText('Mendaftarkan routing reverse proxy Nginx host & SSL...')

    try {
      const res = await api.post('/onboarding/step4', {
        project_id: provisionedProject.project_id
      })

      setDeployProgress(90)
      setDeployStepIndex(3)
      setDeployStatusText('Memverifikasi status HTTP 200 service publik...')
      await new Promise((r) => setTimeout(r, 600))
      setDeployProgress(100)
      setDeployStatusText('Subdomain publik live!')

      setSubdomainData(res.data)
      await new Promise((r) => setTimeout(r, 400))
      toast.success('Selamat! Onboarding selesai & subdomain telah aktif!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengaktifkan subdomain.')
    } finally {
      setIsDeploying(false)
    }
  }

  const handleFinishOnboarding = () => {
    onComplete({
      ...user,
      name: displayName,
      onboarding_completed: true,
      onboarding_step: 4
    })
  }

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success('Berhasil disalin ke clipboard!')
    setTimeout(() => setCopiedKey(''), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-slate-900 p-4">
        <div className="flex flex-col items-center space-y-3 bg-white border border-slate-200 p-8 rounded-xl text-slate-900">
          <RefreshCw className="h-8 w-8 text-slate-700 animate-spin" />
          <p className="text-xs text-slate-500 font-mono">Memuat Onboarding Wizard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-center items-center font-sans p-4 sm:p-6 md:p-8">
      
      {/* Centered Brand Header & Stepper */}
      <div className="w-full max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand Identity */}
        <div className="flex items-center space-x-3.5">
          <img
            src="/logos/miraigrid-logo.svg"
            alt="MiraiGrid"
            className="h-10 w-10 rounded-xl bg-white p-1.5 border border-slate-200"
          />
          <div>
            <h1 className="font-bold text-lg text-slate-900 tracking-tight flex items-center space-x-2">
              <span>MiraiGrid</span>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Setup Akun Baru
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 font-mono">NIM / Username: {username}</p>
          </div>
        </div>

        {/* Minimalist In-Flow Step Stepper */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 bg-white p-1.5 rounded-xl border border-slate-200 overflow-x-auto max-w-full">
          {[
            { num: 1, label: 'Alokasi' },
            { num: 2, label: 'Database' },
            { num: 3, label: 'Runtime' },
            { num: 4, label: 'Subdomain' }
          ].map((s) => (
            <div key={s.num} className="flex items-center shrink-0">
              <div
                className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  currentStep === s.num
                    ? 'bg-slate-900 text-white'
                    : currentStep > s.num
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'text-slate-500'
                }`}
              >
                {currentStep > s.num ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <span className="font-mono text-[11px]">{s.num}</span>
                )}
                <span>{s.label}</span>
              </div>
              {s.num < 4 && <div className="w-2 h-px bg-slate-200 mx-0.5" />}
            </div>
          ))}
        </div>
      </div>

      {/* Main Wizard Form Container */}
      <main className="w-full max-w-4xl mx-auto flex flex-col justify-center">
        
        {/* STEP 1: Pengenalan & Alokasi Resource */}
        {currentStep === 1 && (
          <div
            key="step-1"
            className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Selamat Datang di MiraiGrid Cloud Lab!
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Platform PaaS Mandiri Laboratorium Teknik Informatika UMPO untuk Mahasiswa.
                </p>
              </div>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-6">
              {/* Form Input Display Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Konfirmasi Nama Lengkap Mahasiswa
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Masukkan nama lengkap Anda..."
                  required
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white rounded-lg px-4 py-2.5 text-sm text-slate-900 outline-none transition font-sans"
                />
                <p className="text-[11px] text-slate-500">
                  Nama ini akan ditampilkan pada sertifikat praktikum, dashboard, dan audit log pengerjaan tugas.
                </p>
              </div>

              {/* Infographics Alokasi Resource */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {isDosenRole(user?.role)
                    ? 'Alokasi Kuota & Resource Komputasi Dosen'
                    : 'Alokasi Kuota Sandbox Praktikum Anda'}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
                    <HardDrive className="h-5 w-5 text-emerald-600 mx-auto mb-2" />
                    <div className="text-lg font-bold font-mono text-slate-900">{formatMBSize(quotas.max_disk_mb || 10240)}</div>
                    <div className="text-[11px] text-slate-500">Storage File Manager</div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
                    <Cpu className="h-5 w-5 text-emerald-600 mx-auto mb-2" />
                    <div className="text-lg font-bold font-mono text-slate-900">{formatMBSize(quotas.max_memory_mb || 512)}</div>
                    <div className="text-[11px] text-slate-500">Alokasi RAM Sandboxed</div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
                    <Layers className="h-5 w-5 text-emerald-600 mx-auto mb-2" />
                    <div className="text-lg font-bold font-mono text-slate-900">{quotas.max_cpu_cores} vCPU</div>
                    <div className="text-[11px] text-slate-500">Batas Komputasi CPU</div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
                    <Database className="h-5 w-5 text-emerald-600 mx-auto mb-2" />
                    <div className="text-lg font-bold font-mono text-slate-900">{formatMBSize(quotas.max_database_disk_mb || 5120)}</div>
                    <div className="text-[11px] text-slate-500">MySQL / PG Enterprise</div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={submitting}
                >
                  <span>{submitting ? 'Menyimpan...' : 'Konfirmasi & Lanjut ke Step 2'}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: Database Provisioning */}
        {currentStep === 2 && (
          <div
            key="step-2"
            className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Step 2: Provisi Database Mandiri
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Pilih mesin basis data nyata Anda untuk isolasi penuh selama praktikum.
                </p>
              </div>
            </div>

            {!provisionedDb ? (
              <div className="space-y-6">
                {/* Engine Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* MariaDB / MySQL */}
                  <div
                    onClick={() => setSelectedEngine('mariadb')}
                    className={`cursor-pointer rounded-xl p-5 border transition-colors ${
                      selectedEngine === 'mariadb'
                        ? 'bg-emerald-50/40 border-emerald-500'
                        : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <img src="/logos/mariadb.svg" alt="MariaDB" className="h-6 w-6 object-contain" />
                        <span className="text-xs font-semibold font-mono text-slate-700 px-2.5 py-0.5 bg-white rounded-lg border border-slate-200">
                          MySQL / MariaDB 11
                        </span>
                      </div>
                      {selectedEngine === 'mariadb' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                    </div>
                    <h4 className="font-bold text-base text-slate-900">MariaDB Enterprise</h4>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                      Sangat cocok untuk Laravel, CodeIgniter, WordPress, dan praktikum basis data relasional standar.
                    </p>
                    <div className="mt-3 text-[11px] text-slate-500 font-mono">Port Publik: :3306</div>
                  </div>

                  {/* PostgreSQL */}
                  <div
                    onClick={() => setSelectedEngine('postgres')}
                    className={`cursor-pointer rounded-xl p-5 border transition-colors ${
                      selectedEngine === 'postgres'
                        ? 'bg-emerald-50/40 border-emerald-500'
                        : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <img src="/logos/postgres.svg" alt="PostgreSQL" className="h-6 w-6 object-contain" />
                        <span className="text-xs font-semibold font-mono text-sky-700 px-2.5 py-0.5 bg-white rounded-lg border border-slate-200">
                          PostgreSQL 16
                        </span>
                      </div>
                      {selectedEngine === 'postgres' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                    </div>
                    <h4 className="font-bold text-base text-slate-900">PostgreSQL Enterprise</h4>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                      Sangat cocok untuk Next.js (Prisma/Drizzle), Django, FastAPI, analitik data, dan indexing modern.
                    </p>
                    <div className="mt-3 text-[11px] text-slate-500 font-mono">Port Publik: :5432</div>
                  </div>
                </div>

                {/* Suffix database input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Nama Suffix Database (Otomatis Dibuat)
                  </label>
                  <div className="flex items-center">
                    <span className="bg-slate-100 border border-r-0 border-slate-200 rounded-l-lg px-3.5 py-2.5 text-xs font-mono text-slate-500">
                      s{username}_
                    </span>
                    <input
                      type="text"
                      value={dbSuffix}
                      onChange={(e) => setDbSuffix(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="praktikum"
                      className="flex-1 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white rounded-r-lg px-3.5 py-2.5 text-sm text-slate-900 outline-none font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Pola nama database: <strong className="text-slate-800">s{username}_{dbSuffix || 'praktikum'}</strong> dengan user terisolasi <strong className="text-slate-800">s{username}</strong>.
                  </p>
                </div>

                <div className="pt-4 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setCurrentStep(1)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Kembali</span>
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={handleStep2Provision}
                    disabled={submitting || isProvisioningDb}
                  >
                    <span>{isProvisioningDb ? 'Memprovisi Database...' : 'Provisi Database Otomatis'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              /* Success Provisioned Card */
              <div className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                  <div className="flex items-center space-x-2.5 mb-1.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <h4 className="font-bold text-base text-emerald-900">
                      Database Nyata Berhasil Terbentuk &amp; Terisolasi!
                    </h4>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Kredensial berikut telah tersimpan aman dan terintegrasi otomatis dengan CloudBeaver &amp; Adminer Lab.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                    <span className="text-slate-500">Database Name:</span>
                    <span className="text-slate-900 font-bold">{provisionedDb.db_name}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                    <span className="text-slate-500">Username:</span>
                    <span className="text-slate-900 font-bold">{provisionedDb.db_username}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                    <span className="text-slate-500">Password:</span>
                    <span className="text-slate-900">{provisionedDb.db_password}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                    <span className="text-slate-500">Host &amp; Port:</span>
                    <span className="text-slate-900">{provisionedDb.host}:{provisionedDb.port}</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-slate-500 block mb-1">Connection URI:</span>
                    <div className="flex items-center space-x-2 bg-white border border-slate-200 p-2 rounded-lg text-[11px] overflow-hidden">
                      <span className="truncate flex-1 text-slate-800">{provisionedDb.connection_uri}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(provisionedDb.connection_uri, 'uri')}
                        className="p-1 text-slate-500 hover:text-slate-900"
                        title="Salin Connection URI"
                      >
                        {copiedKey === 'uri' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={() => setCurrentStep(3)}
                  >
                    <span>Lanjut ke Step 3: Runtime Stack</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Runtime Stack & Auto-Extract Upload */}
        {currentStep === 3 && (
          <div
            key="step-3"
            className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Step 3: Runtime Stack &amp; Kode Aplikasi
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  {isDosenRole(user?.role)
                    ? 'Sandbox Dosen: Unggah berkas riset, modul ajar, atau aplikasi pengujian Anda.'
                    : 'Tentukan bahasa pemrograman dan unggah project praktikum Anda.'}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Runtime Choices */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Pilih Runtime Pemrograman Utama
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'php83', name: 'PHP 8.3 (OLS)', tag: 'OpenLiteSpeed / Laravel / CI', logo: '/logos/php.svg' },
                    { id: 'node20', name: 'Node.js 20', tag: 'React / Express / Vite', logo: '/logos/node.svg' },
                    { id: 'python311', name: 'Python 3.11', tag: 'FastAPI / Flask / Django', logo: '/logos/python.svg' }
                  ].map((rt) => (
                    <div
                      key={rt.id}
                      onClick={() => setSelectedRuntime(rt.id)}
                      className={`cursor-pointer rounded-xl p-4 border transition-colors text-center ${
                        selectedRuntime === rt.id
                          ? 'bg-emerald-50/40 border-emerald-500'
                          : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="h-10 flex items-center justify-center mb-2">
                        <img src={rt.logo} alt={rt.name} className="h-8 w-8 object-contain" />
                      </div>
                      <div className="font-bold text-sm text-slate-900">{rt.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{rt.tag}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upload or Starter Option */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="starter-check"
                    checked={useStarterTemplate}
                    onChange={(e) => {
                      setUseStarterTemplate(e.target.checked)
                      if (e.target.checked) setUploadedFile(null)
                    }}
                    className="rounded border-slate-300 text-slate-900 accent-slate-900 focus:ring-0"
                  />
                  <label htmlFor="starter-check" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Gunakan Starter Template Otomatis (Rekomendasi untuk Uji Coba Pertama)
                  </label>
                </div>

                {!useStarterTemplate && (
                  <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 rounded-xl p-6 text-center transition-colors">
                    <input
                      type="file"
                      id="onboarding-file"
                      onChange={(e) => setUploadedFile(e.target.files[0])}
                      className="hidden"
                      accept=".zip,.php,.js,.py,.html,.tar.gz"
                    />
                    <label htmlFor="onboarding-file" className="cursor-pointer flex flex-col items-center space-y-2">
                      <UploadCloud className="h-10 w-10 text-emerald-600" />
                      <div className="text-xs font-semibold text-slate-900">
                        {uploadedFile ? uploadedFile.name : 'Klik atau Drag & Drop file project (.zip atau single file)'}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        File ZIP akan diekstrak secara otomatis &amp; aman dengan proteksi Anti-Zip Slip.
                      </p>
                    </label>
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setCurrentStep(2)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Kembali</span>
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={handleStep3Deploy}
                  disabled={submitting || isDeploying}
                >
                  <span>{isDeploying ? 'Sedang Menyiapkan...' : 'Deploy & Aktifkan Service'}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Subdomain Generation & Celebration */}
        {currentStep === 4 && (
          <div
            key="step-4"
            className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Step 4: Subdomain Publik &amp; Siap Pakai
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Publikasikan aplikasi web Anda ke subdomain live kampus dengan SSL HTTPS otomatis.
                </p>
              </div>
            </div>

            {!subdomainData ? (
              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="text-xs text-slate-600">
                    Pola subdomain publik resmi {getRoleLabel(user?.role).toLowerCase()}:
                  </div>
                  <div className="font-mono text-base text-emerald-700 font-bold">
                    web-xxxx-{username}.miraigrid.web.id
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Routing Nginx host akan mengarahkan request HTTPS publik langsung ke container sandbox Anda tanpa memerlukan port manual.
                  </p>
                </div>

                <div className="pt-4 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setCurrentStep(3)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Kembali</span>
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={handleStep4Publish}
                    disabled={submitting || isDeploying}
                  >
                    <span>{submitting ? 'Mengaktifkan Routing...' : 'Generate & Aktifkan Subdomain'}</span>
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              /* Celebration & Final Dashboard CTA */
              <div className="space-y-6">
                {/* Refined Header */}
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 mb-1">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    Infrastruktur Siap Digunakan
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                    {isDosenRole(user?.role)
                      ? 'Selamat datang Bapak/Ibu Dosen di MiraiGrid Cloud Workspace!'
                      : 'Workspace mandiri Anda telah dikonfigurasi dan siap melayani aplikasi praktikum secara publik.'}
                  </p>
                </div>

                {/* Elegant URL Address Bar Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 flex items-center space-x-1.5">
                      <Globe className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Subdomain Publik Resmi</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono flex items-center space-x-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>SSL Ingress Terproteksi</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 bg-white border border-slate-200 px-3.5 py-2.5 rounded-lg">
                    <span className="text-xs text-slate-400 font-mono select-none">https://</span>
                    <span className="text-xs sm:text-sm font-mono font-semibold text-emerald-700 truncate flex-1">
                      {subdomainData.public_url ? subdomainData.public_url.replace(/^https?:\/\//, '') : ''}
                    </span>
                    
                    <div className="flex items-center space-x-1.5 shrink-0 pl-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(subdomainData.public_url, 'subdomain')}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs transition border border-slate-200"
                        title="Salin Tautan"
                      >
                        {copiedKey === 'subdomain' ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-[11px] font-medium text-emerald-700">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-medium">Salin</span>
                          </>
                        )}
                      </button>

                      <a
                        href={subdomainData.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs transition border border-slate-200"
                        title="Buka Website"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-medium">Buka</span>
                      </a>
                    </div>
                  </div>

                  {/* Micro-specs summary row */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-slate-500">
                    <div className="bg-white rounded-lg py-1.5 px-2 text-center border border-slate-200">
                      <span className="text-slate-400 block font-mono text-[10px]">ROUTING</span>
                      <span className="text-emerald-700 font-medium">Zero-Port Nginx</span>
                    </div>
                    <div className="bg-white rounded-lg py-1.5 px-2 text-center border border-slate-200">
                      <span className="text-slate-400 block font-mono text-[10px]">ENKRIPSI</span>
                      <span className="text-emerald-700 font-medium">TLS 1.3 HTTPS</span>
                    </div>
                    <div className="bg-white rounded-lg py-1.5 px-2 text-center border border-slate-200">
                      <span className="text-slate-400 block font-mono text-[10px]">ISOLASI</span>
                      <span className="text-emerald-700 font-medium">Multi-Tenant</span>
                    </div>
                  </div>
                </div>

                {/* Final Enter Dashboard Button */}
                <div className="pt-2 flex justify-center">
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={handleFinishOnboarding}
                  >
                    <span>Masuk ke Dashboard Utama</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Animated Preparation & Deployment Spinner Modal */}
        {isDeploying && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 max-w-lg w-full text-center space-y-6">
              {/* Dual-Ring Spinner */}
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-t-slate-900 border-r-transparent border-b-emerald-500 border-l-transparent rounded-full animate-spin" />
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800">
                  <Server className="h-6 w-6" />
                </div>
              </div>

              {/* Modal Titles */}
              <div className="space-y-1">
                <h3 className="font-bold text-lg sm:text-xl text-slate-900">
                  Menyiapkan Lingkungan Cloud...
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-sans">
                  {deployStatusText || 'Sistem sedang memprovisi container dan routing publik.'}
                </p>
              </div>

              {/* Progress Bar & Percentage */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-500">Progress Otomatisasi:</span>
                  <span className="text-emerald-700 font-bold">{deployProgress}%</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${deployProgress}%` }}
                  />
                </div>
              </div>

              {/* Live Stage Checklist */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2.5 font-sans text-xs">
                {[
                  { label: 'Alokasi Sandbox & Direktori Kerja Mahasiswa', idx: 0 },
                  { label: 'Inisialisasi Container Runtime & Port Binding', idx: 1 },
                  { label: 'Konfigurasi Nginx Host Ingress & Routing Subdomain', idx: 2 },
                  { label: 'Verifikasi TLS Ingress & Health Check Endpoint', idx: 3 }
                ].map((stage) => {
                  const isDone = deployStepIndex > stage.idx || deployProgress === 100
                  const isCurrent = deployStepIndex === stage.idx && deployProgress < 100
                  return (
                    <div key={stage.idx} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : isCurrent ? (
                          <RefreshCw className="h-4 w-4 text-slate-700 animate-spin shrink-0" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-slate-300 shrink-0" />
                        )}
                        <span className={isDone ? 'text-emerald-700 font-medium' : isCurrent ? 'text-slate-900 font-semibold' : 'text-slate-400'}>
                          {stage.label}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">
                        {isDone ? 'SELESAI' : isCurrent ? 'PROSES' : 'MENUNGGU'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Database Provisioning Spinner Modal */}
        {isProvisioningDb && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 max-w-md w-full text-center space-y-5">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-t-slate-900 border-r-transparent border-b-emerald-500 border-l-transparent rounded-full animate-spin" />
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800">
                  <Database className="h-5 w-5" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-slate-900">
                  Memprovisi Database Mandiri...
                </h3>
                <p className="text-xs text-slate-500 font-sans">
                  {dbStatusText || 'Menyiapkan database server dan kredensial terisolasi.'}
                </p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
