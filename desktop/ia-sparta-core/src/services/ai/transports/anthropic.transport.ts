import { BaseTransport } from './base'
import type { ProviderVendor, ModelInfo, ChatRequest, ChatStreamChunk } from '../../../types'
import { HTTP_STATUS_MESSAGES, isRetryable, fetchWithRetry } from './http-utils'

export class AnthropicTransport extends BaseTransport {
  readonly vendor: ProviderVendor = 'anthropic'
  readonly kind = 'cloud' as const
  private readonly baseUrl = 'https://api.anthropic.com'

  constructor(private apiKey: string) {
    super()
  }

  buildHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }
  }

  buildBody(req: ChatRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      system: req.system,
      max_tokens: req.maxTokens ?? 4096,
      stream: true,
    }
    if (req.thinkingEnabled) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: req.thinkingBudget ?? 8000,
      }
    }
    return body
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/v1/models`, {
      headers: this.buildHeaders(),
    })
    if (!res.ok) throw new Error(HTTP_STATUS_MESSAGES[res.status] ?? `HTTP ${res.status}`)
    const data = await res.json()
    return (data.data || []).map((m: { id?: string; name?: string }) => ({
      id: m.id || m.name || '',
      name: m.name || m.id || '',
      vendor: 'anthropic',
      providerId: 'anthropic',
    }))
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.listModels()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' }
    }
  }

  async *streamChat(req: ChatRequest): AsyncIterable<ChatStreamChunk> {
    const url = `${this.baseUrl}/v1/messages`
    const headers = this.buildHeaders()
    const body = JSON.stringify(this.buildBody(req))

    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body,
    })

    if (!res.ok) {
      const msg = HTTP_STATUS_MESSAGES[res.status] ?? `HTTP ${res.status}`
      yield { type: 'error', error: msg }
      if (isRetryable(res.status)) {
        yield { type: 'error', error: `${msg} — se agotaron los reintentos.` }
      }
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      yield { type: 'error', error: 'No response body' }
      return
    }

    if (this.apiKey) {
      console.debug(`[anthropic] request ${url} key=${this.apiKey.slice(0, 6)}...${this.apiKey.length}`)
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let doneEmitted = false
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const json = trimmed.slice(5).trim()
        if (json === '[DONE]') { if (!doneEmitted) { doneEmitted = true; yield { type: 'done' } }; continue }
        try {
          const parsed = JSON.parse(json)
          switch (parsed.type) {
            case 'content_block_start':
              if (parsed.content_block?.type === 'thinking' && parsed.content_block.thinking) {
                yield { type: 'thinking_token', delta: parsed.content_block.thinking }
              }
              break
            case 'content_block_delta':
              if (parsed.delta?.type === 'thinking_delta' && parsed.delta.thinking) {
                yield { type: 'thinking_token', delta: parsed.delta.thinking }
              } else if (parsed.delta?.type === 'text_delta' && parsed.delta.text) {
                yield { type: 'content_token', delta: parsed.delta.text }
              }
              break
            case 'message_stop':
              if (!doneEmitted) { doneEmitted = true; yield { type: 'done' } }
              break
          }
        } catch { /* skip parse errors */ }
      }
    }
    if (!doneEmitted) { yield { type: 'done' } }
  }
}
