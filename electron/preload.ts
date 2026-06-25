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
})
