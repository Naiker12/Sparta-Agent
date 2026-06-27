import { IS_ELECTRON } from './env-adapter'
import type { SpartaEvent } from '@/types'

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
  mode?: string
  skills?: string[]
  mcpServers?: unknown[]
  semanticMemory?: boolean
  reasoning?: { enabled: boolean; budget: number }
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
}

class ElectronAdapter implements MessagingAdapter {
  sendMessage(request: ChatSendRequest): Promise<MessagingAdapterSendResult> | void {
    return window.sparta.sendMessage(request) as unknown as Promise<MessagingAdapterSendResult>
  }

  abortMessage(sessionId: string): void {
    window.sparta.abortMessage(sessionId)
  }

  onEvent(handler: (event: SpartaEvent) => void): () => void {
    return window.sparta.onEvent(handler as (event: unknown) => void)
  }

  isReady(): boolean {
    return !!window.sparta?.sendMessage
  }
}

class WebAdapter implements MessagingAdapter {
  private ws: WebSocket | null = null
  private handlers: Set<(event: SpartaEvent) => void> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  constructor() {
    this.connect()
  }

  private connect() {
    if (this.destroyed) return
    const wsUrl = this.getWebSocketUrl()
    this.ws = new WebSocket(wsUrl)

    this.ws.onmessage = (msg) => {
      try {
        const event: SpartaEvent = JSON.parse(msg.data)
        this.handlers.forEach(h => h(event))
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
        params: request
      }))
      return Promise.resolve({ ok: true })
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

export const messagingAdapter: MessagingAdapter = IS_ELECTRON
  ? new ElectronAdapter()
  : new WebAdapter()
