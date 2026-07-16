import type { MemoryEntry, MemoryRelation } from 'ia-sparta-core'

export function computeRelations(
  entries: MemoryEntry[],
  storedRelations: MemoryRelation[]
): MemoryRelation[] {
  const relations: MemoryRelation[] = [...storedRelations]

  const categories = new Map<string, string[]>()
  for (const entry of entries) {
    const cat = entry.category || '__none__'
    if (cat === 'conversation_turn') continue
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(entry.id)
  }
  for (const [, ids] of categories) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (!relations.some((r) => r.fromId === ids[i] && r.toId === ids[j] || r.fromId === ids[j] && r.toId === ids[i])) {
          relations.push({ fromId: ids[i], toId: ids[j], type: 'same_category', weight: 0.6 })
        }
      }
    }
  }

  const projects = new Map<string, string[]>()
  for (const entry of entries) {
    if (!entry.projectId) continue
    if (!projects.has(entry.projectId)) projects.set(entry.projectId, [])
    projects.get(entry.projectId)!.push(entry.id)
  }
  for (const [, ids] of projects) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (!relations.some((r) => r.fromId === ids[i] && r.toId === ids[j] || r.fromId === ids[j] && r.toId === ids[i])) {
          relations.push({ fromId: ids[i], toId: ids[j], type: 'same_project', weight: 0.8 })
        }
      }
    }
  }

  return relations.filter((r) => r.weight >= 0.05)
}
