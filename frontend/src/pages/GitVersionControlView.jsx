import React, { useState, useEffect } from 'react'
import {
  GitBranch,
  GitPullRequest,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  ArrowLeft,
  ArrowRight,
  Search,
  ChevronRight,
  Folder,
  Sliders,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Clock,
  User,
  History,
  Rocket,
  ShieldCheck,
  ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner } from '../components/Skeletons'
import ModalPortal from '../components/ModalPortal'

export default function GitVersionControlView({ user, onNavigate }) {
  // Views: 'list', 'create', 'manage', 'history'
  const [viewMode, setViewMode] = useState('list')
  const [repositories, setRepositories] = useState([])
  const [selectedRepo, setSelectedRepo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Error & Success Banners
  const [gitError, setGitError] = useState(null)
  const [gitSuccessBanner, setGitSuccessBanner] = useState(null)
  const [autoDeployOnPull, setAutoDeployOnPull] = useState(true)

  // Manage Tab: 'basic' or 'pull_deploy'
  const [manageTab, setManageTab] = useState('basic')

  // Create Form State
  const [isClone, setIsClone] = useState(true)
  const [cloneUrl, setCloneUrl] = useState('')
  const [repoName, setRepoName] = useState('')
  const [targetProjectId, setTargetProjectId] = useState('')
  const [userProjects, setUserProjects] = useState([])

  // Commit History State
  const [commits, setCommits] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Remove Modal State
  const [removeModal, setRemoveModal] = useState({ open: false, repo: null, deleteFiles: false })

  // Branch Switch State
  const [selectedBranch, setSelectedBranch] = useState('')

  // Copied state
  const [copiedText, setCopiedText] = useState('')

  useEffect(() => {
    fetchRepositories()
    fetchUserProjects()
  }, [])

  const fetchRepositories = async () => {
    setLoading(true)
    try {
      const res = await api.get('/git/repositories')
      setRepositories(res.data?.repositories || [])
    } catch (err) {
      toast.error('Gagal memuat daftar repositori Git™.')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserProjects = async () => {
    try {
      const res = await api.get('/projects')
      setUserProjects(res.data || [])
    } catch (err) {
      // ignore
    }
  }

  const fetchRepoDetails = async (repoId) => {
    setActionLoading(true)
    try {
      const res = await api.get(`/git/repositories/${repoId}`)
      const repoData = res.data?.repository
      setSelectedRepo(repoData)
      setSelectedBranch(repoData?.current_branch || 'main')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengambil detail repositori.')
    } finally {
      setActionLoading(false)
    }
  }

  const fetchCommitHistory = async (repoId) => {
    setHistoryLoading(true)
    try {
      const res = await api.get(`/git/repositories/${repoId}/history?limit=40`)
      setCommits(res.data?.commits || [])
    } catch (err) {
      toast.error('Gagal memuat riwayat commit.')
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleOpenManage = async (repo) => {
    await fetchRepoDetails(repo.id)
    setViewMode('manage')
    setManageTab('basic')
  }

  const handleOpenHistory = async (repo) => {
    setSelectedRepo(repo)
    setViewMode('history')
    await fetchCommitHistory(repo.id)
  }

  const handleCloneUrlChange = (e) => {
    const val = e.target.value
    setCloneUrl(val)
    if (val && !repoName) {
      // Suggest name from URL: e.g. https://github.com/user/agentic-ai.git -> agentic-ai
      const parts = val.replace(/\.git$/, '').split('/')
      const suggested = parts[parts.length - 1]
      if (suggested && /^[a-zA-Z0-9_\-\.]+$/.test(suggested)) {
        setRepoName(suggested)
      }
    }
  }

  const handleCreateRepo = async (e) => {
    e.preventDefault()
    setGitError(null)
    setGitSuccessBanner(null)
    if (!repoName.trim()) {
      toast.error('Nama repositori wajib diisi.')
      return
    }
    if (isClone && !cloneUrl.trim()) {
      toast.error('Clone URL wajib diisi untuk mode kloning.')
      return
    }

    setActionLoading(true)
    const toastId = toast.loading(isClone ? 'Mengkloning repositori dari remote...' : 'Membuat repositori Git™ baru...')

    try {
      const payload = {
        name: repoName.trim(),
        clone_url: isClone ? cloneUrl.trim() : null,
        is_clone: isClone,
      }
      const res = await api.post('/git/repositories', payload)
      const successMsg = isClone
        ? `Repositori '${repoName}' berhasil dikloning!`
        : `Repositori '${repoName}' berhasil diinisialisasi!`
      toast.success(successMsg, { id: toastId })
      setGitSuccessBanner({
        title: 'Repositori Berhasil Dibuat',
        message: `${successMsg} Repositori kini siap dikelola dan diintegrasikan ke File Manager.`,
      })
      setRepoName('')
      setCloneUrl('')
      await fetchRepositories()
      setViewMode('list')
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Gagal membuat repositori.'
      setGitError({
        title: isClone ? 'Gagal Kloning Repositori Git' : 'Gagal Inisialisasi Repositori Git',
        message: msg,
      })
      toast.error(msg, { id: toastId })
    } finally {
      setActionLoading(false)
    }
  }

  const handlePullRemote = async () => {
    if (!selectedRepo) return
    setActionLoading(true)
    setGitError(null)
    setGitSuccessBanner(null)
    const toastId = toast.loading('Mengambil & menggabungkan perubahan dari remote (git pull)...')

    try {
      const res = await api.post(`/git/repositories/${selectedRepo.id}/pull`)
      const pullMsg = res.data?.message || 'Repositori berhasil diupdate dari remote!'
      
      let autoDeployText = ''
      if (autoDeployOnPull) {
        try {
          const payload = targetProjectId ? { target_project_id: parseInt(targetProjectId) } : {}
          const deployRes = await api.post(`/git/repositories/${selectedRepo.id}/deploy`, payload)
          if (deployRes.data?.success) {
            autoDeployText = ` Berkas otomatis disinkronkan ke workspace project '${deployRes.data.target_project}' (${deployRes.data.synced_items || 0} berkas).`
          }
        } catch (depErr) {
          console.warn('Auto deploy failed:', depErr)
        }
      }

      toast.success(pullMsg, { id: toastId })
      setGitSuccessBanner({
        title: 'Git Pull & Workspace Update Berhasil',
        message: `${pullMsg}${autoDeployText} Semua berkas telah sinkron dan dapat langsung dikelola di File Manager.`,
        actionBtn: {
          label: 'Buka di File Manager',
          onClick: () => onNavigate && onNavigate(`/files?repo=${selectedRepo.id}`),
        },
      })
      await fetchRepoDetails(selectedRepo.id)
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Gagal melakukan git pull.'
      setGitError({
        title: 'Gagal Update dari Remote (Git Pull)',
        message: msg,
      })
      toast.error(msg, { id: toastId })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckoutBranch = async () => {
    if (!selectedRepo || !selectedBranch) return
    setActionLoading(true)
    setGitError(null)
    setGitSuccessBanner(null)
    const toastId = toast.loading(`Beralih ke branch '${selectedBranch}'...`)

    try {
      const res = await api.post(`/git/repositories/${selectedRepo.id}/checkout`, {
        branch: selectedBranch,
      })
      const msg = res.data?.message || `Berhasil checkout ke ${selectedBranch}!`
      toast.success(msg, { id: toastId })
      setGitSuccessBanner({
        title: 'Checkout Branch Berhasil',
        message: msg,
      })
      await fetchRepoDetails(selectedRepo.id)
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Gagal berpindah branch.'
      setGitError({
        title: `Gagal Checkout ke Branch '${selectedBranch}'`,
        message: msg,
      })
      toast.error(msg, { id: toastId })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeployHead = async () => {
    if (!selectedRepo) return
    setActionLoading(true)
    setGitError(null)
    setGitSuccessBanner(null)
    const toastId = toast.loading('Mendeploy HEAD commit ke workspace project...')

    try {
      const payload = targetProjectId ? { target_project_id: parseInt(targetProjectId) } : {}
      const res = await api.post(`/git/repositories/${selectedRepo.id}/deploy`, payload)
      const msg = res.data?.message || 'Deploy HEAD Commit berhasil!'
      toast.success(msg, { id: toastId })
      setGitSuccessBanner({
        title: 'Deploy HEAD Commit Berhasil',
        message: `${msg} Seluruh berkas telah disinkronkan ke direktori hosting dan dapat dibuka di File Manager.`,
        actionBtn: {
          label: 'Buka di File Manager',
          onClick: () => onNavigate && onNavigate(`/files?repo=${selectedRepo.id}`),
        },
      })
      await fetchRepoDetails(selectedRepo.id)
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Gagal mendeploy commit.'
      setGitError({
        title: 'Gagal Deploy HEAD Commit ke Workspace',
        message: msg,
      })
      toast.error(msg, { id: toastId })
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmRemove = async () => {
    if (!removeModal.repo) return
    const { repo, deleteFiles } = removeModal

    setActionLoading(true)
    setGitError(null)
    setGitSuccessBanner(null)
    const toastId = toast.loading('Menghapus repositori dari Git™ Version Control...')

    try {
      const res = await api.delete(`/git/repositories/${repo.id}?delete_files=${deleteFiles}`)
      toast.success(res.data?.message || 'Repositori berhasil dihapus!', { id: toastId })
      setRemoveModal({ open: false, repo: null, deleteFiles: false })
      if (selectedRepo?.id === repo.id) {
        setSelectedRepo(null)
        setViewMode('list')
      }
      await fetchRepositories()
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Gagal menghapus repositori.'
      setGitError({
        title: 'Gagal Menghapus Repositori Git',
        message: msg,
      })
      toast.error(msg, { id: toastId })
    } finally {
      setActionLoading(false)
    }
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    toast.success(`${label} disalin ke clipboard!`)
    setTimeout(() => setCopiedText(''), 2500)
  }

  // Filter Repositories by search
  const filteredRepos = repositories.filter(
    (r) =>
      r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.path?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.remote_url?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6 w-full font-sans pb-12">
      {/* 1. TOP HEADER ALA CPANEL */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#4D2D1E] pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#4A2617] to-[#2D160E] border border-[#5A3521] flex items-center justify-center p-2.5 shadow-md shrink-0">
            <img src="/logos/git.svg" alt="Git Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-serif font-bold text-[#26160F] tracking-wide">
                Git™ Version Control
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#3D2115] text-[#FAF5EC] border border-[#5A3521]">
                v2.47
              </span>
            </div>
            <p className="text-xs text-[#5C3B29] mt-0.5">
              Kelola repositori Git mandiri: kloning repository remote, pull update, checkout branch, dan riwayat commit.
            </p>
          </div>
        </div>

        {viewMode !== 'list' ? (
          <button
            onClick={() => setViewMode('list')}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#2B1810] hover:bg-[#3A2216] text-[#FAF5EC] border border-[#4D2D1E] shadow-sm transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Daftar</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setViewMode('create')
              setIsClone(true)
              setRepoName('')
              setCloneUrl('')
            }}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-chocolate-700 to-chocolate-600 hover:from-chocolate-600 hover:to-chocolate-500 text-cream-100 shadow-md shadow-chocolate-950/40 border border-chocolate-500/40 transition duration-150"
          >
            <Plus className="h-4 w-4" />
            <span>Create Repository</span>
          </button>
        )}
      </div>

      {/* ERROR BANNER DARI GIT */}
      {gitError && (
        <div className="w-full bg-red-950/50 border border-red-700/70 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-4 text-red-200 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start space-x-3.5">
            <div className="h-9 w-9 rounded-xl bg-red-900/60 border border-red-700/80 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-red-200 font-serif">
                {gitError.title || 'Terjadi Kesalahan pada Git'}
              </h4>
              <p className="text-xs text-red-300/90 font-mono leading-relaxed whitespace-pre-wrap break-all">
                {gitError.message}
              </p>
            </div>
          </div>
          <button
            onClick={() => setGitError(null)}
            className="p-1.5 rounded-xl text-red-400 hover:text-red-100 hover:bg-red-900/50 transition shrink-0"
            title="Tutup Pesan Error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* SUCCESS / NOTIFICATION BANNER */}
      {gitSuccessBanner && (
        <div className="w-full bg-emerald-950/40 border border-emerald-700/60 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-4 text-emerald-200 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start space-x-3.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-900/60 border border-emerald-700/80 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-emerald-200 font-serif">
                {gitSuccessBanner.title}
              </h4>
              <p className="text-xs text-emerald-300/90 leading-relaxed">
                {gitSuccessBanner.message}
              </p>
              {gitSuccessBanner.actionBtn && (
                <div className="pt-2">
                  <button
                    onClick={gitSuccessBanner.actionBtn.onClick}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-800 hover:bg-emerald-700 text-white transition shadow-sm"
                  >
                    <Folder className="h-3.5 w-3.5 text-emerald-300" />
                    <span>{gitSuccessBanner.actionBtn.label}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setGitSuccessBanner(null)}
            className="p-1.5 rounded-xl text-emerald-400 hover:text-emerald-100 hover:bg-emerald-900/50 transition shrink-0"
            title="Tutup Pesan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. MAIN VIEW SWITCHER */}

      {/* ============================================================ */}
      {/* VIEW A: LIST REPOSITORIES ALA CPANEL                         */}
      {/* ============================================================ */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Subheader Toolbar */}
          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 text-[#A47E65] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari repositori atau path..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF5EC] placeholder-[#A47E65] focus:outline-none focus:border-[#C49767] transition font-sans"
              />
            </div>

            <div className="flex items-center space-x-3 text-xs text-[#DFCDB5] w-full sm:w-auto justify-between sm:justify-end">
              <span className="font-mono text-[11px] text-[#A47E65]">
                Menampilkan {filteredRepos.length} dari {repositories.length} repositori
              </span>
              <button
                onClick={fetchRepositories}
                title="Muat Ulang"
                className="p-2 rounded-xl bg-[#1C0F0A] hover:bg-[#3A2216] text-[#DFCDB5] border border-[#3E2316] transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Repositories Table */}
          <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-[#DFCDB5] space-y-3">
                <Spinner className="h-8 w-8 text-[#C49767] mx-auto" />
                <p className="text-xs">Memuat daftar Git™ Version Control...</p>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="p-12 text-center text-[#DFCDB5] space-y-3">
                <div className="h-16 w-16 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex items-center justify-center mx-auto text-[#A47E65]">
                  <GitBranch className="h-8 w-8 opacity-60" />
                </div>
                <h4 className="text-base font-serif font-bold text-[#FAF5EC]">
                  Belum Ada Repositori Git™
                </h4>
                <p className="text-xs text-[#A47E65] max-w-md mx-auto">
                  Anda belum memiliki repositori Git™. Anda dapat mengkloning project dari GitHub/GitLab atau membuat repositori kosong baru untuk mulai melacak riwayat kode praktikum.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setViewMode('create')
                      setIsClone(true)
                    }}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-chocolate-700 to-chocolate-600 text-cream-100 border border-chocolate-500/40 shadow-md"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Your First Repository</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#4D2D1E] bg-[#22120C] text-[#A47E65] font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-3.5 px-5">Repository</th>
                      <th className="py-3.5 px-4">Repository Path</th>
                      <th className="py-3.5 px-4">Branch</th>
                      <th className="py-3.5 px-4">Last Commit</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3E2316]">
                    {filteredRepos.map((repo) => (
                      <tr key={repo.id} className="hover:bg-[#341F14]/70 transition-colors group">
                        <td className="py-3.5 px-5 font-medium text-[#FAF5EC]">
                          <div className="flex items-center space-x-2.5">
                            <GitBranch className="h-4 w-4 text-terracotta-400 shrink-0" />
                            <div>
                              <div className="font-semibold text-sm text-[#FAF5EC] group-hover:text-amber-200 transition">
                                {repo.name}
                              </div>
                              {repo.remote_url && (
                                <p className="text-[10px] text-[#A47E65] truncate max-w-xs font-mono">
                                  {repo.remote_url}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#DFCDB5]">
                          <span className="bg-[#1C0F0A] px-2.5 py-1 rounded-lg border border-[#3E2316] select-all">
                            {repo.path}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#1C0F0A] text-emerald-400 border border-emerald-900/60 font-mono text-[11px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                            <span>{repo.current_branch || 'main'}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#DFCDB5]">
                          {repo.last_commit_short ? (
                            <div>
                              <span className="font-mono text-terracotta-400 font-bold mr-1.5">
                                {repo.last_commit_short}
                              </span>
                              <span className="truncate inline-block max-w-[180px] align-bottom text-[#FAF5EC]/90">
                                {repo.last_commit_message}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#A47E65] italic">Belum ada commit</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => onNavigate && onNavigate(`/files?repo=${repo.id}`)}
                              title="Buka File Repositori di File Manager"
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#1C0F0A] hover:bg-[#3A2216] text-[#DFCDB5] hover:text-[#FAF5EC] border border-[#3E2316] hover:border-[#C49767] transition text-[11px] font-semibold"
                            >
                              <Folder className="h-3.5 w-3.5 text-[#C49767]" />
                              <span>Files</span>
                            </button>
                            <button
                              onClick={() => handleOpenManage(repo)}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#3A2216] hover:bg-[#4D2E1F] text-[#FAF5EC] border border-[#5A3521] transition text-[11px] font-semibold"
                            >
                              <Sliders className="h-3.5 w-3.5 text-[#E8C58D]" />
                              <span>Manage</span>
                            </button>
                            <button
                              onClick={() => handleOpenHistory(repo)}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#1C0F0A] hover:bg-[#3A2216] text-[#DFCDB5] border border-[#3E2316] transition text-[11px] font-semibold"
                            >
                              <History className="h-3.5 w-3.5 text-amber-400" />
                              <span>History</span>
                            </button>
                            <button
                              onClick={() => setRemoveModal({ open: true, repo, deleteFiles: false })}
                              title="Hapus Repositori"
                              className="p-1.5 rounded-xl bg-[#1C0F0A] hover:bg-rose-950/60 text-rose-400 border border-rose-900/40 hover:border-rose-600 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW B: CREATE / CLONE REPOSITORY ALA CPANEL                 */}
      {/* ============================================================ */}
      {viewMode === 'create' && (
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 shadow-xl w-full">
          <div className="mb-6 pb-4 border-b border-[#3E2316]">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#A47E65] mb-1">
              <span className="cursor-pointer hover:underline" onClick={() => setViewMode('list')}>
                List Repositories
              </span>
              <span>/</span>
              <span className="text-[#FAF5EC]">Create Repository</span>
            </div>
            <h3 className="text-xl font-serif font-bold text-[#FAF5EC]">
              {isClone ? 'Clone an Existing Remote Repository' : 'Create a New Blank Repository'}
            </h3>
            <p className="text-xs text-[#DFCDB5]/80 mt-1">
              Gunakan antarmuka ini untuk mengkloning repositori remote (GitHub/GitLab) atau membuat repositori Git™ baru di direktori terisolasi akun Anda.
            </p>
          </div>

          <form onSubmit={handleCreateRepo} className="space-y-6">
            {/* Toggle Clone vs Initialize */}
            <div className="p-4 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex items-center justify-between">
              <div>
                <span className="block text-xs font-bold text-[#FAF5EC]">
                  Clone a Repository
                </span>
                <span className="block text-[11px] text-[#A47E65] mt-0.5">
                  Aktifkan toggle ini untuk mengkloning repositori remote, atau matikan untuk membuat repositori kosong baru.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsClone(!isClone)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isClone ? 'bg-terracotta-500' : 'bg-[#3A2216]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isClone ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Field: Clone URL (if Clone is ON) */}
            {isClone && (
              <div>
                <label className="block text-xs font-semibold text-[#FAF5EC] mb-1.5">
                  Clone URL <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={cloneUrl}
                  onChange={handleCloneUrlChange}
                  placeholder="https://github.com/username/repository.git"
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] placeholder-[#A47E65] focus:outline-none focus:border-[#C49767] transition font-sans"
                />
                <p className="text-[11px] text-[#A47E65] mt-1.5 leading-relaxed">
                  Masukkan URL remote repositori publik atau dengan kredensial token HTTPS (didukung format http://, https://, git://).
                </p>
              </div>
            )}

            {/* Field: Repository Name */}
            <div>
              <label className="block text-xs font-semibold text-[#FAF5EC] mb-1.5">
                Repository Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="contoh: praktikum-web-lanjut"
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] placeholder-[#A47E65] focus:outline-none focus:border-[#C49767] transition font-sans"
              />
              <p className="text-[11px] text-[#A47E65] mt-1.5">
                Hanya gunakan huruf, angka, minus (-), dan garis bawah (_).
              </p>
            </div>

            {/* Field: Repository Path (Read-only preview) */}
            <div>
              <label className="block text-xs font-semibold text-[#FAF5EC] mb-1.5">
                Repository Path (Otomatis Terisolasi)
              </label>
              <div className="bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs font-mono text-terracotta-400 flex items-center space-x-2">
                <Folder className="h-4 w-4 shrink-0 text-[#A47E65]" />
                <span className="truncate">
                  /home/{user?.username || 'user'}/repositories/{repoName || '<nama-repo>'}
                </span>
              </div>
              <p className="text-[11px] text-[#A47E65] mt-1.5">
                Sistem akan otomatis mengisolasi repositori ke dalam folder khusus akun Anda.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-4 border-t border-[#3E2316]">
              <button
                type="submit"
                disabled={actionLoading}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-chocolate-700 to-chocolate-600 hover:from-chocolate-600 hover:to-chocolate-500 text-cream-100 shadow-lg shadow-chocolate-950/40 border border-chocolate-500/40 transition disabled:opacity-50"
              >
                {actionLoading ? (
                  <span className="flex items-center space-x-2">
                    <Spinner size="xs" />
                    <span>Memproses...</span>
                  </span>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>{isClone ? 'Clone Repository' : 'Create Blank Repository'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#1C0F0A] hover:bg-[#341F14] text-[#DFCDB5] border border-[#3E2316] transition"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW C: MANAGE REPOSITORY (BASIC INFO + PULL OR DEPLOY)      */}
      {/* ============================================================ */}
      {viewMode === 'manage' && selectedRepo && (
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 shadow-xl w-full space-y-6">
          {/* Header & Breadcrumb */}
          <div className="border-b border-[#3E2316] pb-5">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#A47E65] mb-1">
              <span className="cursor-pointer hover:underline" onClick={() => setViewMode('list')}>
                List Repositories
              </span>
              <span>/</span>
              <span className="text-[#FAF5EC]">Manage Repository</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-serif font-bold text-[#FAF5EC] flex items-center space-x-2.5">
                  <GitBranch className="h-6 w-6 text-terracotta-400" />
                  <span>{selectedRepo.name}</span>
                </h3>
                <p className="text-xs font-mono text-[#A47E65] mt-1 select-all">
                  {selectedRepo.path}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onNavigate && onNavigate(`/files?repo=${selectedRepo.id}`)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1C0F0A] hover:bg-[#3A2216] text-[#DFCDB5] hover:text-[#FAF5EC] border border-[#3E2316] hover:border-[#C49767] transition"
                >
                  <Folder className="h-4 w-4 text-[#C49767]" />
                  <span>Buka di File Manager</span>
                </button>
                <button
                  onClick={() => handleOpenHistory(selectedRepo)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1C0F0A] hover:bg-[#3A2216] text-[#DFCDB5] border border-[#3E2316] transition"
                >
                  <History className="h-4 w-4 text-amber-400" />
                  <span>Lihat History Commit</span>
                </button>
              </div>
            </div>
          </div>

          {/* Manage Tabs ala cPanel: Basic Information | Pull or Deploy */}
          <div className="flex border-b border-[#3E2316] space-x-4">
            <button
              onClick={() => setManageTab('basic')}
              className={`pb-3 text-xs font-semibold transition-all relative ${
                manageTab === 'basic'
                  ? 'text-terracotta-400 border-b-2 border-terracotta-400 font-bold'
                  : 'text-[#DFCDB5]/70 hover:text-[#FAF5EC]'
              }`}
            >
              Basic Information
            </button>
            <button
              onClick={() => setManageTab('pull_deploy')}
              className={`pb-3 text-xs font-semibold transition-all relative ${
                manageTab === 'pull_deploy'
                  ? 'text-terracotta-400 border-b-2 border-terracotta-400 font-bold'
                  : 'text-[#DFCDB5]/70 hover:text-[#FAF5EC]'
              }`}
            >
              Pull or Deploy
            </button>
          </div>

          {/* TAB 1: BASIC INFORMATION */}
          {manageTab === 'basic' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Left Column: Repository & Branch Details */}
              <div className="space-y-5">
                {/* Repository Path */}
                <div className="p-5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#A47E65]">
                      Repository Path
                    </label>
                    <button
                      onClick={() => copyToClipboard(selectedRepo.path, 'Repository Path')}
                      className="text-[11px] text-[#A47E65] hover:text-[#FAF5EC] flex items-center space-x-1 transition"
                    >
                      <Copy className="h-3 w-3" />
                      <span>Salin</span>
                    </button>
                  </div>
                  <div className="bg-[#140A07] border border-[#2D180F] rounded-xl px-3.5 py-2.5 text-xs font-mono text-terracotta-400 flex items-center space-x-2">
                    <Folder className="h-4 w-4 text-[#A47E65] shrink-0" />
                    <span className="truncate">{selectedRepo.path}</span>
                  </div>
                </div>

                {/* Currently Checked-Out Branch */}
                <div className="p-5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-3">
                  <label className="block text-xs font-semibold text-[#A47E65]">
                    Currently Checked-Out Branch
                  </label>
                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="flex-1 bg-[#140A07] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                    >
                      {(selectedRepo.branches || [selectedRepo.default_branch || 'main']).map((b) => (
                        <option key={b} value={b}>
                          {b} {b === selectedRepo.current_branch ? '(Active)' : ''}
                        </option>
                      ))}
                    </select>
                    {selectedBranch !== selectedRepo.current_branch && (
                      <button
                        onClick={handleCheckoutBranch}
                        disabled={actionLoading}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D4629] transition shadow-md"
                      >
                        Checkout
                      </button>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-[#A47E65]">
                    <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                    <span>Branch aktif: <span className="font-mono text-emerald-300 font-semibold">{selectedRepo.current_branch}</span></span>
                  </div>
                </div>

                {/* Remote URL Info */}
                {selectedRepo.remote_url && (
                  <div className="p-5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-2">
                    <label className="block text-xs font-semibold text-[#A47E65]">
                      Remote URL
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={selectedRepo.remote_url}
                        className="flex-1 bg-[#140A07] border border-[#2D180F] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#FAF5EC] select-all outline-none"
                      />
                      <button
                        onClick={() => copyToClipboard(selectedRepo.remote_url, 'Remote URL')}
                        className="p-2.5 rounded-xl bg-[#140A07] hover:bg-[#341F14] text-[#DFCDB5] border border-[#3E2316] transition"
                        title="Salin Remote URL"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: HEAD Commit Card ala cPanel */}
              <div className="p-6 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#301B11]">
                  <span className="text-xs font-bold text-[#E8C58D] uppercase tracking-wider flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-terracotta-400" />
                    <span>HEAD Commit Information</span>
                  </span>
                  {selectedRepo.head_commit && (
                    <button
                      onClick={() =>
                        copyToClipboard(selectedRepo.head_commit.hash, 'Commit Hash')
                      }
                      className="px-2.5 py-1 rounded-lg bg-[#2A1810] border border-[#4A2818] text-[11px] font-mono text-[#DFCDB5] hover:text-[#FAF5EC] flex items-center space-x-1.5 transition"
                    >
                      <span className="text-amber-400">{selectedRepo.head_commit.short_hash}</span>
                      <Copy className="h-3 w-3 text-[#A47E65]" />
                    </button>
                  )}
                </div>

                {selectedRepo.head_commit ? (
                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="text-[11px] text-[#A47E65] block mb-1">Commit Message:</span>
                      <p className="font-semibold text-sm text-[#FAF5EC] leading-relaxed p-3.5 rounded-xl bg-[#140A07] border border-[#2D180F]">
                        "{selectedRepo.head_commit.message}"
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-1 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#140A07]/50 border border-[#24130B]">
                        <span className="text-[#A47E65] flex items-center space-x-1.5">
                          <User className="h-3.5 w-3.5" />
                          <span>Author:</span>
                        </span>
                        <span className="text-[#FAF5EC] font-medium">
                          {selectedRepo.head_commit.author_name} ({selectedRepo.head_commit.author_email})
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#140A07]/50 border border-[#24130B]">
                        <span className="text-[#A47E65] flex items-center space-x-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Tanggal:</span>
                        </span>
                        <span className="text-[#FAF5EC] font-medium">
                          {selectedRepo.head_commit.date}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#140A07]/50 border border-[#24130B]">
                        <span className="text-[#A47E65]">SHA-1 Full Hash:</span>
                        <span className="text-[#DFCDB5] font-mono text-[10px] truncate max-w-[200px]" title={selectedRepo.head_commit.hash}>
                          {selectedRepo.head_commit.hash}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#A47E65] italic py-6 text-center">Belum ada commit di branch ini.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PULL OR DEPLOY */}
          {manageTab === 'pull_deploy' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* Column 1: Remote Pull Card */}
                <div className="p-6 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-xl bg-[#2D180F] border border-[#4A2818]">
                        <GitPullRequest className="h-5 w-5 text-terracotta-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-serif font-bold text-[#FAF5EC]">
                          Update from Remote (Git Pull)
                        </h4>
                        <span className="text-[11px] text-[#A47E65]">
                          Sinkronisasi repositori lokal dengan remote branch
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-xs text-[#DFCDB5]/80 leading-relaxed pt-1">
                      Tarik dan gabungkan komit terbaru dari branch remote ke direktori repositori lokal.
                    </p>

                    {/* Auto-Deploy Toggle Checkbox */}
                    <div className="p-3.5 rounded-xl bg-[#140A07] border border-[#2D180F] flex items-center justify-between">
                      <div className="pr-3">
                        <span className="block text-xs font-semibold text-[#FAF5EC]">
                          Auto Deploy ke Web Project
                        </span>
                        <span className="block text-[10px] text-[#A47E65] mt-0.5">
                          Otomatis salin file ke workspace hosting setelah pull selesai
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoDeployOnPull}
                        onChange={(e) => setAutoDeployOnPull(e.target.checked)}
                        className="h-4 w-4 accent-terracotta-500 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#301B11] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <button
                      onClick={handlePullRemote}
                      disabled={actionLoading || !selectedRepo.remote_url}
                      className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D4629] shadow-md transition disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Spinner size="xs" />
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 text-emerald-400" />
                          <span>Update from Remote</span>
                        </>
                      )}
                    </button>
                    {!selectedRepo.remote_url && (
                      <span className="text-[11px] text-amber-400 italic">
                        Tanpa remote URL
                      </span>
                    )}
                  </div>
                </div>

                {/* Column 2: Deploy HEAD Commit Card */}
                <div className="p-6 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-800/60">
                        <Rocket className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-serif font-bold text-[#FAF5EC]">
                          Deploy HEAD Commit to Project
                        </h4>
                        <span className="text-[11px] text-[#A47E65]">
                          Terapkan kode ke direktori runtime hosting web
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[#DFCDB5]/80 leading-relaxed pt-1">
                      Terapkan berkas kode dari HEAD commit repositori ini langsung ke workspace hosting web project mahasiswa yang aktif.
                    </p>

                    {userProjects.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-[#140A07] border border-[#2D180F] space-y-1.5">
                        <label className="block text-[11px] font-semibold text-[#A47E65]">
                          Pilih Target Project Hosting:
                        </label>
                        <select
                          value={targetProjectId}
                          onChange={(e) => setTargetProjectId(e.target.value)}
                          className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3 py-2 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                        >
                          <option value="">Otomatis (Project Pertama Aktif)</option>
                          {userProjects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.subdomain})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#301B11] space-y-3">
                    <button
                      onClick={handleDeployHead}
                      disabled={actionLoading}
                      className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-cream-50 border border-emerald-500/50 shadow-md transition disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Spinner size="xs" />
                      ) : (
                        <>
                          <Rocket className="h-4 w-4" />
                          <span>Deploy HEAD Commit</span>
                        </>
                      )}
                    </button>

                    {/* Last Deployment Information */}
                    {selectedRepo.last_deployed_at && (
                      <div className="text-[11px] text-[#DFCDB5] flex items-center space-x-2 pt-1">
                        <span className="text-[#A47E65]">Terakhir Di-deploy:</span>
                        <span className="font-semibold text-emerald-300">
                          {new Date(selectedRepo.last_deployed_at).toLocaleString('id-ID')}
                        </span>
                        {selectedRepo.last_deployed_commit && (
                          <span className="font-mono text-[#E8C58D]">
                            ({selectedRepo.last_deployed_commit.substring(0, 7)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Helper Bar: File Manager Direct Access */}
              <div className="p-4 rounded-2xl bg-[#1C0F0A]/90 border border-[#3E2316] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center space-x-3 text-xs text-[#DFCDB5]">
                  <Folder className="h-5 w-5 text-[#C49767] shrink-0" />
                  <div>
                    <span className="font-semibold text-[#FAF5EC]">Ingin melihat atau mengedit berkas langsung di browser?</span>
                    <p className="text-[11px] text-[#A47E65]">
                      Berkas yang di-deploy tersimpan di workspace project dan dapat dikelola lengkap lewat File Manager.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate && onNavigate(`/files?repo=${selectedRepo.id}`)}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#3A2216] hover:bg-[#5A3521] text-[#FAF5EC] border border-[#5E3622] transition shrink-0"
                >
                  <Folder className="h-3.5 w-3.5 text-[#C49767]" />
                  <span>Buka File Manager</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW D: COMMIT HISTORY ALA CPANEL (media_1794293461562)      */}
      {/* ============================================================ */}
      {viewMode === 'history' && selectedRepo && (
        <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 sm:p-8 shadow-xl w-full space-y-6">
          <div className="flex items-center justify-between border-b border-[#3E2316] pb-5">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#A47E65] mb-1">
                <span className="cursor-pointer hover:underline" onClick={() => setViewMode('list')}>
                  List Repositories
                </span>
                <span>/</span>
                <span className="text-[#FAF5EC]">Commit History</span>
              </div>
              <h3 className="text-xl font-serif font-bold text-[#FAF5EC] flex items-center space-x-2.5">
                <History className="h-5 w-5 text-amber-400" />
                <span>Riwayat Commit: {selectedRepo.name}</span>
              </h3>
            </div>

            <button
              onClick={() => fetchCommitHistory(selectedRepo.id)}
              className="p-2 rounded-xl bg-[#1C0F0A] hover:bg-[#3A2216] text-[#DFCDB5] border border-[#3E2316] transition"
              title="Refresh History"
            >
              <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {historyLoading ? (
            <div className="p-12 text-center text-[#DFCDB5]">
              <Spinner className="h-8 w-8 text-[#C49767] mx-auto mb-2" />
              <p className="text-xs">Memuat log commit Git™...</p>
            </div>
          ) : commits.length === 0 ? (
            <div className="p-12 text-center text-[#A47E65]">
              <p className="text-xs">Belum ada riwayat commit di repositori ini.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {commits.map((c) => (
                <div
                  key={c.hash}
                  className="p-4 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] hover:border-[#5A3521] transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#FAF5EC]">{c.message}</p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#A47E65]">
                      <span className="flex items-center space-x-1">
                        <User className="h-3.5 w-3.5 text-[#DFCDB5]" />
                        <span>{c.author_name}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3.5 w-3.5 text-[#DFCDB5]" />
                        <span>{c.date}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-lg bg-[#2B1810] text-[#E8C58D] font-mono text-[11px] border border-[#4D2D1E]">
                      {c.short_hash}
                    </span>
                    <button
                      onClick={() => copyToClipboard(c.hash, 'Full Commit SHA')}
                      className="p-1.5 rounded-lg bg-[#24130B] hover:bg-[#341F14] text-[#A47E65] hover:text-[#FAF5EC] border border-[#3E2316] transition"
                      title="Copy Full SHA"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. MODAL: REMOVE REPOSITORY (WITH SAFE UNLINK OPTION)       */}
      {/* ============================================================ */}
      <ModalPortal isOpen={Boolean(removeModal.open && removeModal.repo)}>
        <div
          onClick={() => setRemoveModal({ open: false, repo: null, deleteFiles: false })}
          className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#2B1810] border border-[#5A3521] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 text-[#FAF5EC]"
          >
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="h-10 w-10 rounded-2xl bg-rose-950/60 border border-rose-800/50 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-serif font-bold text-[#FAF5EC]">
                  Hapus Repositori Git™
                </h4>
                <p className="text-xs text-[#DFCDB5]/70">
                  {removeModal.repo?.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#DFCDB5] leading-relaxed">
              Apakah Anda yakin ingin menghapus repositori <span className="font-semibold text-white font-mono">'{removeModal.repo?.name}'</span> dari daftar pelacakan Git™ Version Control?
            </p>

            {/* Checkbox: Delete Files or Keep in File Manager */}
            <div className="p-3.5 rounded-xl bg-[#1C0F0A] border border-[#3E2316]">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeModal.deleteFiles}
                  onChange={(e) =>
                    setRemoveModal({ ...removeModal, deleteFiles: e.target.checked })
                  }
                  className="mt-0.5 rounded border-[#5A3521] text-terracotta-500 focus:ring-terracotta-500 bg-[#2B1810]"
                />
                <div className="text-xs text-[#FAF5EC]">
                  <span className="font-semibold">Hapus juga direktori dan file fisik di disk</span>
                  <p className="text-[11px] text-[#A47E65] mt-0.5">
                    {removeModal.deleteFiles ? (
                      <span className="text-rose-400 font-medium">
                        PERINGATAN: Seluruh file di {removeModal.repo?.path} akan dihapus permanen.
                      </span>
                    ) : (
                      <span>
                        (Direkomendasikan) File di File Manager tetap aman tersimpan, hanya pelacakan Git™ yang dilepas.
                      </span>
                    )}
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setRemoveModal({ open: false, repo: null, deleteFiles: false })}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1C0F0A] hover:bg-[#341F14] text-[#DFCDB5] border border-[#3E2316] transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmRemove}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition disabled:opacity-50"
              >
                {actionLoading ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
    </div>
  )
}
