/**
 * Helper untuk label peran & terminologi dinamis berdasarkan role akun (Mahasiswa / Dosen / Administrator).
 */
export const isDosenRole = (role) => String(role || '').toLowerCase() === 'dosen'

export const isAdminRole = (role) => String(role || '').toLowerCase() === 'admin'

export const getRoleLabel = (role) => {
  const normalized = String(role || '').toLowerCase()
  if (normalized === 'dosen') return 'Dosen'
  if (normalized === 'admin') return 'Administrator'
  return 'Mahasiswa'
}

export const getIdentifierLabel = (role) => {
  const normalized = String(role || '').toLowerCase()
  if (normalized === 'dosen') return 'NIDN/Username'
  if (normalized === 'admin') return 'Username'
  return 'NIM'
}
