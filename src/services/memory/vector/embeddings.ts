import type { ProviderVendor } from '@/types'

interface EmbeddingProvider {
  vendor: ProviderVendor
  apiKey?: string
  serverUrl?: string
}

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
const OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text'

let _activeProvider: EmbeddingProvider | null = null

export function setActiveProvider(provider: EmbeddingProvider | null): void {
  _activeProvider = provider
}

export function getActiveProvider(): EmbeddingProvider | null {
  return _activeProvider
}

async function openaiEmbed(texts: string[], apiKey: string): Promise<number[][] | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_EMBEDDING_MODEL,
        input: texts,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data
      .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
      .map((d: { embedding: number[] }) => d.embedding)
  } catch {
    return null
  }
}

async function ollamaEmbed(texts: string[], serverUrl: string): Promise<number[][] | null> {
  try {
    const results: number[][] = []
    for (const text of texts) {
      const res = await fetch(`${serverUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_EMBEDDING_MODEL, prompt: text }),
      })
      if (!res.ok) return null
      const data = await res.json()
      results.push(data.embedding)
    }
    return results
  } catch {
    return null
  }
}

export async function embed(text: string): Promise<number[] | null> {
  const provider = _activeProvider
  if (!provider) return null

  if (provider.vendor === 'openai' && provider.apiKey) {
    const result = await openaiEmbed([text], provider.apiKey)
    if (result) return result[0]
  }

  if (provider.vendor === 'ollama' && provider.serverUrl) {
    const result = await ollamaEmbed([text], provider.serverUrl)
    if (result) return result[0]
  }

  return null
}

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return []

  const provider = _activeProvider
  if (!provider) return texts.map(() => null)

  if (provider.vendor === 'openai' && provider.apiKey) {
    const result = await openaiEmbed(texts, provider.apiKey)
    if (result) return result
  }

  if (provider.vendor === 'ollama' && provider.serverUrl) {
    const result = await ollamaEmbed(texts, provider.serverUrl)
    if (result) return result
  }

  return texts.map(() => null)
}

export function getEmbeddingModelLabel(): string {
  const provider = _activeProvider
  if (!provider) return 'No disponible'
  if (provider.vendor === 'openai') return `OpenAI ${OPENAI_EMBEDDING_MODEL}`
  if (provider.vendor === 'ollama') return `Ollama ${OLLAMA_EMBEDDING_MODEL}`
  return provider.vendor
}
