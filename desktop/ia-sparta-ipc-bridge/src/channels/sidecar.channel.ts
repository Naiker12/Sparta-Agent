import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { app, ipcMain } from 'electron'
import { EventEmitter } from 'node:events'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pythonProcess: any = null
let sidecarReady = false
let lineBuffer = ''
let restartAttempts = 0
let restartTimer: ReturnType<typeof setTimeout> | null = null

const MAX_RESTART_ATTEMPTS = 3

let sidecarWsToken: string | null = null

export const sidecarEvents = new EventEmitter()
export const SidecarEvent = {
  MESSAGE: 'sidecar:message',
  READY: 'sidecar:ready',
  EXIT: 'sidecar:exit',
  ERROR: 'sidecar:error',
  STDERR: 'sidecar:stderr',
  CRASHED: 'sidecar:crashed',
} as const

function getPythonCwd(): string {
  // En dev: raíz del proyecto/python
  // En prod (empaquetado): recurso extra junto al ejecutable
  return app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : path.join(process.cwd(), 'python')
}

function getWorkspaceRoot(): string {
  // Solo devolvemos el workspace que el usuario seleccionó explícitamente.
  // Vacío = sin workspace → el sidecar lanzará error pidiendo abrir una carpeta.
  return process.env.SPARTA_WORKSPACE_ROOT ?? ''
}

function getDataDir(): string {
  // Directorio de datos de la app: userData en prod, .sparta en CWD en dev.
  const fromEnv = process.env.SPARTA_DATA_DIR
  if (fromEnv) return fromEnv
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'data')
    : path.join(process.cwd(), '.sparta')
}

function getPythonCommand(): { command: string; args: string[]; cwd: string } {
  const cwd = getPythonCwd()

  // En dev preferimos el venv creado por sidecar:setup si existe.
  const venvPython = process.platform === 'win32'
    ? path.join(process.cwd(), 'python', '.venv', 'Scripts', 'python.exe')
    : path.join(process.cwd(), 'python', '.venv', 'bin', 'python')
  const bundledPython = app.isPackaged
    ? path.join(
        process.resourcesPath,
        'python-runtime',
        process.platform === 'win32'
          ? 'python.exe'
          : path.join('bin', 'python3'),
      )
    : ''

  if (app.isPackaged && bundledPython && fs.existsSync(bundledPython)) {
    return { command: bundledPython, args: ['-m', 'sparta_ai.main'], cwd }
  }

  if (!app.isPackaged && fs.existsSync(venvPython)) {
    return { command: venvPython, args: ['-m', 'sparta_ai.main'], cwd }
  }

  return { command: 'python', args: ['-m', 'sparta_ai.main'], cwd }
}

export function startSidecar(): void {
  if (pythonProcess) return
  spawnSidecar()
}

