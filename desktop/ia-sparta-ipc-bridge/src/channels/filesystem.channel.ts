import { ipcMain, dialog, shell } from 'electron'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { startFileWatcher, stopFileWatcher, expandWatcher, collapseWatcher } from './file-watcher'
import { IGNORED_DIR_SET } from '../lib/filesystem-constants'
import { isWithinRoot } from '../tools/main-process-file-tools'
import { isDocumentConvertible, convertDocumentToMarkdown, getCachedAttachmentContent } from './document.channel'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

let _workspaceRoot: string | null = null

export function getWorkspaceRoot(): string | null {
  return _workspaceRoot
}

function assertWorkspacePath(candidate: string): string | null {
  if (!_workspaceRoot) return 'No workspace folder is connected'
  if (!isWithinRoot(candidate, _workspaceRoot)) return 'Path is outside workspace root'
  return null
}

function setWorkspaceRoot(root: string): { success: true } | { success: false; error: string } {
  try {
    if (!root || typeof root !== 'string') return { success: false, error: 'Invalid path' }
    const stat = fs.statSync(root)
    if (!stat.isDirectory()) return { success: false, error: 'Workspace root must be a directory' }
    _workspaceRoot = fs.realpathSync(root)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid workspace root' }
  }
}

export function registerFilesystemIPC() {
  ipcMain.handle('fs:openFolderDialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('fs:readDirLevel', async (_event, dirPath: string) => {
    if (!dirPath || typeof dirPath !== 'string') return { nodes: [], error: 'Invalid path' }
    const pathError = assertWorkspacePath(dirPath)
    if (pathError) return { nodes: [], error: pathError }
    try {
      let entries: fs.Dirent[] = []
      try {
        entries = await fsPromises.readdir(dirPath, { withFileTypes: true })
      } catch (err) {
        return { nodes: [], error: (err as Error).message }
      }

      const nodes: FileTreeNode[] = []
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env') continue
        if (entry.isDirectory() && IGNORED_DIR_SET.has(entry.name)) continue

        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          nodes.push({ name: entry.name, path: fullPath, type: 'directory', children: [] })
        } else if (entry.isFile()) {
          nodes.push({ name: entry.name, path: fullPath, type: 'file' })
        }
      }

      nodes.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name)
        return a.type === 'directory' ? -1 : 1
      })

      return { nodes }
    } catch (err) {
      return { nodes: [], error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:readFile', async (_event, filePath: string, encoding?: string) => {
    if (!filePath || typeof filePath !== 'string') return { success: false, error: 'Invalid path' }
    const pathError = assertWorkspacePath(filePath)
    if (pathError) return { success: false, error: pathError }

    //  Check chat attachment cache first (e.g. for uploaded PDFs, DOCX, XLSX)
    const cached = getCachedAttachmentContent(filePath)
    if (cached && cached.trim()) {
      return { success: true, content: cached, encoding: 'utf-8' }
    }

    //  Convert document if PDF, DOCX, XLSX, etc.
    if (isDocumentConvertible(filePath)) {
      try {
        const conv = await convertDocumentToMarkdown({ filePath })
        if (conv && conv.markdown) {
          return { success: true, content: conv.markdown, encoding: 'utf-8' }
        }
      } catch { /* ignore fallback to fs */ }
    }

    try {
      const enc: 'utf-8' | 'base64' = encoding === 'base64' ? 'base64' : 'utf-8'
      const content = fs.readFileSync(filePath, enc)
      return { success: true, content, encoding: enc }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    if (!filePath || typeof filePath !== 'string') return { success: false, error: 'Invalid path' }
    const pathError = assertWorkspacePath(filePath)
    if (pathError) return { success: false, error: pathError }
    try {
      fs.writeFileSync(filePath, content, 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') return { success: false, error: 'Invalid path' }
    const pathError = assertWorkspacePath(filePath)
    if (pathError) return { success: false, error: pathError }
    try {
      await shell.trashItem(filePath)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:deleteFolder', async (_event, folderPath: string) => {
    if (!folderPath || typeof folderPath !== 'string') return { success: false, error: 'Invalid path' }
    const pathError = assertWorkspacePath(folderPath)
    if (pathError) return { success: false, error: pathError }
    try {
      await shell.trashItem(folderPath)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:mkdir', async (_event, dirPath: string) => {
    if (!dirPath || typeof dirPath !== 'string') return { success: false, error: 'Invalid path' }
    const pathError = assertWorkspacePath(dirPath)
    if (pathError) return { success: false, error: pathError }
    try {
      await fsPromises.mkdir(dirPath, { recursive: true })
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:startWatcher', async (_event, dirPath: string) => {
    const configured = setWorkspaceRoot(dirPath)
    if (!configured.success) return configured
    await startFileWatcher(_workspaceRoot!)
    return configured
  })

  ipcMain.handle('fs:setWorkspaceRoot', async (_event, root: string) => {
    const configured = setWorkspaceRoot(root)
    if (!configured.success) return configured
    await startFileWatcher(_workspaceRoot!)
    return configured
  })

  ipcMain.handle('fs:stopWatcher', () => {
    stopFileWatcher()
    return { success: true }
  })

  ipcMain.handle('fs:expandWatcher', async (_event, dirPath: string) => {
    if (!dirPath || typeof dirPath !== 'string') return { success: false }
    await expandWatcher(dirPath)
    return { success: true }
  })

  ipcMain.handle('fs:collapseWatcher', async (_event, dirPath: string) => {
    if (!dirPath || typeof dirPath !== 'string') return { success: false }
    collapseWatcher(dirPath)
    return { success: true }
  })

  ipcMain.handle('fs:scanModelWeights', async (_event, scanDir: string) => {
    if (!scanDir || typeof scanDir !== 'string') {
      return { success: false, error: 'Ruta no válida', models: [] }
    }

    try {
      if (!fs.existsSync(scanDir)) {
        return { success: false, error: `El directorio "${scanDir}" no existe en el equipo`, models: [] }
      }

      const discovered: Array<{
        name: string
        path: string
        size: string
        sizeBytes: number
        format: 'GGUF' | 'Safetensors' | 'LoRA' | 'PyTorch' | 'Checkpoint'
        quantization: string
        lastModified: string
      }> = []

      async function scanRecursive(currentPath: string, depth: number) {
        if (depth > 3) return
        let entries: fs.Dirent[] = []
        try {
          entries = await fsPromises.readdir(currentPath, { withFileTypes: true })
        } catch {
          return
        }

        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
          const fullPath = path.join(currentPath, entry.name)

          if (entry.isDirectory()) {
            const isCheckpointDir =
              entry.name.includes('checkpoint') ||
              entry.name.includes('lora') ||
              entry.name.includes('models') ||
              entry.name.includes('output') ||
              entry.name.includes('weights')
            if (isCheckpointDir || depth < 2) {
              await scanRecursive(fullPath, depth + 1)
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            const nameLower = entry.name.toLowerCase()

            if (ext === '.gguf' || ext === '.safetensors' || ext === '.bin' || ext === '.pt' || ext === '.onnx') {
              try {
                const stat = await fsPromises.stat(fullPath)
                const sizeGb = (stat.size / (1024 * 1024 * 1024)).toFixed(1)
                const sizeMb = (stat.size / (1024 * 1024)).toFixed(0)
                const sizeStr = stat.size >= 1024 * 1024 * 1024 ? `${sizeGb} GB` : `${sizeMb} MB`

                let format: 'GGUF' | 'Safetensors' | 'LoRA' | 'PyTorch' | 'Checkpoint' = 'GGUF'
                if (ext === '.safetensors') format = nameLower.includes('adapter') ? 'LoRA' : 'Safetensors'
                else if (ext === '.pt' || ext === '.bin') format = 'PyTorch'

                let quant = 'Estándar'
                if (nameLower.includes('q4_k_m') || nameLower.includes('q4_k')) quant = 'Q4_K_M'
                else if (nameLower.includes('q5_k_m') || nameLower.includes('q5_k')) quant = 'Q5_K_M'
                else if (nameLower.includes('q8_0') || nameLower.includes('q8_k')) quant = 'Q8_0'
                else if (nameLower.includes('q4_0')) quant = 'Q4_0'
                else if (nameLower.includes('q4_1')) quant = 'Q4_1'
                else if (nameLower.includes('4bit') || nameLower.includes('4-bit') || nameLower.includes('bnb')) quant = '4-bit BnB'
                else if (nameLower.includes('8bit') || nameLower.includes('8-bit')) quant = '8-bit'
                else if (nameLower.includes('f16') || nameLower.includes('fp16')) quant = 'FP16'
                else if (nameLower.includes('bf16')) quant = 'BF16'

                discovered.push({
                  name: path.basename(entry.name, ext),
                  path: fullPath,
                  size: sizeStr,
                  sizeBytes: stat.size,
                  format,
                  quantization: quant,
                  lastModified: stat.mtime.toISOString(),
                })
              } catch {
                /* skip */
              }
            }
          }
        }
      }

      await scanRecursive(scanDir, 0)
      return { success: true, models: discovered }
    } catch (err) {
      return { success: false, error: (err as Error).message, models: [] }
    }
  })
}
