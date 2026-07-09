import type { MemoryEntry } from '@/types'
import { connect as sidecarConnect, addEntry as sidecarAdd, getIndexedCount as sidecarCount, isConnected } from './vector'

export interface VectorConfig {
  enabled: boolean
  provider?: {
    vendor: string
    apiKey?: string
    serverUrl?: string
  }
}

let _vectorConfig: VectorConfig = { enabled: false }

export function configureVector(config: VectorConfig): void {
  _vectorConfig = config
  // Embedding computation is now centralized in the Python sidecar; the
  // provider field here is ignored but kept for API compatibility.
}

export function isVectorEnabled(): boolean {
  return _vectorConfig.enabled && isConnected()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function tryAutoConfigure(_providers: { vendor: string; apiKey?: string; serverUrl?: string }[]): boolean {
  if (_vectorConfig.enabled) return true
  // The sidecar computes embeddings locally; we just need the user to have
  // semantic memory enabled. Auto-configure if Chroma/sidecar is reachable.
  configureVector({ enabled: true })
  return true
}

export async function ensureVectorReady(): Promise<boolean> {
  if (!_vectorConfig.enabled) return false
  return sidecarConnect()
}

export async function indexInChroma(entry: MemoryEntry): Promise<boolean> {
  if (!_vectorConfig.enabled) return false
  const ok = await sidecarConnect()
  if (!ok) return false
  const normalized = {
    id: entry.id,
    content: entry.content,
    memory_type: entry.category ?? entry.source ?? 'general',
    tags: entry.category ? [entry.category] : [],
    timestamp: entry.createdAt,
  }
  return sidecarAdd(normalized as unknown as MemoryEntry)
}

export async function getIndexedCount(): Promise<number> {
  if (!_vectorConfig.enabled) return 0
  const ok = await sidecarConnect()
  if (!ok) return 0
  return sidecarCount()
}

export { semanticSearch, buildMemoryContext } from './vector/semantic-search'
export type { SemanticSearchResult } from './vector/semantic-search'
export { extractMemory } from './extractor'
