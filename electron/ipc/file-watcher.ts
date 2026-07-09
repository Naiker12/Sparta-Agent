import chokidar, { type FSWatcher } from 'chokidar'
import path from 'node:path'
import { BrowserWindow } from 'electron'

let watcher: FSWatcher | null = null
let watchedRoot: string | null = null

const IGNORED_DIRS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.venv/**',
  '**/__pycache__/**',
  '**/dist/**',
  '**/dist-electron/**',
  '**/.next/**',
  '**/.pytest_cache/**',
  '**/build/**',
]

function broadcastFileChanged(filePath: string): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) return
  win.webContents.send('sparta:event', {
    type: 'file:changed',
    path: filePath,
    timestamp: Date.now(),
  })
}

export function startFileWatcher(rootPath: string): void {
  if (watchedRoot === rootPath && watcher) return
  stopFileWatcher()

  const absRoot = path.resolve(rootPath)
  watcher = chokidar.watch(absRoot, {
    ignored: IGNORED_DIRS,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    depth: 8,
  })

  watcher
    .on('add', (p) => broadcastFileChanged(p))
    .on('change', (p) => broadcastFileChanged(p))
    .on('unlink', (p) => broadcastFileChanged(p))
    .on('addDir', (p) => {
      if (p !== absRoot) broadcastFileChanged(p)
    })
    .on('unlinkDir', (p) => broadcastFileChanged(p))

  watchedRoot = absRoot
  console.log(`[file-watcher] Watching: ${absRoot}`)
}

export function stopFileWatcher(): void {
  if (watcher) {
    watcher.close()
    watcher = null
    watchedRoot = null
    console.log('[file-watcher] Stopped')
  }
}
