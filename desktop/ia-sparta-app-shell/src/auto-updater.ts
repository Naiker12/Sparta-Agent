import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export type UpdaterStage =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
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

function appImageEnvironmentError(): string | null {
  if (process.platform !== 'linux' || !app.isPackaged || process.env.APPIMAGE) return null
  return 'Automatic installation requires running Sparta Agent from its writable AppImage file. Download the latest AppImage from GitHub instead.'
}

const updateMetaPath = (): string => path.join(app.getPath('userData'), 'update-meta.json')

function rememberDownloadedVersion(version: string): void {
  try {
    writeFileSync(updateMetaPath(), JSON.stringify({ downloadedVersion: version }), 'utf8')
  } catch {
    // A failed guard must never prevent the updater from working.
  }
}

function shouldSkipAutomaticCheck(): boolean {
  const metaPath = updateMetaPath()
  try {
    if (!existsSync(metaPath)) return false
    const { downloadedVersion } = JSON.parse(readFileSync(metaPath, 'utf8')) as { downloadedVersion?: unknown }
    if (downloadedVersion !== app.getVersion()) return false
    unlinkSync(metaPath)
    return true
  } catch {
    return false
  }
}

function isSameOrOlderVersion(candidate: string, current: string): boolean {
  const candidateParts = candidate.split(/[.+-]/).map((part) => Number(part))
  const currentParts = current.split(/[.+-]/).map((part) => Number(part))
  if (candidateParts.some(Number.isNaN) || currentParts.some(Number.isNaN)) return candidate === current

  const length = Math.max(candidateParts.length, currentParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (candidateParts[index] ?? 0) - (currentParts[index] ?? 0)
    if (difference !== 0) return difference < 0
  }
  return true
}

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
    if (isSameOrOlderVersion(info.version, app.getVersion())) {
      emit({ stage: 'not-available' }, getWindow)
      return
    }
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
    rememberDownloadedVersion(info.version)
    emit({
      stage: 'downloaded',
      version: info.version,
      releaseNotes: state.releaseNotes ?? releaseNotesText(info.releaseNotes),
      percent: 100,
    }, getWindow)
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
    const environmentError = appImageEnvironmentError()
    if (environmentError) {
      emit({ ...state, stage: 'error', error: environmentError }, getWindow)
      return { ok: false, error: environmentError }
    }
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
    const environmentError = appImageEnvironmentError()
    if (environmentError) {
      emit({ ...state, stage: 'error', error: environmentError }, getWindow)
      return { ok: false, error: environmentError }
    }
    emit({ ...state, stage: 'installing' }, getWindow)
    autoUpdater.quitAndInstall(true, true)
    return { ok: true }
  })

  if (app.isPackaged && !shouldSkipAutomaticCheck()) void autoUpdater.checkForUpdates()
}
