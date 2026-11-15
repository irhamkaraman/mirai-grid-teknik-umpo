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
import Button from '../components/Button'
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

  const openRepoPathInFileManager = (repoPath) => {
    if (!onNavigate) return
    const rawPath = String(repoPath || '')
    const isAdmin = user?.role === 'admin'
    const cleanRel = isAdmin
      ? rawPath.replace(/^\/home\/?/, '')
      : rawPath.replace(/^\/home\/[^/]+\/?/, '')
    const baseRoute = isAdmin ? '/dashboard' : '/workspace/files'
    onNavigate(cleanRel ? `${baseRoute}?path=${encodeURIComponent(cleanRel)}` : baseRoute)
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
      {/* 1. TOP HEADER V2 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="h-11 w-11 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center p-2.5 shrink-0">
            <img src="/logos/git.svg" alt="Git Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-sans font-bold text-slate-900 tracking-tight">
                Git Version Control
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                v2.47
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola repositori Git mandiri: kloning repository remote, pull update, checkout branch, dan riwayat commit.
            </p>
          </div>
        </div>

        {viewMode !== 'list' ? (
          <Button
            variant="secondary"
            size="sm"
            icon={ArrowLeft}
            onClick={() => setViewMode('list')}
          >
            Kembali ke Daftar
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => {
              setViewMode('create')
              setIsClone(true)
              setRepoName('')
              setCloneUrl('')
            }}
          >
            Create Repository
          </Button>
        )}
      </div>

      {/* ERROR BANNER DARI GIT */}
      {gitError && (
        <div className="w-full bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start justify-between gap-4 text-rose-800">
          <div className="flex items-start space-x-3">
            <div className="h-9 w-9 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-rose-900 font-sans">
                {gitError.title || 'Terjadi Kesalahan pada Git'}
              </h4>
              <p className="text-xs text-rose-700 font-mono leading-relaxed whitespace-pre-wrap break-all">
                {gitError.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setGitError(null)}
            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-800 hover:bg-rose-100 transition shrink-0"
            title="Tutup Pesan Error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* SUCCESS / NOTIFICATION BANNER */}
      {gitSuccessBanner && (
        <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start justify-between gap-4 text-emerald-900">
          <div className="flex items-start space-x-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-emerald-900 font-sans">
                {gitSuccessBanner.title}
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                {gitSuccessBanner.message}
              </p>
              {gitSuccessBanner.actionBtn && (
                <div className="pt-2">
                  <Button
                    variant="emerald"
                    size="xs"
                    icon={Folder}
                    onClick={gitSuccessBanner.actionBtn.onClick}
                  >
                    {gitSuccessBanner.actionBtn.label}
                  </Button>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setGitSuccessBanner(null)}
            className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-900 hover:bg-emerald-100 transition shrink-0"
            title="Tutup Pesan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. MAIN VIEW SWITCHER */}

      {/* ============================================================ */}
      {/* VIEW A: LIST REPOSITORIES V2                                 */}
      {/* ============================================================ */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Subheader Toolbar */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari repositori atau path..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 transition font-sans"
              />
            </div>

            <div className="flex items-center space-x-3 text-xs text-slate-600 w-full sm:w-auto justify-between sm:justify-end">
              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                Menampilkan {filteredRepos.length} dari {repositories.length} repositori
              </span>
              <button
                type="button"
                onClick={fetchRepositories}
                title="Muat Ulang"
                className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/80 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Repositories Table */}
          <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-600 space-y-3">
                <Spinner className="h-8 w-8 text-emerald-600 mx-auto" />
                <p className="text-xs">Memuat daftar Git Version Control...</p>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="p-12 text-center text-slate-600 space-y-3">
                <div className="h-14 w-14 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center mx-auto text-slate-500">
                  <GitBranch className="h-7 w-7 opacity-60" />
                </div>
                <h4 className="text-base font-sans font-bold text-slate-900">
                  Belum Ada Repositori Git
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Anda belum memiliki repositori Git. Anda dapat mengkloning project dari GitHub/GitLab atau membuat repositori kosong baru untuk mulai melacak riwayat kode praktikum.
                </p>
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={() => {
                      setViewMode('create')
                      setIsClone(true)
                    }}
                  >
                    Create Your First Repository
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/80 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-3.5 px-5">Repository</th>
                      <th className="py-3.5 px-4">Repository Path</th>
                      <th className="py-3.5 px-4">Branch</th>
                      <th className="py-3.5 px-4">Last Commit</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {filteredRepos.map((repo) => (
                      <tr key={repo.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-medium text-slate-900">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 shrink-0">
                              <GitBranch className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => handleOpenManage(repo)}
                                className="font-semibold text-sm text-slate-900 hover:text-emerald-700 transition text-left"
                              >
                                {repo.name}
                              </button>
                              {repo.remote_url && (
                                <p className="text-[10px] text-slate-500 truncate max-w-xs font-mono">
                                  {repo.remote_url}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => openRepoPathInFileManager(repo.path)}
                            title={`Buka ${repo.path} di File Manager`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] font-mono text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700 transition max-w-[260px]"
                          >
                            <Folder className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{repo.path}</span>
                            <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" />
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono text-[11px] font-medium">
                            <GitBranch className="h-3 w-3" />
                            <span>{repo.current_branch || 'main'}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {repo.last_commit_short ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-700 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                                {repo.last_commit_short}
                              </span>
                              <span className="truncate inline-block max-w-[180px] text-slate-700">
                                {repo.last_commit_message}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Belum ada commit</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openRepoPathInFileManager(repo.path)}
                              title="Buka di File Manager"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                            >
                              <Folder className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenManage(repo)}
                              title="Kelola Repositori"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                            >
                              <Sliders className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenHistory(repo)}
                              title="Riwayat Commit"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                            >
                              <History className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRemoveModal({ open: true, repo, deleteFiles: false })}
                              title="Hapus Repositori"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                            >
                              <Trash2 className="h-4 w-4" />
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
      {/* VIEW B: CREATE / CLONE REPOSITORY V2                         */}
      {/* ============================================================ */}
      {viewMode === 'create' && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 w-full">
          <div className="mb-6 pb-4 border-b border-slate-200/80">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-1">
              <span className="cursor-pointer hover:text-slate-900 hover:underline" onClick={() => setViewMode('list')}>
                List Repositories
              </span>
              <span>/</span>
              <span className="text-slate-900">Create Repository</span>
            </div>
            <h3 className="text-xl font-sans font-bold text-slate-900">
              {isClone ? 'Clone an Existing Remote Repository' : 'Create a New Blank Repository'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Gunakan antarmuka ini untuk mengkloning repositori remote (GitHub/GitLab) atau membuat repositori Git baru di direktori terisolasi akun Anda.
            </p>
          </div>

          <form onSubmit={handleCreateRepo} className="space-y-6">
            {/* Toggle Clone vs Initialize */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="block text-xs font-bold text-slate-900">
                  Clone a Repository
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Aktifkan toggle ini untuk mengkloning repositori remote, atau matikan untuk membuat repositori kosong baru.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsClone(!isClone)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isClone ? 'bg-emerald-600' : 'bg-slate-300'
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
                <label className="block text-xs font-semibold text-slate-900 mb-1.5">
                  Clone URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={cloneUrl}
                  onChange={handleCloneUrlChange}
                  placeholder="https://github.com/username/repository.git"
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 transition font-sans"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Masukkan URL remote repositori publik atau dengan kredensial token HTTPS (didukung format http://, https://, git://).
                </p>
              </div>
            )}

            {/* Field: Repository Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1.5">
                Repository Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="contoh: praktikum-web-lanjut"
                className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 transition font-sans"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                Hanya gunakan huruf, angka, minus (-), dan garis bawah (_).
              </p>
            </div>

            {/* Field: Repository Path (Read-only preview) */}
            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1.5">
                Repository Path (Otomatis Terisolasi)
              </label>
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg px-3.5 py-2.5 text-xs font-mono text-emerald-700 flex items-center space-x-2">
                <Folder className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">
                  /home/{user?.username || 'user'}/repositories/{repoName || '<nama-repo>'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Sistem akan otomatis mengisolasi repositori ke dalam folder khusus akun Anda.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-4 border-t border-slate-200/80">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={actionLoading}
                icon={Plus}
              >
                {actionLoading ? 'Memproses...' : isClone ? 'Clone Repository' : 'Create Blank Repository'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setViewMode('list')}
              >
                Batal
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW C: MANAGE REPOSITORY (BASIC INFO + PULL OR DEPLOY) V2   */}
      {/* ============================================================ */}
      {viewMode === 'manage' && selectedRepo && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 w-full space-y-6">
          {/* Header & Breadcrumb */}
          <div className="border-b border-slate-200/80 pb-5">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-1">
              <span className="cursor-pointer hover:text-slate-900 hover:underline" onClick={() => setViewMode('list')}>
                List Repositories
              </span>
              <span>/</span>
              <span className="text-slate-900">Manage Repository</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-2xl font-sans font-bold text-slate-900 flex items-center space-x-2.5">
                  <GitBranch className="h-5 w-5 text-emerald-600" />
                  <span>{selectedRepo.name}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => openRepoPathInFileManager(selectedRepo.path)}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-emerald-700 mt-1 transition"
                >
                  <span>{selectedRepo.path}</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Folder}
                  onClick={() => openRepoPathInFileManager(selectedRepo.path)}
                >
                  File Manager
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={History}
                  onClick={() => handleOpenHistory(selectedRepo)}
                >
                  History Commit
                </Button>
              </div>
            </div>
          </div>

          {/* Manage Tabs V2 */}
          <div className="flex border-b border-slate-200/80 space-x-5">
            <button
              type="button"
              onClick={() => setManageTab('basic')}
              className={`pb-3 text-xs font-semibold transition-all ${
                manageTab === 'basic'
                  ? 'text-emerald-700 border-b-2 border-emerald-600 font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Basic Information
            </button>
            <button
              type="button"
              onClick={() => setManageTab('pull_deploy')}
              className={`pb-3 text-xs font-semibold transition-all ${
                manageTab === 'pull_deploy'
                  ? 'text-emerald-700 border-b-2 border-emerald-600 font-bold'
                  : 'text-slate-500 hover:text-slate-900'
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
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-600">
                      Repository Path
                    </label>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedRepo.path, 'Repository Path')}
                      className="text-[11px] text-slate-500 hover:text-slate-900 flex items-center space-x-1 transition"
                    >
                      <Copy className="h-3 w-3" />
                      <span>Salin</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => openRepoPathInFileManager(selectedRepo.path)}
                    className="w-full bg-white border border-slate-200/80 hover:border-emerald-300 rounded-lg px-3.5 py-2.5 text-xs font-mono text-slate-700 hover:text-emerald-700 flex items-center justify-between gap-2 transition text-left"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Folder className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="truncate">{selectedRepo.path}</span>
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  </button>
                </div>

                {/* Currently Checked-Out Branch */}
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <label className="block text-xs font-semibold text-slate-600">
                    Currently Checked-Out Branch
                  </label>
                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="flex-1 bg-white border border-slate-200/80 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                    >
                      {(selectedRepo.branches || [selectedRepo.default_branch || 'main']).map((b) => (
                        <option key={b} value={b}>
                          {b} {b === selectedRepo.current_branch ? '(Active)' : ''}
                        </option>
                      ))}
                    </select>
                    {selectedBranch !== selectedRepo.current_branch && (
                      <Button
                        variant="emerald"
                        size="sm"
                        loading={actionLoading}
                        onClick={handleCheckoutBranch}
                      >
                        Checkout
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                    <GitBranch className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Branch aktif: <span className="font-mono text-emerald-700 font-semibold">{selectedRepo.current_branch}</span></span>
                  </div>
                </div>

                {/* Remote URL Info */}
                {selectedRepo.remote_url && (
                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <label className="block text-xs font-semibold text-slate-600">
                      Remote URL
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={selectedRepo.remote_url}
                        className="flex-1 bg-white border border-slate-200/80 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-900 select-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedRepo.remote_url, 'Remote URL')}
                        className="p-2 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80 transition"
                        title="Salin Remote URL"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: HEAD Commit Card V2 */}
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    <span>HEAD Commit Information</span>
                  </span>
                  {selectedRepo.head_commit && (
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(selectedRepo.head_commit.hash, 'Commit Hash')
                      }
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/80 text-[11px] font-mono text-slate-700 hover:text-slate-900 flex items-center space-x-1.5 transition"
                    >
                      <span className="font-semibold text-emerald-700">{selectedRepo.head_commit.short_hash}</span>
                      <Copy className="h-3 w-3 text-slate-400" />
                    </button>
                  )}
                </div>

                {selectedRepo.head_commit ? (
                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">Commit Message:</span>
                      <p className="font-semibold text-sm text-slate-900 leading-relaxed p-3.5 rounded-lg bg-white border border-slate-200/80">
                        "{selectedRepo.head_commit.message}"
                      </p>
                    </div>

                    <div className="space-y-2 pt-1 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80">
                        <span className="text-slate-500 flex items-center space-x-1.5">
                          <User className="h-3.5 w-3.5" />
                          <span>Author:</span>
                        </span>
                        <span className="text-slate-900 font-medium">
                          {selectedRepo.head_commit.author_name} ({selectedRepo.head_commit.author_email})
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80">
                        <span className="text-slate-500 flex items-center space-x-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Tanggal:</span>
                        </span>
                        <span className="text-slate-900 font-medium">
                          {selectedRepo.head_commit.date}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80">
                        <span className="text-slate-500">SHA-1 Full Hash:</span>
                        <span className="text-slate-600 font-mono text-[10px] truncate max-w-[200px]" title={selectedRepo.head_commit.hash}>
                          {selectedRepo.head_commit.hash}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-6 text-center">Belum ada commit di branch ini.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PULL OR DEPLOY */}
          {manageTab === 'pull_deploy' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* Column 1: Remote Pull Card */}
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-white border border-slate-200/80 text-slate-700">
                        <GitPullRequest className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-sans font-bold text-slate-900">
                          Update from Remote (Git Pull)
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          Sinkronisasi repositori lokal dengan remote branch
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed pt-1">
                      Tarik dan gabungkan komit terbaru dari branch remote ke direktori repositori lokal.
                    </p>

                    {/* Auto-Deploy Toggle Checkbox */}
                    <div className="p-3.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between">
                      <div className="pr-3">
                        <span className="block text-xs font-semibold text-slate-900">
                          Auto Deploy ke Web Project
                        </span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          Otomatis salin file ke workspace hosting setelah pull selesai
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoDeployOnPull}
                        onChange={(e) => setAutoDeployOnPull(e.target.checked)}
                        className="h-4 w-4 accent-emerald-600 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <Button
                      variant="emerald"
                      size="sm"
                      icon={RefreshCw}
                      loading={actionLoading}
                      disabled={!selectedRepo.remote_url}
                      onClick={handlePullRemote}
                    >
                      Update from Remote
                    </Button>
                    {!selectedRepo.remote_url && (
                      <span className="text-[11px] text-slate-500 italic">
                        Tanpa remote URL
                      </span>
                    )}
                  </div>
                </div>

                {/* Column 2: Deploy HEAD Commit Card */}
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200/70 text-emerald-700">
                        <Rocket className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-sans font-bold text-slate-900">
                          Deploy HEAD Commit to Project
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          Terapkan kode ke direktori runtime hosting web
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed pt-1">
                      Terapkan berkas kode dari HEAD commit repositori ini langsung ke workspace hosting web project yang aktif.
                    </p>

                    {userProjects.length > 0 && (
                      <div className="p-3.5 rounded-lg bg-white border border-slate-200/80 space-y-1.5">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Pilih Target Project Hosting:
                        </label>
                        <select
                          value={targetProjectId}
                          onChange={(e) => setTargetProjectId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500"
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

                  <div className="pt-4 border-t border-slate-200/80 space-y-3">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Rocket}
                      loading={actionLoading}
                      onClick={handleDeployHead}
                    >
                      Deploy HEAD Commit
                    </Button>

                    {/* Last Deployment Information */}
                    {selectedRepo.last_deployed_at && (
                      <div className="text-[11px] text-slate-600 flex items-center space-x-2 pt-1">
                        <span className="text-slate-500">Terakhir Di-deploy:</span>
                        <span className="font-semibold text-emerald-700">
                          {new Date(selectedRepo.last_deployed_at).toLocaleString('id-ID')}
                        </span>
                        {selectedRepo.last_deployed_commit && (
                          <span className="font-mono text-emerald-700">
                            ({selectedRepo.last_deployed_commit.substring(0, 7)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Helper Bar: File Manager Direct Access */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center space-x-3 text-xs text-slate-600">
                  <Folder className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900">Ingin melihat atau mengedit berkas langsung di browser?</span>
                    <p className="text-[11px] text-slate-500">
                      Berkas yang di-deploy tersimpan di workspace project dan dapat dikelola lengkap lewat File Manager.
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Folder}
                  onClick={() => openRepoPathInFileManager(selectedRepo.path)}
                >
                  Buka File Manager
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW D: COMMIT HISTORY V2                                    */}
      {/* ============================================================ */}
      {viewMode === 'history' && selectedRepo && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 w-full space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-5">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-1">
                <span className="cursor-pointer hover:text-slate-900 hover:underline" onClick={() => setViewMode('list')}>
                  List Repositories
                </span>
                <span>/</span>
                <span className="text-slate-900">Commit History</span>
              </div>
              <h3 className="text-xl font-sans font-bold text-slate-900 flex items-center space-x-2.5">
                <History className="h-5 w-5 text-emerald-600" />
                <span>Riwayat Commit: {selectedRepo.name}</span>
              </h3>
            </div>

            <button
              type="button"
              onClick={() => fetchCommitHistory(selectedRepo.id)}
              className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/80 transition"
              title="Refresh History"
            >
              <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {historyLoading ? (
            <div className="p-12 text-center text-slate-600">
              <Spinner className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-xs">Memuat log commit Git...</p>
            </div>
          ) : commits.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <p className="text-xs">Belum ada riwayat commit di repositori ini.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {commits.map((c) => (
                <div
                  key={c.hash}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-900">{c.message}</p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span className="flex items-center space-x-1">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>{c.author_name}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{c.date}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-lg bg-white text-emerald-700 font-mono text-[11px] border border-slate-200/80 font-semibold">
                      {c.short_hash}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(c.hash, 'Full Commit SHA')}
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200/80 transition"
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
          className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-7 max-w-md w-full space-y-5 animate-in zoom-in-95 duration-150 text-slate-900"
          >
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-sans font-bold text-slate-900">
                  Hapus Repositori Git
                </h4>
                <p className="text-xs text-slate-500">
                  {removeModal.repo?.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus repositori <span className="font-semibold text-slate-900 font-mono">'{removeModal.repo?.name}'</span> dari daftar pelacakan Git Version Control?
            </p>

            {/* Checkbox: Delete Files or Keep in File Manager */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeModal.deleteFiles}
                  onChange={(e) =>
                    setRemoveModal({ ...removeModal, deleteFiles: e.target.checked })
                  }
                  className="mt-0.5 rounded border-slate-300 accent-rose-600 bg-white"
                />
                <div className="text-xs text-slate-900">
                  <span className="font-semibold">Hapus juga direktori dan file fisik di disk</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {removeModal.deleteFiles ? (
                      <span className="text-rose-600 font-medium">
                        PERINGATAN: Seluruh file di {removeModal.repo?.path} akan dihapus permanen.
                      </span>
                    ) : (
                      <span>
                        (Direkomendasikan) File di File Manager tetap aman tersimpan, hanya pelacakan Git yang dilepas.
                      </span>
                    )}
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRemoveModal({ open: false, repo: null, deleteFiles: false })}
              >
                Batal
              </Button>
              <Button
                variant="danger-solid"
                size="sm"
                loading={actionLoading}
                onClick={handleConfirmRemove}
              >
                {actionLoading ? 'Menghapus...' : 'Ya, Hapus'}
              </Button>
            </div>
          </div>
        </div>
      </ModalPortal>
    </div>
  )
}
