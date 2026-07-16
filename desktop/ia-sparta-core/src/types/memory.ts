export interface MemoryEntry {
  id: string
  content: string
  source: 'manual' | 'auto'
  category?: string
  createdAt: number
  projectId?: string
  sourceSessionId?: string
  sourceMessageId?: string
}

export type RelationType = 'same_category' | 'same_project' | 'same_session' | 'manual' | 'entity_relation' | 'semantic_relation'

export interface MemoryRelation {
  fromId: string
  toId: string
  type: RelationType
  weight: number
  entityType?: string
}

export interface MemoryGraphNode {
  memoryId: string
  position: { x: number; y: number; z: number }
  radius: number
  color: string
}

export interface MemoryGraph {
  nodes: MemoryGraphNode[]
  relations: MemoryRelation[]
}

export interface ExtractedMemory {
  entities: { name: string; category?: string }[]
  facts: { content: string; aboutEntity?: string }[]
  relations: { from: string; to: string; type: string; weight: number }[]
}
