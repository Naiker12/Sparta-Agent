export type RuntimeEnvironment = 'electron' | 'web'

export function detectEnvironment(): RuntimeEnvironment {
  if (typeof window === 'undefined') return 'electron'

  // Presencia real del preámbulo o APIs de Electron en la ventana del navegador
  const hasElectronAPIs = !!(
    (window as any).sparta?.sendMessage ||
    (window as any).electron?.invoke ||
    (window as any).electronAPI ||
    (window as any).terminal?.create ||
    navigator.userAgent.includes('Electron')
  )

  if (hasElectronAPIs) {
    return 'electron'
  }

  // Si se abre directamente en un navegador Web (e.g. Chrome, Edge en http://localhost:5173), el entorno es 'web'
  return 'web'
}

export const ENV = detectEnvironment()
export const IS_ELECTRON = ENV === 'electron'
export const IS_WEB = ENV === 'web'

export const FEATURES = {
  terminal: IS_ELECTRON,
  vault: IS_ELECTRON,
  rustSecurity: IS_ELECTRON,
  pythonSidecar: IS_ELECTRON,
  fileSystemFull: IS_ELECTRON,
  webSocket: IS_WEB,
  serviceWorker: IS_WEB,
} as const