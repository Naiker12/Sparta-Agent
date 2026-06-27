import { BaseTransport } from './base'
import type { ProviderVendor, ModelInfo, ChatRequest, ChatStreamChunk } from '@/types'
import { HTTP_STATUS_MESSAGES } from './http-utils'

export class OllamaTransport extends BaseTransport {
  readonly vendor: ProviderVendor = 'ollama'
  readonly kind = 'local' as const

  constructor(private serverUrl: string = 'http://localhost:11434') {
    super()
  }

  buildHeaders(): Record<string, string> {
    return { 'content-type': 'application/json' }
  }

  buildBody(req: ChatRequest): Record<string, unknown> {
    return {
      model: req.model,
      messages: req.messages,
      stream: true,
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${this.serverUrl}/api/tags`, {
      headers: this.buildHeaders(),
    })
    if (!res.ok) throw new Error(HTTP_STATUS_MESSAGES[res.status] ?? `HTTP ${res.status}`)
    const data = await res.json()
    return (data.models || []).map((m: { name: string }) => ({
      id: m.name,
      name: m.name,
      vendor: 'ollama',
      providerId: 'ollama',
    }))
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.listModels()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not connect to Ollama' }
    }
  }

  async *streamChat(req: ChatRequest): AsyncIterable<ChatStreamChunk> {
    const url = `${this.serverUrl}/api/chat`
    const headers = this.buildHeaders()
    const body = JSON.stringify(this.buildBody(req))

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
    })

    if (!res.ok) {
      const msg = HTTP_STATUS_MESSAGES[res.status] ?? `HTTP ${res.status}`
      yield { type: 'error', error: msg }
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      yield { type: 'error', error: 'No response body' }
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line)
          if (parsed.message?.content) {
            yield { type: 'content_token', delta: parsed.message.content }
          }
          if (parsed.done) {
            yield { type: 'done' }
          }
        } catch { /* skip parse errors */ }
      }
    }
    yield { type: 'done' }
  }
}
