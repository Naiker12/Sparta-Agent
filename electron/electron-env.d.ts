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
}

interface SpartaAPI {
  onEvent: (listener: (event: unknown) => void) => () => void
  sendEvent: (event: unknown) => void
}

interface Window {
  electronAPI: ElectronAPI
  electron: {
    on: (channel: string, listener: (...args: unknown[]) => void) => () => void
    send: (channel: string, ...args: unknown[]) => void
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  }
  sparta: SpartaAPI
}
