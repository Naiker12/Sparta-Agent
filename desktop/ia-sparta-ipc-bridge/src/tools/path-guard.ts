/**
 * path-guard.ts
 * Lógica pura de validación de límites de directorio sin dependencias de Electron ni de canales de IPC.
 */

import fs from 'node:fs'
import path from 'node:path'

export function isWithinRoot(filePath: string, root: string): boolean {
  try {
    const resolvedRoot = fs.realpathSync(path.resolve(root))
    const absoluteTarget = path.resolve(filePath)
    let existingAncestor = absoluteTarget

    // `realpath` cannot resolve a new destination. Walk up to the closest
    // existing ancestor first, then append the remainder to its real path.
    // This catches a symlink/junction such as `workspace/link -> C:\outside`
    // before a write creates `workspace/link/new-file` outside the workspace.
    while (!fs.existsSync(existingAncestor)) {
      const parent = path.dirname(existingAncestor)
      if (parent === existingAncestor) return false
      existingAncestor = parent
    }

    const resolvedAncestor = fs.realpathSync(existingAncestor)
    const resolved = path.resolve(
      resolvedAncestor,
      path.relative(existingAncestor, absoluteTarget),
    )
    return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep)
  } catch {
    // A security guard must fail closed. Falling back to a textual comparison
    // makes unresolved junctions and permission failures look safe.
    return false
  }
}

export class PathGuard {
  public static isWithinRoot(filePath: string, root: string): boolean {
    return isWithinRoot(filePath, root)
  }
}
