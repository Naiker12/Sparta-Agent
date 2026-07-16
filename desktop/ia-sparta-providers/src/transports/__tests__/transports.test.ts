import { describe, it, expect } from 'vitest'
import { AnthropicTransport } from '../anthropic.transport'
import { ChatCompletionsTransport } from '../openai.transport'
import { OllamaTransport } from '../ollama.transport'
import { HTTP_STATUS_MESSAGES, isRetryable } from '../http-utils'
import type { ChatRequest } from '@/types'

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
