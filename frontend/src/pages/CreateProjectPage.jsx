import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowLeft, Check, AlertCircle, Folder, Rocket, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner } from '../components/Skeletons'

export default function CreateProjectPage({ onBack, onCreated, user: propUser }) {
  const currentUser = propUser || JSON.parse(localStorage.getItem('miraigrid_user') || '{}')
  const isAdmin = currentUser?.role === 'admin'
  const location = useLocation()
  const initialLang = React.useMemo(() => {
    const params = new URLSearchParams(location.search)
    const l = params.get('lang')
    if (l && ['php', 'node', 'python'].includes(l)) return l
    return 'php'
  }, [location.search])

  const [projectName, setProjectName] = useState('')
  const [appRoot, setAppRoot] = useState('')
  const [gitRepos, setGitRepos] = useState([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState(initialLang) // 'php', 'python', 'node'
  const [selectedVersion, setSelectedVersion] = useState(() => {
    if (initialLang === 'python') return '3.11'
    if (initialLang === 'node') return '20'
    return '8.2'
  })
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAdmin) {
      setLoadingRepos(true)
      api.get('/git/repositories')
        .then((res) => {
          if (res.data?.success && Array.isArray(res.data.repositories)) {
            setGitRepos(res.data.repositories)
          }
        })
        .catch(() => {})
        .finally(() => setLoadingRepos(false))
    }
  }, [isAdmin])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const l = params.get('lang')
    if (l && ['php', 'node', 'python'].includes(l) && l !== selectedLanguage) {
      setSelectedLanguage(l)
      if (l === 'python') setSelectedVersion('3.11')
      else if (l === 'node') setSelectedVersion('20')
      else setSelectedVersion('8.2')
    }
  }, [location.search])

  const languageOptions = [
    {
      id: 'php',
      name: 'PHP',
      logo: '/logos/php.svg',
      badge: 'Apache + PDO',
      defaultVer: '8.2',
      versions: [
        { val: '8.3', label: 'PHP 8.3 (Terbaru)' },
        { val: '8.2', label: 'PHP 8.2 (Recommended)' },
        { val: '8.1', label: 'PHP 8.1' },
        { val: '8.0', label: 'PHP 8.0' },
        { val: '7.4', label: 'PHP 7.4 (Legacy)' }
      ]
    },
    {
      id: 'python',
      name: 'Python',
      logo: '/logos/python.svg',
      badge: 'Flask / Gunicorn',
      defaultVer: '3.11',
      versions: [
        { val: '3.12', label: 'Python 3.12 (Terbaru)' },
        { val: '3.11', label: 'Python 3.11 (Recommended)' },
        { val: '3.10', label: 'Python 3.10' },
        { val: '3.9', label: 'Python 3.9' }
      ]
    },
    {
      id: 'node',
      name: 'Node.js',
      logo: '/logos/node.svg',
      badge: 'Express / NPM',
      defaultVer: '20',
      versions: [
        { val: '22', label: 'Node.js 22 (Current)' },
        { val: '20', label: 'Node.js 20 (Recommended LTS)' },
        { val: '18', label: 'Node.js 18 (LTS)' },
        { val: '16', label: 'Node.js 16' }
      ]
    }
  ]

  const handleLanguageSelect = (langId) => {
    setSelectedLanguage(langId)
    const found = languageOptions.find((l) => l.id === langId)
    if (found) {
      setSelectedVersion(found.defaultVer)
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    setError('')
    setActionLoading(true)
    const toastId = toast.loading(`Membuat project ${projectName} (${selectedLanguage.toUpperCase()} ${selectedVersion})...`)

    try {
      const res = await api.post('/projects/create', {
        name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        language: selectedLanguage,
        version: selectedVersion,
        app_config: {
          app_root: appRoot.trim(),
          startup_file: selectedLanguage === 'python' ? 'app.py' : selectedLanguage === 'node' ? 'server.js' : 'index.php'
        }
      })
      toast.success('Project berhasil dibuat dan container langsung aktif!', { id: toastId })
      onCreated(res.data)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Gagal membuat project.'
      setError(msg)
      toast.error(msg, { id: toastId })
    } finally {
      setActionLoading(false)
    }
  }

  const currentLangConfig = languageOptions.find((l) => l.id === selectedLanguage) || languageOptions[0]

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Breadcrumb Bar */}
      <div className="flex items-center space-x-3 pb-2 border-b border-[#DECDBD]">
        <button
          onClick={onBack}
          className="p-2.5 rounded-2xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] transition shadow-sm"
          title="Kembali ke Daftar Aplikasi"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#26160F]">
            Buat Project Web Baru
          </h2>
          <p className="text-xs text-[#5C3B29] font-sans mt-0.5">
            Pilih bahasa pemrograman & versi engine untuk container terisolasi Anda.
          </p>
        </div>
      </div>

      {/* Main Form Container (Dedicated Page View, BUKAN MODAL!) */}
      <div className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-9 shadow-2xl text-[#FAF5EC]">
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreateProject} className="space-y-6">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">
              Nama Project (Slug)
            </label>
            <input
              type="text"
              required
              placeholder="contoh: sistem-kasir-praktikum"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-2xl px-4 py-3 text-xs text-[#FAF5EC] placeholder-[#553826] focus:outline-none focus:border-[#C49767] transition font-sans"
            />
            <p className="text-[10px] text-[#A47E65] mt-1.5 font-mono">
              Hanya huruf kecil, angka, dan tanda hubung (-).
            </p>
          </div>

          {/* 3 LANGUAGE CARDS WITH PROPORTIONAL LOGOS */}
          <div>
            <label className="block text-xs font-semibold text-[#DFCDB5] mb-2.5">
              Pilih Bahasa Pemrograman
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {languageOptions.map((lang) => {
                const isSelected = selectedLanguage === lang.id
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => handleLanguageSelect(lang.id)}
                    className={`p-5 rounded-3xl border text-center flex flex-col items-center justify-between transition-all duration-200 relative group ${
                      isSelected
                        ? 'bg-[#3A2115] border-[#C49767] shadow-xl ring-2 ring-[#C49767]/60'
                        : 'bg-[#1C0F0A] border-[#3E2316] hover:bg-[#25150E] hover:border-[#543221]'
                    }`}
                  >
                    {/* Selected Check Badge */}
                    {isSelected && (
                      <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-[#C49767] text-[#2B1810] flex items-center justify-center shadow-md">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}

                    {/* Logo Image with equal balanced dimensions */}
                    <div className="h-16 w-16 rounded-2xl bg-[#24140C] border border-[#3E2316] p-2.5 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                      <img
                        src={lang.logo}
                        alt={`${lang.name} logo`}
                        className="h-11 w-11 object-contain"
                      />
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-[#FAF5EC] font-serif">{lang.name}</h4>
                      <p className="text-[10px] text-[#E8DCB8] font-mono mt-0.5">{lang.badge}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Version Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">
              Pilih Versi {currentLangConfig.name}
            </label>
            <div className="relative">
              <select
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-2xl pl-4 pr-11 py-3 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767] transition appearance-none cursor-pointer"
              >
                {currentLangConfig.versions.map((ver) => (
                  <option key={ver.val} value={ver.val}>
                    {ver.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-[#A47E65]">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[11px] text-[#A47E65] mt-1.5 font-mono">
              Container Docker resmi {currentLangConfig.name} akan otomatis di-pull dan dijalankan seketika.
            </p>
          </div>

          {/* App Root Directory (Custom Directory / Sandbox) */}
          <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[#DFCDB5]">
                App Root Directory {isAdmin ? (
                  <span className="text-[#C49767] font-normal">(Bisa Custom / Repositori Git)</span>
                ) : (
                  <span className="text-[#A47E65] font-normal">(Opsional)</span>
                )}
              </label>
              {isAdmin && gitRepos.length > 0 && (
                <span className="text-[10px] text-[#A47E65] font-mono">
                  {gitRepos.length} Git™ Repositori Terdeteksi
                </span>
              )}
            </div>

            <input
              type="text"
              placeholder={
                isAdmin
                  ? 'contoh: public atau /home/admin/repositories/nama_repo (kosongkan untuk default root)'
                  : 'contoh: public atau src (kosongkan jika kode berada di root project)'
              }
              value={appRoot}
              onChange={(e) => setAppRoot(e.target.value)}
              className="w-full bg-[#2B1810] border border-[#4D2D1E] rounded-xl px-4 py-2.5 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767] transition placeholder-[#553826]"
            />

            {/* Quick Pick Git Repositories for Admin */}
            {isAdmin && gitRepos.length > 0 && (
              <div className="pt-1">
                <div className="text-[10px] text-[#A47E65] font-mono mb-1.5 flex items-center space-x-1">
                  <span>Pilih Cepat dari Git™ Repositories:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {gitRepos.map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      onClick={() => setAppRoot(repo.path)}
                      className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition flex items-center space-x-1 ${
                        appRoot === repo.path
                          ? 'bg-[#C49767] text-[#2B1810] border-[#C49767] font-bold shadow-sm'
                          : 'bg-[#2B1810] text-[#DFCDB5] border-[#4D2D1E] hover:border-[#C49767]'
                      }`}
                      title={repo.path}
                    >
                      <Folder className="h-3 w-3 shrink-0 text-[#C49767]" />
                      <span>{repo.name}</span>
                    </button>
                  ))}
                  {appRoot && (
                    <button
                      type="button"
                      onClick={() => setAppRoot('')}
                      className="text-[10px] font-mono px-2 py-1 text-rose-400 hover:underline"
                    >
                      Reset default
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Security Explanation / Helper Text */}
            <p className="text-[11px] text-[#A47E65] font-sans leading-relaxed">
              {isAdmin ? (
                <span>
                  <strong className="text-[#E8DCB8]">Akses Administrator:</strong> Anda bebas menentukan path direktori ke subfolder project (e.g. <code className="font-mono text-[#E8DCB8]">public</code>) maupun ke direktori lain di server seperti <code className="font-mono text-[#E8DCB8]">/home/admin/repositories/nama_repo</code>.
                </span>
              ) : (
                <span>
                  <strong className="text-[#E8DCB8]">Sandbox Mahasiswa:</strong> Tentukan subdirektori di dalam folder project Anda (misal <code className="font-mono text-[#E8DCB8]">public</code> atau <code className="font-mono text-[#E8DCB8]">src</code>). Sistem mengunci akses secara aman agar tidak dapat berpindah di luar ruang akun Anda.
                </span>
              )}
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#3E2316]">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 rounded-2xl text-xs font-semibold text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-7 py-3 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] shadow-xl shadow-black/20 transition duration-150 disabled:opacity-50 flex items-center space-x-2"
            >
              {actionLoading ? (
                <>
                  <Spinner size="xs" />
                  <span>Menyiapkan Container...</span>
                </>
              ) : (
                <span>Buat & Jalankan</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
