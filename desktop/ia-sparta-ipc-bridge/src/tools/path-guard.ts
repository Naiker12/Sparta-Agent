/**
 * path-guard.ts
 * Lógica pura de validación de límites de directorio sin dependencias de Electron ni de canales de IPC.
 */

import fs from 'node:fs'
import path from 'node:path'

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

export class PathGuard {
  public static isWithinRoot(filePath: string, root: string): boolean {
    return isWithinRoot(filePath, root)
  }
}
