let apiBase = ''
let backendError: string | null = null

function detectTauri(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return (
    '__TAURI__' in window ||
    '__TAURI_INTERNALS__' in window ||
    window.location.protocol === 'tauri:'
  )
}

function detectElectron(): boolean {
  if (typeof window === 'undefined') return false
  return (
    'electronAPI' in window ||
    navigator.userAgent.includes('Electron')
  )
}

const isTauri = detectTauri()
const isElectron = detectElectron()

const initialApiBase = apiBase

export function resetApiBase() {
  apiBase = initialApiBase
}

export function setApiBase(port: number) {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return
  apiBase = `http://127.0.0.1:${port}`
  backendError = null
}

export function setBackendError(message: string | null): void {
  backendError = message
}

export function getBackendError(): string | null {
  return backendError
}

export function getApiBase(): string {
  return apiBase
}

export function apiUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `${apiBase}${path}`
}

export { isTauri, isElectron }
