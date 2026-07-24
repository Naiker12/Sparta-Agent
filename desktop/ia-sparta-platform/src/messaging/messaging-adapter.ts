import { IS_ELECTRON } from '../env'
import type { SpartaEvent } from 'ia-sparta-core'

interface ChatSendRequest {
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
  provider?: string
  mode?: string
  skills?: string[]
  mcpServers?: unknown[]
  semanticMemory?: boolean
  reasoning?: { enabled: boolean; budget: number; effort?: string }
  webSearchEnabled?: boolean
  workspaceRoot?: string
  connectedFolder?: string
  agentAutonomy?: string
  agentExecuteLocal?: boolean
  securityLoaded?: boolean
  sandboxMode?: string
  openFiles?: string[]
  activeFilePath?: string
}

interface MessagingAdapterSendResult {
  ok: boolean
  error?: string
}

interface MessagingAdapter {
  sendMessage(request: ChatSendRequest): Promise<MessagingAdapterSendResult> | void
  abortMessage(sessionId: string): void
  onEvent(handler: (event: SpartaEvent) => void): () => void
  isReady(): boolean
  onReady?(callback: () => void): () => void
}

class ElectronAdapter implements MessagingAdapter {
  sendMessage(request: ChatSendRequest): Promise<MessagingAdapterSendResult> | void {
    return window.sparta?.sendMessage(request) as unknown as Promise<MessagingAdapterSendResult>
  }

  abortMessage(sessionId: string): void {
    window.sparta?.abortMessage(sessionId)
  }

  onEvent(handler: (event: SpartaEvent) => void): () => void {
    return window.sparta?.onEvent(handler as (event: unknown) => void) ?? (() => {})
  }

  isReady(): boolean {
    return !!window.sparta?.sendMessage
  }

  onReady(callback: () => void): () => void {
    if (this.isReady()) {
      callback()
      return () => {}
    }
    const timer = setInterval(() => {
      if (this.isReady()) {
        clearInterval(timer)
        callback()
      }
    }, 300)
    return () => clearInterval(timer)
  }
}

class WebAdapter implements MessagingAdapter {
  private ws: WebSocket | null = null
  private handlers: Set<(event: SpartaEvent) => void> = new Set()
  private readyCallbacks: Set<() => void> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  // ── Parity with Electron IPC: seq counters + late-event guard ─────
  private chunkSeqCounters = new Map<string, { streamSeq: number; thinkSeq: number }>()
  private activeStreams = new Map<string, { active: boolean; messageId: string }>()
  private doneResolvers = new Map<string, { resolve: (v: boolean) => void; timer: ReturnType<typeof setTimeout> }>()

  constructor() {
    this.connect()
  }

  private getNextSeq(requestId: string, kind: 'stream' | 'think'): number {
    const entry = this.chunkSeqCounters.get(requestId) ?? { streamSeq: 0, thinkSeq: 0 }
    if (kind === 'stream') entry.streamSeq++
    else entry.thinkSeq++
    this.chunkSeqCounters.set(requestId, entry)
    return kind === 'stream' ? entry.streamSeq : entry.thinkSeq
  }

  private clearSeqCounters(requestId: string): void {
    this.chunkSeqCounters.delete(requestId)
  }

  private resolveDone(sessionId: string): void {
    const entry = this.doneResolvers.get(sessionId)
    if (entry) {
      clearTimeout(entry.timer)
      entry.resolve(true)
      this.doneResolvers.delete(sessionId)
    }
  }

  private connect() {
    if (this.destroyed) return
    const wsUrl = this.getWebSocketUrl()
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      this.readyCallbacks.forEach((cb) => cb())
      this.readyCallbacks.clear()
    }

    this.ws.onmessage = (msg) => {
      try {
        const raw: Record<string, unknown> = JSON.parse(msg.data)
        const forwarded = this.normalizeAndFilter(raw)
        if (forwarded) {
          this.handlers.forEach(h => h(forwarded as unknown as SpartaEvent))
        }
      } catch { /* ignore malformed */ }
    }

