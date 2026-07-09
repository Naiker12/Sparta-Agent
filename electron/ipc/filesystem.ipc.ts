import { ipcMain, dialog, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { startFileWatcher, stopFileWatcher } from './file-watcher'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.venv', '__pycache__', '.pytest_cache', 'dist', 'build', '.next'])
const MAX_DEPTH = 8

function buildFileTree(dirPath: string, depth = 0): FileTreeNode[] {
  if (depth >= MAX_DEPTH) return []

  let entries: fs.Dirent[] = []
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return []
  }

  const nodes: FileTreeNode[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env') continue
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue

    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'directory',
        children: buildFileTree(fullPath, depth + 1),
      })
    } else if (entry.isFile()) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'file',
      })
    }
  }

  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === 'directory' ? -1 : 1
  })
}

export function registerFilesystemIPC() {
  ipcMain.handle('fs:openFolderDialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
    if (!dirPath || typeof dirPath !== 'string') return []
    return buildFileTree(dirPath)
  })

  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') return { success: false, error: 'Invalid path' }
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return { success: true, content }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    if (!filePath || typeof filePath !== 'string') return { success: false, error: 'Invalid path' }
    try {
      fs.writeFileSync(filePath, content, 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') return { success: false, error: 'Invalid path' }
    try {
      await shell.trashItem(filePath)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:deleteFolder', async (_event, folderPath: string) => {
    if (!folderPath || typeof folderPath !== 'string') return { success: false, error: 'Invalid path' }
    try {
      await shell.trashItem(folderPath)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:startWatcher', (_event, dirPath: string) => {
    if (!dirPath || typeof dirPath !== 'string') return { success: false }
    startFileWatcher(dirPath)
    return { success: true }
  })

  ipcMain.handle('fs:stopWatcher', () => {
    stopFileWatcher()
    return { success: true }
  })
}
