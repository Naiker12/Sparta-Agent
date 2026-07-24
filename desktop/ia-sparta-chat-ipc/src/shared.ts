import { BrowserWindow } from 'electron'

export interface MCPServerConfig {
  id?: string
  name?: string
  type?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  env_vault_refs?: string[]
  url?: string
  headers?: Record<string, string>
  headers_vault_refs?: string[]
  enabled?: boolean
  timeout?: number
  tools?: { include?: string[]; exclude?: string[] }
}

export interface ChatRequest {
  sessionId: string
  messageId: string
  model: string
  messages: { role: string; content: string }[]
  providerKey?: string
  apiUrl?: string
  isLocal?: boolean
  system?: string
  vendor?: string
  providerId?: string
  mode?: string
  skills?: string[]
  mcpServers?: MCPServerConfig[]
  semanticMemory?: boolean
  reasoning?: { enabled: boolean; budget: number }
  webSearchEnabled?: boolean
  workspaceRoot?: string
  connectedFolder?: string
  agentAutonomy?: string
  agentExecuteLocal?: boolean
  securityLoaded?: boolean
  sandboxMode?: string
  openFiles?: string[]
}

export const activeStreams = new Map<string, { active: boolean; messageId: string }>()
export const chunkSeqCounters = new Map<string, { streamSeq: number; thinkSeq: number }>()
export const windowBySession = new Map<string, BrowserWindow>()
export const sessionReady = new Map<string, boolean>()
export const eventBuffer = new Map<string, Record<string, unknown>[]>()
export const streamResolvers = new Map<string, () => void>()
export const lastActivity = new Map<string, number>()

export function getNextSeq(requestId: string, kind: 'stream' | 'think'): number {
  const entry = chunkSeqCounters.get(requestId) ?? { streamSeq: 0, thinkSeq: 0 }
  if (kind === 'stream') entry.streamSeq++
  else entry.thinkSeq++
  chunkSeqCounters.set(requestId, entry)
  return kind === 'stream' ? entry.streamSeq : entry.thinkSeq
}

export function clearSeqCounters(requestId: string): void {
  chunkSeqCounters.delete(requestId)
}

export function sendToRenderer(event: Record<string, unknown>): void {
  const sessionId = event.sessionId as string | undefined

  if (sessionId && !sessionReady.get(sessionId)) {
    const buf = eventBuffer.get(sessionId) ?? []
    buf.push(event)
    eventBuffer.set(sessionId, buf)
    return
  }

  let win: BrowserWindow | undefined

  if (sessionId) {
    win = windowBySession.get(sessionId)
  }

  if (!win || win.isDestroyed()) {
    win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  }

  if (!win || win.isDestroyed()) {
    console.warn('[chat.ipc] No available window to send event:', event.type)
    return
  }

  win.webContents.send('sparta:event', event)
}

export async function waitForDone(requestId: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const done = () => resolve(true)
    streamResolvers.set(requestId, done)
    setTimeout(() => {
      if (streamResolvers.get(requestId) === done) {
        streamResolvers.delete(requestId)
        resolve(false)
      }
    }, timeoutMs)
  })
}
