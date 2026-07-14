import { ipcMain, BrowserWindow } from 'electron'
import { isSidecarRunning, isSidecarReady } from '../sidecar.ipc'
import { sessionReady, eventBuffer, windowBySession } from './shared'

export function registerSidecarStatusIPC(): void {
  ipcMain.handle('sidecar:status', () => {
    return { running: isSidecarRunning(), ready: isSidecarReady() }
  })

  ipcMain.on('chat:ready', (_event: Electron.IpcMainEvent, { sessionId }: { sessionId: string }) => {
    sessionReady.set(sessionId, true)
    const buf = eventBuffer.get(sessionId)
    if (buf && buf.length > 0) {
      const win = windowBySession.get(sessionId) ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        for (const evt of buf) {
          win.webContents.send('sparta:event', evt)
        }
      }
      eventBuffer.delete(sessionId)
    }
  })
}
