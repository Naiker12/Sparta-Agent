import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { registerChatIPC } from './ipc/chat.ipc'
import { registerMemoryIPC } from './ipc/memory.ipc'
import { registerVaultIPC } from './ipc/vault.ipc'
import { registerSearchIPC } from './ipc/search.ipc'
import { registerKeyManagerIPC } from './ipc/keymanager.ipc'
import { registerSecurityIPC, wireSecurityIntoPipeline } from './ipc/security.ipc'
import { startSidecar, stopSidecar } from './ipc/sidecar.ipc'

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
    icon: path.join(process.env.VITE_PUBLIC, 'sparta-escritorio.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Sparta Agent',
  })

  win.once('ready-to-show', () => win?.show())

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
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

app.whenReady().then(() => {
  // Start Python AI sidecar before creating window
  startSidecar()

  createWindow()

  registerChatIPC()
  registerMemoryIPC()
  registerVaultIPC()
  registerSearchIPC()
  registerKeyManagerIPC()
  registerSecurityIPC()

  // Wire Rust security layer into the IPC pipeline
  wireSecurityIntoPipeline()

  // Seed vault keys into Python sidecar cache
  const { pushAll } = require('./ipc/keymanager.ipc')
  setTimeout(() => {
    pushAll().catch((err: Error) => console.warn('[main] Failed to seed keys:', err.message))
  }, 1000)

  ipcMain.handle('app:getVersion', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.env.APP_ROOT, 'package.json'), 'utf-8'))
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

// Graceful shutdown: stop sidecar when app quits
app.on('before-quit', () => {
  stopSidecar()
})
