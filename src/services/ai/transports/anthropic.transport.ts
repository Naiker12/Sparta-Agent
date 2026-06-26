import { BaseTransport } from './base'
import type { ProviderVendor, ModelInfo, ChatRequest, ChatStreamChunk } from '@/interfaces'

export class AnthropicTransport extends BaseTransport {
  readonly vendor: ProviderVendor = 'anthropic'
  readonly kind = 'cloud' as const

  constructor(private apiKey: string) {
    super()
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        system: req.system,
        max_tokens: req.maxTokens ?? 4096,
        stream: true,
      }),
    })
    if (!res.ok) {
      yield { type: 'error', error: `HTTP ${res.status}` }
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
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const json = trimmed.slice(5).trim()
        if (json === '[DONE]') { yield { type: 'done' }; continue }
        try {
          const parsed = JSON.parse(json)
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield { type: 'content_token', delta: parsed.delta.text }
          }
        } catch { /* skip parse errors */ }
      }
    }
    yield { type: 'done' }
  }
}
