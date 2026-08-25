import { ipcMain, BrowserWindow, dialog, type IpcMainInvokeEvent, type IpcMainEvent } from 'electron'
import { spawnPty, type SpartaPtyProcess } from '../tools/pty-manager'
import { execSync } from 'node:child_process'
import { accessSync } from 'node:fs'
import os from 'os'
import { runCommandForAgent } from '../tools/main-process-shell-tool'

// Canonical source of truth: python/sparta_ai/security/command_sanitizer.py
// This list MUST stay in sync with DANGEROUS_PATTERNS in that file.
const DESTRUCTIVE_PATTERNS = [
  // rm -rf / (any path outside cwd)
  /^rm\s+(-rf?\s+)?(\/|[~]\/|\.\.)/,
  /^rmdir\s+\//,
  // Dangerous device/raw writes
  /^dd\s+if=/,
  /^mkfs\./,
  /^fdisk\s+/,
  /^format\s+/,
  /^mkswap\b/,
  // Crypto / ransomware patterns
  /gpg\s+--symmetric\s+--passphrase/,
  /openssl\s+enc\s+-aes-256-cbc/,
  /find\s+\/.*-exec\s+rm/,
  /find\s+\/.*-delete/,
  /\bshred\s+/,
  /\bwipe\s+/,
  /\bsrm\s+/,
  // Remote fetch + pipe-to-shell
  /(wget|curl)\s+.*[|;]/,
  /(wget|curl)\s+.*\|\s*(ba|z)?sh/,
  /\bbash\s+<(wget|curl)/,
  // Privilege escalation
  /\bsudo\s+(rm|dd|mkfs)/,
  /\bsu\s+-/,
  /\bchmod\s+(4777|777)\s+/,
  /\bchown\s/,
  /\bpasswd\b/,
  /\bvipw\b/,
  /\bvisudo\b/,
  // Network pivoting
  /\bnmap\s+/,
  /\bmasscan\s+/,
  /\bnc\s+-[lv]/,
  /\bsocat\s+/,
  /\bssh\s+.*-[LRD]\s+/,
  /\bproxychains\s+/,
  // Windows-specific
  /^del\s+\/f\s+\/s/i,
  /^rd\s+\/s\s+\/q/i,
  /^cipher\s+\/w:/i,
  /^>.*(sparta-vault\.json|\.env)$/,
  // Credential exfiltration
  />\s*(sparta-vault\.json|\.env|id_rsa|id_ed25519)/,
  /\bformat\s+\/[qQ]/,
  /\bdiskpart\b/,
]

interface SessionState {
  pty: SpartaPtyProcess
  buffer: string[]
  ready: boolean
  win: BrowserWindow
}

interface AgentProcState {
  pty: SpartaPtyProcess
  win: BrowserWindow
}
export const sessions = new Map<string, SessionState>()

export const agentProcs = new Map<string, AgentProcState>()

const BANNER = `\x1b[35m
   _____ ____   ___    ____  ______ ___
  / ___// __ \\ /   |  / __ \\/_  __//   |
  \\__ \\/ /_/ // /| | / /_/ / / /  / /| |
 ___/ / ____// ___ |/ _, _/ / /  / ___ |
/____/_/    /_/  |_/_/ |_| /_/  /_/  |_|
\x1b[0m
\x1b[2m  Sparta Agent — Terminal integrada · PTY real\x1b[0m
\x1b[2m  Presiona Ctrl+\` para mostrar/ocultar\x1b[0m

`

function getWin(event: IpcMainInvokeEvent | IpcMainEvent): BrowserWindow {
  return BrowserWindow.fromWebContents(event.sender)!
}

import { getWorkspaceRoot } from './filesystem.channel'

