/**
 * pty-manager.ts — Abstracción resiliente de PTY / Terminal para Electron.
 * Intenta cargar `node-pty` si está disponible en runtime. Si no, usa `node:child_process.spawn`
 * de forma 100% transparente sin fallar ni romper el inicio de la aplicación.
 */

import { spawn as cpSpawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import EventEmitter from 'node:events'

export interface SpartaPtyProcess {
  pid: number
  onData: (callback: (data: string) => void) => void
  onExit: (callback: (e: { exitCode: number; signal?: number }) => void) => void
  write: (data: string) => void
  resize?: (cols: number, rows: number) => void
  kill: (signal?: string) => void
}

let nativePty: any = null
try {
  // Carga condicional segura en runtime
  const req = typeof require !== 'undefined' ? require : null
  if (req) {
    nativePty = req('node-pty')
  }
} catch {
  // node-pty no está presente o compilado, child_process fallback activo
}

export function spawnPty(
  shell: string,
  args: string[],
  options: {
    name?: string
    cols?: number
    rows?: number
    cwd?: string
    env?: Record<string, string | undefined>
  }
): SpartaPtyProcess {
  if (nativePty && typeof nativePty.spawn === 'function') {
    try {
      return nativePty.spawn(shell, args, options)
    } catch (err) {
      console.warn('[pty-manager] node-pty spawn failed, falling back to child_process:', err)
    }
  }

  // Fallback nativo transparente con child_process (funciona en 100% de plataformas)
  const emitter = new EventEmitter()
  const child: ChildProcessWithoutNullStreams = cpSpawn(shell, args, {
    cwd: options.cwd,
    env: options.env as NodeJS.ProcessEnv,
    windowsHide: true,
    shell: false,
  })

  child.stdout.on('data', (buf) => {
    emitter.emit('data', buf.toString('utf8'))
  })

  child.stderr.on('data', (buf) => {
    emitter.emit('data', buf.toString('utf8'))
  })

  child.on('exit', (code, signal) => {
    emitter.emit('exit', { exitCode: code ?? 0, signal: signal ? 1 : 0 })
  })

  child.on('error', (err) => {
    emitter.emit('data', `\r\n[Error de terminal]: ${err.message}\r\n`)
    emitter.emit('exit', { exitCode: 1 })
  })

  return {
    pid: child.pid || 0,
    onData: (cb) => emitter.on('data', cb),
    onExit: (cb) => emitter.on('exit', cb),
    write: (data) => {
      if (child.stdin && !child.stdin.destroyed) {
        child.stdin.write(data)
      }
    },
    resize: () => {
      // noop para procesos spawn estándar
    },
    kill: (signal) => {
      try {
        child.kill((signal as NodeJS.Signals) || 'SIGTERM')
      } catch {
        /* ignore */
      }
    },
  }
}
