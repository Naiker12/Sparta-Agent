import { ipcRenderer, contextBridge } from 'electron'

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
  isSidecarReady: () => ipcRenderer.invoke('sidecar:status'),
})

contextBridge.exposeInMainWorld('vault', {
  isAvailable: () => ipcRenderer.invoke('vault:isAvailable'),
  storeKey: (keyId: string, value: string, vendor?: string) => ipcRenderer.invoke('vault:storeKey', keyId, value, vendor),
  getKey: (keyId: string) => ipcRenderer.invoke('vault:getKey', keyId),
  deleteKey: (keyId: string) => ipcRenderer.invoke('vault:deleteKey', keyId),
  listKeys: () => ipcRenderer.invoke('vault:listKeys'),
  hasKey: (keyId: string) => ipcRenderer.invoke('vault:hasKey', keyId),
})
