/**
 * MiraiGrid Browser Runtime Security Guard & Branded Console Engine
 * - Allows Inspect Element for UI inspection
 * - Blocks Console JS injection, eval(), and browser-based API crawling (fetch/XHR/sendBeacon)
 * - Removes dynamically injected <script> tags via MutationObserver
 * - Displays styled Engine / Cloud / Peringatan banner in DevTools Console
 */

const BUNDLE_ORIGIN_PATTERN = /(\/assets\/|\/src\/|main\.jsx|vite)/i
const CONSOLE_EVAL_PATTERN = /(<anonymous>|debugger eval code|^eval\s|\bVM\d+:\d+)/i

let bannerPrintedAt = 0

export function printMiraiGridConsoleBanner(force = false) {
  const now = Date.now()
  if (!force && now - bannerPrintedAt < 4000) return
  bannerPrintedAt = now

  try {
    const clear = typeof console.clear === 'function' ? console.clear : null
    if (force && clear) clear()

    console.log(
      '%c MIRAIGRID %c CLOUD WORKSPACE %c ENGINE v2.0 %c ISOLATED SANDBOX ',
      'background:#059669;color:#ffffff;font-weight:800;font-size:12px;padding:4px 8px;border-radius:4px 0 0 4px;',
      'background:#0f172a;color:#34d399;font-weight:700;font-size:12px;padding:4px 8px;',
      'background:#0284c7;color:#ffffff;font-weight:700;font-size:12px;padding:4px 8px;',
      'background:#1e293b;color:#cbd5e1;font-weight:600;font-size:12px;padding:4px 8px;border-radius:0 4px 4px 0;'
    )

    console.log(
      '%c PERINGATAN KEAMANAN — STOP! ',
      'background:#dc2626;color:#ffffff;font-weight:900;font-size:18px;padding:6px 12px;border-radius:6px;'
    )

    console.log(
      '%c[Engine Guard]%c Akses eksekusi skrip, injeksi JavaScript, dan crawling API melalui Browser Console telah %cDINONAKTIFKAN%c.\n' +
        '%c[Cloud Policy]%c Anda tetap dapat menggunakan Inspect Element untuk meninjau UI, namun seluruh percobaan manipulasi runtime, scraping, atau penempelan skrip asing akan diblokir dan dicatat secara otomatis.\n' +
        '%c[Environment]%c  Lab TI UMPO • cgroup v2 Multi-Tenant Isolation • Zero-Trust Perimeter',
      'color:#0284c7;font-weight:700;',
      'color:#334155;font-weight:500;',
      'color:#dc2626;font-weight:800;',
      'color:#334155;font-weight:500;',
      'color:#059669;font-weight:700;',
      'color:#334155;font-weight:500;',
      'color:#64748b;font-weight:700;',
      'color:#64748b;font-weight:500;'
    )
  } catch {
    // Ignore console errors in restricted environments
  }
}

function isConsoleOrInjectedCaller() {
  try {
    const stack = new Error().stack || ''
    const lines = stack.split('\n').slice(1)
    const hasBundleFrame = lines.some((l) => BUNDLE_ORIGIN_PATTERN.test(l))
    if (hasBundleFrame) return false
    return lines.some((l) => CONSOLE_EVAL_PATTERN.test(l)) || lines.length > 0
  } catch {
    return true
  }
}

function logBlockedAction(actionName) {
  try {
    console.log(
      `%c PERINGATAN %c ${actionName} dari Console/Injeksi diblokir oleh MiraiGrid Security Engine.`,
      'background:#dc2626;color:#fff;font-weight:800;padding:2px 6px;border-radius:3px;',
      'color:#dc2626;font-weight:600;'
    )
  } catch {
    // ignore
  }
}

function lockGlobalProp(obj, prop, value) {
  try {
    Object.defineProperty(obj, prop, {
      value,
      writable: false,
      configurable: false,
      enumerable: true,
    })
  } catch {
    try {
      obj[prop] = value
    } catch {
      // ignore if already locked
    }
  }
}

