import { execSync } from 'node:child_process'
import os from 'node:os'
import { ipcMain } from 'electron'

export interface HarnessDefinition {
  id: string
  label: string
  binary: string
  versionFlag: string
  docsUrl: string
  description: string
}

export const KNOWN_HARNESSES: HarnessDefinition[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    binary: 'claude',
    versionFlag: '--version',
    docsUrl: 'https://docs.claude.com/claude-code',
    description: 'Asistente de codificación por CLI de Anthropic con soporte de herramientas y subagentes.',
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    binary: 'opencode',
    versionFlag: '--version',
    docsUrl: 'https://opencode.ai',
    description: 'Asistente de terminal de código abierto con soporte de agentes y modo servidor OpenAPI.',
  },
  {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    binary: 'gemini',
    versionFlag: '--version',
    docsUrl: 'https://github.com/google-gemini/gemini-cli',
    description: 'Herramienta de línea de comandos de Google Gemini con integración rápida de modelos multimodal.',
  },
  {
    id: 'codex-cli',
    label: 'Codex / ChatGPT CLI',
    binary: 'codex',
    versionFlag: '--version',
    docsUrl: 'https://github.com/openai/codex',
    description: 'CLI de asistencia e integración de modelos OpenAI Codex en consola.',
  },
]

export interface HarnessStatus {
  id: string
  label: string
  installed: boolean
  version: string | null
  path: string | null
  description: string
  docsUrl: string
}

function findBinary(binary: string): string | null {
  try {
    const isWin = os.platform() === 'win32'
    const cmd = isWin ? `where.exe ${binary} 2>nul` : `which ${binary} 2>/dev/null`
    const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 2500 }).toString().trim()
    const firstLine = out.split(/\r?\n/)[0]?.trim()
    return firstLine || null
  } catch {
    return null
  }
}

function getVersion(binary: string, flag: string): string | null {
  try {
    const out = execSync(`${binary} ${flag}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
      env: { ...process.env, CI: '1' },
    })
      .toString()
      .trim()
    const firstLine = out.split(/\r?\n/)[0]?.trim()
    return firstLine || null
  } catch {
    return null
  }
}

export function detectHarnesses(): HarnessStatus[] {
  return KNOWN_HARNESSES.map((h) => {
    const path = findBinary(h.binary)
    const version = path ? getVersion(h.binary, h.versionFlag) : null
    return {
      id: h.id,
      label: h.label,
      installed: !!path,
      path,
      version,
      description: h.description,
      docsUrl: h.docsUrl,
    }
  })
}

export function registerHarnessIPC(): void {
  ipcMain.handle('harnesses:detect', () => {
    return detectHarnesses()
  })
}
