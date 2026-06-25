import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MemoryEntry } from '@/types'
import { useEventBus } from './event-bus.store'

interface MemoryState {
  entries: MemoryEntry[]
  addEntry: (content: string, source: 'manual' | 'auto', category?: string, projectId?: string) => string
  updateEntry: (id: string, partial: Partial<MemoryEntry>) => void
  deleteEntry: (id: string) => void
  getActiveCount: () => number
}

const defaultEntries: MemoryEntry[] = [
  {
    id: 'mem-1',
    content: 'El proyecto usa React + TypeScript + Zustand para el estado.',
    source: 'auto',
    category: 'tech-stack',
    createdAt: Date.now(),
    projectId: 'default',
  },
  {
    id: 'mem-2',
    content: 'Prefiere Tailwind CSS para estilos y CSS variables para temas.',
    source: 'auto',
    category: 'preferences',
    createdAt: Date.now(),
    projectId: 'default',
  },
]

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
  entries: defaultEntries,

  addEntry: (content, source, category, projectId) => {
    const id = crypto.randomUUID()
    const entry: MemoryEntry = { id, content, source, category, projectId, createdAt: Date.now() }
    set((s) => ({ entries: [...s.entries, entry] }))
    useEventBus.getState().dispatch({ type: 'memory:added', memoryId: id, timestamp: Date.now() })
    return id
  },

  updateEntry: (id, partial) => {
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, ...partial } : e)),
    }))
    useEventBus.getState().dispatch({ type: 'memory:updated', memoryId: id, timestamp: Date.now() })
  },

  deleteEntry: (id) => {
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
    useEventBus.getState().dispatch({ type: 'memory:deleted', memoryId: id, timestamp: Date.now() })
  },

  getActiveCount: () => get().entries.length,
}),
    { name: 'sparta-memory' }
  )
)
