import React, { useState } from 'react'
import { ArrowLeft, Check, AlertCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner } from '../components/Skeletons'

export default function CreateProjectPage({ onBack, onCreated }) {
  const [projectName, setProjectName] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('php') // 'php', 'python', 'node'
  const [selectedVersion, setSelectedVersion] = useState('8.2')
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

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
      <div className="max-w-3xl bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-9 shadow-2xl text-[#FAF5EC]">
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
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-2xl px-4 py-3 text-xs text-[#FAF5EC] font-mono focus:outline-none focus:border-[#C49767] transition"
            >
              {currentLangConfig.versions.map((ver) => (
                <option key={ver.val} value={ver.val}>
                  {ver.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#A47E65] mt-1.5 font-mono">
              Container Docker resmi {currentLangConfig.name} akan otomatis di-pull dan dijalankan seketika.
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
