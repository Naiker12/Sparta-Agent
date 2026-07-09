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
  getTerminalToken: () => Promise<string | undefined>
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
    reasoning?: { enabled: boolean; budget: number; effort?: string }
    webSearchEnabled?: boolean
    workspaceRoot?: string
  }) => Promise<{ ok: boolean; error?: string; aborted?: boolean }>
  abortMessage: (sessionId: string) => Promise<void>
  isSidecarReady: () => Promise<{ running: boolean; ready: boolean }>
  fetchModels: (req: { vendor: string; apiKey?: string; serverUrl?: string }) => Promise<{ models: string[]; error?: string }>
  memoryIndex: (entry: Record<string, unknown>) => Promise<{ ok: boolean; id?: string | null; error?: string }>
  memorySearch: (query: string, k?: number) => Promise<{ ok: boolean; results?: unknown[]; error?: string }>
  memoryEmbed: (texts: string[]) => Promise<{ ok: boolean; embeddings?: number[][]; error?: string }>
  memoryDelete: (entryId: string) => Promise<{ ok: boolean; error?: string }>
  memoryCount: () => Promise<{ ok: boolean; count?: number; error?: string }>
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
  startWatcher: (dirPath: string) => Promise<{ success: boolean }>
  stopWatcher: () => Promise<{ success: boolean }>
}

interface TerminalIPC {
  create: (opts: { terminalId: string; cols: number; rows: number }) => Promise<{ success: boolean; shell?: string; error?: string }>
  write: (terminalId: string, data: string) => void
  resize: (terminalId: string, cols: number, rows: number) => void
  destroy: (terminalId: string) => Promise<{ success: boolean }>
  onData: (terminalId: string, callback: (data: string) => void) => () => void
  onExit: (terminalId: string, callback: (code: number) => void) => () => void
  agentWrite: (terminalId: string, command: string) => Promise<{ success: boolean; error?: string; needsConfirmation?: boolean }>
  agentWriteForce: (terminalId: string, command: string) => Promise<{ success: boolean; error?: string }>
  listSessions: () => Promise<string[]>
  agentSpawn: (procId: string, command: string, cwd?: string) => Promise<{ success: boolean; error?: string }>
  agentKill: (procId: string) => Promise<{ success: boolean }>
  onAgentSpawn: (callback: (payload: { procId: string; command: string }) => void) => () => void
  onAgentOutput: (callback: (payload: { procId: string; chunk: string }) => void) => () => void
  onAgentExit: (callback: (payload: { procId: string; code: number }) => void) => () => void
}

interface SkillsIPC {
  list: () => Promise<unknown[]>
  view: (skillId: string) => Promise<{ metadata: Record<string, unknown>; body: string; source_path: string }>
  installFromUrl: (url: string) => Promise<{ success: boolean; skillId?: string; error?: string; scan?: unknown }>
  installFromRepo: (repoUrl: string) => Promise<{ success: boolean; error?: string; info?: string }>
  uninstall: (skillId: string) => Promise<{ success: boolean; error?: string }>
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
  terminal: TerminalIPC
  fs: FsAPI
  skills: SkillsIPC
}
