import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { EventEmitter } from 'node:events'

let sidecarReady = true
let sidecarWsToken: string | null = randomUUID()

export const sidecarEvents = new EventEmitter()
export const SidecarEvent = {
  MESSAGE: 'sidecar:message',
  READY: 'sidecar:ready',
  EXIT: 'sidecar:exit',
  ERROR: 'sidecar:error',
  STDERR: 'sidecar:stderr',
  CRASHED: 'sidecar:crashed',
} as const

export function startSidecar(): void {
  sidecarReady = true
  if (!sidecarWsToken) sidecarWsToken = randomUUID()
  sidecarEvents.emit(SidecarEvent.READY, { event: 'ready', status: 'ok' })
}

export function sendToPython(msg: object): boolean {
  // Direct in-memory event dispatch for native TypeScript agents
  setImmediate(() => {
    sidecarEvents.emit(SidecarEvent.MESSAGE, msg)
  })
  return true
}

export function stopSidecar(): void {
  sidecarReady = false
}

export function isSidecarRunning(): boolean {
  return sidecarReady
}

export function isSidecarReady(): boolean {
  return sidecarReady
}

export function waitForSidecarReady(_timeoutMs?: number): Promise<boolean> {
  return Promise.resolve(true)
}

export function getSidecarWsToken(): string | null {
  return sidecarWsToken
}

export function registerSidecarIPC(): void {
  ipcMain.handle('sidecar:terminal-token', () => sidecarWsToken)
}

