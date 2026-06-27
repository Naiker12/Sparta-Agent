import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
import { EventEmitter } from 'node:events'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pythonProcess: any = null
let lineBuffer = ''

export const sidecarEvents = new EventEmitter()
export const SidecarEvent = {
  MESSAGE: 'sidecar:message',
  EXIT: 'sidecar:exit',
  ERROR: 'sidecar:error',
} as const

function getPythonCommand(): { command: string; args: string[] } {
  // Prefer bundled Python runtime if available
  const bundledPython = app.isPackaged
    ? path.join(process.resourcesPath, 'python-runtime', 'python.exe')
    : ''
  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'python', 'sparta_ai', 'main.py')
    : path.join(__dirname, '..', '..', 'python', 'sparta_ai', 'main.py')

  if (bundledPython && require('fs').existsSync(bundledPython)) {
    return { command: bundledPython, args: [scriptPath] }
  }
  return { command: 'python', args: [scriptPath] }
}

export function startSidecar(): void {
  if (pythonProcess) return

  const { command, args } = getPythonCommand()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc: any = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, SPARTA_ENV: 'electron', PYTHONUNBUFFERED: '1' },
  })

  proc.stdout?.on('data', (chunk: Buffer) => {
    lineBuffer += chunk.toString()
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const msg = JSON.parse(trimmed)
        sidecarEvents.emit(SidecarEvent.MESSAGE, msg)
      } catch {
        console.warn('[sidecar] Non-JSON stdout:', trimmed.slice(0, 120))
      }
    }
  })

  proc.stderr?.on('data', (data: Buffer) => {
    console.log('[Python Sidecar]', data.toString().trimEnd())
  })

  proc.on('exit', (code: number | null, signal: string | null) => {
    console.log(`[sidecar] Exited code=${code} signal=${signal}`)
    pythonProcess = null
    sidecarEvents.emit(SidecarEvent.EXIT, { code, signal })
  })

  proc.on('error', (err: Error) => {
    console.error('[sidecar] Error:', err.message)
    pythonProcess = null
    sidecarEvents.emit(SidecarEvent.ERROR, err.message)
  })

  pythonProcess = proc
  console.log(`[sidecar] Started: ${args[0]}`)
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
  pythonProcess = null
  try {
    sendToPython({ method: 'shutdown', id: 'exit' })
    proc.stdin?.end()
  } catch { /* ignore */ }

  const timer = setTimeout(() => proc.kill('SIGKILL'), 3000)
  proc.on('exit', () => { clearTimeout(timer) })
}

export function isSidecarRunning(): boolean {
  return pythonProcess !== null && !pythonProcess.killed
}
