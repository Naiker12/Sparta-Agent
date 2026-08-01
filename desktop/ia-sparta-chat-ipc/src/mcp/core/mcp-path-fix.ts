/**
 * mcp-path-fix.ts
 * Utilidad de resolución del PATH del sistema para procesos hijos en Electron.
 * Resuelve el error ENOENT al buscar ejecutables como npx, uvx, node o python.
 */

import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

export function loadDotEnv(): void {
  try {
    const envPaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(os.homedir(), '.sparta', '.env'),
    ]
    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8')
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const eqIdx = trimmed.indexOf('=')
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim()
            let val = trimmed.slice(eqIdx + 1).trim()
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1)
            }
            if (!process.env[key] || process.env[key] === '') {
              process.env[key] = val
            }
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
}

// Load .env automatically
loadDotEnv()

export function getEnhancedEnv(customEnv?: Record<string, string>): Record<string, string> {
  loadDotEnv()
  const currentPath = process.env.PATH ?? process.env.Path ?? ''
  const extraPaths: string[] = []

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    extraPaths.push(
      path.join(appData, 'npm'),
      path.join(localAppData, 'Programs', 'nodejs'),
      'C:\\Program Files\\nodejs',
      'C:\\Program Files (x86)\\nodejs',
      path.join(os.homedir(), '.cargo', 'bin'),
      path.join(os.homedir(), '.local', 'bin'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python311'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python310'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312')
    )
  } else {
    extraPaths.push(
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/opt/homebrew/bin',
      path.join(os.homedir(), '.nvm', 'versions', 'node', 'current', 'bin'),
      path.join(os.homedir(), '.cargo', 'bin'),
      path.join(os.homedir(), '.local', 'bin')
    )
  }

  const pathSeparator = process.platform === 'win32' ? ';' : ':'
  const pathSet = new Set(currentPath.split(pathSeparator).filter(Boolean))
  for (const p of extraPaths) {
    pathSet.add(p)
  }

  const enhancedPath = Array.from(pathSet).join(pathSeparator)
  return {
    ...process.env,
    PATH: enhancedPath,
    Path: enhancedPath,
    ...(customEnv ?? {}),
  } as Record<string, string>
}
