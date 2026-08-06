import { BaseTransport } from './base'
import type { ProviderVendor, ModelInfo, ChatRequest, ChatStreamChunk } from 'ia-sparta-core'
import { HTTP_STATUS_MESSAGES, isRetryable, fetchWithRetry } from './http-utils'

const API_BASE: Record<string, string> = {
  openai: 'https://api.openai.com',
  // Gemini exposes an OpenAI-compatible Chat Completions endpoint.
  google: 'https://generativelanguage.googleapis.com/v1beta/openai',
  groq: 'https://api.groq.com/openai',
  mistral: 'https://api.mistral.ai',
  deepseek: 'https://api.deepseek.com',
  together: 'https://api.together.xyz',
  fireworks: 'https://api.fireworks.ai/inference',
  openrouter: 'https://openrouter.ai/api',
  cohere: 'https://api.cohere.ai',
  perplexity: 'https://api.perplexity.ai',
  xai: 'https://api.x.ai',
  nvidia: 'https://integrate.api.nvidia.com',
}

function normalizeBaseUrl(rawUrl: string): string {
  let url = rawUrl.trim().replace(/\/+$/, '')
  if (url.endsWith('/v1')) {
    url = url.slice(0, -3).replace(/\/+$/, '')
  }
  return url
}

export class ChatCompletionsTransport extends BaseTransport {
  readonly vendor: ProviderVendor
  readonly kind = 'cloud' as const
  private baseUrl: string

  constructor(vendor: ProviderVendor, private apiKey: string, serverUrl?: string) {
    super()
    this.vendor = vendor
    const raw = serverUrl || API_BASE[vendor] || 'https://api.openai.com'
    this.baseUrl = normalizeBaseUrl(raw)
  }

  private getChatCompletionsUrl(): string {
    return this.vendor === 'google'
      ? `${this.baseUrl}/chat/completions`
      : `${this.baseUrl}/v1/chat/completions`
  }

  buildHeaders(): Record<string, string> {
    const cleanKey = (this.apiKey || '').trim().replace(/^["']|["']$/g, '')
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    }
    if (cleanKey) {
      headers.Authorization = `Bearer ${cleanKey}`
    }
    if (this.vendor === 'openrouter' || this.baseUrl.includes('openrouter')) {
      headers['HTTP-Referer'] = 'https://github.com/Naiker12/Sparta-Agent'
      headers['X-Title'] = 'Sparta Agent'
    }
    return headers
  }

  buildBody(req: ChatRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: req.model,
      messages: [
        ...(req.system ? [{ role: 'system' as const, content: req.system }] : []),
        ...req.messages,
      ],
      stream: true,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.7,
    }
    // OpenAI-compatible providers use the standard tools schema for tool definitions.
    if (Array.isArray(req.tools) && req.tools.length > 0) {
      body.tools = req.tools.map((t: any) => {
        if (t.type === 'function' && t.function) return t
        return {
          type: 'function',
          function: {
            name: t.name || t.function?.name || 'tool',
            description: t.description || t.function?.description || '',
            parameters: t.parameters || t.input_schema || t.inputSchema || t.function?.parameters || { type: 'object', properties: {} },
          },
        }
      })
      body.tool_choice = 'auto'
    }
    if (this.vendor === 'openai' && req.thinkingEnabled && req.reasoningEffort && req.reasoningEffort !== 'none') {
      body.reasoning_effort = req.reasoningEffort
    }
    if (this.vendor === 'openrouter' && req.thinkingEnabled && req.reasoningEffort && req.reasoningEffort !== 'none') {
      body.reasoning = { effort: req.reasoningEffort }
    }
    return body
  }

