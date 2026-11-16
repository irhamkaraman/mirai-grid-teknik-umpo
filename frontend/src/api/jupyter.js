import { api } from './client'

/**
 * Verifikasi NIM dan Password mahasiswa untuk autentikasi JupyterHub.
 */
export async function verifyJupyterCredentials(username, password, customApi = api) {
  const { data } = await customApi.post('/jupyter/verify-credentials', {
    username: String(username).trim(),
    password: String(password)
  })
  return data
}

/**
 * Meluncurkan sesi JupyterHub menggunakan gateway resmi MiraiGrid.
 * Langsung membuka https://jupyter.miraigrid.web.id dengan token autentikasi aman tanpa about:blank.
 */
export function launchJupyterLab() {
  const token = localStorage.getItem('miraigrid_token') || ''
  
  if (token && window.location.hostname.includes('miraigrid.web.id')) {
    try {
      document.cookie = `miraigrid_token=${token}; path=/; domain=.miraigrid.web.id; max-age=86400; SameSite=Lax; Secure`
    } catch (e) {}
  }

  const isDomain = window.location.hostname.includes('miraigrid.web.id')
  const jupyterUrl = isDomain
    ? `https://jupyter.miraigrid.web.id/?token=${encodeURIComponent(token)}`
    : 'http://76.76.76.187:8888'

  window.open(jupyterUrl, '_blank')
}
