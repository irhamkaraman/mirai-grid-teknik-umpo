import React, { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, AlertCircle } from 'lucide-react'
import { api } from '../api/client'
import { Spinner } from './Skeletons'
import ModalPortal from './ModalPortal'

export default function ChangePasswordModal({ isOpen, onClose, isMandatory = false, onSuccess }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Password baru minimal 8 karakter.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      })
      onSuccess?.()
      onClose()
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Gagal mengubah password. Pastikan password lama benar.'
      setError(errMsg)
      toast.error(errMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 text-[#FAF5EC]">
          <div className="flex items-center space-x-3 text-[#E8DCB8] mb-4">
            <div className="p-2.5 rounded-2xl bg-[#3A2115] border border-[#543221] text-[#FAF5EC]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-[#FAF5EC]">
                {isMandatory ? 'Ganti Password Pertama Kali' : 'Perbarui Password'}
              </h3>
              <p className="text-xs text-[#DFCDB5]">
                {isMandatory
                  ? 'Untuk keamanan praktikum, silakan ganti password awal Anda.'
                  : 'Masukkan password lama dan password baru Anda.'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center space-x-2 text-rose-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Password Lama</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] placeholder-[#553826] focus:outline-none focus:border-[#C49767]"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Password Baru (Min. 8 Karakter)</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] placeholder-[#553826] focus:outline-none focus:border-[#C49767]"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Konfirmasi Password Baru</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] placeholder-[#553826] focus:outline-none focus:border-[#C49767]"
                placeholder="••••••••"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              {!isMandatory && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"
                >
                  Batal
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] border border-[#7D492F] shadow-md shadow-black/20 transition disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center space-x-1.5">
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
