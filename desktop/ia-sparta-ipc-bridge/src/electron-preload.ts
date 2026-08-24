import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getBackendPort: () => ipcRenderer.invoke('backend:get-port') as Promise<number | undefined>,
  onBackendReady: (callback: (port: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, port: number) => callback(port)
    ipcRenderer.on('backend:ready', listener)
    return () => ipcRenderer.removeListener('backend:ready', listener)
  },
  onBackendError: (callback: (message: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) => callback(message)
    ipcRenderer.on('backend:error', listener)
    return () => ipcRenderer.removeListener('backend:error', listener)
  },
  setTitleBarOverlay: (colors: { color: string; symbolColor: string }) => ipcRenderer.send('titlebar:set-overlay', colors),
  getVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
})
