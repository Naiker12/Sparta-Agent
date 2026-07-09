import type { MemoryEntry } from '@/types'

let _sidecarBaseUrl = ''

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.sparta?.memoryIndex
}

function getSidecarBaseUrl(): string {
  if (_sidecarBaseUrl) return _sidecarBaseUrl
  const fromEnv = import.meta.env.VITE_SIDECAR_HTTP_URL as string | undefined
  if (fromEnv) return fromEnv
  const host = (import.meta.env.VITE_SIDECAR_HOST as string) || 'localhost'
  const port = (import.meta.env.VITE_SIDECAR_HTTP_PORT as string) || '8765'
  return `http://${host}:${port}`
}

export function setBaseUrl(url: string): void {
  _sidecarBaseUrl = url.replace(/\/+$/, '')
}

async function sidecarFetch(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${getSidecarBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
  return res.json()
}

export async function connect(): Promise<boolean> {
  if (isElectron()) {
    try {
      const status = await window.sparta!.isSidecarReady()
      return status.ready
    } catch {
      return false
    }
  }
  try {
    const res = await fetch(`${getSidecarBaseUrl()}/health`)
    return res.ok
  } catch {
    return false
  }
}

export function isConnected(): boolean {
  // Best-effort: the sidecar is considered connected if the bridge is available.
  return isElectron() ? !!window.sparta : true
}

export async function addEntry(entry: MemoryEntry): Promise<boolean> {
  if (isElectron()) {
    const result = await window.sparta!.memoryIndex(entry as unknown as Record<string, unknown>)
    return result.ok
  }
  const result = await sidecarFetch('/api/memory/index', { entry }) as { ok: boolean }
  return result.ok
}

export async function updateEntry(
  entryId: string,
  content: string,
): Promise<boolean> {
  // Chroma update semantics are implemented as a delete + re-add via the sidecar.
  const okDelete = await deleteEntry(entryId)
  if (!okDelete) return false
  const okAdd = await addEntry({
    id: entryId,
    content,
    source: 'manual',
    createdAt: Date.now(),
  })
  return okAdd
}

export async function deleteEntry(entryId: string): Promise<boolean> {
  if (isElectron()) {
    const result = await window.sparta!.memoryDelete(entryId)
    return result.ok
  }
  const result = await sidecarFetch('/api/memory/delete', { entry_id: entryId }) as { ok: boolean }
  return result.ok
}

export async function searchByQuery(
  query: string,
  k = 5,
): Promise<{ id: string; content: string; metadata: Record<string, unknown>; distance: number }[]> {
  if (isElectron()) {
    const result = await window.sparta!.memorySearch(query, k)
    if (!result.ok || !Array.isArray(result.results)) return []
    return (result.results as Array<{ id: string; content: string; metadata?: Record<string, unknown>; score?: number; distance?: number }>)
      .map((r) => ({
        id: r.id,
        content: r.content ?? '',
        metadata: r.metadata ?? {},
        distance: r.distance ?? (1 - (r.score ?? 0)),
      }))
  }
  const result = await sidecarFetch('/api/memory/search', { query, k }) as {
    ok: boolean
    results?: Array<{ id: string; content: string; metadata?: Record<string, unknown>; score?: number; distance?: number }>
  }
  if (!result.ok || !Array.isArray(result.results)) return []
  return result.results.map((r) => ({
    id: r.id,
    content: r.content ?? '',
    metadata: r.metadata ?? {},
    distance: r.distance ?? (1 - (r.score ?? 0)),
  }))
}

export async function count(): Promise<number> {
  if (isElectron()) {
    const result = await window.sparta!.memoryCount()
    return result.ok ? (result.count ?? 0) : 0
  }
  const result = await sidecarFetch('/api/memory/count', {}) as { ok: boolean; count?: number }
  return result.ok ? (result.count ?? 0) : 0
}

export async function deleteAll(): Promise<boolean> {
  // Deleting all entries requires listing them first; for now this is not
  // exposed through the sidecar bridge and returns false to keep the surface
  // small. Callers should delete entries individually via deleteEntry.
  return false
}
