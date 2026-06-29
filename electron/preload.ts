import { ipcRenderer, contextBridge } from 'electron'
import type { FileTreeNode } from './ipc/filesystem.ipc'

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  onMaximizedChange: (callback: (maximized: boolean) => void) => {
    const handler = () => ipcRenderer.invoke('win:isMaximized').then(callback)
    ipcRenderer.on('win:maximized-changed', handler)
    return () => ipcRenderer.removeListener('win:maximized-changed', handler)
  },
  setTitleBarOverlay: (colors: { color: string; symbolColor: string }) =>
    ipcRenderer.send('titlebar:set-overlay', colors),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
})

contextBridge.exposeInMainWorld('electron', {
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },
  send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
})

contextBridge.exposeInMainWorld('sparta', {
  onEvent: (listener: (event: unknown) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: unknown) => listener(data)
    ipcRenderer.on('sparta:event', subscription)
    return () => ipcRenderer.removeListener('sparta:event', subscription)
  },
  sendEvent: (event: unknown) => {
    ipcRenderer.send('sparta:event', event)
  },
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
  }) => ipcRenderer.invoke('chat:send', req),
  abortMessage: (sessionId: string) => ipcRenderer.invoke('chat:abort', sessionId),
  isSidecarReady: () => ipcRenderer.invoke('sidecar:status') as Promise<{ running: boolean; ready: boolean }>,
})

contextBridge.exposeInMainWorld('vault', {
  isAvailable: () => ipcRenderer.invoke('vault:isAvailable'),
  storeKey: (keyId: string, value: string, vendor?: string) => ipcRenderer.invoke('vault:storeKey', keyId, value, vendor),
  getKey: (keyId: string) => ipcRenderer.invoke('vault:getKey', keyId),
  deleteKey: (keyId: string) => ipcRenderer.invoke('vault:deleteKey', keyId),
  listKeys: () => ipcRenderer.invoke('vault:listKeys'),
  hasKey: (keyId: string) => ipcRenderer.invoke('vault:hasKey', keyId),
})

contextBridge.exposeInMainWorld('terminal', {
  create: (opts: { terminalId: string; cols: number; rows: number }) =>
    ipcRenderer.invoke('terminal:create', opts),

  write: (terminalId: string, data: string) =>
    ipcRenderer.send('terminal:write', { terminalId, data }),

  resize: (terminalId: string, cols: number, rows: number) =>
    ipcRenderer.send('terminal:resize', { terminalId, cols, rows }),

  destroy: (terminalId: string) =>
    ipcRenderer.invoke('terminal:destroy', { terminalId }),

  onData: (terminalId: string, callback: (data: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: string) => callback(data)
    ipcRenderer.on(`terminal:data:${terminalId}`, handler)
    return () => ipcRenderer.removeListener(`terminal:data:${terminalId}`, handler)
  },

  onExit: (terminalId: string, callback: (code: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, { exitCode }: { exitCode: number }) => callback(exitCode)
    ipcRenderer.on(`terminal:exit:${terminalId}`, handler)
    return () => ipcRenderer.removeListener(`terminal:exit:${terminalId}`, handler)
  },

  agentWrite: (terminalId: string, command: string) =>
    ipcRenderer.invoke('terminal:agent-write', { terminalId, command }),
  agentWriteForce: (terminalId: string, command: string) =>
    ipcRenderer.invoke('terminal:agent-write-force', { terminalId, command }),
})

contextBridge.exposeInMainWorld('fs', {
  openFolderDialog: () => ipcRenderer.invoke('fs:openFolderDialog') as Promise<string | null>,
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath) as Promise<FileTreeNode[]>,
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath) as Promise<{ success: boolean; content?: string; error?: string }>,
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content) as Promise<{ success: boolean; error?: string }>,
  deleteFile: (filePath: string) => ipcRenderer.invoke('fs:deleteFile', filePath) as Promise<{ success: boolean; error?: string }>,
  deleteFolder: (folderPath: string) => ipcRenderer.invoke('fs:deleteFolder', folderPath) as Promise<{ success: boolean; error?: string }>,
})

contextBridge.exposeInMainWorld('skills', {
  list: () => ipcRenderer.invoke('skills:list') as Promise<unknown[]>,
  view: (skillId: string) => ipcRenderer.invoke('skills:view', skillId) as Promise<{ metadata: Record<string, unknown>; body: string; source_path: string }>,
  install: (repo: string, skill?: string) => ipcRenderer.invoke('skills:install', { repo, skill }) as Promise<{ ok: boolean; output: string }>,
  repoList: (repo: string) => ipcRenderer.invoke('skills:repo-list', repo) as Promise<{ ok: boolean; output: string }>,
  find: (query: string) => ipcRenderer.invoke('skills:find', query) as Promise<{ ok: boolean; output: string }>,
  update: () => ipcRenderer.invoke('skills:update') as Promise<{ ok: boolean; output: string }>,
  uninstall: (skillId: string) => ipcRenderer.invoke('skills:uninstall', skillId) as Promise<{ success: boolean; error?: string }>,
})
