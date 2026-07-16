/**
 * ia-sparta-app-shell — Creación/configuración de BrowserWindow
 *
 * Responsabilidad ÚNICA: crear y configurar la ventana principal de Electron.
 * No sabe nada de IPC, ni de sidecar, ni de nada más que BrowserWindow.
 */
import { BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT || path.join(__dirname, '..'), 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT || path.join(__dirname, '..'), 'dist')

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
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
    icon: path.join(process.env.VITE_PUBLIC || '', 'sparta-escritorio.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Sparta Agent',
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Window control IPC
  ipcMain.on('win:minimize', () => win.minimize())
  ipcMain.on('win:maximize', () => {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('win:close', () => win.close())
  ipcMain.handle('win:isMaximized', () => win.isMaximized())

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  return win
}