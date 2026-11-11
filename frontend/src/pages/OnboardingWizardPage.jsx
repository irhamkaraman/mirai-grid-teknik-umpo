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

export default function OnboardingWizardPage({ user, onComplete }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Step 1 State: Profile & Resource (Always starts completely empty for new registration)
  const [displayName, setDisplayName] = useState('')
  const [quotas, setQuotas] = useState({
    max_disk_mb: 500,
    max_memory_mb: 256,
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
  const [selectedRuntime, setSelectedRuntime] = useState('php82')
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
      <div className="min-h-screen bg-[#E6D7BE] flex items-center justify-center text-[#26160F] p-4">
        <div className="flex flex-col items-center space-y-3 bg-[#2B1810] border border-[#4D2D1E] p-8 rounded-3xl shadow-2xl text-[#FAF5EC] alpine-pop-in">
          <RefreshCw className="h-8 w-8 text-[#C49767] animate-spin" />
          <p className="text-xs text-[#E8C58D] font-mono">Memuat Onboarding Wizard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#E6D7BE] text-[#FAF5EC] flex flex-col justify-center items-center font-sans selection:bg-[#5A3521] selection:text-[#FAF5EC] p-4 sm:p-6 md:p-8">
      
      {/* Centered Brand Header & Stepper (No Full Navbar) */}
      <div className="w-full max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 alpine-pop-in">
        {/* Brand Identity */}
        <div className="flex items-center space-x-3.5">
          <img
            src="/logos/miraigrid-logo.svg"
            alt="MiraiGrid"
            className="h-10 w-10 rounded-2xl bg-white p-1 border border-[#D4C1AC] shadow-md transition-transform duration-300 hover:scale-105"
          />
          <div>
            <h1 className="font-serif font-bold text-xl text-[#26160F] tracking-wide flex items-center space-x-2">
              <span>MiraiGrid</span>
              <span className="text-[10px] font-sans font-semibold text-[#8C5E35] bg-[#E0CFB3] px-2.5 py-0.5 rounded-full border border-[#D4C1AC]">
                Setup Akun Baru
              </span>
            </h1>
            <p className="text-[11px] text-[#785338] font-mono">NIM / Username: {username}</p>
          </div>
        </div>

        {/* Minimalist In-Flow Step Stepper */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 bg-[#DFCEA9]/75 backdrop-blur-sm p-1.5 rounded-2xl border border-[#D4C1AC]/90 shadow-sm">
          {[
            { num: 1, label: 'Alokasi' },
            { num: 2, label: 'Database' },
            { num: 3, label: 'Runtime' },
            { num: 4, label: 'Subdomain' }
          ].map((s) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300 ${
                  currentStep === s.num
                    ? 'bg-[#2B1810] text-[#E8C58D] border border-[#5A3521] shadow-md scale-105'
                    : currentStep > s.num
                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 shadow-sm'
                    : 'text-[#785338] hover:text-[#26160F]'
                }`}
              >
                {currentStep > s.num ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <span className="font-mono text-[11px]">{s.num}</span>
                )}
                <span>{s.label}</span>
              </div>
              {s.num < 4 && <div className="w-2.5 h-px bg-[#C5B396] mx-0.5" />}
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
            x-data="{ step: 1 }"
            x-transition:enter="transition ease-out duration-300 transform"
            x-transition:enter-start="opacity-0 translate-y-4 scale-95"
            x-transition:enter-end="opacity-100 translate-y-0 scale-100"
            className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 shadow-2xl alpine-transition"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-2xl bg-[#3A2216] border border-[#5A3521] text-[#E8C58D]">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF5EC]">
                  Selamat Datang di MiraiGrid Cloud Lab!
                </h2>
                <p className="text-xs sm:text-sm text-[#C49767] mt-0.5">
                  Platform PaaS Mandiri Laboratorium Teknik Informatika UMPO untuk Mahasiswa.
                </p>
              </div>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-6">
              {/* Form Input Display Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#DFCDB5] block">
                  Konfirmasi Nama Lengkap Mahasiswa
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Masukkan nama lengkap Anda..."
                  required
                  className="w-full bg-[#1E110A] border border-[#4D2D1E] focus:border-[#C49767] rounded-2xl px-4 py-3 text-sm text-[#FAF5EC] outline-none transition font-sans"
                />
                <p className="text-[11px] text-[#A47E65]">
                  Nama ini akan ditampilkan pada sertifikat praktikum, dashboard, dan audit log pengerjaan tugas.
                </p>
              </div>

              {/* Infographics Alokasi Resource */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold text-[#DFCDB5] uppercase tracking-wider">
                  Alokasi Kuota Sandbox Praktikum Anda
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#1E110A] border border-[#4D2D1E] hover:border-[#C49767] rounded-2xl p-4 text-center alpine-hover-card transition-all">
                    <HardDrive className="h-5 w-5 text-[#E8C58D] mx-auto mb-2" />
                    <div className="text-lg font-bold font-mono text-[#FAF5EC]">{quotas.max_disk_mb >= 1000 ? `${quotas.max_disk_mb / 1000} GB` : `${quotas.max_disk_mb} MB`}</div>
                    <div className="text-[11px] text-[#A47E65]">Storage File Manager</div>
                  </div>

                  <div className="bg-[#1E110A] border border-[#4D2D1E] hover:border-[#C49767] rounded-2xl p-4 text-center alpine-hover-card transition-all">
                    <Cpu className="h-5 w-5 text-[#E8C58D] mx-auto mb-2" />
                    <div className="text-lg font-bold font-mono text-[#FAF5EC]">{quotas.max_memory_mb} MB</div>
                    <div className="text-[11px] text-[#A47E65]">Alokasi RAM Sandboxed</div>
                  </div>

                  <div className="bg-[#1E110A] border border-[#4D2D1E] hover:border-[#C49767] rounded-2xl p-4 text-center alpine-hover-card transition-all">
                    <Layers className="h-5 w-5 text-[#E8C58D] mx-auto mb-2" />
                    <div className="text-lg font-bold font-mono text-[#FAF5EC]">{quotas.max_cpu_cores} vCPU</div>
                    <div className="text-[11px] text-[#A47E65]">Batas Komputasi CPU</div>
                  </div>

                  <div className="bg-[#1E110A] border border-[#4D2D1E] hover:border-[#C49767] rounded-2xl p-4 text-center alpine-hover-card transition-all">
                    <Database className="h-5 w-5 text-[#E8C58D] mx-auto mb-2" />
                    <div className="text-lg font-bold font-mono text-[#FAF5EC]">MySQL / PG</div>
                    <div className="text-[11px] text-[#A47E65]">Multi-DB Enterprise</div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-[#C49767] hover:bg-[#E8C58D] text-[#24140D] font-bold text-xs transition shadow-lg disabled:opacity-50 alpine-hover-card active:scale-[0.98]"
                >
                  <span>{submitting ? 'Menyimpan...' : 'Konfirmasi & Lanjut ke Step 2'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: Database Provisioning */}
        {currentStep === 2 && (
          <div
            key="step-2"
            x-data="{ step: 2 }"
            x-transition:enter="transition ease-out duration-300 transform"
            x-transition:enter-start="opacity-0 translate-y-4 scale-95"
            x-transition:enter-end="opacity-100 translate-y-0 scale-100"
            className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 shadow-2xl alpine-transition"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-2xl bg-[#3A2216] border border-[#5A3521] text-[#E8C58D] alpine-pop-in">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF5EC]">
                  Step 2: Provisi Database Mandiri
                </h2>
                <p className="text-xs sm:text-sm text-[#C49767] mt-0.5">
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
                    className={`cursor-pointer rounded-2xl p-5 border transition-all alpine-hover-card active:scale-[0.98] ${
                      selectedEngine === 'mariadb'
                        ? 'bg-[#3A2216] border-[#C49767] shadow-xl ring-1 ring-[#C49767]'
                        : 'bg-[#1E110A] border-[#4D2D1E] hover:border-[#6B3F2B]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <img src="/logos/mariadb.svg" alt="MariaDB" className="h-6 w-6 object-contain" />
                        <span className="text-xs font-semibold font-mono text-[#E8C58D] px-2.5 py-0.5 bg-[#1E110A] rounded-lg border border-[#4D2D1E]">
                          MySQL / MariaDB 11
                        </span>
                      </div>
                      {selectedEngine === 'mariadb' && <CheckCircle2 className="h-5 w-5 text-[#C49767] alpine-pop-in" />}
                    </div>
                    <h4 className="font-serif font-bold text-base text-[#FAF5EC]">MariaDB Enterprise</h4>
                    <p className="text-xs text-[#DFCDB5] mt-1 line-clamp-2">
                      Sangat cocok untuk Laravel, CodeIgniter, WordPress, dan praktikum basis data relasional standar.
                    </p>
                    <div className="mt-3 text-[11px] text-[#A47E65] font-mono">Port Publik: :3306</div>
                  </div>

                  {/* PostgreSQL */}
                  <div
                    onClick={() => setSelectedEngine('postgres')}
                    className={`cursor-pointer rounded-2xl p-5 border transition-all alpine-hover-card active:scale-[0.98] ${
                      selectedEngine === 'postgres'
                        ? 'bg-[#3A2216] border-[#C49767] shadow-xl ring-1 ring-[#C49767]'
                        : 'bg-[#1E110A] border-[#4D2D1E] hover:border-[#6B3F2B]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <img src="/logos/postgres.svg" alt="PostgreSQL" className="h-6 w-6 object-contain" />
                        <span className="text-xs font-semibold font-mono text-cyan-400 px-2.5 py-0.5 bg-[#1E110A] rounded-lg border border-[#4D2D1E]">
                          PostgreSQL 16
                        </span>
                      </div>
                      {selectedEngine === 'postgres' && <CheckCircle2 className="h-5 w-5 text-[#C49767] alpine-pop-in" />}
                    </div>
                    <h4 className="font-serif font-bold text-base text-[#FAF5EC]">PostgreSQL Enterprise</h4>
                    <p className="text-xs text-[#DFCDB5] mt-1 line-clamp-2">
                      Sangat cocok untuk Next.js (Prisma/Drizzle), Django, FastAPI, analitik data, dan indexing modern.
                    </p>
                    <div className="mt-3 text-[11px] text-[#A47E65] font-mono">Port Publik: :5432</div>
                  </div>
                </div>

                {/* Suffix database input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#DFCDB5] block">
                    Nama Suffix Database (Otomatis Dibuat)
                  </label>
                  <div className="flex items-center">
                    <span className="bg-[#1E110A] border border-r-0 border-[#4D2D1E] rounded-l-2xl px-4 py-3 text-xs font-mono text-[#A47E65]">
                      s{username}_
                    </span>
                    <input
                      type="text"
                      value={dbSuffix}
                      onChange={(e) => setDbSuffix(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="praktikum"
                      className="flex-1 bg-[#1E110A] border border-[#4D2D1E] focus:border-[#C49767] rounded-r-2xl px-4 py-3 text-sm text-[#FAF5EC] outline-none font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-[#A47E65]">
                    Pola nama database: <strong className="text-[#FAF5EC]">s{username}_{dbSuffix || 'praktikum'}</strong> dengan user terisolasi <strong className="text-[#FAF5EC]">s{username}</strong>.
                  </p>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl bg-[#3A2216] text-xs font-semibold text-[#DFCDB5] hover:text-white alpine-hover-card active:scale-95"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Kembali</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStep2Provision}
                    disabled={submitting}
                    className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-[#C49767] hover:bg-[#E8C58D] text-[#24140D] font-bold text-xs transition shadow-lg disabled:opacity-50 alpine-hover-card active:scale-[0.98]"
                  >
                    <span>{submitting ? 'Memprovisi Database...' : 'Provisi Database Otomatis Sekarang'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Success Provisioned Card */
              <div className="space-y-6 alpine-pop-in">
                <div className="bg-emerald-950/40 border border-emerald-700/60 rounded-2xl p-5">
                  <div className="flex items-center space-x-2.5 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <h4 className="font-serif font-bold text-base text-emerald-200">
                      Database Nyata Berhasil Terbentuk & Terisolasi!
                    </h4>
                  </div>
                  <p className="text-xs text-emerald-300/80">
                    Kredensial berikut telah tersimpan aman dan terintegrasi otomatis dengan CloudBeaver & Adminer Lab.
                  </p>
                </div>

                <div className="bg-[#1E110A] border border-[#4D2D1E] rounded-2xl p-4 space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[#4D2D1E]/60">
                    <span className="text-[#A47E65]">Database Name:</span>
                    <span className="text-[#FAF5EC] font-bold">{provisionedDb.db_name}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#4D2D1E]/60">
                    <span className="text-[#A47E65]">Username:</span>
                    <span className="text-[#FAF5EC] font-bold">{provisionedDb.db_username}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#4D2D1E]/60">
                    <span className="text-[#A47E65]">Password:</span>
                    <span className="text-[#FAF5EC]">{provisionedDb.db_password}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#4D2D1E]/60">
                    <span className="text-[#A47E65]">Host & Port:</span>
                    <span className="text-[#FAF5EC]">{provisionedDb.host}:{provisionedDb.port}</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-[#A47E65] block mb-1">Connection URI:</span>
                    <div className="flex items-center space-x-2 bg-[#2B1810] p-2 rounded-xl text-[11px] overflow-hidden">
                      <span className="truncate flex-1 text-[#E8C58D]">{provisionedDb.connection_uri}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(provisionedDb.connection_uri, 'uri')}
                        className="p-1 text-[#C49767] hover:text-white"
                        title="Salin Connection URI"
                      >
                        {copiedKey === 'uri' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-[#C49767] hover:bg-[#E8C58D] text-[#24140D] font-bold text-xs transition shadow-lg alpine-hover-card active:scale-[0.98]"
                  >
                    <span>Lanjut ke Step 3: Runtime Stack</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Runtime Stack & Auto-Extract Upload */}
        {currentStep === 3 && (
          <div
            key="step-3"
            x-data="{ step: 3 }"
            x-transition:enter="transition ease-out duration-300 transform"
            x-transition:enter-start="opacity-0 translate-y-4 scale-95"
            x-transition:enter-end="opacity-100 translate-y-0 scale-100"
            className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 shadow-2xl alpine-transition"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-2xl bg-[#3A2216] border border-[#5A3521] text-[#E8C58D] alpine-pop-in">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF5EC]">
                  Step 3: Runtime Stack & Kode Aplikasi
                </h2>
                <p className="text-xs sm:text-sm text-[#C49767] mt-0.5">
                  Tentukan bahasa pemrograman dan unggah project praktikum Anda.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Runtime Choices */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#DFCDB5] block">
                  Pilih Runtime Pemrograman Utama
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'php82', name: 'PHP 8.2', tag: 'Web / Laravel / CI', logo: '/logos/php.svg' },
                    { id: 'node20', name: 'Node.js 20', tag: 'React / Express / Vite', logo: '/logos/node.svg' },
                    { id: 'python311', name: 'Python 3.11', tag: 'FastAPI / Flask / Django', logo: '/logos/python.svg' }
                  ].map((rt) => (
                    <div
                      key={rt.id}
                      onClick={() => setSelectedRuntime(rt.id)}
                      className={`cursor-pointer rounded-2xl p-4 border transition-all text-center alpine-hover-card active:scale-[0.98] ${
                        selectedRuntime === rt.id
                          ? 'bg-[#3A2216] border-[#C49767] shadow-xl ring-1 ring-[#C49767]'
                          : 'bg-[#1E110A] border-[#4D2D1E] hover:border-[#6B3F2B]'
                      }`}
                    >
                      <div className="h-10 flex items-center justify-center mb-2 transition-transform duration-200 hover:scale-110">
                        <img src={rt.logo} alt={rt.name} className="h-8 w-8 object-contain" />
                      </div>
                      <div className="font-bold text-sm text-[#FAF5EC]">{rt.name}</div>
                      <div className="text-[10px] text-[#A47E65] mt-0.5">{rt.tag}</div>
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
                    className="rounded bg-[#1E110A] border-[#4D2D1E] text-[#C49767] focus:ring-0"
                  />
                  <label htmlFor="starter-check" className="text-xs font-semibold text-[#DFCDB5] cursor-pointer">
                    Gunakan Starter Template Otomatis (Rekomendasi untuk Uji Coba Pertama)
                  </label>
                </div>

                {!useStarterTemplate && (
                  <div className="border-2 border-dashed border-[#5A3521] hover:border-[#C49767] bg-[#1E110A] rounded-2xl p-6 text-center transition alpine-hover-card">
                    <input
                      type="file"
                      id="onboarding-file"
                      onChange={(e) => setUploadedFile(e.target.files[0])}
                      className="hidden"
                      accept=".zip,.php,.js,.py,.html,.tar.gz"
                    />
                    <label htmlFor="onboarding-file" className="cursor-pointer flex flex-col items-center space-y-2">
                      <UploadCloud className="h-10 w-10 text-[#C49767] transition-transform duration-200 hover:scale-110" />
                      <div className="text-xs font-semibold text-[#FAF5EC]">
                        {uploadedFile ? uploadedFile.name : 'Klik atau Drag & Drop file project (.zip atau single file)'}
                      </div>
                      <p className="text-[10px] text-[#A47E65]">
                        File ZIP akan diekstrak secara otomatis & aman dengan proteksi Anti-Zip Slip.
                      </p>
                    </label>
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl bg-[#3A2216] text-xs font-semibold text-[#DFCDB5] hover:text-white alpine-hover-card active:scale-95"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Kembali</span>
                </button>

                <button
                  type="button"
                  onClick={handleStep3Deploy}
                  disabled={submitting || isDeploying}
                  className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-[#C49767] hover:bg-[#E8C58D] text-[#24140D] font-bold text-xs transition shadow-lg disabled:opacity-50 alpine-hover-card active:scale-[0.98]"
                >
                  <span>{isDeploying ? 'Sedang Menyiapkan & Mendeploy...' : 'Deploy & Aktifkan Service Sekarang'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Subdomain Generation & Celebration */}
        {currentStep === 4 && (
          <div
            key="step-4"
            x-data="{ step: 4 }"
            x-transition:enter="transition ease-out duration-300 transform"
            x-transition:enter-start="opacity-0 translate-y-4 scale-95"
            x-transition:enter-end="opacity-100 translate-y-0 scale-100"
            className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 shadow-2xl alpine-transition"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-2xl bg-[#3A2216] border border-[#5A3521] text-[#E8C58D] alpine-pop-in">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF5EC]">
                  Step 4: Subdomain Publik & Siap Pakai
                </h2>
                <p className="text-xs sm:text-sm text-[#C49767] mt-0.5">
                  Publikasikan aplikasi web Anda ke subdomain live kampus dengan SSL HTTPS otomatis.
                </p>
              </div>
            </div>

            {!subdomainData ? (
              <div className="space-y-6">
                <div className="bg-[#1E110A] border border-[#4D2D1E] rounded-2xl p-5 space-y-3 alpine-hover-card">
                  <div className="text-xs text-[#DFCDB5]">
                    Pola subdomain publik resmi mahasiswa:
                  </div>
                  <div className="font-mono text-base text-[#E8C58D] font-bold">
                    web-xxxx-{username}.miraigrid.web.id
                  </div>
                  <p className="text-[11px] text-[#A47E65]">
                    Routing Nginx host akan mengarahkan request HTTPS publik langsung ke container sandbox Anda tanpa memerlukan port manual.
                  </p>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl bg-[#3A2216] text-xs font-semibold text-[#DFCDB5] hover:text-white alpine-hover-card active:scale-95"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Kembali</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStep4Publish}
                    disabled={submitting}
                    className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-[#C49767] hover:bg-[#E8C58D] text-[#24140D] font-bold text-xs transition shadow-lg disabled:opacity-50 alpine-hover-card active:scale-[0.98]"
                  >
                    <span>{submitting ? 'Mengaktifkan Routing Subdomain...' : 'Generate & Aktifkan Subdomain Publik'}</span>
                    <Sparkles className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Celebration & Final Dashboard CTA */
              <div className="space-y-6 alpine-pop-in">
                {/* Refined Header */}
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#3A2216] border border-[#5A3521] text-[#E8C58D] shadow-lg mb-1">
                    <CheckCircle2 className="h-7 w-7 text-[#C49767]" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF5EC] tracking-tight">
                    Infrastruktur Siap Digunakan
                  </h3>
                  <p className="text-xs sm:text-sm text-[#DFCDB5] max-w-md mx-auto">
                    Workspace mandiri Anda telah dikonfigurasi dan siap melayani aplikasi praktikum secara publik.
                  </p>
                </div>

                {/* Elegant URL Address Bar Card */}
                <div className="bg-[#1E110A] border border-[#4D2D1E] rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#DFCDB5] flex items-center space-x-1.5">
                      <Globe className="h-3.5 w-3.5 text-[#C49767]" />
                      <span>Subdomain Publik Resmi</span>
                    </span>
                    <span className="text-[11px] text-[#A47E65] font-mono flex items-center space-x-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80" />
                      <span>SSL Ingress Terproteksi</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 bg-[#2B1810] border border-[#4D2D1E]/80 px-3.5 py-2.5 rounded-xl">
                    <span className="text-xs text-[#A47E65] font-mono select-none">https://</span>
                    <span className="text-xs sm:text-sm font-mono font-semibold text-[#E8C58D] truncate flex-1">
                      {subdomainData.public_url ? subdomainData.public_url.replace(/^https?:\/\//, '') : ''}
                    </span>
                    
                    <div className="flex items-center space-x-1.5 shrink-0 pl-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(subdomainData.public_url, 'subdomain')}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#3A2216] hover:bg-[#4D2D1E] text-[#E8C58D] hover:text-white text-xs transition active:scale-95 border border-[#5A3521]/60"
                        title="Salin Tautan"
                      >
                        {copiedKey === 'subdomain' ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-[11px] font-medium text-emerald-400">Tersalin</span>
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
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#3A2216] hover:bg-[#4D2D1E] text-[#E8C58D] hover:text-white text-xs transition active:scale-95 border border-[#5A3521]/60"
                        title="Buka Website"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-medium">Buka</span>
                      </a>
                    </div>
                  </div>

                  {/* Micro-specs summary row */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-[#A47E65]">
                    <div className="bg-[#24140D] rounded-lg py-1.5 px-2 text-center border border-[#3A2216]">
                      <span className="text-[#DFCDB5] block font-mono text-[10px]">ROUTING</span>
                      <span className="text-emerald-400/90 font-medium">Zero-Port Nginx</span>
                    </div>
                    <div className="bg-[#24140D] rounded-lg py-1.5 px-2 text-center border border-[#3A2216]">
                      <span className="text-[#DFCDB5] block font-mono text-[10px]">ENKRIPSI</span>
                      <span className="text-emerald-400/90 font-medium">TLS 1.3 HTTPS</span>
                    </div>
                    <div className="bg-[#24140D] rounded-lg py-1.5 px-2 text-center border border-[#3A2216]">
                      <span className="text-[#DFCDB5] block font-mono text-[10px]">ISOLASI</span>
                      <span className="text-emerald-400/90 font-medium">Multi-Tenant</span>
                    </div>
                  </div>
                </div>

                {/* Final Enter Dashboard Button */}
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={handleFinishOnboarding}
                    className="flex items-center space-x-2 px-8 py-3.5 rounded-2xl bg-[#C49767] hover:bg-[#E8C58D] text-[#24140D] font-bold text-xs sm:text-sm transition shadow-xl alpine-hover-card hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Masuk ke Dashboard Utama</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Animated Preparation & Deployment Spinner Modal */}
        {isDeploying && (
          <div className="fixed inset-0 z-50 bg-[#140B07]/85 backdrop-blur-md flex items-center justify-center p-4 alpine-fade">
            <div className="bg-[#2B1810] border border-[#5A3521] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl text-center space-y-6 alpine-pop-in relative overflow-hidden">
              {/* Background ambient glow */}
              <div className="absolute -top-16 -left-16 w-44 h-44 bg-[#C49767]/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Orbital Dual-Ring High-Tech Spinner */}
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                {/* Outer Ring */}
                <div className="absolute inset-0 border-4 border-t-[#C49767] border-r-transparent border-b-[#E8C58D] border-l-transparent rounded-full animate-spin" />
                {/* Inner Counter-Rotating Ring */}
                <div className="absolute inset-3 border-2 border-t-emerald-400 border-r-transparent border-b-[#8C5E35] border-l-transparent rounded-full animate-spin-reverse" />
                {/* Central Glowing Icon */}
                <div className="p-3 bg-[#1E110A] rounded-2xl border border-[#4D2D1E] shadow-inner text-[#E8C58D] animate-pulse">
                  <Server className="h-6 w-6" />
                </div>
              </div>

              {/* Modal Titles */}
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-xl sm:text-2xl text-[#FAF5EC]">
                  Menyiapkan Lingkungan Cloud...
                </h3>
                <p className="text-xs sm:text-sm text-[#C49767] font-sans">
                  {deployStatusText || 'Sistem sedang memprovisi container dan routing publik.'}
                </p>
              </div>

              {/* Progress Bar & Percentage */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-[#A47E65]">Progress Otomatisasi:</span>
                  <span className="text-emerald-400 font-bold">{deployProgress}%</span>
                </div>
                <div className="h-2.5 w-full bg-[#1E110A] rounded-full overflow-hidden border border-[#4D2D1E]/90 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-[#8C5E35] via-[#C49767] to-emerald-400 rounded-full transition-all duration-500 ease-out shadow-sm"
                    style={{ width: `${deployProgress}%` }}
                  />
                </div>
              </div>

              {/* Live Stage Checklist */}
              <div className="bg-[#1E110A] border border-[#4D2D1E] rounded-2xl p-4 text-left space-y-2.5 font-sans text-xs">
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
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        ) : isCurrent ? (
                          <RefreshCw className="h-4 w-4 text-[#C49767] animate-spin shrink-0" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-[#4D2D1E] shrink-0" />
                        )}
                        <span className={isDone ? 'text-emerald-300 font-medium' : isCurrent ? 'text-[#FAF5EC] font-semibold' : 'text-[#785338]'}>
                          {stage.label}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-[#A47E65]">
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
          <div className="fixed inset-0 z-50 bg-[#140B07]/85 backdrop-blur-md flex items-center justify-center p-4 alpine-fade">
            <div className="bg-[#2B1810] border border-[#5A3521] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5 alpine-pop-in relative overflow-hidden">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-t-[#C49767] border-r-transparent border-b-[#E8C58D] border-l-transparent rounded-full animate-spin" />
                <div className="p-3 bg-[#1E110A] rounded-2xl border border-[#4D2D1E] shadow-inner text-[#E8C58D] animate-pulse">
                  <Database className="h-6 w-6" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-xl text-[#FAF5EC]">
                  Memprovisi Database Mandiri...
                </h3>
                <p className="text-xs text-[#C49767] font-sans">
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
