import type { MemoryEntry } from '@/interfaces'

export interface MemoryService {
  addEntry(content: string, source: 'manual' | 'auto', category?: string): MemoryEntry
  deleteEntry(id: string): void
  searchEntries(query: string): MemoryEntry[]
  getAllEntries(): MemoryEntry[]
}

export function createMemoryService(): MemoryService {
  const entries = new Map<string, MemoryEntry>()

  return {
    addEntry(content: string, source: 'manual' | 'auto', category?: string): MemoryEntry {
      const entry: MemoryEntry = {
        id: crypto.randomUUID(),
        content,
        source,
        category,
        createdAt: Date.now(),
      }
      entries.set(entry.id, entry)
      return entry
    },

    deleteEntry(id: string): void {
      entries.delete(id)
    },

    searchEntries(query: string): MemoryEntry[] {
      void query
      return Array.from(entries.values())
    },

    getAllEntries(): MemoryEntry[] {
      return Array.from(entries.values())
    },
  }
}
