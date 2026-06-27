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
  isSidecarReady: () => Promise<{ running: boolean; ready: boolean }>
}

interface VaultAPI {
  isAvailable: () => Promise<boolean>
  storeKey: (keyId: string, value: string, vendor?: string) => Promise<boolean>
  getKey: (keyId: string) => Promise<string | null>
  deleteKey: (keyId: string) => Promise<boolean>
  listKeys: () => Promise<{ keyId: string; vendor?: string }[]>
  hasKey: (keyId: string) => Promise<boolean>
}

interface FsAPI {
  openFolderDialog: () => Promise<string | null>
  readDir: (dirPath: string) => Promise<import('./ipc/filesystem.ipc').FileTreeNode[]>
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
  deleteFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>
}

interface TerminalAPI {
  create: (opts: { terminalId: string; cols: number; rows: number }) => Promise<{ success: boolean; shell: string }>
  write: (terminalId: string, data: string) => void
  resize: (terminalId: string, cols: number, rows: number) => void
  destroy: (terminalId: string) => Promise<{ success: boolean }>
  onData: (terminalId: string, callback: (data: string) => void) => () => void
  onExit: (terminalId: string, callback: (code: number) => void) => () => void
  agentWrite: (terminalId: string, command: string) => Promise<{ success: boolean }>
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
  terminal: TerminalAPI
  fs: FsAPI
}
