import { ipcMain, BrowserWindow, type IpcMainInvokeEvent, type IpcMainEvent } from 'electron'
import * as pty from 'node-pty'
import os from 'os'

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
  \\__ \\/ /_/ // /| | / /_/ / / /  / /| |
 ___/ / ____// ___ |/ _, _/ / /  / ___ |
/____/_/    /_/  |_/_/ |_| /_/  /_/  |_|
\x1b[0m
\x1b[2m  Sparta Agent — Terminal integrada · PTY real\x1b[0m
\x1b[2m  Escribe comandos normalmente, o pide al agente que ejecute algo por ti.\x1b[0m

`

function getWin(event: IpcMainInvokeEvent | IpcMainEvent): BrowserWindow {
  return BrowserWindow.fromWebContents(event.sender)!
}

export function registerTerminalIPC() {
  ipcMain.handle('terminal:create', (event: IpcMainInvokeEvent, { terminalId, cols, rows }: { terminalId: string; cols: number; rows: number }) => {
    const shell = os.platform() === 'win32'
      ? 'powershell.exe'
      : (process.env.SHELL ?? '/bin/bash')

    const ptyProcess = pty.spawn(shell, [], {
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

    const win = getWin(event)
    const state: SessionState = { pty: ptyProcess, buffer: [], ready: false, win }

    // Send banner immediately (before any PTY data)
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

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      sessions.delete(terminalId)
      if (!state.win.isDestroyed()) {
        state.win.webContents.send(`terminal:exit:${terminalId}`, { exitCode })
      }
    })

    sessions.set(terminalId, state)
    return { success: true, shell }
  })

  // Renderer signals that its onData listener is registered
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

  ipcMain.on('terminal:write', (_event: IpcMainEvent, { terminalId, data }: { terminalId: string; data: string }) => {
    sessions.get(terminalId)?.pty.write(data)
  })

  ipcMain.on('terminal:resize', (_event: IpcMainEvent, { terminalId, cols, rows }: { terminalId: string; cols: number; rows: number }) => {
    sessions.get(terminalId)?.pty.resize(cols, rows)
  })

  ipcMain.handle('terminal:destroy', (_event: IpcMainInvokeEvent, { terminalId }: { terminalId: string }) => {
    const state = sessions.get(terminalId)
    if (state) {
      state.pty.kill()
      sessions.delete(terminalId)
    }
    return { success: true }
  })

  ipcMain.handle('terminal:agent-write', (_event: IpcMainInvokeEvent, { terminalId, command }: { terminalId: string; command: string }) => {
    const state = sessions.get(terminalId)
    if (!state) return { success: false, error: 'No terminal activa' }

    // Show visual prefix so user can distinguish agent-vs-manual commands
    const prefixed = `\x1b[36m[agente]\x1b[0m ${command}\r\n`
    state.win.webContents.send(`terminal:data:${terminalId}`, prefixed)

    state.pty.write(command + '\r')
    return { success: true }
  })
}
