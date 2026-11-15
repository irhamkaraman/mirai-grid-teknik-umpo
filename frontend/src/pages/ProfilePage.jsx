import React, { useEffect, useState } from 'react'
import { User, Key, Calendar, Shield, CheckCircle2, Eye, EyeOff, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import Button from '../components/Button'
import { Spinner } from '../components/Skeletons'

const ROLE_LABELS = {
  admin: 'Administrator Lab',
  dosen: 'Dosen',
  student: 'Mahasiswa'
}

function formatJoinedDate(raw) {
  if (!raw) return '-'
  const normalized = String(raw).includes('T') ? raw : String(raw).replace(' ', 'T') + 'Z'
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return String(raw)
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export default function ProfilePage({ user, onUserUpdated }) {
  const [profile, setProfile] = useState(user || {})
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [nameInput, setNameInput] = useState(user?.name || '')
  const [savingName, setSavingName] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)

  useEffect(() => {
    let mounted = true
    api
      .get('/auth/me')
      .then((res) => {
        if (!mounted || !res.data) return
        setProfile(res.data)
        setNameInput(res.data.name || '')
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingProfile(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const handleSaveName = async (e) => {
    e.preventDefault()
    const trimmed = nameInput.trim()
    if (trimmed.length < 2) {
      toast.error('Nama minimal 2 karakter.')
      return
    }
    setSavingName(true)
    try {
      const res = await api.put('/auth/profile', { name: trimmed })
      const updated = res.data
      setProfile(updated)
      setNameInput(updated.name)
      const stored = JSON.parse(localStorage.getItem('miraigrid_user') || '{}')
      const merged = { ...stored, name: updated.name }
      localStorage.setItem('miraigrid_user', JSON.stringify(merged))
      if (onUserUpdated) onUserUpdated(merged)
      toast.success('Nama profil berhasil diperbarui.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memperbarui nama profil.')
    } finally {
      setSavingName(false)
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error('Password baru minimal 8 karakter.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok.')
      return
    }
    setSavingPass(true)
    try {
      await api.post('/auth/change-password', {
        old_password: oldPassword || null,
        new_password: newPassword
      })
      toast.success('Password berhasil diperbarui.')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memperbarui password.')
    } finally {
      setSavingPass(false)
    }
  }

  const initial = (profile?.name || user?.name || 'U').charAt(0).toUpperCase()
  const roleLabel = ROLE_LABELS[profile?.role || user?.role] || 'Pengguna'

  return (
    <div className="w-full max-w-4xl space-y-6 font-sans pb-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700">
            <User className="h-5 w-5" />
          </span>
          <span>Profil Anda</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Kelola informasi akun, perbarui nama tampilan, dan ubah kata sandi keamanan Anda.
        </p>
      </div>

      {/* Account Overview Card */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-6">
        {loadingProfile ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
            <Spinner size="xs" />
            <span>Memuat data profil...</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-slate-900 text-white font-bold text-xl flex items-center justify-center shrink-0">
                {initial}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">{profile?.name || user?.name}</h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Shield className="h-3 w-3" />
                    {roleLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  ID / Username: <span className="text-slate-700 font-semibold">{profile?.username || user?.username}</span>
                </p>
              </div>
            </div>

            <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs shrink-0">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <Calendar className="h-3 w-3" />
                <span>Bergabung Sejak</span>
              </div>
              <p className="font-medium text-slate-800 mt-1">
                {formatJoinedDate(profile?.created_at)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Name & Update Password Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Edit Nama */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Edit Nama Profil</h3>
              <p className="text-[11px] text-slate-500">Perbarui nama tampilan yang muncul di workspace Anda.</p>
            </div>
          </div>

          <form onSubmit={handleSaveName} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Nama Lengkap</label>
              <input
                type="text"
                required
                minLength={2}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Masukkan nama lengkap"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-400"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" disabled={savingName} icon={Save}>
                {savingName ? 'Menyimpan...' : 'Simpan Nama'}
              </Button>
            </div>
          </form>
        </div>

        {/* Update Password */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                <Key className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Update Password</h3>
                <p className="text-[11px] text-slate-500">Gunakan minimal 8 karakter untuk keamanan akun.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title={showPass ? 'Sembunyikan Password' : 'Lihat Password'}
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password Lama</label>
              <input
                type={showPass ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Masukkan password saat ini"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password Baru</label>
              <input
                type={showPass ? 'text' : 'password'}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Konfirmasi Password Baru</label>
              <input
                type={showPass ? 'text' : 'password'}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-400"
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" variant="primary" size="sm" disabled={savingPass} icon={Key}>
                {savingPass ? 'Memperbarui...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
