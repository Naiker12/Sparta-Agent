/**
 * Centralized filesystem constants for ignored directories.
 * Used by both file-watcher.ts (chokidar globs) and filesystem.channel.ts (readDir filtering).
 */

export const IGNORED_DIR_SET = new Set([
  'node_modules',
  '.git',
  '.venv',
  'venv',
  'env',
  '.cargo',
  '__pycache__',
  '.pytest_cache',
  'dist',
  'build',
  '.next',
  '.out',
  'out',
  '.nuxt',
  '.idea',
  '.vscode',
  'dist-electron',
  'dist-web',
  'release',
  '.ruff_cache',
  '.sparta',
  '.agents',
  'vendor',
  '.tmp',
  'temp',
  'tmp',
])

export function shouldIgnoreDirectory(dirName: string): boolean {
  return IGNORED_DIR_SET.has(dirName) || dirName.startsWith('.')
}