  async listModels(): Promise<ModelInfo[]> {
    if (this.vendor === 'google') {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': this.apiKey.trim() },
      })
      if (!res.ok) throw new Error(HTTP_STATUS_MESSAGES[res.status] ?? `HTTP ${res.status}`)
      const data = await res.json()
      return (data.models || []).map((m: { name: string }) => ({
        id: m.name.replace('models/', ''),
        name: m.name.replace('models/', ''),
        vendor: this.vendor,
        providerId: this.vendor,
      }))
    }
    const res = await fetch(`${this.baseUrl}/v1/models`, {
      headers: this.buildHeaders(),
    })
    if (!res.ok) throw new Error(HTTP_STATUS_MESSAGES[res.status] ?? `HTTP ${res.status}`)
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
    const url = this.getChatCompletionsUrl()
    const headers = this.buildHeaders()
    const body = JSON.stringify(this.buildBody(req))

    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body,
    })

    if (!res.ok) {
      let errorMsg = HTTP_STATUS_MESSAGES[res.status] ?? `HTTP ${res.status}`
      try {
        const errData = await res.json()
        const providerMessage = errData?.error?.message ?? errData?.message ?? errData?.detail
        if (typeof providerMessage === 'string' && providerMessage.trim()) {
          errorMsg = `${errorMsg}: ${providerMessage}`
        } else if (errData?.error?.status) {
          errorMsg = `${errorMsg}: ${errData.error.status}`
        }
      } catch { /* ignore */ }

      yield { type: 'error', error: errorMsg }
      if (isRetryable(res.status)) {
        yield { type: 'error', error: `${errorMsg} — se agotaron los reintentos.` }
      }
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      yield { type: 'error', error: 'No response body' }
      return
    }

    if (this.apiKey) {
      console.debug(`[${this.vendor}] request ${url} key=${this.apiKey.slice(0, 6)}...${this.apiKey.length}`)
    }

    const decoder = new TextDecoder()
    let buffer = ''
    const pendingToolCalls = new Map<number, { id: string; name: string; arguments: string }>()

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
          // OpenRouter unified format: reasoning_details array
          if (choice?.delta?.reasoning_details) {
            const details = Array.isArray(choice.delta.reasoning_details)
              ? choice.delta.reasoning_details.map((d: { text?: string }) => d.text ?? '').join('')
              : String(choice.delta.reasoning_details)
            if (details) {
              yield { type: 'thinking_token', delta: details }
            }
          }
          if (Array.isArray(choice?.delta?.tool_calls)) {
            for (const tc of choice.delta.tool_calls) {
              const index = tc.index ?? 0
              const existing = pendingToolCalls.get(index) ?? { id: '', name: '', arguments: '' }
              if (tc.id) existing.id = tc.id
              if (tc.function?.name) existing.name = tc.function.name
              if (tc.function?.arguments) existing.arguments += tc.function.arguments
              pendingToolCalls.set(index, existing)
            }
          }
          if (choice?.finish_reason === 'tool_calls' || choice?.finish_reason === 'stop' || choice?.finish_reason === 'end_turn') {
            for (const [, callData] of pendingToolCalls) {
              let parsedInput: Record<string, unknown> = {}
              try {
                parsedInput = JSON.parse(callData.arguments || '{}')
              } catch {
                parsedInput = { query: callData.arguments }
              }
              yield {
                type: 'tool_call',
                toolCall: {
                  id: callData.id || `call_${Date.now()}`,
                  toolName: callData.name || 'web_search',
                  input: parsedInput,
                },
              }
            }
            pendingToolCalls.clear()
            yield { type: 'done' }
          }
        } catch { /* skip parse errors */ }
      }
    }

    if (pendingToolCalls.size > 0) {
      for (const [, callData] of pendingToolCalls) {
        let parsedInput: Record<string, unknown> = {}
        try {
          parsedInput = JSON.parse(callData.arguments || '{}')
        } catch {
          parsedInput = { query: callData.arguments }
        }
        yield {
          type: 'tool_call',
          toolCall: {
            id: callData.id || `call_${Date.now()}`,
            toolName: callData.name || 'web_search',
            input: parsedInput,
          },
        }
      }
      pendingToolCalls.clear()
    }
    yield { type: 'done' }
  }
}
