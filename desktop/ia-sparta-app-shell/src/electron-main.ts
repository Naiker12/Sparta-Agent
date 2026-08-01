import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { registerMemoryIPC } from 'ia-sparta-ipc-bridge'
import { registerVaultIPC } from 'ia-sparta-ipc-bridge'
import { registerKeyManagerIPC, pushAllKeys } from 'ia-sparta-ipc-bridge'
import { registerChatSendIPC, registerOnMessageHandler, registerSidecarStatusIPC, registerMemoryIPC as registerChatMemoryIPC, registerEditorDiffIPC, registerAudioIPC, registerMcpTestIPC, registerMcpOAuthIPC, registerAgentTaskIPC, registerMcpCallToolIPC, registerMcpSyncIPC, getEnhancedEnv } from 'ia-sparta-chat-ipc'
import { registerSecurityIPC, wireSecurityIntoPipeline } from 'ia-sparta-ipc-bridge'
import { startSidecar, stopSidecar, waitForSidecarReady, registerSidecarIPC } from 'ia-sparta-ipc-bridge'
import { registerTerminalIPC, sessions, agentProcs } from 'ia-sparta-ipc-bridge'
import { registerFilesystemIPC } from 'ia-sparta-ipc-bridge'
import { registerSkillsIPC } from 'ia-sparta-ipc-bridge'
import { registerPermissionIPC, setPermissionWindow } from 'ia-sparta-ipc-bridge'
import { registerModelsIPC } from 'ia-sparta-ipc-bridge'
import { stopFileWatcher } from 'ia-sparta-ipc-bridge'

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
    for (const [, session] of sessions) {
      if (session && typeof (session as any).destroy === 'function') {
        (session as any).destroy()
      }
    }
    sessions.clear()

    for (const [, proc] of agentProcs) {
      try {
        if (proc && typeof (proc as any).kill === 'function') {
          (proc as any).kill()
        }
      } catch {
        // ignore
      }
    }
    agentProcs.clear()

    stopFileWatcher()
    stopSidecar()

    win = null
  })

  if (VITE_DEV_SERVER_URL) {
    // Retry loading Vite dev server URL if it fails (common during hot-reload rebuilds)
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
  // Enrich process.env.PATH to fix ENOENT when launching binaries like npx, uvx or node
  const env = getEnhancedEnv()
  process.env.PATH = env.PATH
  process.env.Path = env.Path

  // Start native TypeScript EventBridge before creating window
  startSidecar()

  // Register security IPC early so the renderer gets the real module status
  // as soon as the window loads (avoids false "security unavailable" warning).
  registerSecurityIPC()

  createWindow()

  // App metadata IPC handlers
  ipcMain.handle('app:getVersion', () => app.getVersion() || '0.1.1')
  ipcMain.handle('app:getName', () => app.getName() || 'Sparta Agent')

  // Register chat IPC handlers from ia-sparta-chat-ipc
  registerChatSendIPC()
  registerOnMessageHandler()
  registerSidecarStatusIPC()
  registerChatMemoryIPC()
  registerEditorDiffIPC()
  registerAudioIPC()
  registerMcpTestIPC()
  registerMcpOAuthIPC()
  registerMcpCallToolIPC()
  registerMcpSyncIPC()
  registerAgentTaskIPC()
  registerMemoryIPC()
  registerVaultIPC()
  registerKeyManagerIPC()

  // Register remaining IPC modules
  registerTerminalIPC()
  registerFilesystemIPC()
  registerSkillsIPC()
  registerPermissionIPC()
  registerModelsIPC()
  registerSidecarIPC()

  // Push all stored API keys to Sidecar and wire security module into pipeline
  await waitForSidecarReady()
  wireSecurityIntoPipeline()

  try {
    await pushAllKeys()
  } catch (err) {
    console.warn('[main] Could not push keys to sidecar:', err)
  }
})
