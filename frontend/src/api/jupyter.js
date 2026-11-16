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
 * Meluncurkan sesi JupyterHub menggunakan token SSO MiraiGrid terenkripsi.
 */
export async function launchJupyterLab(customApi = api) {
  // Buka popup window lebih awal untuk mencegah pemblokiran popup browser
  const popup = window.open('', `miraigrid_jupyter_${Date.now()}`)

  if (popup && popup.document) {
    try {
      popup.document.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Membuka JupyterHub...</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #f8fafc;
              color: #0f172a;
            }
            .card {
              text-align: center;
              background: #ffffff;
              padding: 32px 36px;
              border-radius: 16px;
              border: 1px solid #e2e8f0;
              max-width: 420px;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            }
            .spinner {
              width: 36px;
              height: 36px;
              margin: 0 auto 16px;
              border: 3px solid #e2e8f0;
              border-top-color: #f97316;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            h3 { font-size: 16px; font-weight: 600; margin: 0 0 8px; color: #0f172a; }
            p { font-size: 13px; color: #64748b; margin: 0; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="spinner"></div>
            <h3>Mengautentikasi JupyterHub...</h3>
            <p>Menyiapkan sesi SSO terenkripsi untuk akun Anda.</p>
          </div>
        </body>
        </html>
      `)
      popup.document.close()
    } catch (e) {}
  }

  try {
    const { data } = await customApi.post('/jupyter/sso-launch')

    const form = document.createElement('form')
    form.method = 'POST'
    form.action = data.action_url
    form.target = popup ? popup.name : '_blank'
    form.style.display = 'none'

    Object.entries(data.fields).forEach(([name, value]) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = String(value)
      form.appendChild(input)
    })

    document.body.appendChild(form)
    form.submit()
    setTimeout(() => {
      try {
        if (form.parentNode) {
          document.body.removeChild(form)
        }
      } catch (e) {}
    }, 1000)
    return data
  } catch (error) {
    if (popup && !popup.closed && popup.document) {
      const errDetail = error.response?.data?.detail || error.message || 'Gagal membuka sesi JupyterHub.'
      try {
        popup.document.body.innerHTML = `
          <div class="card" style="border-color: #fecdd3; background: #fff;">
            <div style="font-size: 32px; margin-bottom: 12px;">⚠️</div>
            <h3 style="color: #e11d48;">Kendala Akses JupyterHub</h3>
            <p style="color: #475569; margin-bottom: 20px;">${errDetail}</p>
            <div style="display: flex; gap: 8px; justify-content: center;">
              <a href="https://jupyter.miraigrid.web.id" style="display: inline-block; padding: 8px 16px; border-radius: 8px; background: #0f172a; color: #fff; text-decoration: none; font-size: 13px; font-weight: 500;">Petunjuk Jaringan LAN</a>
            </div>
          </div>
        `
      } catch (e) {
        popup.close()
      }
    }
    throw error
  }
}
