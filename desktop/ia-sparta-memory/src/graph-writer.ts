import type { MemoryEntry, MemoryRelation, ExtractedMemory } from 'ia-sparta-core'

interface WriterDeps {
  getEntries: () => MemoryEntry[]
  getRelations: () => MemoryRelation[]
  addEntry: (entry: MemoryEntry) => void
  updateEntry: (id: string, partial: Partial<MemoryEntry>) => void
  deleteEntry: (id: string) => void
  addRelation: (rel: MemoryRelation) => void
  updateRelation: (fromId: string, toId: string, partial: Partial<MemoryRelation>) => void
}

function normalizeText(s: string): string {
  return s.toLowerCase().trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function similarity(a: string, b: string): number {
  const dist = levenshtein(normalizeText(a), normalizeText(b))
  const maxLen = Math.max(a.length, b.length)
  return maxLen === 0 ? 1 : 1 - dist / maxLen
}

export function findDuplicateEntry(
  content: string,
  category: string | undefined,
  existing: MemoryEntry[]
): MemoryEntry | null {
  const normalized = normalizeText(content)
  for (const entry of existing) {
    if (normalizeText(entry.content) === normalized) return entry
  }
  if (category) {
    const sameCat = existing.filter((e) => e.category === category)
    for (const entry of sameCat) {
      if (similarity(entry.content, content) > 0.85) return entry
    }
  }
  return null
}

export function updateTrustScore(
  rel: MemoryRelation,
  confirmed: boolean
): MemoryRelation {
  const newWeight = confirmed
    ? Math.min(1, rel.weight + 0.1)
    : Math.max(0, rel.weight - 0.3)
  return { ...rel, weight: newWeight }
}

export function writeExtractedMemory(
  extracted: ExtractedMemory,
  sessionId: string,
  messageId: string,
  deps: WriterDeps
): void {
  const existing = deps.getEntries()
  const entityNameToId = new Map<string, string>()
  let addedCount = 0

  for (const entity of extracted.entities) {
    const dup = findDuplicateEntry(entity.name, entity.category, existing)
    if (dup) {
      entityNameToId.set(entity.name, dup.id)
      continue
    }
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      content: entity.name,
      source: 'auto',
      category: entity.category ?? 'entity',
      createdAt: Date.now(),
      projectId: undefined,
      sourceSessionId: sessionId,
      sourceMessageId: messageId,
    }
    entityNameToId.set(entity.name, entry.id)
    deps.addEntry(entry)
    addedCount++
  }

  for (const fact of extracted.facts) {
    const cat = fact.aboutEntity ? `fact:${fact.aboutEntity}` : 'fact'
    const dup = findDuplicateEntry(fact.content, cat, existing)
    if (dup) {
      const entityName = fact.aboutEntity
      if (entityName && entityNameToId.has(entityName)) {
        const entityId = entityNameToId.get(entityName)!
        const existingRels = deps.getRelations()
        const existingRel = existingRels.find(
          (r) => r.fromId === dup.id && r.toId === entityId
        )
        if (existingRel) {
          deps.updateRelation(dup.id, entityId, updateTrustScore(existingRel, true))
        }
      }
      continue
    }
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      content: fact.content,
      source: 'auto',
      category: cat,
      createdAt: Date.now(),
      projectId: undefined,
      sourceSessionId: sessionId,
      sourceMessageId: messageId,
    }
    deps.addEntry(entry)
    addedCount++

    const entityName = fact.aboutEntity
    if (entityName && entityNameToId.has(entityName)) {
      deps.addRelation({
        fromId: entry.id,
        toId: entityNameToId.get(entityName)!,
        type: 'entity_relation',
        weight: 0.7,
        entityType: 'fact_about',
      })
    }
  }

  for (const rel of extracted.relations) {
    const fromId = entityNameToId.get(rel.from)
    const toId = entityNameToId.get(rel.to)
    if (!fromId || !toId) continue
    const existingRels = deps.getRelations()
    const existingRel = existingRels.find(
      (r) => r.fromId === fromId && r.toId === toId
    )
    if (existingRel) {
      deps.updateRelation(fromId, toId, updateTrustScore(existingRel, true))
    } else {
      deps.addRelation({
        fromId,
        toId,
        type: 'entity_relation',
        weight: Math.min(1, rel.weight),
        entityType: rel.type,
      })
    }
  }

  console.debug(`[memory:writer] Added ${addedCount} new entries from extraction`)
}
