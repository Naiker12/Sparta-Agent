import type { MemoryEntry } from '@/interfaces'

const COLLECTION_NAME = 'sparta_memory'

let _baseUrl = 'http://localhost:8000'
let _connected = false
let _collectionId: string | null = null

export function setBaseUrl(url: string): void {
  _baseUrl = url.replace(/\/+$/, '')
}

async function api(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${_baseUrl}/api/v1${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options?.headers,
    },
  })
}

export async function connect(): Promise<boolean> {
  try {
    const res = await api('/heartbeat')
    _connected = res.ok
    return _connected
  } catch {
    _connected = false
    return false
  }
}

export function isConnected(): boolean {
  return _connected
}

export async function getOrCreateCollection(): Promise<{ id: string } | null> {
  if (!_connected) return null

  try {
    const listRes = await api('/collections')
    if (listRes.ok) {
      const collections = await listRes.json()
      const existing = collections.find((c: { name: string }) => c.name === COLLECTION_NAME)
      if (existing) {
        _collectionId = existing.id
        return existing
      }
    }
  } catch { /* collection may not exist yet */ }

  try {
    const res = await api('/collections', {
      method: 'POST',
      body: JSON.stringify({ name: COLLECTION_NAME }),
    })
    if (res.ok) {
      const col = await res.json()
      _collectionId = col.id
      return col
    }
  } catch { /* creation failed */ }

  return null
}

async function ensureCollection(): Promise<string | null> {
  if (!_connected) return null
  if (_collectionId) return _collectionId
  const col = await getOrCreateCollection()
  return col?.id ?? null
}

export async function addEntry(
  entry: MemoryEntry,
  embedding: number[],
): Promise<boolean> {
  const colId = await ensureCollection()
  if (!colId) return false

  try {
    const res = await api(`/collections/${colId}/add`, {
      method: 'POST',
      body: JSON.stringify({
        ids: [entry.id],
        embeddings: [embedding],
        metadatas: [{
          content: entry.content,
          source: entry.source,
          category: entry.category ?? '',
          projectId: entry.projectId ?? '',
          sourceSessionId: entry.sourceSessionId ?? '',
          sourceMessageId: entry.sourceMessageId ?? '',
          createdAt: entry.createdAt,
        }],
        documents: [entry.content],
      }),
    })
    return res.ok
  } catch (err) {
    console.error('[chroma] addEntry failed:', err)
    return false
  }
}

export async function updateEntry(
  entryId: string,
  content: string,
  embedding: number[],
): Promise<boolean> {
  const colId = await ensureCollection()
  if (!colId) return false

  try {
    const res = await api(`/collections/${colId}/update`, {
      method: 'POST',
      body: JSON.stringify({
        ids: [entryId],
        embeddings: [embedding],
        metadatas: [{ content }],
        documents: [content],
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function deleteEntry(entryId: string): Promise<boolean> {
  const colId = await ensureCollection()
  if (!colId) return false

  try {
    const res = await api(`/collections/${colId}/delete`, {
      method: 'POST',
      body: JSON.stringify({ ids: [entryId] }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function search(
  queryEmbedding: number[],
  k = 5,
): Promise<{ id: string; content: string; metadata: Record<string, unknown>; distance: number }[]> {
  const colId = await ensureCollection()
  if (!colId) return []

  try {
    const res = await api(`/collections/${colId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        query_embeddings: [queryEmbedding],
        n_results: k,
        include: ['documents', 'metadatas', 'distances'],
      }),
    })
    if (!res.ok) return []
    const data = await res.json()

    const ids: string[] = data.ids?.[0] ?? []
    const docs: string[] = data.documents?.[0] ?? []
    const metas: Record<string, unknown>[] = data.metadatas?.[0] ?? []
    const distances: number[] = data.distances?.[0] ?? []

    return ids.map((id, i) => ({
      id,
      content: docs[i] ?? '',
      metadata: metas[i] ?? {},
      distance: distances[i] ?? 1,
    }))
  } catch {
    return []
  }
}

export async function count(): Promise<number> {
  const colId = await ensureCollection()
  if (!colId) return 0
  try {
    const res = await api(`/collections/${colId}/count`)
    if (!res.ok) return 0
    const data = await res.json()
    return typeof data === 'number' ? data : 0
  } catch {
    return 0
  }
}

export async function deleteAll(): Promise<boolean> {
  const colId = await ensureCollection()
  if (!colId) return false
  try {
    const res = await api(`/collections/${colId}/delete`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    return res.ok
  } catch {
    return false
  }
}
