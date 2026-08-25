/**
 * filesystem-constants.ts
 * Directorios y patrones excluidos del árbol de archivos y file watchers.
 */

export const IGNORED_DIR_SET = new Set([
  'node_modules',
  '.git',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  '.turbo',
  '.next',
  'dist',
  'dist-electron',
  'release',
  '.idea',
  '.vscode',
  '.DS_Store',
  'coverage',
  '.output',
  'build',
])

export function shouldIgnoreDirectory(dirNameOrPath: string): boolean {
  if (!dirNameOrPath) return false
  const parts = dirNameOrPath.split(/[/\\]/)
  return parts.some((p) => IGNORED_DIR_SET.has(p) || (p.startsWith('.') && p !== '.env'))
}
