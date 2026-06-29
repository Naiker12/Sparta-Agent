import type { SpartaEvent } from './events'
import type { FileTreeNode, FileReadResult, FileWriteResult } from './filesystem'

interface SpartaSendMessageRequest {
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
}

interface SpartaAPI {
  onEvent: (listener: (event: SpartaEvent) => void) => () => void
  sendEvent: (event: unknown) => void
  sendMessage: (req: SpartaSendMessageRequest) => Promise<{ ok: boolean; error?: string; aborted?: boolean }>
  abortMessage: (sessionId: string) => Promise<void>
  isSidecarReady: () => Promise<{ running: boolean; ready: boolean }>
}

interface VaultAPI {
  isAvailable: () => Promise<boolean>
  storeKey: (keyId: string, value: string, vendor?: string) => Promise<boolean>
  getKey: (keyId: string) => Promise<string | undefined>
  deleteKey: (keyId: string) => Promise<boolean>
  listKeys: () => Promise<string[]>
  hasKey: (keyId: string) => Promise<boolean>
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

interface ElectronIPC {
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void
  send: (channel: string, ...args: unknown[]) => void
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
}

interface FilesystemAPI {
  openFolderDialog: () => Promise<string | null>
  readDir: (dirPath: string) => Promise<FileTreeNode[]>
  readFile: (filePath: string) => Promise<FileReadResult>
  writeFile: (filePath: string, content: string) => Promise<FileWriteResult>
}

interface TerminalAPI {
  create: (opts: { terminalId: string; cols: number; rows: number }) => Promise<{ success: boolean; shell?: string; error?: string }>
  write: (terminalId: string, data: string) => void
  resize: (terminalId: string, cols: number, rows: number) => void
  destroy: (terminalId: string) => Promise<{ success: boolean }>
  onData: (terminalId: string, callback: (data: string) => void) => () => void
  onExit: (terminalId: string, callback: (code: number) => void) => () => void
  agentWrite: (terminalId: string, command: string) => Promise<{ success: boolean; error?: string; needsConfirmation?: boolean }>
  agentWriteForce: (terminalId: string, command: string) => Promise<{ success: boolean; error?: string }>
}

interface SkillsAPI {
  list: () => Promise<unknown[]>
  view: (skillId: string) => Promise<{ metadata: Record<string, unknown>; body: string; source_path: string }>
  installFromUrl: (url: string) => Promise<{ success: boolean; skillId?: string; error?: string; scan?: unknown }>
  installFromRepo: (repoUrl: string) => Promise<{ success: boolean; error?: string; info?: string }>
  uninstall: (skillId: string) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    sparta?: SpartaAPI
    vault?: VaultAPI
    electronAPI?: ElectronAPI
    electron?: ElectronIPC
    fs?: FilesystemAPI
    terminal?: TerminalAPI
    skills?: SkillsAPI
  }
}