    this.ws.onclose = () => {
      if (this.destroyed) return
      this.reconnectTimer = setTimeout(() => this.connect(), 2000)
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  /**
   * Normalizes raw WS events from Python to match the shape the renderer
   * expects (parity with Electron IPC's on-message.channel.ts).
   * Returns null if the event should be dropped.
   */
  private normalizeAndFilter(raw: Record<string, unknown>): Record<string, unknown> | null {
    const type = raw.type as string | undefined
    if (!type) return null

    const sessionId = (raw.session_id ?? raw.sessionId ?? '') as string
    const messageId = (raw.message_id ?? raw.messageId ?? '') as string
    const requestId = sessionId && messageId ? `${sessionId}:${messageId}` : ''

    // ── Late-event guard (parity with Electron isLateStreamEvent) ───
    if (requestId && sessionId) {
      const activeStream = this.activeStreams.get(sessionId)
      const isStreamLike = type.startsWith('stream:') || type.startsWith('thinking:') ||
        type.startsWith('tool:') || type === 'search:progress'
      if (isStreamLike && (!activeStream || !activeStream.active || activeStream.messageId !== messageId)) {
        return null
      }
    }

    // ── Track active streams ────────────────────────────────────────
    if (sessionId && messageId) {
      if (type === 'stream:token' || type === 'thinking:started') {
        if (!this.activeStreams.has(sessionId)) {
          this.activeStreams.set(sessionId, { active: true, messageId })
        }
      }
      if (type === 'stream:completed' || type === 'stream:aborted' || type === 'stream:error') {
        this.activeStreams.delete(sessionId)
        if (requestId) this.clearSeqCounters(requestId)
        this.resolveDone(sessionId)
      }
    }

    // ── Remap stream:degenerate → stream:error (parity with Electron) ─
    if (type === 'stream:degenerate') {
      if (requestId) this.clearSeqCounters(requestId)
      this.activeStreams.delete(sessionId)
      this.resolveDone(sessionId)
      return {
        type: 'stream:error',
        sessionId,
        messageId,
        error: 'La respuesta se cortó por repetición detectada. El texto generado hasta el corte se conserva. Probá con otro modelo o reintentá.',
      }
    }

    // ── stream:cancelled (parity with Electron) ─────────────────────
    if (type === 'stream:cancelled') {
      if (requestId) this.clearSeqCounters(requestId)
      return { type: 'stream:cancelled', sessionId, messageId }
    }

    // ── Inject chunkSeq for token events (parity with Electron) ─────
    if (requestId) {
      if (type === 'thinking:token') {
        return { ...raw, sessionId, messageId, chunkSeq: raw.chunkSeq ?? this.getNextSeq(requestId, 'think') }
      }
      if (type === 'stream:token') {
        return { ...raw, sessionId, messageId, chunkSeq: raw.chunkSeq ?? this.getNextSeq(requestId, 'stream') }
      }
    }

    // ── Normalize snake_case fields to camelCase (parity with Electron) ─
    return {
      ...raw,
      sessionId,
      messageId,
      tokensUsed: raw.tokensUsed ?? raw.tokens_used,
      toolCallId: raw.toolCallId ?? raw.tool_call_id,
      currentStep: raw.currentStep ?? raw.current_step,
      planComplete: raw.planComplete ?? raw.plan_complete,
      origin: raw.origin ?? 'native',
    }
  }

  onReady(callback: () => void): () => void {
    if (this.isReady()) {
      callback()
      return () => {}
    }
    this.readyCallbacks.add(callback)
    return () => this.readyCallbacks.delete(callback)
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = import.meta.env.VITE_SIDECAR_HOST ?? 'localhost'
    const port = import.meta.env.VITE_SIDECAR_WS_PORT ?? '8765'
    return `${protocol}//${host}:${port}/ws`
  }

  sendMessage(request: ChatSendRequest): Promise<MessagingAdapterSendResult> | void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'chat.stream',
        params: {
          session_id: request.sessionId,
          message_id: request.messageId,
          model: request.model,
          messages: request.messages,
          provider_key: request.providerKey,
          api_url: request.apiUrl,
          is_local: request.isLocal,
          vendor: request.vendor,
          provider_id: request.providerId,
          mode: request.mode,
          skills: request.skills,
          mcp_servers: request.mcpServers,
          semantic_memory: request.semanticMemory,
          reasoning: request.reasoning,
          web_search_enabled: request.webSearchEnabled ?? true,
          workspace_root: request.workspaceRoot,
          connected_folder: request.connectedFolder,
          agent_autonomy: request.agentAutonomy,
          agent_execute_local: request.agentExecuteLocal,
          sandbox_mode: request.sandboxMode,
          open_files: request.openFiles,
          active_file_path: request.activeFilePath,
        },
      }))

      // Wait for terminal event or timeout (parity with Electron IPC)
      const timeout = 240_000
      return new Promise<MessagingAdapterSendResult>((resolve) => {
        const timer = setTimeout(() => {
          this.doneResolvers.delete(request.sessionId)
          this.abortMessage(request.sessionId)
          resolve({ ok: false, error: 'Timeout' })
        }, timeout)
        this.doneResolvers.set(request.sessionId, {
          resolve: (completed: boolean) => {
            clearTimeout(timer)
            this.doneResolvers.delete(request.sessionId)
            if (completed) {
              resolve({ ok: true })
            } else {
              resolve({ ok: false, error: 'Stream ended unexpectedly' })
            }
          },
          timer,
        })
      })
    }
    return Promise.resolve({ ok: false, error: 'WebSocket not connected' })
  }

  abortMessage(sessionId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'chat.abort',
        params: { sessionId }
      }))
    }
  }

  onEvent(handler: (event: SpartaEvent) => void): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  isReady(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  destroy(): void {
    this.destroyed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.handlers.clear()
  }
}

let _messagingAdapter: MessagingAdapter | null = null

export function getMessagingAdapter(): MessagingAdapter {
  if (!_messagingAdapter) {
    _messagingAdapter = IS_ELECTRON
      ? new ElectronAdapter()
      : new WebAdapter()
  }
  return _messagingAdapter
}

/** @deprecated Use getMessagingAdapter() instead */
export const messagingAdapter: MessagingAdapter = /* @__PURE__ */ (() => {
  if (typeof window === 'undefined') {
    // Main process: return a no-op adapter to avoid accessing `window`
    return {
      sendMessage: () => Promise.resolve({ ok: false, error: 'Not available in main process' }),
      abortMessage: () => {},
      onEvent: () => () => {},
      isReady: () => false,
    }
  }
  return getMessagingAdapter()
})()