function shellCommand(profile?: string, customFlags?: string[]) {
  if (profile && (profile.includes('\\') || profile.includes('/') || profile.endsWith('.exe'))) {
    return { shell: profile, args: customFlags && customFlags.length > 0 ? customFlags : [] }
  }
  if (os.platform() === 'win32') {
    if (profile === 'pwsh' || profile?.includes('pwsh')) {
      const pwsh = (() => {
        try { return execSync('where pwsh.exe 2>nul').toString().trim().split('\n')[0]?.trim() || '' } catch { return '' }
      })()
      if (pwsh) return { shell: pwsh, args: customFlags && customFlags.length > 0 ? customFlags : ['-NoLogo'] }
    }
    if (profile === 'cmd' || profile?.includes('cmd')) {
      return { shell: process.env.COMSPEC || 'cmd.exe', args: customFlags && customFlags.length > 0 ? customFlags : [] }
    }
    // Default: try pwsh first, then powershell, then cmd
    const pwsh = (() => {
      try { return execSync('where pwsh.exe 2>nul').toString().trim().split('\n')[0]?.trim() || '' } catch { return '' }
    })()
    if (pwsh) return { shell: pwsh, args: customFlags && customFlags.length > 0 ? customFlags : ['-NoLogo'] }
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    const winPs = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
    try { accessSync(winPs); return { shell: winPs, args: customFlags && customFlags.length > 0 ? customFlags : ['-NoLogo'] } } catch { /* ignore */ }
    return { shell: process.env.COMSPEC || 'cmd.exe', args: customFlags && customFlags.length > 0 ? customFlags : [] }
  }
  if (profile === 'zsh' || profile?.includes('zsh')) return { shell: '/bin/zsh', args: customFlags && customFlags.length > 0 ? customFlags : ['-l'] }
  if (profile === 'bash' || profile?.includes('bash')) return { shell: '/bin/bash', args: customFlags && customFlags.length > 0 ? customFlags : ['-l'] }
  const shell = process.env.SHELL || '/bin/bash'
  return { shell, args: customFlags && customFlags.length > 0 ? customFlags : ['-l'] }
}

