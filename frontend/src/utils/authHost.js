const PRODUCTION_ROOT_DOMAIN = 'miraigrid.web.id'
const AUTH_SUBDOMAIN_HOST = 'auth.miraigrid.web.id'
const MAIN_APP_HOST = 'miraigrid.web.id'
const SHARED_TOKEN_COOKIE = 'miraigrid_token'

export function isMiraiGridProductionHost() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  return host === PRODUCTION_ROOT_DOMAIN || host.endsWith(`.${PRODUCTION_ROOT_DOMAIN}`)
}

export function isAuthSubdomain() {
  if (typeof window === 'undefined') return false
  return window.location.hostname.toLowerCase() === AUTH_SUBDOMAIN_HOST
}

export function isAllowedMiraiGridRedirect(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false
  const trimmed = rawUrl.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return true
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const host = parsed.hostname.toLowerCase()
    if (isMiraiGridProductionHost()) {
      return parsed.protocol === 'https:' && (host === PRODUCTION_ROOT_DOMAIN || host.endsWith(`.${PRODUCTION_ROOT_DOMAIN}`))
    }
    return host === window.location.hostname.toLowerCase()
  } catch {
    return false
  }
}

export function sanitizeRedirectUrl(rawUrl, fallbackPath = '/dashboard') {
  const defaultTarget = getMainAppUrl(fallbackPath)
  if (!isAllowedMiraiGridRedirect(rawUrl)) {
    return defaultTarget
  }
  const trimmed = rawUrl.trim()
  if (trimmed.startsWith('/')) {
    return getMainAppUrl(trimmed)
  }
  return trimmed
}

export function getMainAppUrl(path = '/dashboard') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  if (isMiraiGridProductionHost()) {
    return `https://${MAIN_APP_HOST}${cleanPath}`
  }
  return cleanPath
}

export function getAuthLoginUrl(redirectTarget = null) {
  let targetUrl = ''
  if (isMiraiGridProductionHost()) {
    targetUrl = `https://${AUTH_SUBDOMAIN_HOST}/login`
  } else {
    targetUrl = '/login'
  }
  if (redirectTarget && isAllowedMiraiGridRedirect(redirectTarget)) {
    const resolved = redirectTarget.startsWith('/') ? getMainAppUrl(redirectTarget) : redirectTarget
    const sep = targetUrl.includes('?') ? '&' : '?'
    return `${targetUrl}${sep}redirect=${encodeURIComponent(resolved)}`
  }
  return targetUrl
}

export function getAuthLogoutUrl() {
  if (isMiraiGridProductionHost()) {
    return `https://${AUTH_SUBDOMAIN_HOST}/logout?logged_out=1`
  }
  return '/logout?logged_out=1'
}

export function setSharedAuthCookie(token) {
  if (typeof document === 'undefined' || !token) return
  if (isMiraiGridProductionHost()) {
    document.cookie = `${SHARED_TOKEN_COOKIE}=${encodeURIComponent(token)}; domain=.${PRODUCTION_ROOT_DOMAIN}; path=/; max-age=86400; SameSite=Lax; Secure`
  } else {
    document.cookie = `${SHARED_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax`
  }
}

export function getSharedAuthCookie() {
  if (typeof document === 'undefined') return null
  const prefix = `${SHARED_TOKEN_COOKIE}=`
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length))
      } catch {
        return trimmed.slice(prefix.length)
      }
    }
  }
  return null
}

export function clearSharedAuthCookie() {
  if (typeof document === 'undefined') return
  if (isMiraiGridProductionHost()) {
    document.cookie = `${SHARED_TOKEN_COOKIE}=; domain=.${PRODUCTION_ROOT_DOMAIN}; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`
  }
  document.cookie = `${SHARED_TOKEN_COOKIE}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
}
