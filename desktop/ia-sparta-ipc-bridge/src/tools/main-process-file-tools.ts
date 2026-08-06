/**
 * main-process-file-tools.ts — Herramientas nativas de archivo para el proceso principal (Node.js).
 *
 * Implementa read_file, write_file, edit_file, delete_file, list_directory
 * usando fs/fsPromises directo y respetando la guarda de seguridad isWithinRoot.
 */

import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { getWorkspaceRoot } from '../channels/filesystem.channel'
import { isDocumentConvertible, convertDocumentToMarkdown } from '../channels/document.channel'
import { IGNORED_DIR_SET } from '../../../ia-sparta-core/src/lib/filesystem-constants'

export function isWithinRoot(filePath: string, root: string): boolean {
  try {
    const resolved = fs.realpathSync(path.resolve(filePath))
    const resolvedRoot = fs.realpathSync(path.resolve(root))
    return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep)
  } catch {
    const resolved = path.resolve(filePath)
    const resolvedRoot = path.resolve(root)
    return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep)
  }
}

export const MAIN_FILE_TOOLS = ['read_file', 'write_file', 'edit_file', 'delete_file', 'list_directory'] as const

export function isMainProcessFileTool(name: string): boolean {
  return (MAIN_FILE_TOOLS as readonly string[]).includes(name)
}

export async function executeMainProcessFileTool(
  toolName: string,
  args: Record<string, unknown>,
  customWorkspaceRoot?: string,
): Promise<string> {
  const root = customWorkspaceRoot || getWorkspaceRoot()

  switch (toolName) {
    case 'read_file': {
      const filePath = String(args.path ?? '')
      if (!filePath) throw new Error('read_file requiere "path"')
      if (root && !isWithinRoot(filePath, root)) {
        throw new Error('La ruta está fuera de la carpeta conectada / workspace root.')
      }
      if (isDocumentConvertible(filePath)) {
        const conv = await convertDocumentToMarkdown({ filePath })
        return conv.markdown
      }
      const content = await fsPromises.readFile(filePath, 'utf-8')
      return content
    }

    case 'write_file': {
      const filePath = String(args.path ?? '')
      const content = String(args.content ?? '')
      if (!filePath) throw new Error('write_file requiere "path"')
      if (root && !isWithinRoot(filePath, root)) {
        throw new Error('La ruta está fuera de la carpeta conectada / workspace root.')
      }
      const parentDir = path.dirname(filePath)
      if (parentDir) {
        await fsPromises.mkdir(parentDir, { recursive: true })
      }
      await fsPromises.writeFile(filePath, content, 'utf-8')
      return `Archivo escrito exitosamente: ${filePath}`
    }

    case 'edit_file': {
      const filePath = String(args.path ?? '')
      const oldText = String(args.old_text ?? '')
      const newText = String(args.new_text ?? '')
      if (!filePath || !oldText) throw new Error('edit_file requiere "path" y "old_text"')
      if (root && !isWithinRoot(filePath, root)) {
        throw new Error('La ruta está fuera de la carpeta conectada / workspace root.')
      }
      const current = await fsPromises.readFile(filePath, 'utf-8')
      if (!current.includes(oldText)) {
        throw new Error('El texto a reemplazar (old_text) no fue encontrado en el archivo.')
      }
      const updated = current.replace(oldText, newText)
      await fsPromises.writeFile(filePath, updated, 'utf-8')
      return `Archivo editado exitosamente: ${filePath}`
    }

    case 'delete_file': {
      const filePath = String(args.path ?? '')
      if (!filePath) throw new Error('delete_file requiere "path"')
      if (root && !isWithinRoot(filePath, root)) {
        throw new Error('La ruta está fuera de la carpeta conectada / workspace root.')
      }
      await fsPromises.rm(filePath, { recursive: true, force: true })
      return `Archivo/carpeta eliminado exitosamente: ${filePath}`
    }

    case 'list_directory': {
      let dirPath = String(args.path ?? root ?? '.')
      if (dirPath === '.' || dirPath === './') {
        dirPath = root || process.cwd()
      }
      if (root && !isWithinRoot(dirPath, root)) {
        throw new Error('La ruta está fuera de la carpeta conectada / workspace root.')
      }
      const entries = await fsPromises.readdir(dirPath, { withFileTypes: true })
      const lines: string[] = []
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env') continue
        if (entry.isDirectory() && IGNORED_DIR_SET.has(entry.name)) continue
        const typeStr = entry.isDirectory() ? 'DIR' : 'FILE'
        lines.push(`[${typeStr}] ${entry.name}`)
      }
      lines.sort()
      return lines.length > 0 ? lines.join('\n') : '(directorio vacío)'
    }

    default:
      throw new Error(`Herramienta de archivo no soportada: ${toolName}`)
  }
}
