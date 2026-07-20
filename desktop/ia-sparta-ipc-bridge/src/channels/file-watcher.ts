import type { FSWatcher } from 'chokidar'
import path from 'node:path'
import { BrowserWindow } from 'electron'
import { shouldIgnoreDirectory } from 'ia-sparta-core'

let rootWatcher: FSWatcher | null = null
let watchedRoot: string | null = null
const directoryWatchers = new Map<string, FSWatcher>()

function broadcastFileChanged(filePath: string): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) return
  win.webContents.send('sparta:event', {
    type: 'file:changed',
    path: filePath,
    timestamp: Date.now(),
  })
}

async function watchDirectory(dirPath: string): Promise<void> {
  if (directoryWatchers.has(dirPath)) return

  const chokidar = await import('chokidar')
  const watcher = chokidar.watch(dirPath, {
    persistent: true,
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  })

  watcher
    .on('add', (p) => broadcastFileChanged(p))
    .on('change', (p) => broadcastFileChanged(p))
    .on('unlink', (p) => broadcastFileChanged(p))
    .on('addDir', (p) => {
      const dirName = path.basename(p)
      if (!shouldIgnoreDirectory(dirName)) {
        broadcastFileChanged(p)
      }
    })
    .on('unlinkDir', (p) => {
      broadcastFileChanged(p)
      unwatchDirectory(p)
    })

  directoryWatchers.set(dirPath, watcher)
}

function unwatchDirectory(dirPath: string): void {
  const watcher = directoryWatchers.get(dirPath)
  if (watcher) {
    watcher.close()
    directoryWatchers.delete(dirPath)
  }
}

export async function expandWatcher(dirPath: string): Promise<void> {
  if (!watchedRoot) return
  if (!dirPath.startsWith(watchedRoot)) return
  await watchDirectory(dirPath)
}

export function collapseWatcher(dirPath: string): void {
  unwatchDirectory(dirPath)
  for (const [watchedPath] of directoryWatchers) {
    if (watchedPath.startsWith(dirPath)) {
      unwatchDirectory(watchedPath)
    }
  }
}

export async function startFileWatcher(rootPath: string): Promise<void> {
  if (watchedRoot === rootPath && rootWatcher) return
  stopFileWatcher()

  const chokidar = await import('chokidar')
  const absRoot = path.resolve(rootPath)

  rootWatcher = chokidar.watch(absRoot, {
    persistent: true,
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  })

  rootWatcher
    .on('add', (p) => broadcastFileChanged(p))
    .on('change', (p) => broadcastFileChanged(p))
    .on('unlink', (p) => broadcastFileChanged(p))
    .on('addDir', (p) => {
      if (p !== absRoot) {
        const dirName = path.basename(p)
        if (!shouldIgnoreDirectory(dirName)) {
          broadcastFileChanged(p)
        }
      }
    })
    .on('unlinkDir', (p) => {
      broadcastFileChanged(p)
      unwatchDirectory(p)
    })

  watchedRoot = absRoot
}

export function stopFileWatcher(): void {
  if (rootWatcher) {
    rootWatcher.close()
    rootWatcher = null
  }

  for (const [, watcher] of directoryWatchers) {
    watcher.close()
  }
  directoryWatchers.clear()

  watchedRoot = null
}
