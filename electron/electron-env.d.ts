/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string
    VITE_PUBLIC: string
  }
}

interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void
  setTitleBarOverlay: (colors: { color: string; symbolColor: string }) => void
  getVersion: () => Promise<string>
}

interface SpartaAPI {
  onEvent: (listener: (event: unknown) => void) => () => void
  sendEvent: (event: unknown) => void
  sendMessage: (req: {
    sessionId: string
    messageId: string
    model: string
    messages: { role: string; content: string }[]
    providerKey?: string
    apiUrl?: string
    isLocal?: boolean
    system?: string
    vendor?: string
    providerId?: string
    mode?: string
    skills?: string[]
    mcpServers?: unknown[]
    semanticMemory?: boolean
    reasoning?: { enabled: boolean; budget: number }
  }) => Promise<{ ok: boolean; error?: string; aborted?: boolean }>
  abortMessage: (sessionId: string) => Promise<void>
  isSidecarReady: () => Promise<{ running: boolean }>
}

interface VaultAPI {
  isAvailable: () => Promise<boolean>
  storeKey: (keyId: string, value: string, vendor?: string) => Promise<boolean>
  getKey: (keyId: string) => Promise<string | null>
  deleteKey: (keyId: string) => Promise<boolean>
  listKeys: () => Promise<{ keyId: string; vendor?: string }[]>
  hasKey: (keyId: string) => Promise<boolean>
}

interface Window {
  electronAPI: ElectronAPI
  electron: {
    on: (channel: string, listener: (...args: unknown[]) => void) => () => void
    send: (channel: string, ...args: unknown[]) => void
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  }
  sparta: SpartaAPI
  vault: VaultAPI
}
