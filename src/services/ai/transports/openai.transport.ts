import { BaseTransport } from './base'
import type { ProviderVendor, ModelInfo, ChatRequest, ChatStreamChunk } from '@/interfaces'

const API_BASE: Record<string, string> = {
  openai: 'https://api.openai.com',
  groq: 'https://api.groq.com/openai',
  mistral: 'https://api.mistral.ai',
  deepseek: 'https://api.deepseek.com',
  together: 'https://api.together.xyz',
  fireworks: 'https://api.fireworks.ai/inference',
  openrouter: 'https://openrouter.ai/api',
  cohere: 'https://api.cohere.ai',
  perplexity: 'https://api.perplexity.ai',
  xai: 'https://api.x.ai',
}

export class ChatCompletionsTransport extends BaseTransport {
  readonly vendor: ProviderVendor
  readonly kind = 'cloud' as const
  private baseUrl: string

  constructor(vendor: ProviderVendor, private apiKey: string, serverUrl?: string) {
    super()
    this.vendor = vendor
    this.baseUrl = serverUrl || API_BASE[vendor] || 'https://api.openai.com'
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return (data.data || []).map((m: { id: string }) => ({
      id: m.id,
      name: m.id,
      vendor: this.vendor,
      providerId: this.vendor,
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
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model,
        messages: [
          ...(req.system ? [{ role: 'system' as const, content: req.system }] : []),
          ...req.messages,
        ],
        stream: true,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.7,
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
          const choice = parsed.choices?.[0]
          if (choice?.delta?.content) {
            yield { type: 'content_token', delta: choice.delta.content }
          }
          if (choice?.delta?.reasoning_content) {
            yield { type: 'thinking_token', delta: choice.delta.reasoning_content }
          }
          if (choice?.finish_reason === 'stop' || choice?.finish_reason === 'end_turn') {
            yield { type: 'done' }
          }
        } catch { /* skip parse errors */ }
      }
    }
    yield { type: 'done' }
  }
}
