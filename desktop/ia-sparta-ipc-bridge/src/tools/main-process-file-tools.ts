/**
 * main-process-file-tools.ts — Herramientas nativas de archivo para el proceso principal (Node.js).
 *
 * Implementa read_file, write_file, edit_file, delete_file, list_directory
 * usando fs/fsPromises directo y respetando la guarda de seguridad isWithinRoot.
 */

import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { getWorkspaceAccess, getWorkspaceRoot } from '../channels/filesystem.channel'
import { isDocumentConvertible, convertDocumentToMarkdown, getCachedAttachmentContent } from '../channels/document.channel'
import { IGNORED_DIR_SET } from '../lib/filesystem-constants'
import { isWithinRoot, PathGuard } from './path-guard'

export { isWithinRoot, PathGuard }

export const MAIN_FILE_TOOLS = ['read_file', 'write_file', 'edit_file', 'delete_file', 'list_directory'] as const

export function isMainProcessFileTool(name: string): boolean {
  return (MAIN_FILE_TOOLS as readonly string[]).includes(name)
}

export async function executeMainProcessFileTool(
  toolName: string,
  args: Record<string, unknown>,
  customWorkspaceRoot?: string,
  workspaceAccess: 'read' | 'write' | 'write_no_delete' = 'write',
): Promise<string> {
  const root = customWorkspaceRoot || getWorkspaceRoot()
  if (!root) {
    throw new Error('No hay una carpeta de proyecto conectada para esta operación.')
  }

  const access = customWorkspaceRoot ? workspaceAccess : getWorkspaceAccess()
  if (toolName === 'delete_file' && access === 'write_no_delete') {
    throw new Error('La carpeta conectada no permite eliminar archivos.')
  }
  if (['write_file', 'edit_file', 'delete_file'].includes(toolName) && access === 'read') {
    throw new Error('La carpeta conectada es de solo lectura.')
  }

  switch (toolName) {
    case 'read_file': {
      const filePath = String(args.path ?? '')
      if (!filePath) throw new Error('read_file requiere "path"')

      if (!isWithinRoot(filePath, root)) {
        throw new Error('La ruta está fuera de la carpeta conectada / workspace root.')
      }

      // Check chat attachment cache first (e.g. for uploaded PDFs, DOCX, XLSX)
      const cachedText = getCachedAttachmentContent(filePath)
      if (cachedText && cachedText.trim()) {
        return cachedText
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
