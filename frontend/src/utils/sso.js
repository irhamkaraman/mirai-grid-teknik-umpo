import { toast } from 'sonner'

/**
 * Launch isolated database Web GUI (phpMyAdmin or phpPgAdmin) with secure Single Sign-On (SSO).
 * Directly navigates to the backend SSO gateway, which self-authenticates and auto-submits to PMA/PPA.
 * Completely eliminates blank popup tabs (about:blank), cross-window race conditions, and Incognito cookie blocks.
 * 
 * @param {'postgres' | 'mariadb'} engine
 * @param {number | null} dbId
 */
export function launchDatabaseSSO(engine, dbId = null) {
  const isPg = engine === 'postgres' || String(engine).toLowerCase().includes('postg')
  const engineParam = isPg ? 'postgres' : 'mariadb'
  const targetLabel = isPg ? 'phpPgAdmin' : 'phpMyAdmin'
  const token = localStorage.getItem('miraigrid_token') || ''

  if (!token) {
    toast.error(`Sesi Anda telah berakhir. Silakan login kembali untuk mengakses ${targetLabel}.`)
    return
  }

  // Pre-seed cross-subdomain cookie for .miraigrid.web.id
  if (window.location.hostname.includes('miraigrid.web.id')) {
    try {
      document.cookie = `miraigrid_token=${token}; path=/; domain=.miraigrid.web.id; max-age=86400; SameSite=Lax; Secure`
    } catch (e) {}
  }

  const isDomain = window.location.hostname.includes('miraigrid.web.id')
  const apiBase = isDomain
    ? 'https://api.miraigrid.web.id'
    : `${window.location.protocol}//${window.location.hostname}:8000`

  const targetUrl = `${apiBase}/api/databases/sso-redirect?engine=${engineParam}${dbId ? `&db_id=${dbId}` : ''}&token=${encodeURIComponent(token)}`

  toast.loading(`Menghubungkan sesi aman ke ${targetLabel}...`, { duration: 3000 })

  // Synchronously open target gateway in new tab — completely bypasses popup blockers and about:blank
  window.open(targetUrl, '_blank')
}
