import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

export type UpdaterStage =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdaterState {
  stage: UpdaterStage
  version?: string
  releaseNotes?: string
  percent?: number
  error?: string
}

let state: UpdaterState = { stage: 'idle' }
let checking = false
let downloading = false

function releaseNotesText(notes: string | Array<{ note?: string | null }> | null | undefined): string | undefined {
  if (typeof notes === 'string') return notes || undefined
  if (!Array.isArray(notes)) return undefined
  const text = notes.map((entry) => entry.note ?? '').filter(Boolean).join('\n\n')
  return text || undefined
}

function emit(next: UpdaterState, getWindow: () => BrowserWindow | null | undefined): void {
  state = next
  getWindow()?.webContents.send('updater:state', state)
}

/** Registers the desktop updater once Electron is ready. */
export function setupAutoUpdater(getWindow: () => BrowserWindow | null | undefined): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => {
    emit({ stage: 'checking' }, getWindow)
  })
  autoUpdater.on('update-available', (info) => {
    emit({
      stage: 'available',
      version: info.version,
      releaseNotes: releaseNotesText(info.releaseNotes),
    }, getWindow)
  })
  autoUpdater.on('update-not-available', () => {
    emit({ stage: 'not-available' }, getWindow)
  })
  autoUpdater.on('download-progress', (progress) => {
    emit({ ...state, stage: 'downloading', percent: Math.round(progress.percent) }, getWindow)
  })
  autoUpdater.on('update-downloaded', (info) => {
    downloading = false
    emit({ stage: 'downloaded', version: info.version }, getWindow)
  })
  autoUpdater.on('error', (error) => {
    checking = false
    downloading = false
    emit({ stage: 'error', error: error.message }, getWindow)
  })

  ipcMain.handle('updater:get-state', () => state)
  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) return { ok: false, error: 'Updater disabled in development' }
    if (checking || downloading) return { ok: false, error: 'An update operation is already in progress' }
    checking = true
    try {
      await autoUpdater.checkForUpdates()
      return { ok: true }
    } catch (error) {
      checking = false
      const message = error instanceof Error ? error.message : String(error)
      emit({ stage: 'error', error: message }, getWindow)
      return { ok: false, error: message }
    } finally {
      checking = false
    }
  })
  ipcMain.handle('updater:download', async () => {
    if (state.stage !== 'available') return { ok: false, error: 'No update is available to download' }
    if (downloading) return { ok: false, error: 'The update is already downloading' }
    downloading = true
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true }
    } catch (error) {
      downloading = false
      const message = error instanceof Error ? error.message : String(error)
      emit({ stage: 'error', error: message }, getWindow)
      return { ok: false, error: message }
    }
  })
  ipcMain.handle('updater:install', () => {
    if (state.stage !== 'downloaded') return { ok: false, error: 'The update has not finished downloading' }
    autoUpdater.quitAndInstall(false, true)
    return { ok: true }
  })

  if (app.isPackaged) void autoUpdater.checkForUpdates()
}
