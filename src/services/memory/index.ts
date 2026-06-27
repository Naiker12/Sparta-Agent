import type { MemoryEntry, ProviderVendor } from '@/types'
import { connect as chromaConnect, addEntry as chromaAdd, getIndexedCount as chromaCount, isConnected } from './vector'
import { setActiveProvider, embed } from './vector/embeddings'

export interface VectorConfig {
  enabled: boolean
  provider?: {
    vendor: ProviderVendor
    apiKey?: string
    serverUrl?: string
  }
}

let _vectorConfig: VectorConfig = { enabled: false }

export function configureVector(config: VectorConfig): void {
  _vectorConfig = config
  if (config.provider) {
    setActiveProvider(config.provider)
  }
}

export function isVectorEnabled(): boolean {
  return _vectorConfig.enabled && isConnected()
}

export function tryAutoConfigure(providers: { vendor: ProviderVendor; apiKey?: string; serverUrl?: string }[]): boolean {
  if (_vectorConfig.enabled) return true
  const openai = providers.find((p) => p.vendor === 'openai')
  if (openai?.apiKey) {
    configureVector({ enabled: true, provider: { vendor: 'openai', apiKey: openai.apiKey } })
    return true
  }
  const ollama = providers.find((p) => p.vendor === 'ollama')
  if (ollama?.serverUrl) {
    configureVector({ enabled: true, provider: { vendor: 'ollama', serverUrl: ollama.serverUrl } })
    return true
  }
  return false
}

export async function ensureVectorReady(): Promise<boolean> {
  if (!_vectorConfig.enabled) return false
  const ok = await chromaConnect()
  return ok
}

export async function indexInChroma(entry: MemoryEntry): Promise<boolean> {
  if (!_vectorConfig.enabled) return false
  const ok = await chromaConnect()
  if (!ok) return false

  const embedding = await embed(entry.content)
  if (!embedding) return false

  return chromaAdd(entry, embedding)
}

export async function getIndexedCount(): Promise<number> {
  if (!_vectorConfig.enabled) return 0
  const ok = await chromaConnect()
  if (!ok) return 0
  return chromaCount()
}

export { semanticSearch, buildMemoryContext } from './vector/semantic-search'
export type { SemanticSearchResult } from './vector/semantic-search'
