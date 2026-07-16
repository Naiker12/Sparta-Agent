import type { ChatRequest } from 'ia-sparta-core'

export interface ChatResponse {
  ok: boolean
  error?: string
  aborted?: boolean
}

export class SidecarBridge {
  async send(params: ChatRequest & { sessionId: string; messageId: string }): Promise<ChatResponse> {
    if (!window.sparta?.sendMessage) {
      return { ok: false, error: 'Sidecar no disponible desde navegador' }
    }
    try {
      return await window.sparta.sendMessage(params)
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  abort(sessionId: string): void {
    window.sparta?.abortMessage(sessionId)
  }

  async isReady(): Promise<boolean> {
    if (!window.sparta?.isSidecarReady) return false
    const status = await window.sparta.isSidecarReady()
    return status.running && status.ready
  }
}

export const sidecarBridge = new SidecarBridge()
