import { api } from '../api/client'
import { toast } from 'sonner'

/**
 * Launch isolated database Web GUI (phpMyAdmin or phpPgAdmin) with secure Single Sign-On (SSO).
 * Performs HMAC-SHA256 signature verification on the server side and auto-submits a POST form.
 * 
 * @param {'postgres' | 'mariadb'} engine
 * @param {number | null} dbId
 */
export async function launchDatabaseSSO(engine, dbId = null) {
  const isPg = engine === 'postgres' || String(engine).toLowerCase().includes('postg')
  const targetLabel = isPg ? 'phpPgAdmin' : 'phpMyAdmin'
  const windowName = `miraigrid_sso_${isPg ? 'ppa' : 'pma'}_${Date.now()}`

  // Synchronously open blank window to bypass popup blockers
  let targetWindow = null
  try {
    targetWindow = window.open('', windowName)
    if (targetWindow && targetWindow.document) {
      targetWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Otentikasi ${targetLabel} - MiraiGrid</title>
  <style>
    body {
      margin: 0;
      background-color: #190D07;
      color: #FAF5EC;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      flex-direction: column;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(232, 220, 184, 0.2);
      border-top-color: #E8C58D;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 {
      margin: 0 0 8px 0;
      font-size: 20px;
      font-weight: 600;
      color: #FAF5EC;
    }
    p {
      margin: 0;
      font-size: 13px;
      color: #C49767;
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h2>Mengautentikasi ${targetLabel}...</h2>
  <p>Membuka sesi terisolasi terenkripsi untuk akun Anda</p>
</body>
</html>`)
    }
  } catch (e) {
    console.warn('Could not open preview window synchronously:', e)
  }

  const toastId = toast.loading(`Menghubungkan sesi aman ke ${targetLabel}...`)

  try {
    const res = await api.post('/databases/sso-launch', {
      engine: isPg ? 'postgres' : 'mariadb',
      db_id: dbId,
    })

    if (!res.data || !res.data.success) {
      throw new Error(res.data?.detail || 'Gagal menyiapkan sesi Single Sign-On.')
    }

    const { port, path, fields, db_username } = res.data
    const host = window.location.hostname
    const actionUrl = `http://${host}:${port}${path}`

    // Create form and submit into the opened window
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = actionUrl
    form.target = targetWindow ? windowName : '_blank'
    form.style.display = 'none'

    Object.entries(fields).forEach(([key, val]) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = key
      input.value = val
      form.appendChild(input)
    })

    document.body.appendChild(form)
    form.submit()
    setTimeout(() => {
      try {
        document.body.removeChild(form)
      } catch (e) {}
    }, 1000)

    toast.success(`Berhasil login ke ${targetLabel} sebagai '${db_username}'!`, { id: toastId })
  } catch (err) {
    if (targetWindow && !targetWindow.closed) {
      try {
        targetWindow.close()
      } catch (e) {}
    }
    const errMsg = err.response?.data?.detail || err.message || `Gagal auto-login ke ${targetLabel}.`
    toast.error(errMsg, { id: toastId })
  }
}
