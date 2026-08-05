import { describe, it, expect, vi } from 'vitest'
import { AnthropicTransport } from '../anthropic.transport'
import { ChatCompletionsTransport } from '../openai.transport'
import { OllamaTransport } from '../ollama.transport'
import { HTTP_STATUS_MESSAGES, isRetryable } from '../http-utils'
import type { ChatRequest } from 'ia-sparta-core'

const sampleReq: ChatRequest = {
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Hello' }],
  system: 'You are a helpful assistant.',
  stream: true,
  maxTokens: 4096,
  temperature: 0.7,
}

describe('AnthropicTransport', () => {
  const transport = new AnthropicTransport('sk-ant-test123')

  it('buildHeaders returns Anthropic-specific headers', () => {
    const headers = transport.buildHeaders()
    expect(headers['x-api-key']).toBe('sk-ant-test123')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['content-type']).toBe('application/json')
    expect(headers['Authorization']).toBeUndefined()
  })

  it('buildBody returns correct structure', () => {
    const body = transport.buildBody(sampleReq)
    expect(body.model).toBe('claude-3-5-sonnet-20241022')
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }])
    expect(body.system).toBe('You are a helpful assistant.')
    expect(body.max_tokens).toBe(4096)
    expect(body.stream).toBe(true)
  })

  it('buildBody omits system when undefined', () => {
    const body = transport.buildBody({ ...sampleReq, system: undefined })
    expect(body.system).toBeUndefined()
  })

  it('buildBody formats tools for Anthropic correctly', () => {
    const body = transport.buildBody({
      ...sampleReq,
      tools: [{ name: 'web_search', description: 'Busca en la web', inputSchema: { type: 'object' } }],
    })
    expect(body.tools).toEqual([
      { name: 'web_search', description: 'Busca en la web', input_schema: { type: 'object' } },
    ])
  })
})

describe('ChatCompletionsTransport', () => {
  const transport = new ChatCompletionsTransport('openai', 'sk-openai-test')

  it('buildHeaders returns Bearer auth', () => {
    const headers = transport.buildHeaders()
    expect(headers['Authorization']).toBe('Bearer sk-openai-test')
    expect(headers['content-type']).toBe('application/json')
    expect(headers['x-api-key']).toBeUndefined()
  })

  it('buildBody includes system message in messages array', () => {
    const body = transport.buildBody(sampleReq)
    expect(body.model).toBe('claude-3-5-sonnet-20241022')
    expect((body.messages as { role: string; content: string }[])).toHaveLength(2)
    expect((body.messages as { role: string; content: string }[])[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' })
    expect((body.messages as { role: string; content: string }[])[1]).toEqual({ role: 'user', content: 'Hello' })
    expect(body.stream).toBe(true)
    expect(body.max_tokens).toBe(4096)
    expect(body.temperature).toBe(0.7)
  })

  it('buildBody formats tools for OpenAI function calling schema', () => {
    const body = transport.buildBody({
      ...sampleReq,
      tools: [{ name: 'web_search', description: 'Busca en la web', inputSchema: { type: 'object' } }],
    })
    expect(body.functions).toEqual([
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Busca en la web',
          parameters: { type: 'object' },
        },
      },
    ])
    expect(body.function_call).toBe('auto')
  })

  it('buildBody omits system message when not set', () => {
    const body = transport.buildBody({ ...sampleReq, system: undefined })
    expect((body.messages as { role: string; content: string }[])).toHaveLength(1)
    expect((body.messages as { role: string; content: string }[])[0].role).toBe('user')
  })
})

describe('ChatCompletionsTransport with serverUrl override', () => {
  const transport = new ChatCompletionsTransport('openai', 'sk-test', 'https://my-proxy.example.com')

  it('buildHeaders still returns Bearer auth', () => {
    const headers = transport.buildHeaders()
    expect(headers['Authorization']).toBe('Bearer sk-test')
  })
})

describe('OpenRouter reasoning controls', () => {
  it('passes the selected reasoning effort for compatible models', () => {
    const transport = new ChatCompletionsTransport('openrouter', 'sk-or-test')
    const body = transport.buildBody({ ...sampleReq, thinkingEnabled: true, reasoningEffort: 'high' })

    expect(body.reasoning).toEqual({ effort: 'high' })
  })
})

describe('Gemini OpenAI-compatible transport', () => {
  const transport = new ChatCompletionsTransport('google', 'AIza-test')

  it('uses the Gemini compatibility endpoint instead of OpenAI', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    for await (const _chunk of transport.streamChat(sampleReq)) { /* exhaust stream */ }

    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer AIza-test' }) }),
    )
    vi.unstubAllGlobals()
  })
})

describe('OllamaTransport', () => {
  const transport = new OllamaTransport('http://localhost:11434')

  it('buildHeaders returns content-type only (no auth)', () => {
    const headers = transport.buildHeaders()
    expect(headers['content-type']).toBe('application/json')
    expect(headers['Authorization']).toBeUndefined()
    expect(headers['x-api-key']).toBeUndefined()
  })

  it('buildBody returns correct Ollama structure', () => {
    const body = transport.buildBody(sampleReq)
    expect(body.model).toBe('claude-3-5-sonnet-20241022')
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }])
    expect(body.stream).toBe(true)
  })
})

describe('HTTP status messages', () => {
  it('maps 401 to key error', () => {
    expect(HTTP_STATUS_MESSAGES[401]).toBe('API key inválida o expirada.')
  })

  it('maps 429 to rate limit', () => {
    expect(HTTP_STATUS_MESSAGES[429]).toBe('Rate limit del proveedor.')
  })

  it('maps 529 to overload', () => {
    expect(HTTP_STATUS_MESSAGES[529]).toBe('Proveedor sobrecargado.')
  })
})

describe('isRetryable', () => {
  it('returns true for 429', () => {
    expect(isRetryable(429)).toBe(true)
  })

  it('returns true for 529', () => {
    expect(isRetryable(529)).toBe(true)
  })

  it('returns false for 401', () => {
    expect(isRetryable(401)).toBe(false)
  })

  it('returns false for 200', () => {
    expect(isRetryable(200)).toBe(false)
  })
})
