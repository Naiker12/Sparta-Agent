import type { MemoryEntry, MemoryGraphNode, MemoryRelation } from '@/types'

function fibonacciSphere(count: number, total: number, sphereRadius: number): { x: number; y: number; z: number } {
  const goldenRatio = (1 + Math.sqrt(5)) / 2
  const theta = 2 * Math.PI * count / goldenRatio
  const phi = Math.acos(1 - 2 * (count + 0.5) / Math.max(1, total))
  return {
    x: sphereRadius * Math.sin(phi) * Math.cos(theta),
    y: sphereRadius * Math.sin(phi) * Math.sin(theta),
    z: sphereRadius * Math.cos(phi),
  }
}

export function computeGraphLayout(
  entries: MemoryEntry[],
  existingNodes?: Map<string, MemoryGraphNode>
): MemoryGraphNode[] {
  const n = entries.length
  if (n === 0) return []
  const sphereRadius = Math.max(6, Math.min(16, n * 1.2))
  const result: MemoryGraphNode[] = []

  for (let i = 0; i < n; i++) {
    const entry = entries[i]
    if (existingNodes?.has(entry.id)) {
      result.push(existingNodes.get(entry.id)!)
      continue
    }
    const position = fibonacciSphere(i, n, sphereRadius)
    result.push({
      memoryId: entry.id,
      position,
      radius: Math.max(0.3, Math.min(0.8, entry.content.length / 200)),
      color: entry.source === 'auto' ? 'accent' : 'status-ok',
    })
  }
  return result
}

export function computeRelations(
  entries: MemoryEntry[],
  storedRelations: MemoryRelation[]
): MemoryRelation[] {
  const relations: MemoryRelation[] = [...storedRelations]

  const categories = new Map<string, string[]>()
  for (const entry of entries) {
    const cat = entry.category || '__none__'
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

export function getNewNodePositions(
  newEntryIds: string[],
  allEntries: MemoryEntry[],
  existingNodes: Map<string, MemoryGraphNode>
): MemoryGraphNode[] {
  return newEntryIds.map((id) => {
    const entry = allEntries.find((e) => e.id === id)
    if (!entry) return null
    const relatedIds = allEntries
      .filter((e) => e.id !== id && e.category === entry.category)
      .map((e) => e.id)
    const relatedNode = relatedIds
      .map((rid) => existingNodes.get(rid))
      .find(Boolean)
    let position: { x: number; y: number; z: number }
    if (relatedNode) {
      const angle = Math.random() * Math.PI * 2
      const dist = 2.5
      position = {
        x: relatedNode.position.x + Math.cos(angle) * dist,
        y: relatedNode.position.y + Math.sin(angle) * dist,
        z: relatedNode.position.z + (Math.random() - 0.5) * dist,
      }
    } else {
      const fallbackRadius = Math.max(6, Math.min(16, allEntries.length * 1.2))
      position = fibonacciSphere(existingNodes.size, Math.max(existingNodes.size + 1, allEntries.length), fallbackRadius)
    }
    return {
      memoryId: id,
      position,
      radius: Math.max(0.3, Math.min(0.8, entry.content.length / 200)),
      color: entry.source === 'auto' ? 'accent' : 'status-ok',
    }
  }).filter(Boolean) as MemoryGraphNode[]
}
