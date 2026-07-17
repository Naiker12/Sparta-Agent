import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { registerChatIPC } from 'ia-sparta-ipc-bridge'
import { registerMemoryIPC } from 'ia-sparta-ipc-bridge'
import { registerVaultIPC } from 'ia-sparta-ipc-bridge'
import { registerKeyManagerIPC, pushAllKeys } from 'ia-sparta-ipc-bridge'
import { registerSecurityIPC, wireSecurityIntoPipeline } from 'ia-sparta-ipc-bridge'
import { startSidecar, stopSidecar, waitForSidecarReady, registerSidecarIPC } from 'ia-sparta-ipc-bridge'
import { registerTerminalIPC, sessions, agentProcs } from 'ia-sparta-ipc-bridge'
import { registerFilesystemIPC } from 'ia-sparta-ipc-bridge'
import { registerSkillsIPC } from 'ia-sparta-ipc-bridge'
import { registerPermissionIPC, setPermissionWindow } from 'ia-sparta-ipc-bridge'
import { registerModelsIPC } from 'ia-sparta-ipc-bridge'
import { stopFileWatcher } from 'ia-sparta-ipc-bridge'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0C0C10',
      symbolColor: '#9CA3AF',
      height: 38,
    },
    backgroundColor: '#0C0C10',
    show: false,
    icon: path.join(process.env.VITE_PUBLIC!, 'sparta-escritorio.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Sparta Agent',
  })

  win.once('ready-to-show', () => {
    win?.show()
    if (win) setPermissionWindow(win)
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  win.on('closed', () => {
    for (const [id, session] of sessions) {
      if (session.win.isDestroyed() || session.win === win) {
        session.pty.kill()
        sessions.delete(id)
      }
    }
    for (const [id, proc] of agentProcs) {
      if (proc.win.isDestroyed() || proc.win === win) {
        proc.pty.kill()
        agentProcs.delete(id)
      }
    }
  })

  ipcMain.on('win:minimize', () => win?.minimize())
  ipcMain.on('win:maximize', () => {
    if (win?.isMaximized()) { win.unmaximize() } else { win?.maximize() }
  })
  ipcMain.on('win:close', () => win?.close())
  ipcMain.handle('win:isMaximized', () => win?.isMaximized())

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  // Start Python AI sidecar before creating window
  startSidecar()

  // Register security IPC early so the renderer gets the real module status
  // as soon as the window loads (avoids false "security unavailable" warning).
  registerSecurityIPC()

  createWindow()

  registerChatIPC()
  registerMemoryIPC()
  registerVaultIPC()
  registerKeyManagerIPC()
  registerTerminalIPC()
  registerFilesystemIPC()
  registerSkillsIPC()
  registerSidecarIPC()
  registerPermissionIPC()
  registerModelsIPC()

  // Wire Rust security layer into the IPC pipeline
  wireSecurityIntoPipeline()

  // Seed vault keys into Python sidecar cache once it is ready.
  // Wrapped in an IIFE so we can await the sidecar handshake without blocking app startup.
  setTimeout(() => {
    void (async () => {
      try {
        const ready = await waitForSidecarReady(30_000)
        if (!ready) {
          console.warn('[main] Sidecar did not become ready; skipping key seed')
          return
        }
        const result = await pushAllKeys()
        if (result.ok) {
          console.log('[main] Seeded', result.count, 'vault keys into sidecar')
        } else {
          console.warn('[main] Failed to seed keys:', result.error)
        }
      } catch (err) {
        console.warn('[main] Failed to seed keys:', (err as Error).message)
      }
    })()
  }, 1000)

  ipcMain.handle('app:getVersion', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.env.APP_ROOT!, 'package.json'), 'utf-8'))
    return pkg.version || '0.0.0'
  })

  ipcMain.on('shell:open-external', (_event, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) {
      shell.openExternal(url)
    }
  })

  ipcMain.on('titlebar:set-overlay', (_event, colors: { color: string; symbolColor: string }) => {
    if (win) {
      win.setTitleBarOverlay({
        color: colors.color,
        symbolColor: colors.symbolColor,
        height: 38,
      })
    }
  })
})

// Graceful shutdown: stop sidecar and file watcher when app quits
app.on('before-quit', () => {
  try { stopFileWatcher() } catch { /* ignore */ }
  try { stopSidecar() } catch { /* ignore */ }
  // Kill all terminal PTY sessions to prevent orphan processes
  try {
    for (const [id, session] of sessions) {
      try { session.pty.kill() } catch { /* ignore */ }
      sessions.delete(id)
    }
    for (const [id, proc] of agentProcs) {
      try { proc.pty.kill() } catch { /* ignore */ }
      agentProcs.delete(id)
    }
  } catch { /* ignore */ }
})
