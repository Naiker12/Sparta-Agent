export type RuntimeEnvironment = 'electron' | 'web'

export function detectEnvironment(): RuntimeEnvironment {
  if (typeof window !== 'undefined' && (window.sparta || window.electronAPI)) {
    return 'electron'
  }
  try {
    // Vite define reemplaza __IS_ELECTRON__ con true/false en build-time
    // @ts-expect-error - global definido por vite.config.ts define
    if (__IS_ELECTRON__) return 'electron'
  } catch {}
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
