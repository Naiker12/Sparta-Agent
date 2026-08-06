export type RuntimeEnvironment = 'electron'

export function detectEnvironment(): RuntimeEnvironment {
  return 'electron'
}

export const ENV = 'electron'
export const IS_ELECTRON = true
export const IS_WEB = false

export const FEATURES = {
  terminal: true,
  vault: true,
  rustSecurity: true,
  pythonSidecar: true,
  fileSystemFull: true,
  webSocket: false,
  serviceWorker: false,
} as const