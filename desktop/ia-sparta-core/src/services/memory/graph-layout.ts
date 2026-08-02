import type { MemoryEntry, MemoryRelation } from '../../types'

const ENTITY_KEYWORDS = [
  'gmail', 'onedrive', 'notion', 'fetch', 'filesystem', 'vite', 'electron',
  'python', 'mcp', 'token', 'settings', 'chat', 'agente', 'memory', 'modelos',
  'openrouter', 'api', 'key', 'oauth', 'sparta', 'powershell', 'git', 'docker',
  'terminal', 'react', 'd3', 'chroma', 'vault', 'ipc'
]

function extractEntities(content: string): Set<string> {
  const found = new Set<string>()
  const text = content.toLowerCase()
  for (const kw of ENTITY_KEYWORDS) {
    if (text.includes(kw)) {
      found.add(kw)
    }
  }
  return found
}

export function computeRelations(
  entries: MemoryEntry[],
  storedRelations: MemoryRelation[]
): MemoryRelation[] {
  const relations: MemoryRelation[] = [...storedRelations]
  const existingPairSet = new Set<string>()
  const nodeEdgeCount = new Map<string, number>()

  for (const r of relations) {
    existingPairSet.add(`${r.fromId}:${r.toId}`)
    existingPairSet.add(`${r.toId}:${r.fromId}`)
    nodeEdgeCount.set(r.fromId, (nodeEdgeCount.get(r.fromId) ?? 0) + 1)
    nodeEdgeCount.set(r.toId, (nodeEdgeCount.get(r.toId) ?? 0) + 1)
  }

  function addEdge(fromId: string, toId: string, type: string, weight: number, maxEdgesPerNode = 4) {
    if (fromId === toId) return
    const countA = nodeEdgeCount.get(fromId) ?? 0
    const countB = nodeEdgeCount.get(toId) ?? 0
    if (countA >= maxEdgesPerNode || countB >= maxEdgesPerNode) return

    const key1 = `${fromId}:${toId}`
    const key2 = `${toId}:${fromId}`
    if (existingPairSet.has(key1) || existingPairSet.has(key2)) return
    existingPairSet.add(key1)
    existingPairSet.add(key2)
    nodeEdgeCount.set(fromId, countA + 1)
    nodeEdgeCount.set(toId, countB + 1)
    relations.push({ fromId, toId, type: type as any, weight })
  }

  // 1. Cadena secuencial por sesión (Constelación lineal)
  const sessions = new Map<string, MemoryEntry[]>()
  for (const entry of entries) {
    if (!entry.sourceSessionId) continue
    if (!sessions.has(entry.sourceSessionId)) sessions.set(entry.sourceSessionId, [])
    sessions.get(entry.sourceSessionId)!.push(entry)
  }
  for (const [, sessionEntries] of sessions) {
    const sorted = [...sessionEntries].sort((a, b) => a.createdAt - b.createdAt)
    for (let i = 0; i < sorted.length - 1; i++) {
      addEdge(sorted[i].id, sorted[i + 1].id, 'same_session', 0.95, 3)
    }
  }

  // 2. Enlaces por entidad compartida (Constelación estelar adyacente, max 2 enlaces por cluster)
  const entityMap = new Map<string, MemoryEntry[]>()
  for (const entry of entries) {
    const ents = extractEntities(entry.content)
    for (const ent of ents) {
      if (!entityMap.has(ent)) entityMap.set(ent, [])
      entityMap.get(ent)!.push(entry)
    }
  }
  for (const [, entEntries] of entityMap) {
    for (let i = 0; i < entEntries.length - 1; i++) {
      addEdge(entEntries[i].id, entEntries[i + 1].id, 'shared_entity', 0.75, 4)
    }
  }

  // 3. Enlaces por misma categoría (Líneas maestras entre vecinos inmediatos)
  const categories = new Map<string, MemoryEntry[]>()
  for (const entry of entries) {
    const cat = entry.category || 'hecho'
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(entry)
  }
  for (const [, catEntries] of categories) {
    for (let i = 0; i < catEntries.length - 1; i++) {
      addEdge(catEntries[i].id, catEntries[i + 1].id, 'same_category', 0.5, 4)
    }
  }

  return relations.filter((r) => r.weight >= 0.05)
}