export function initSecurityGuard() {
  if (typeof window === 'undefined' || window.__MIRAIGRID_GUARD_ACTIVE__) return
  lockGlobalProp(window, '__MIRAIGRID_GUARD_ACTIVE__', true)

  // 1. Print initial branded banner
  printMiraiGridConsoleBanner(false)

  // 2. Capture native network APIs inside closure BEFORE locking globals
  const nativeFetch = window.fetch.bind(window)
  const nativeXHROpen = XMLHttpRequest.prototype.open
  const nativeSendBeacon = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null

  // 3. Block eval() completely
  const blockedEval = function blockedEval() {
    logBlockedAction('eval()')
    throw new Error('[MiraiGrid Security Engine] eval() dinonaktifkan di lingkungan workspace.')
  }
  lockGlobalProp(window, 'eval', blockedEval)

  // 4. Guard window.fetch against Console / injected script crawling
  const guardedFetch = function guardedFetch(input, init) {
    if (isConsoleOrInjectedCaller()) {
      logBlockedAction('fetch() / Crawling')
      return Promise.reject(
        new Error('[MiraiGrid Security Engine] Akses fetch() atau crawling melalui Console diblokir.')
      )
    }
    return nativeFetch(input, init)
  }
  lockGlobalProp(window, 'fetch', guardedFetch)

  // 5. Guard XMLHttpRequest.prototype.open against Console / injected script crawling
  const guardedXHROpen = function guardedXHROpen(method, url, ...rest) {
    if (isConsoleOrInjectedCaller()) {
      logBlockedAction('XMLHttpRequest / Crawling')
      throw new Error('[MiraiGrid Security Engine] Akses XMLHttpRequest melalui Console diblokir.')
    }
    return nativeXHROpen.call(this, method, url, ...rest)
  }
  lockGlobalProp(XMLHttpRequest.prototype, 'open', guardedXHROpen)

  // 6. Guard navigator.sendBeacon
  if (nativeSendBeacon) {
    const guardedBeacon = function guardedBeacon(url, data) {
      if (isConsoleOrInjectedCaller()) {
        logBlockedAction('sendBeacon()')
        return false
      }
      return nativeSendBeacon(url, data)
    }
    lockGlobalProp(navigator, 'sendBeacon', guardedBeacon)
  }

  // 7. Block document.write / document.writeln injection
  const blockedWrite = function blockedWrite() {
    logBlockedAction('document.write()')
  }
  lockGlobalProp(document, 'write', blockedWrite)
  lockGlobalProp(document, 'writeln', blockedWrite)

  // 8. Guard Function() constructor against Console execution while allowing internal app calls
  const NativeFunction = window.Function
  const GuardedFunction = function GuardedFunction(...args) {
    if (isConsoleOrInjectedCaller()) {
      logBlockedAction('new Function()')
      throw new Error('[MiraiGrid Security Engine] Eksekusi Function() dari Console dinonaktifkan.')
    }
    return NativeFunction.apply(this, args)
  }
  GuardedFunction.prototype = NativeFunction.prototype
  lockGlobalProp(window, 'Function', GuardedFunction)

  // 9. DOM MutationObserver: remove any foreign or console-injected <script> tags
  if (typeof MutationObserver !== 'undefined' && document.documentElement) {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node && node.nodeType === 1 && node.tagName === 'SCRIPT') {
            const typeAttr = (node.getAttribute('type') || '').toLowerCase()
            const src = node.getAttribute('src') || ''
            const isAllowedJsonLd = typeAttr === 'application/ld+json'
            const isAllowedBundle =
              src.startsWith('/assets/') ||
              src.startsWith('/src/') ||
              src.startsWith(window.location.origin + '/assets/') ||
              src.startsWith('https://static.cloudflareinsights.com/')
            if (!isAllowedJsonLd && !isAllowedBundle) {
              node.remove()
              logBlockedAction('Injeksi tag <script>')
            }
          }
        }
      }
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
  }

  // 10. Non-blocking DevTools open detection: re-show styled warning when DevTools opens
  let wasOpen = false
  const checkDevTools = () => {
    const widthGap = window.outerWidth - window.innerWidth > 160
    const heightGap = window.outerHeight - window.innerHeight > 160
    const isOpen = widthGap || heightGap
    if (isOpen && !wasOpen) {
      wasOpen = true
      printMiraiGridConsoleBanner(false)
    } else if (!isOpen) {
      wasOpen = false
    }
  }
  window.addEventListener('resize', checkDevTools, { passive: true })
  setTimeout(checkDevTools, 800)
}
