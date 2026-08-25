import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { BackendManager } from './backend-manager'
import { registerAllIPC } from 'ia-sparta-ipc-bridge'

// Suppress noisy Chromium GPU/cache errors on Windows dev hot-reloads and optimize performance & RAM usage
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('log-level', '3')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096')
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null
const backend = new BackendManager()

function backendDirectory(): string {
  return app.isPackaged ? path.join(process.resourcesPath, 'backend') : path.resolve(__dirname, '..', 'desktop', 'backend-spartan')
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#F2EBE0',
      symbolColor: '#352D40',
      height: 38,
    },
    backgroundColor: '#F2EBE0',
    show: false,
    icon: path.join(process.env.VITE_PUBLIC!, 'sparta-escritorio.png'),
    webPreferences: {
      // vite-plugin-electron writes the preload entry under this filename.
      // Loading the old `preload.mjs` leaves the renderer without electronAPI,
      // so API requests fall through to Vite's HTML page instead of the backend.
      preload: path.join(__dirname, 'electron-preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Sparta Agent',
  })

  win.once('ready-to-show', () => {
    win?.show()
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  win.on('closed', () => {
    win = null
  })

  if (VITE_DEV_SERVER_URL) {
    win.webContents.on('did-fail-load', (_event, _code, _desc, url) => {
      if (url === VITE_DEV_SERVER_URL) {
        setTimeout(() => {
          win?.loadURL(VITE_DEV_SERVER_URL!)
        }, 1000)
      }
    })
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  win.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https:') || details.url.startsWith('http:')) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })
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
  // Register all system, terminal, filesystem, security and core IPC channels
  registerAllIPC()

  // Window control IPC handlers
  ipcMain.on('win:minimize', () => win?.minimize())
  ipcMain.on('win:maximize', () => {
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })
  ipcMain.on('win:close', () => win?.close())
  ipcMain.handle('win:isMaximized', () => win?.isMaximized() ?? false)

  // Register this before loading the renderer. Otherwise an eager renderer can
  // ask for the port during its first frame, before the handler exists, then
  // fall back to Vite's HTML response for /api requests.
  ipcMain.handle('backend:get-port', () => backend.getPort())
  createWindow()
  void backend.start(backendDirectory())
    .then((port) => win?.webContents.send('backend:ready', port))
    .catch((error) => win?.webContents.send('backend:error', error instanceof Error ? error.message : String(error)))

  // Caption buttons theme overlay
  ipcMain.on('titlebar:set-overlay', (_event, colors: { color?: string; symbolColor?: string }) => {
    if (!win || !/^#[0-9a-f]{6}$/i.test(colors?.color ?? '') || !/^#[0-9a-f]{6}$/i.test(colors?.symbolColor ?? '')) return
    win.setTitleBarOverlay({ color: colors.color!, symbolColor: colors.symbolColor!, height: 38 })
  })

  // App metadata IPC handlers
  ipcMain.handle('app:getVersion', () => app.getVersion() || '0.2.1')
  ipcMain.handle('app:getName', () => app.getName() || 'Sparta Agent')
})

app.on('before-quit', () => backend.stop())

