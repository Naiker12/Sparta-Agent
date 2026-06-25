export interface MemoryEntry {
  id: string
  content: string
  source: 'manual' | 'auto'
  category?: string
  createdAt: number
  projectId?: string
}
