import React, { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { api } from '../api/client'
import { Spinner } from './Skeletons'
import ModalPortal from './ModalPortal'
import { useTheme } from '../context/ThemeContext'
import Button from './Button'

export default function ChangePasswordModal({ isOpen, onClose, isMandatory = false, onSuccess }) {
  const { isV2 } = useTheme()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      const msg = 'Password baru minimal 8 karakter.'
      setError(msg)
      toast.error(msg)
      return
    }

    if (newPassword !== confirmPassword) {
      const msg = 'Konfirmasi password tidak cocok.'
      setError(msg)
      toast.error(msg)
      return
    }

    setLoading(true)
    try {
      const payload = {
        new_password: newPassword,
      }
      if (!isMandatory && oldPassword.trim()) {
        payload.old_password = oldPassword.trim()
      }

      await api.post('/auth/change-password', payload)

      // Update persistent user state in localStorage
      try {
        const saved = JSON.parse(localStorage.getItem('miraigrid_user') || '{}')
        saved.must_change_password = false
        localStorage.setItem('miraigrid_user', JSON.stringify(saved))
      } catch (e) {}

      toast.success('Password berhasil diperbarui!', {
        description: 'Selamat datang di workspace praktikum Anda.',
      })

      // Reset form
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')

      onSuccess?.()
      onClose()
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Gagal mengubah password. Silakan coba kembali.'
      setError(errMsg)
      toast.error(errMsg)
    } finally {
      setLoading(false)
    }
  }

  if (isV2) {
    return (
      <ModalPortal isOpen={isOpen}>
        <div
          onClick={() => !isMandatory && onClose()}
          className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl p-6 text-slate-900 animate-in zoom-in-95 duration-150 font-sans"
          >
            <div className="flex items-center space-x-3 mb-5">
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-xs">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isMandatory ? 'Ganti Password Pertama Kali' : 'Perbarui Password'}
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  {isMandatory
                    ? 'Tentukan password baru untuk mengamankan akun praktikum Anda.'
                    : 'Masukkan password baru yang akan digunakan.'}
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start space-x-2 text-rose-700 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isMandatory && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password Lama (Opsional)
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    placeholder="Password akun sebelumnya"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password Baru <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3.5 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    placeholder="Minimal 8 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Konfirmasi Password Baru <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3.5 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    placeholder="Ulangi password baru"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                {!isMandatory && (
                  <Button variant="secondary" size="md" onClick={onClose} disabled={loading}>
                    Batal
                  </Button>
                )}
                <Button variant="primary" size="md" type="submit" loading={loading}>
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>
    )
  }

  return (
    <ModalPortal isOpen={isOpen}>
      <div
        onClick={() => !isMandatory && onClose()}
        className="fixed inset-0 !mt-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 text-[#FAF5EC] animate-in zoom-in-95 duration-150"
        >
          <div className="flex items-center space-x-3 text-[#E8DCB8] mb-5">
            <div className="p-2.5 rounded-2xl bg-[#3A2115] border border-[#543221] text-[#FAF5EC] shadow-inner">
              <KeyRound className="h-5 w-5 text-[#C49767]" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-[#FAF5EC]">
                {isMandatory ? 'Ganti Password Pertama Kali' : 'Perbarui Password'}
              </h3>
              <p className="text-xs text-[#DFCDB5]/80 font-light mt-0.5">
                {isMandatory
                  ? 'Tentukan password baru untuk mengamankan akun praktikum Anda.'
                  : 'Masukkan password baru yang akan digunakan.'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-2 text-rose-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isMandatory && (
              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">
                  Password Lama (Opsional)
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] placeholder-[#705241] focus:outline-none focus:border-[#C49767] transition"
                  placeholder="Password akun sebelumnya"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">
                Password Baru <span className="text-[#E8DCB8]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-[#FAF5EC] placeholder-[#705241] focus:outline-none focus:border-[#C49767] transition"
                  placeholder="Minimal 8 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-[#A47E65] hover:text-[#FAF5EC] transition"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">
                Konfirmasi Password Baru <span className="text-[#E8DCB8]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-[#FAF5EC] placeholder-[#705241] focus:outline-none focus:border-[#C49767] transition"
                  placeholder="Ulangi password baru"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-[#A47E65] hover:text-[#FAF5EC] transition"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              {!isMandatory && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"
                >
                  Batal
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#E8DCB8] text-[#180D07] hover:bg-white transition shadow-lg disabled:opacity-50"
              >
                {loading && <Spinner size="xs" />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  )
}
