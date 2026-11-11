import React, { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { api } from '../api/client'
import { Spinner } from './Skeletons'
import ModalPortal from './ModalPortal'

export default function ChangePasswordModal({ isOpen, onClose, isMandatory = false, onSuccess }) {
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
        new_password: newPassword
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
        description: 'Selamat datang di workspace praktikum Anda.'
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

  return (
    <ModalPortal isOpen={isOpen}>
      <div
        onClick={() => !isMandatory && onClose()}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
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
            {/* Hanya tampilkan Password Lama jika BUKAN mandatory */}
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

            {/* Input Password Baru */}
            <div>
              <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">
                Password Baru (Min. 8 Karakter)
              </label>
              <div className="relative group">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-[#FAF5EC] placeholder-[#705241] focus:outline-none focus:border-[#C49767] transition font-sans shadow-inner"
                  placeholder="Masukkan minimal 8 karakter"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A47454] hover:text-[#FAF5EC] transition p-1 rounded-md"
                  title={showNewPassword ? 'Sembunyikan' : 'Lihat'}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Input Konfirmasi Password Baru */}
            <div>
              <label className="block text-xs font-semibold text-[#DFCDB5] mb-1.5">
                Konfirmasi Password Baru
              </label>
              <div className="relative group">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full bg-[#1C0F0A] border rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-[#FAF5EC] placeholder-[#705241] focus:outline-none transition font-sans shadow-inner ${
                    confirmPassword && confirmPassword !== newPassword
                      ? 'border-rose-500/50 focus:border-rose-500'
                      : confirmPassword && confirmPassword === newPassword
                      ? 'border-emerald-500/50 focus:border-emerald-500'
                      : 'border-[#3E2316] focus:border-[#C49767]'
                  }`}
                  placeholder="Ulangi password baru Anda"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A47454] hover:text-[#FAF5EC] transition p-1 rounded-md"
                  title={showConfirmPassword ? 'Sembunyikan' : 'Lihat'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && confirmPassword === newPassword && (
                <div className="flex items-center space-x-1.5 mt-1.5 text-[11px] text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Password cocok</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-3">
              {!isMandatory && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"
                >
                  Batal
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#7E5338] via-[#643F29] to-[#4D2F1E] hover:from-[#915F40] hover:via-[#734A31] hover:to-[#5A3623] text-[#FAF5EC] border border-[#A47454]/40 hover:border-[#C49767] shadow-lg shadow-black/30 transition-all duration-200 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <Spinner size="xs" />
                    <span>Menyimpan...</span>
                  </span>
                ) : (
                  'Simpan Password'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  )
}
