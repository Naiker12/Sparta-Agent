export interface MemoryEntry {
  id: string
  content: string
  source: 'manual' | 'auto'
  category?: string
  createdAt: number
  projectId?: string
}

export interface MemoryRelation {
  fromId: string
  toId: string
  type: 'same_category' | 'same_project' | 'same_session' | 'manual'
  weight: number
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
