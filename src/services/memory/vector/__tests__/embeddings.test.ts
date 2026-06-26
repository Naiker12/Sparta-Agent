import { describe, it, expect, beforeEach } from 'vitest'
import { setActiveProvider, getActiveProvider, getEmbeddingModelLabel } from '../embeddings'

describe('embeddings provider config', () => {
  beforeEach(() => {
    setActiveProvider(null)
  })

  it('setActiveProvider stores provider', () => {
    setActiveProvider({ vendor: 'openai', apiKey: 'sk-test' })
    const p = getActiveProvider()
    expect(p).toEqual({ vendor: 'openai', apiKey: 'sk-test' })
  })

  it('getActiveProvider returns null when not configured', () => {
    expect(getActiveProvider()).toBeNull()
  })

  it('getEmbeddingModelLabel returns label for OpenAI', () => {
    setActiveProvider({ vendor: 'openai', apiKey: 'sk-test' })
    expect(getEmbeddingModelLabel()).toContain('OpenAI')
    expect(getEmbeddingModelLabel()).toContain('text-embedding-3-small')
  })

  it('getEmbeddingModelLabel returns label for Ollama', () => {
    setActiveProvider({ vendor: 'ollama', serverUrl: 'http://localhost:11434' })
    expect(getEmbeddingModelLabel()).toContain('Ollama')
    expect(getEmbeddingModelLabel()).toContain('nomic-embed-text')
  })

  it('getEmbeddingModelLabel returns vendor when unknown', () => {
    setActiveProvider({ vendor: 'anthropic' })
    expect(getEmbeddingModelLabel()).toBe('anthropic')
  })

  it('getEmbeddingModelLabel returns No disponible when null', () => {
    expect(getEmbeddingModelLabel()).toBe('No disponible')
  })
})

describe('semantic-search buildMemoryContext', () => {
  it('returns empty string for empty results', async () => {
    const { buildMemoryContext } = await import('../semantic-search')
    const result = await buildMemoryContext('test', 5)
    expect(result).toBe('')
  })
})
