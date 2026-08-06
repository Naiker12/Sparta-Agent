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
  tools?: unknown[]
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
    if (window.sparta?.sendMessage) {
      return window.sparta.sendMessage(request) as unknown as Promise<MessagingAdapterSendResult>
    }
    if (window.electron?.invoke) {
      return window.electron.invoke('chat:send', request) as unknown as Promise<MessagingAdapterSendResult>
    }
  }

  abortMessage(sessionId: string): void {
    if (window.sparta?.abortMessage) {
      window.sparta.abortMessage(sessionId)
    }
  }

  onEvent(handler: (event: SpartaEvent) => void): () => void {
    if (window.sparta?.onEvent) {
      return window.sparta.onEvent(handler as (event: unknown) => void)
    }
    if (window.electron?.on) {
      return window.electron.on('sparta:event', handler as (...args: unknown[]) => void)
    }
    return () => {}
  }

  isReady(): boolean {
    return typeof window !== 'undefined' && !!(window.sparta?.sendMessage || window.electron?.invoke)
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
    }, 150)
    return () => clearInterval(timer)
  }

}

let _messagingAdapter: MessagingAdapter | null = null

export function getMessagingAdapter(): MessagingAdapter {
  if (!_messagingAdapter) {
    _messagingAdapter = new ElectronAdapter()
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