export function registerTerminalIPC() {
  ipcMain.handle('terminal:create', (
    event: IpcMainInvokeEvent,
    {
      terminalId,
      cols,
      rows,
      shell: shellProfile,
      cwd,
      shellFlags,
      envOverrides,
    }: {
      terminalId: string
      cols: number
      rows: number
      shell?: string
      cwd?: string
      shellFlags?: string[]
      envOverrides?: Record<string, string>
    }
  ) => {
    const { shell, args: shellArgs } = shellCommand(shellProfile, shellFlags)

    const workingDir = cwd || getWorkspaceRoot() || process.env.HOME || process.cwd()

    let ptyProcess: SpartaPtyProcess
    try {
      ptyProcess = spawnPty(shell, shellArgs, {
        name: 'xterm-256color',
        cols: cols ?? 80,
        rows: rows ?? 24,
        cwd: workingDir,
        env: {
          ...process.env,
          ...(envOverrides || {}),
          SPARTA_TERMINAL: '1',
          TERM_PROGRAM: 'SpartaAgent',
        },
      })
    } catch (err) {
      console.error('[terminal] pty.spawn failed:', err)
      return {
        success: false,
        shell,
        error: `No se pudo iniciar la terminal. Corre: npm run rebuild-native. ` +
          `(${err instanceof Error ? err.message : String(err)})`,
      }
    }

    const win = getWin(event)
    const state: SessionState = { pty: ptyProcess, buffer: [], ready: false, win }

    win.webContents.send(`terminal:data:${terminalId}`, BANNER)

    ptyProcess.onData((data: string) => {
      if (!state.ready) {
        state.buffer.push(data)
        return
      }
      if (!state.win.isDestroyed()) {
        state.win.webContents.send(`terminal:data:${terminalId}`, data)
      }
    })

    ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      sessions.delete(terminalId)
      if (!state.win.isDestroyed()) {
        state.win.webContents.send(`terminal:exit:${terminalId}`, { exitCode, signal: signal ?? null })
      }
    })

    sessions.set(terminalId, state)
    return { success: true, shell }
  })

  ipcMain.on('terminal:ready', (_event: IpcMainEvent, { terminalId }: { terminalId: string }) => {
    const state = sessions.get(terminalId)
    if (!state) return
    state.ready = true
    if (state.buffer.length > 0) {
      state.buffer.forEach((chunk) => {
        if (!state.win.isDestroyed()) {
          state.win.webContents.send(`terminal:data:${terminalId}`, chunk)
        }
      })
      state.buffer.length = 0
    }
  })

  ipcMain.on('terminal:write', (
    _event: IpcMainEvent,
    { terminalId, data }: { terminalId: string; data: string }
  ) => {
    sessions.get(terminalId)?.pty.write(data)
  })

  ipcMain.on('terminal:resize', (
    _event: IpcMainEvent,
    { terminalId, cols, rows }: { terminalId: string; cols: number; rows: number }
  ) => {
    sessions.get(terminalId)?.pty.resize?.(cols, rows)
  })

  ipcMain.handle('terminal:destroy', (
    _event: IpcMainInvokeEvent,
    { terminalId }: { terminalId: string }
  ) => {
    const state = sessions.get(terminalId)
    if (state) {
      try {
        state.pty.kill()
      } catch { /* ignore ConPTY cleanup assertion on Windows */ }
      sessions.delete(terminalId)
    }
    return { success: true }
  })

  ipcMain.handle('terminal:agent-write', (
    _event: IpcMainInvokeEvent,
    { terminalId, command }: { terminalId: string; command: string }
  ) => {
    const id = terminalId || findFirstTerminalId()
    const state = sessions.get(id)
    if (!state) return { success: false, error: 'No hay terminal activa. Abre la terminal primero.' }

    const trimmed = command.trim()
    const isDangerous = DESTRUCTIVE_PATTERNS.some((p) => p.test(trimmed))
    if (isDangerous) {
      return {
        success: false,
        error: 'Comando potencialmente destructivo. Envía a terminal:agent-write-force para confirmar.',
        needsConfirmation: true,
        command,
      }
    }

    const prefixed = `\x1b[36m[agente]\x1b[0m ${command}\r\n`
    if (!state.win.isDestroyed()) {
      state.win.webContents.send(`terminal:data:${id}`, prefixed)
    }
    state.pty.write(command + '\r')
    return { success: true }
  })

  ipcMain.handle('terminal:agent-write-force', async (
    _event: IpcMainInvokeEvent,
    { terminalId, command }: { terminalId: string; command: string }
  ) => {
    const id = terminalId || findFirstTerminalId()
    const state = sessions.get(id)
    if (!state) return { success: false, error: 'No hay terminal activa' }

    // SEC-TERM2: Validate dangerous commands server-side instead of trusting renderer
    const trimmed = command.trim()
    const isDangerous = DESTRUCTIVE_PATTERNS.some((p) => p.test(trimmed))
    if (isDangerous) {
      const win = state.win
      if (win.isDestroyed()) return { success: false, error: 'Window destroyed' }
      const { response } = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Ejecutar', 'Cancelar'],
        defaultId: 1,
        title: 'Confirmar comando peligroso',
        message: 'Este comando fue marcado como potencialmente destructivo:',
        detail: trimmed.slice(0, 300),
      })
      if (response !== 0) {
        return { success: false, error: 'Comando rechazado por el usuario.' }
      }
    }

    const prefixed = `\x1b[36m[agente]\x1b[0m ${command}\r\n\x1b[33m⚠  Confirmado por el usuario\x1b[0m\r\n`
    if (!state.win.isDestroyed()) {
      state.win.webContents.send(`terminal:data:${id}`, prefixed)
    }
    state.pty.write(command + '\r')
    return { success: true }
  })

  ipcMain.handle('terminal:list-sessions', () => {
    return Array.from(sessions.keys())
  })

  ipcMain.handle('terminal:agent-spawn', async (
    _event: IpcMainInvokeEvent,
    { procId, command, cwd }: { procId: string; command: string; cwd?: string }
  ) => {
    try {
      const res = await runCommandForAgent(procId, command, cwd)
      return { success: res.success, error: res.error }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('terminal:agent-kill', (_event, { procId }: { procId: string }) => {
    const state = agentProcs.get(procId)
    if (state) {
      state.pty.kill()
      agentProcs.delete(procId)
    }
    return { success: true }
  })
}

function findFirstTerminalId(): string {
  return Array.from(sessions.keys())[0] || ''
}