function spawnSidecar(): void {
  if (pythonProcess) return

  const { command, args, cwd } = getPythonCommand()

  sidecarReady = false
  sidecarWsToken = randomUUID()

  const workspaceRoot = getWorkspaceRoot()
  const dataDir = getDataDir()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc: any = spawn(command, args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      SPARTA_ENV: 'electron',
      SPARTA_ELECTRON: '1',
      SPARTA_WORKSPACE_ROOT: workspaceRoot,
      SPARTA_DATA_DIR: dataDir,
      SPARTA_WS_TOKEN: sidecarWsToken,
      PYTHONUNBUFFERED: '1',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      PYTHONPATH: cwd,
    },
  })

  proc.stdout.setEncoding('utf8')
  proc.stderr.setEncoding('utf8')

  proc.stdout?.on('data', (chunk: Buffer) => {
    lineBuffer += chunk.toString()
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const msg = JSON.parse(trimmed)
        if (msg.event === 'ready') {
          sidecarReady = true
          restartAttempts = 0
          sidecarEvents.emit(SidecarEvent.READY, msg)
          console.log('[sidecar] Ready signal received')
          continue
        }
        sidecarEvents.emit(SidecarEvent.MESSAGE, msg)
      } catch (err) {
        console.warn('[sidecar] Non-JSON stdout:', trimmed.slice(0, 120), (err as Error).message)
      }
    }
  })

  proc.stderr?.on('data', (data: Buffer) => {
    const text = data.toString().trimEnd()
    console.log('[Python Sidecar]', text)
    sidecarEvents.emit(SidecarEvent.STDERR, text)
  })

  proc.on('exit', (code: number | null, signal: string | null) => {
    console.log(`[sidecar] Exited code=${code} signal=${signal}`)
    pythonProcess = null
    sidecarReady = false
    sidecarEvents.emit(SidecarEvent.EXIT, { code, signal })

    // Auto-restart on unexpected exit unless we intentionally shut it down.
    if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGKILL' && restartAttempts < MAX_RESTART_ATTEMPTS) {
      const delayMs = 1000 * (restartAttempts + 1)
      restartAttempts++
      console.log(`[sidecar] Restarting in ${delayMs}ms (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})`)
      sidecarEvents.emit(SidecarEvent.CRASHED, { code, signal, attempt: restartAttempts })
      restartTimer = setTimeout(() => {
        restartTimer = null
        try {
          spawnSidecar()
        } catch (err) {
          console.error('[sidecar] Restart timer failed:', (err as Error).message)
          sidecarEvents.emit(SidecarEvent.CRASHED, {
            code: null,
            signal: null,
            attempt: restartAttempts,
            error: (err as Error).message,
          })
        }
      }, delayMs)
    }
  })

  proc.on('error', (err: Error) => {
    console.error('[sidecar] Error:', err.message)
    pythonProcess = null
    sidecarReady = false
    sidecarEvents.emit(SidecarEvent.ERROR, err.message)
  })

  pythonProcess = proc
  console.log(`[sidecar] Started: ${command} ${args.join(' ')} (cwd=${cwd})`)
}

export function sendToPython(msg: object): void {
  if (!pythonProcess?.stdin?.writable) {
    console.warn('[sidecar] Not running, cannot send')
    return
  }
  pythonProcess.stdin.write(JSON.stringify(msg) + '\n')
}

export function stopSidecar(): void {
  const proc = pythonProcess
  if (!proc) return

  // Cancel any pending auto-restart so we don't respawn after an intentional stop.
  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }
  restartAttempts = 0

  try {
    sendToPython({ method: 'shutdown', id: 'exit' })
    proc.stdin?.end()
  } catch { /* ignore */ }

  pythonProcess = null
  sidecarReady = false

  const timer = setTimeout(() => proc.kill('SIGKILL'), 3000)
  proc.on('exit', () => { clearTimeout(timer) })
}

export function isSidecarRunning(): boolean {
  return pythonProcess !== null && !pythonProcess.killed
}

export function isSidecarReady(): boolean {
  return isSidecarRunning() && sidecarReady
}

export function waitForSidecarReady(timeoutMs = 30_000): Promise<boolean> {
  if (isSidecarReady()) return Promise.resolve(true)
  if (!isSidecarRunning()) return Promise.resolve(false)
  return new Promise((resolve) => {
    const onReady = () => {
      clearTimeout(timer)
      resolve(true)
    }
    const onExit = () => {
      sidecarEvents.off(SidecarEvent.READY, onReady)
      clearTimeout(timer)
      resolve(false)
    }
    const timer = setTimeout(() => {
      sidecarEvents.off(SidecarEvent.READY, onReady)
      sidecarEvents.off(SidecarEvent.EXIT, onExit)
      resolve(false)
    }, timeoutMs)
    sidecarEvents.once(SidecarEvent.READY, onReady)
    sidecarEvents.once(SidecarEvent.EXIT, onExit)
  })
}

export function getSidecarWsToken(): string | null {
  return sidecarWsToken
}

export function registerSidecarIPC(): void {
  // Expose the shared WebSocket token to the renderer. In the current
  // Electron build the terminal uses node-pty IPC, so this token is not used
  // by the frontend terminal; it is still generated and shared with the Python
  // sidecar so that any future web-driver terminal path has authentication.
  ipcMain.handle('sidecar:terminal-token', () => sidecarWsToken)
}
