/**
 * ia-sparta-app-shell — Ciclo de vida de la app Electron
 *
 * Responsabilidad ÚNICA: manejar ready / before-quit / activate.
 * No sabe nada de ventanas ni de IPC.
 */
import { app, BrowserWindow } from 'electron'

export function setupAppLifecycle(createWindow: () => void): void {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}