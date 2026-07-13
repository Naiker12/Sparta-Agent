import { ipcMain, dialog, shell } from 'electron'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
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

let _workspaceRoot: string | null = null

function isWithinRoot(filePath: string, root: string): boolean {
  const resolved = fs.realpathSync(path.resolve(filePath))
  const resolvedRoot = fs.realpathSync(path.resolve(root))
  return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep)
}

async function buildFileTree(dirPath: string, depth = 0): Promise<FileTreeNode[]> {
  if (depth >= MAX_DEPTH) return []

  let entries: fs.Dirent[] = []
  try {
    entries = await fsPromises.readdir(dirPath, { withFileTypes: true })
  } catch (err) {
    console.error(`[fs] readDir failed for ${dirPath}:`, (err as Error).message)
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
        children: await buildFileTree(fullPath, depth + 1),
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
    if (!dirPath || typeof dirPath !== 'string') return { nodes: [], error: 'Invalid path' }
    if (!_workspaceRoot) _workspaceRoot = dirPath
    try {
      const nodes = await buildFileTree(dirPath)
      return { nodes }
    } catch (err) {
      console.error(`[fs] readDir error for ${dirPath}:`, (err as Error).message)
      return { nodes: [], error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') return { success: false, error: 'Invalid path' }
    if (_workspaceRoot && !isWithinRoot(filePath, _workspaceRoot)) {
      return { success: false, error: 'Path is outside workspace root' }
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return { success: true, content }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    if (!filePath || typeof filePath !== 'string') return { success: false, error: 'Invalid path' }
    if (_workspaceRoot && !isWithinRoot(filePath, _workspaceRoot)) {
      return { success: false, error: 'Path is outside workspace root' }
    }
    try {
      fs.writeFileSync(filePath, content, 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') return { success: false, error: 'Invalid path' }
    if (_workspaceRoot && !isWithinRoot(filePath, _workspaceRoot)) {
      return { success: false, error: 'Path is outside workspace root' }
    }
    try {
      await shell.trashItem(filePath)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:deleteFolder', async (_event, folderPath: string) => {
    if (!folderPath || typeof folderPath !== 'string') return { success: false, error: 'Invalid path' }
    if (_workspaceRoot && !isWithinRoot(folderPath, _workspaceRoot)) {
      return { success: false, error: 'Path is outside workspace root' }
    }
    try {
      await shell.trashItem(folderPath)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:mkdir', async (_event, dirPath: string) => {
    if (!dirPath || typeof dirPath !== 'string') return { success: false, error: 'Invalid path' }
    if (_workspaceRoot && !isWithinRoot(dirPath, _workspaceRoot)) {
      return { success: false, error: 'Path is outside workspace root' }
    }
    try {
      await fsPromises.mkdir(dirPath, { recursive: true })
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:startWatcher', (_event, dirPath: string) => {
    if (!dirPath || typeof dirPath !== 'string') return { success: false }
    _workspaceRoot = dirPath
    startFileWatcher(dirPath)
    return { success: true }
  })

  ipcMain.handle('fs:stopWatcher', () => {
    stopFileWatcher()
    return { success: true }
  })
}
