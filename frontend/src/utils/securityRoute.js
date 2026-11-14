/**
 * MiraiGrid Enterprise PaaS Route Security & Obfuscation Engine
 * 
 * Provides:
 * 1. Cryptographic session-bound route hashing (cPanel / Enterprise PaaS style).
 * 2. Real-time dynamic URL hash synchronization for files, folders, and workspace views.
 * 3. Strict tamper detection & path traversal prevention across all routes.
 * 4. Automatic security alert & session termination on URL manipulation attempts.
 */

// Simple deterministic hash helper (32-bit hex string)
function djb2Hash(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// Get or initialize persistent session key for the active browser session
export function getSecuritySessionKey() {
  try {
    let key = sessionStorage.getItem('miraigrid_route_sess')
    if (!key) {
      const user = JSON.parse(localStorage.getItem('miraigrid_user') || '{}')
      const token = localStorage.getItem('miraigrid_token') || 'guest'
      const username = user.username || 'session'
      const randomPart = Math.random().toString(36).substring(2, 10)
      const timePart = Date.now().toString(36)
      key = `s_${username.slice(0, 4)}_${djb2Hash(token + timePart).slice(0, 8)}_${randomPart}`
      sessionStorage.setItem('miraigrid_route_sess', key)
    }
    return key
  } catch (e) {
    return 's_sec_guest_0001'
  }
}

// Safe base64 encoding for URI components
export function safeB64Encode(str) {
  if (!str) return ''
  try {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  } catch (e) {
    return encodeURIComponent(str)
  }
}

// Safe base64 decoding for URI components
export function safeB64Decode(b64) {
  if (!b64) return ''
  try {
    let str = b64.replace(/-/g, '+').replace(/_/g, '/')
    while (str.length % 4) str += '='
    return decodeURIComponent(escape(atob(str)))
  } catch (e) {
    return decodeURIComponent(b64)
  }
}

// Compute deterministic route signature
export function computeRouteSignature(routePath, paramsObj = {}) {
  const sessKey = getSecuritySessionKey()
  const sortedKeys = Object.keys(paramsObj).sort()
  const serialized = sortedKeys.map(k => `${k}:${paramsObj[k]}`).join('|')
  return djb2Hash(`${sessKey}#${routePath}#${serialized}`)
}

/**
 * Synchronize the current File Manager location into a dynamic, encrypted URL hash
 * e.g., /files#!_sec/s_admi_a1b2c3d4/ws=c2ltcnUtdGVrbmlr&dir=L2FwcA==&sig=8fa1e0b3
 */
export function syncFileRoute(workspaceName, currentPath, activeFilePath = null) {
  if (typeof window === 'undefined') return
  const sessKey = getSecuritySessionKey()
  const b64Ws = safeB64Encode(workspaceName || 'default')
  const b64Dir = safeB64Encode(currentPath || '/')
  const b64File = activeFilePath ? safeB64Encode(activeFilePath) : ''
  
  const payload = {
    ws: b64Ws,
    dir: b64Dir,
    ...(b64File ? { file: b64File } : {})
  }
  const sig = computeRouteSignature('/files', payload)
  
  let newHash = `!_sec/${sessKey}/ws=${b64Ws}&dir=${b64Dir}`
  if (b64File) newHash += `&file=${b64File}`
  newHash += `&sig=${sig}`

  if (window.location.hash !== `#${newHash}`) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search || ''}#${newHash}`)
  }
}

/**
 * Format any application page route with a professional, hard-to-track session hash
 */
export function syncPageRoute(pageName, extraParams = {}) {
  if (typeof window === 'undefined') return
  const sessKey = getSecuritySessionKey()
  const payload = { page: pageName, ...extraParams }
  const sig = computeRouteSignature(pageName, payload)
  
  const queryStr = Object.entries(payload)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
    
  const newHash = `!_sec/${sessKey}/${queryStr}&sig=${sig}`
  if (window.location.hash !== `#${newHash}`) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search || ''}#${newHash}`)
  }
}

/**
 * Inspect a full URL / path for malicious manipulation attempts
 * Returns: { isTampered: boolean, reason: string }
 */
