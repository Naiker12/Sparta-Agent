import type { MemoryEntry, MemoryGraphNode, MemoryRelation } from '@/types'

export function computeGraphLayout(entries: MemoryEntry[]): MemoryGraphNode[] {
  const n = entries.length
  if (n === 0) return []

  const goldenRatio = (1 + Math.sqrt(5)) / 2
  const sphereRadius = 8

  return entries.map((entry, i) => {
    const theta = 2 * Math.PI * i / goldenRatio
    const phi = Math.acos(1 - 2 * (i + 0.5) / n)

    return {
      memoryId: entry.id,
      position: {
        x: sphereRadius * Math.sin(phi) * Math.cos(theta),
        y: sphereRadius * Math.sin(phi) * Math.sin(theta),
        z: sphereRadius * Math.cos(phi),
      },
      radius: Math.max(0.3, Math.min(0.8, entry.content.length / 200)),
      color: entry.source === 'auto' ? 'accent' : 'status-ok',
    }
  })
}

export function computeRelations(entries: MemoryEntry[]): MemoryRelation[] {
  const relations: MemoryRelation[] = []
  const categories = new Map<string, string[]>()

  for (const entry of entries) {
    const cat = entry.category || '__none__'
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(entry.id)
  }

  for (const [, ids] of categories) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        relations.push({
          fromId: ids[i],
          toId: ids[j],
          type: 'same_category',
          weight: 0.6,
        })
      }
    }
  }

  const projects = new Map<string, string[]>()
  for (const entry of entries) {
    const proj = entry.projectId || '__default__'
    if (!projects.has(proj)) projects.set(proj, [])
    projects.get(proj)!.push(entry.id)
  }

  for (const [, ids] of projects) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (!relations.some((r) => (r.fromId === ids[i] && r.toId === ids[j]) || (r.fromId === ids[j] && r.toId === ids[i]))) {
          relations.push({
            fromId: ids[i],
            toId: ids[j],
            type: 'same_project',
            weight: 0.8,
          })
        }
      }
    }
  }

  return relations
}
