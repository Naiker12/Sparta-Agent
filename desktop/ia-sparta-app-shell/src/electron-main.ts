import { app, BrowserWindow, ipcMain, shell, Notification } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { BackendManager } from './backend-manager'
import { isDesktopAuthOrigin } from './desktop-auth-origin'
import { setupAutoUpdater } from './auto-updater'
import { configureDesktopIdentity, DESKTOP_APP_ID } from './desktop-identity'
import { registerAllIPC, installOfficeComponent, officeComponentStatus } from 'ia-sparta-ipc-bridge'

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

// Chromium initializes Windows notification identity during startup.
// Explicit Chromium profile override also scopes backend/component data. This
// enables a packaged validation run without touching the normal user profile.
const userDataOverride = app.commandLine.getSwitchValue('user-data-dir')
if (userDataOverride && path.isAbsolute(userDataOverride)) app.setPath('userData', userDataOverride)
configureDesktopIdentity(process.env.APP_ROOT!, process.env.VITE_PUBLIC!)

let win: BrowserWindow | null
const backend = new BackendManager()
let backendStartupError: string | undefined

function backendDirectory(): string {
  return app.isPackaged ? path.join(process.resourcesPath, 'backend') : path.resolve(__dirname, '..', 'desktop', 'backend-spartan')
}

function backendRuntimeDirectory(): string {
  return path.join(app.getPath('userData'), 'backend-runtime')
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
    icon: path.join(process.env.VITE_PUBLIC!, process.platform === 'win32' ? 'spartan.ico' : 'sparta-escritorio.png'),
    webPreferences: {
      // vite-plugin-electron writes the preload entry under this filename.
      // Loading the old `preload.mjs` leaves the renderer without electronAPI,
      // so API requests fall through to Vite's HTML page instead of the backend.
      preload: path.join(__dirname, 'electron-preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Spartan',
  })

  if (process.platform === 'win32') {
    win.setAppDetails({
      appId: DESKTOP_APP_ID,
      appIconPath: path.join(process.env.VITE_PUBLIC!, 'spartan.ico'),
      appIconIndex: 0,
      relaunchDisplayName: 'Spartan',
      relaunchCommand: app.isPackaged ? `"${process.execPath}"` : `"${process.execPath}" "${process.env.APP_ROOT}"`,
    })
  }

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

  const notificationKeys = new Set<string>()
  ipcMain.handle('notifications:show', (event, payload: { key?: string; title?: string; body?: string }) => {
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) return false
    const rendererUrl = VITE_DEV_SERVER_URL ?? pathToFileURL(path.join(RENDERER_DIST, 'index.html')).href
    if (!isDesktopAuthOrigin(event.senderFrame.url, rendererUrl)) return false
    if (!payload || typeof payload.key !== 'string' || typeof payload.title !== 'string' ||
      payload.key.length > 256 || payload.title.length > 200 ||
      (payload.body !== undefined && (typeof payload.body !== 'string' || payload.body.length > 200))) return false
    if (notificationKeys.has(payload.key) || !Notification.isSupported()) return false
    notificationKeys.add(payload.key)
    if (notificationKeys.size > 500) notificationKeys.delete(notificationKeys.values().next().value!)
    const notice = new Notification({ title: payload.title, body: payload.body ?? '', icon: path.join(process.env.VITE_PUBLIC!, 'sparta-escritorio.png') })
    notice.on('click', () => { win?.restore(); win?.show(); win?.focus() })
    notice.show()
    return true
  })

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
  ipcMain.handle('backend:authenticate', (event) => {
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) {
      throw new Error('Desktop authentication is only available to the main window')
    }
    const rendererUrl = VITE_DEV_SERVER_URL ?? pathToFileURL(path.join(RENDERER_DIST, 'index.html')).href
    if (!isDesktopAuthOrigin(event.senderFrame.url, rendererUrl)) {
      throw new Error('Desktop authentication is unavailable to this page')
    }
    return backend.authenticate()
  })
  ipcMain.handle('backend:get-status', () => ({
    port: backend.getPort(),
    error: backendStartupError,
  }))
  ipcMain.handle('backend:bootstrap', async () => {
    const emitProgress = (message: string) => win?.webContents.send('backend:install-progress', message)
    try {
      await backend.bootstrap(backendDirectory(), backendRuntimeDirectory(), emitProgress)
      if (process.platform === 'win32' && process.arch === 'x64') {
        const office = await officeComponentStatus()
        if (!office.installed) {
          try { await installOfficeComponent(emitProgress) }
          catch { emitProgress('LibreOffice: preparación pendiente. Puedes reintentar desde el panel de documentos.') }
        }
      }
      emitProgress('Iniciando backend de Sparta...')
      const port = await backend.start(backendDirectory(), backendRuntimeDirectory())
      backendStartupError = undefined
      win?.webContents.send('backend:ready', port)
      win?.webContents.send('backend:install-complete')
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      backendStartupError = message
      win?.webContents.send('backend:install-error', message)
      return { ok: false, error: message }
    }
  })
  createWindow()
  setupAutoUpdater(() => win)
  void backend.start(backendDirectory(), backendRuntimeDirectory())
    .then((port) => {
      backendStartupError = undefined
      win?.webContents.send('backend:ready', port)
    })
    .catch((error) => {
      backendStartupError = error instanceof Error ? error.message : String(error)
      win?.webContents.send('backend:error', backendStartupError)
    })

  // Caption buttons theme overlay
  ipcMain.on('titlebar:set-overlay', (_event, colors: { color?: string; symbolColor?: string }) => {
    if (!win || !/^#[0-9a-f]{6}$/i.test(colors?.color ?? '') || !/^#[0-9a-f]{6}$/i.test(colors?.symbolColor ?? '')) return
    win.setTitleBarOverlay({ color: colors.color!, symbolColor: colors.symbolColor!, height: 38 })
  })

  // App metadata IPC handlers
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getName', () => app.getName() || 'Spartan')
})

app.on('before-quit', () => backend.stop())