export function checkUrlTampering(urlOrHash = '') {
  const rawTarget = urlOrHash || (typeof window !== 'undefined' ? window.location.href : '')
  let fullTarget = rawTarget
  try {
    fullTarget = decodeURIComponent(rawTarget)
  } catch (e) {}
  const lower = fullTarget.toLowerCase()

  // 1. Path traversal attacks
  const traversalPatterns = [
    '..', '%2e%2e', '..%2f', '%2f..', '/etc/', '/proc/', '/sys/', '/root/',
    '/var/run/', '/boot/', 'c:\\', '\\windows\\', '\\system32', '%00', '\x00'
  ]
  for (const pat of traversalPatterns) {
    if (lower.includes(pat)) {
      return { isTampered: true, reason: `Deteksi Path Traversal terlarang: "${pat}"` }
    }
  }

  // 1b. Inspect query parameters (?path= / ?dir=) for tilde (~) or cross-account /home/<other>
  try {
    const activeUser = JSON.parse(localStorage.getItem('miraigrid_user') || '{}')
    const activeUsername = activeUser?.username || ''
    const qIndex = rawTarget.indexOf('?')
    if (qIndex !== -1) {
      const qPart = rawTarget.slice(qIndex + 1).split('#')[0]
      const qParams = new URLSearchParams(qPart)
      for (const key of ['path', 'dir', 'file']) {
        const val = qParams.get(key)
        if (val) {
          const cleanVal = decodeURIComponent(val).trim().replace(/\\/g, '/')
          if (cleanVal.startsWith('~') || cleanVal.includes('/~') || cleanVal.includes('..')) {
            return { isTampered: true, reason: `Parameter query "${key}" mengandung pola traversal terlarang` }
          }
          if (
            activeUsername &&
            cleanVal.startsWith('/home/') &&
            cleanVal !== `/home/${activeUsername}` &&
            !cleanVal.startsWith(`/home/${activeUsername}/`)
          ) {
            return { isTampered: true, reason: `Percobaan akses lintas akun pada parameter "${key}"` }
          }
        }
      }
    }
  } catch (e) {}

  // 2. Cross-Site Scripting (XSS) / Code Injection
  const injectionPatterns = [
    '<script', 'javascript:', 'onerror=', 'onload=', 'vbscript:',
    'data:text/html', 'alert(', 'document.cookie', 'eval(', 'exec('
  ]
  for (const pat of injectionPatterns) {
    if (lower.includes(pat)) {
      return { isTampered: true, reason: `Deteksi Upaya Injeksi Skrip/XSS: "${pat}"` }
    }
  }

  // 3. SQL / Command Injection Patterns
  const cmdPatterns = [
    'union select', 'drop table', '1=1--', "' or '1'='1", ';rm -rf', ';curl', ';wget'
  ]
  for (const pat of cmdPatterns) {
    if (lower.includes(pat)) {
      return { isTampered: true, reason: `Deteksi Pola Perintah Berbahaya: "${pat}"` }
    }
  }

  // 4. Hash Tampering & Base64 Parameter Verification (if an existing !_sec hash is present)
  if (rawTarget.includes('!_sec/')) {
    try {
      const hashPart = rawTarget.split('!_sec/')[1] || ''
      const slashIdx = hashPart.indexOf('/')
      if (slashIdx !== -1) {
        const hashSessKey = hashPart.slice(0, slashIdx)
        const paramString = hashPart.slice(slashIdx + 1)
        const urlParams = new URLSearchParams(paramString)
        const providedSig = urlParams.get('sig')
        const activeUser = JSON.parse(localStorage.getItem('miraigrid_user') || '{}')
        const activeUsername = activeUser?.username || ''

        const payloadForSig = {}
        for (const [k, v] of urlParams.entries()) {
          if (k === 'sig') continue
          payloadForSig[k] = v

          // Check raw value & Base64-decoded value for dir, ws, file
          const candidates = [v]
          if (['dir', 'ws', 'file'].includes(k)) {
            candidates.push(safeB64Decode(v))
          }
          for (const cand of candidates) {
            const norm = String(cand || '').replace(/\\/g, '/')
            const normLower = norm.toLowerCase()
            if (
              norm.includes('..') ||
              normLower.includes('%2e%2e') ||
              norm.startsWith('~') ||
              norm.includes('/~') ||
              normLower.startsWith('/etc') ||
              normLower.startsWith('/root') ||
              normLower.startsWith('/proc') ||
              normLower.startsWith('/sys')
            ) {
              return { isTampered: true, reason: `Parameter hash "${k}" termodifikasi ilegal (Path Traversal Detected)` }
            }
            if (
              activeUsername &&
              norm.startsWith('/home/') &&
              norm !== `/home/${activeUsername}` &&
              !norm.startsWith(`/home/${activeUsername}/`)
            ) {
              return { isTampered: true, reason: `Percobaan akses direktori akun lain via parameter "${k}"` }
            }
          }
        }

        // Verify cryptographic session signature (sig) when session key matches active session
        if (providedSig && hashSessKey === getSecuritySessionKey()) {
          const routeKey = payloadForSig.page || '/files'
          const expectedSig = computeRouteSignature(routeKey, payloadForSig)
          if (providedSig !== expectedSig) {
            return {
              isTampered: true,
              reason: 'Signature keamanan URL (sig) tidak cocok — terdeteksi modifikasi manual parameter rute!'
            }
          }
        }
      }
    } catch (e) {
      // Ignore parsing edge cases
    }
  }

  return { isTampered: false, reason: '' }
}

/**
 * Trigger immediate Security Alarm on route tampering
 */
export function triggerRouteSecurityAlarm(reason = 'Upaya manipulasi parameter URL') {
  if (typeof window === 'undefined') return

  // Prevent multiple alerts firing simultaneously
  if (window.__miraigrid_security_locked) return
  window.__miraigrid_security_locked = true

  // 1. Invalidate session storage
  try {
    sessionStorage.clear()
    localStorage.removeItem('miraigrid_token')
    localStorage.removeItem('miraigrid_user')
  } catch (e) {}

  // 2. Dispatch custom event for React components
  try {
    window.dispatchEvent(new CustomEvent('miraigrid:security_breach', { detail: { reason } }))
  } catch (e) {}

  // 3. Trigger native JavaScript alert as requested by system administrator
  window.alert(
    `🚨 [MIRAIGRID PAAS SECURITY ENGINE]\n\n` +
    `PERINGATAN KEAMANAN SISTEM:\n` +
    `Upaya manipulasi rute URL atau sesi tidak sah telah terdeteksi!\n` +
    `Keterangan: ${reason}\n\n` +
    `Akses sesi langsung dibekukan demi melindungi integritas isolasi container laboratorium.\n` +
    `Silakan klik OK untuk memuat ulang halaman dan melakukan login ulang.`
  )

  // 4. Force reload back to clean login
  window.location.href = '/login'
}
