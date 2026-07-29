/**
 * main-process-shell-tool.ts — Herramienta nativa run_command para el proceso principal (Node.js).
 *
 * Ejecuta comandos en segundo plano usando node-pty, sanitiza comandos destructivos,
 * emite chunks de salida en tiempo real al renderer y retorna el resultado al loop LLM.
 */

import * as pty from 'node-pty'
import os from 'os'
import { execSync } from 'node:child_process'
import { accessSync } from 'node:fs'
import { BrowserWindow } from 'electron'
import { getWorkspaceRoot } from '../channels/filesystem.channel'

const DESTRUCTIVE_PATTERNS = [
  /^rm\s+(-rf?\s+)?(\/|[~]\/|\.\.)/,
  /^rmdir\s+\//,
  /^dd\s+if=/,
  /^mkfs\./,
  /^fdisk\s+/,
  /^format\s+/,
  /^mkswap\b/,
  /gpg\s+--symmetric\s+--passphrase/,
  /openssl\s+enc\s+-aes-256-cbc/,
  /find\s+\/.*-exec\s+rm/,
  /find\s+\/.*-delete/,
  /\bshred\s+/,
  /\bwipe\s+/,
  /\bsrm\s+/,
  /(wget|curl)\s+.*[|;]/,
  /(wget|curl)\s+.*\|\s*(ba|z)?sh/,
  /\bbash\s+<(wget|curl)/,
  /\bsudo\s+(rm|dd|mkfs)/,
  /\bsu\s+-/,
  /\bchmod\s+(4777|777)\s+/,
  /\bchown\s/,
  /\bpasswd\b/,
  /\bvipw\b/,
  /\bvisudo\b/,
  /\bnmap\s+/,
  /\bmasscan\s+/,
  /\bnc\s+-[lv]/,
  /\bsocat\s+/,
  /\bssh\s+.*-[LRD]\s+/,
  /\bproxychains\s+/,
  /^del\s+\/f\s+\/s/i,
  /^rd\s+\/s\s+\/q/i,
  /^cipher\s+\/w:/i,
  /^>.*(sparta-vault\.json|\.env)$/,
  />\s*(sparta-vault\.json|\.env|id_rsa|id_ed25519)/,
  /\bformat\s+\/[qQ]/,
  /\bdiskpart\b/,
]

function getShellCommand(profile?: string) {
  if (os.platform() === 'win32') {
    if (profile === 'pwsh') {
      const pwsh = (() => {
        try { return execSync('where pwsh.exe 2>nul').toString().trim().split('\n')[0]?.trim() || '' } catch { return '' }
      })()
      if (pwsh) return { shell: pwsh, args: ['-NoLogo'] }
    }
    if (profile === 'cmd') {
      return { shell: process.env.COMSPEC || 'cmd.exe', args: [] }
    }
    const pwsh = (() => {
      try { return execSync('where pwsh.exe 2>nul').toString().trim().split('\n')[0]?.trim() || '' } catch { return '' }
    })()
    if (pwsh) return { shell: pwsh, args: ['-NoLogo'] }
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    const winPs = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
    try { accessSync(winPs); return { shell: winPs, args: ['-NoLogo'] } } catch { /* ignore */ }
    return { shell: process.env.COMSPEC || 'cmd.exe', args: [] }
  }
  if (profile === 'zsh') return { shell: '/bin/zsh', args: ['-l'] }
  if (profile === 'bash') return { shell: '/bin/bash', args: ['-l'] }
  const shell = process.env.SHELL || '/bin/bash'
  return { shell, args: ['-l'] }
}

export function runCommandForAgent(
  procId: string,
  command: string,
  cwd?: string,
  onChunk?: (chunk: string) => void,
): Promise<{ success: boolean; output: string; exitCode: number; error?: string }> {
  const sanitizedCmd = command.trim()
  const isDangerous = DESTRUCTIVE_PATTERNS.some((p) => p.test(sanitizedCmd))
  if (isDangerous) {
    return Promise.resolve({
      success: false,
      output: '',
      exitCode: 1,
      error: 'Comando potencialmente destructivo bloqueado por seguridad.',
    })
  }

  const { shell, args: shellArgs } = getShellCommand()
  const workingDir = cwd || getWorkspaceRoot() || process.env.HOME || process.cwd()

  return new Promise((resolve) => {
    let ptyProcess: pty.IPty
    try {
      ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: workingDir,
        env: { ...process.env, SPARTA_TERMINAL: '1', SPARTA_AGENT_BG: '1' },
      })
    } catch (err) {
      return resolve({
        success: false,
        output: '',
        exitCode: 1,
        error: `No se pudo spawnear la shell: ${err instanceof Error ? err.message : String(err)}`,
      })
    }

    const outputChunks: string[] = []

    // Broadcast to renderer windows if active
    const windows = BrowserWindow.getAllWindows()

    windows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('terminal:agent-spawn', { procId, command: sanitizedCmd })
      }
    })

    ptyProcess.onData((data: string) => {
      outputChunks.push(data)
      if (onChunk) onChunk(data)
      windows.forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('terminal:agent-output', { procId, chunk: data })
        }
      })
    })

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      windows.forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('terminal:agent-exit', { procId, code: exitCode })
        }
      })

      const rawOutput = outputChunks.join('')
      // Strip ANSI escape sequences
      const cleanOutput = rawOutput.replace(
        // eslint-disable-next-line no-control-regex
        /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
        '',
      )

      resolve({
        success: exitCode === 0,
        output: cleanOutput.trim() || '(sin salida)',
        exitCode,
      })
    })

    ptyProcess.write(sanitizedCmd + '\r')
  })
}
