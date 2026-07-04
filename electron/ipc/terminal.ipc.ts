import { ipcMain, BrowserWindow, type IpcMainInvokeEvent, type IpcMainEvent } from 'electron'
import * as pty from 'node-pty'
import os from 'os'

const DESTRUCTIVE_PATTERNS = [
  /^rm\s+(-rf?\s+)?(\/|[~]\/|\.\.)/,
  /^rmdir\s+\//,
  /^dd\s+if=/,
  /^mkfs\./,
  /^fdisk\s+/,
  /^format\s+/,
  /^del\s+\/f\s+\/s/i,
  /^rd\s+\/s\s+\/q/i,
  /^cipher\s+\/w:/i,
  /^>.*(sparta-vault\.json|\.env)$/,
]

interface SessionState {
  pty: pty.IPty
  buffer: string[]
  ready: boolean
  win: BrowserWindow
}

const sessions = new Map<string, SessionState>()

const BANNER = `\x1b[35m
   _____ ____   ___    ____  ______ ___
  / ___// __ \\ /   |  / __ \\/_  __//   |
  \\\\__ \\/ /_/ // /| | / /_/ / / /  / /| |
 ___/ / ____// ___ |/ _, _/ / /  / ___ |
/____/_/    /_/  |_/_/ |_| /_/  /_/  |_|
\x1b[0m
\x1b[2m  Sparta Agent — Terminal integrada · PTY real\x1b[0m
\x1b[2m  Presiona Ctrl+\` para mostrar/ocultar\x1b[0m

`

function getWin(event: IpcMainInvokeEvent | IpcMainEvent): BrowserWindow {
  return BrowserWindow.fromWebContents(event.sender)!
}

function shellCommand() {
  if (os.platform() === 'win32') {
    const pwsh = process.env.PWSH || 'pwsh.exe'
    return { shell: pwsh, args: ['-NoLogo'] }
  }
  return { shell: process.env.SHELL ?? '/bin/bash', args: [] }
}

export function registerTerminalIPC() {
  ipcMain.handle('terminal:create', (
    event: IpcMainInvokeEvent,
    { terminalId, cols, rows }: { terminalId: string; cols: number; rows: number }
  ) => {
    const { shell, args: shellArgs } = shellCommand()

    let ptyProcess: pty.IPty
    try {
      ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: cols ?? 80,
        rows: rows ?? 24,
        cwd: process.env.HOME ?? process.cwd(),
        env: {
          ...process.env,
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
    sessions.get(terminalId)?.pty.resize(cols, rows)
  })

  ipcMain.handle('terminal:destroy', (
    _event: IpcMainInvokeEvent,
    { terminalId }: { terminalId: string }
  ) => {
    const state = sessions.get(terminalId)
    if (state) {
      state.pty.kill()
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

  ipcMain.handle('terminal:agent-write-force', (
    _event: IpcMainInvokeEvent,
    { terminalId, command }: { terminalId: string; command: string }
  ) => {
    const id = terminalId || findFirstTerminalId()
    const state = sessions.get(id)
    if (!state) return { success: false, error: 'No hay terminal activa' }

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
}

function findFirstTerminalId(): string {
  return Array.from(sessions.keys())[0] || ''
}
