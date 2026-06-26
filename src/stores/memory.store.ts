import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MemoryEntry, MemoryRelation, MemoryGraphNode } from '@/types'
import { useEventBus } from './event-bus.store'
import { computeGraphLayout, computeRelations, getNewNodePositions } from '@/services/memory/graph-layout'

interface MemoryState {
  entries: MemoryEntry[]
  relations: MemoryRelation[]
  graphNodes: MemoryGraphNode[]

  addEntry: (content: string, source: 'manual' | 'auto', category?: string, projectId?: string, sourceSessionId?: string, sourceMessageId?: string) => string
  updateEntry: (id: string, partial: Partial<MemoryEntry>) => void
  deleteEntry: (id: string) => void
  addRelation: (rel: MemoryRelation) => void
  updateRelation: (fromId: string, toId: string, partial: Partial<MemoryRelation>) => void
  removeRelation: (fromId: string, toId: string) => void
  rebuildGraph: () => void
  addEntriesFromExtraction: (entries: MemoryEntry[], relations: MemoryRelation[]) => void
  getActiveCount: () => number
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
  entries: [],
  relations: [],
  graphNodes: [],

  addEntry: (content, source, category, projectId, sourceSessionId, sourceMessageId) => {
    const id = crypto.randomUUID()
    const entry: MemoryEntry = {
      id, content, source, category, projectId,
      sourceSessionId, sourceMessageId,
      createdAt: Date.now(),
    }
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
    set((s) => ({
      entries: s.entries.filter((e) => e.id !== id),
      relations: s.relations.filter((r) => r.fromId !== id && r.toId !== id),
    }))
    useEventBus.getState().dispatch({ type: 'memory:deleted', memoryId: id, timestamp: Date.now() })
  },

  addRelation: (rel) => {
    set((s) => {
      const exists = s.relations.some(
        (r) => r.fromId === rel.fromId && r.toId === rel.toId && r.type === rel.type
      )
      if (exists) return s
      return { relations: [...s.relations, rel] }
    })
  },

  updateRelation: (fromId, toId, partial) => {
    set((s) => ({
      relations: s.relations.map((r) =>
        r.fromId === fromId && r.toId === toId ? { ...r, ...partial } : r
      ),
    }))
  },

  removeRelation: (fromId, toId) => {
    set((s) => ({
      relations: s.relations.filter((r) => r.fromId !== fromId || r.toId !== toId),
    }))
  },

  rebuildGraph: () => {
    const { entries, relations } = get()
    const existingNodes = new Map(get().graphNodes.map((n) => [n.memoryId, n]))
    const nodes = computeGraphLayout(entries, existingNodes)
    const computedRels = computeRelations(entries, relations)
    set({ graphNodes: nodes, relations: computedRels })
  },

  addEntriesFromExtraction: (newEntries, newRelations) => {
    set((s) => {
      const existingIds = new Set(s.entries.map((e) => e.id))
      const uniqueEntries = newEntries.filter((e) => !existingIds.has(e.id))
      const uniqueRels = newRelations.filter(
        (r) => !s.relations.some((er) => er.fromId === r.fromId && er.toId === r.toId && er.type === r.type)
      )
      const allEntries = [...s.entries, ...uniqueEntries]
      const allRels = [...s.relations, ...uniqueRels]
      const existingNodes = new Map(s.graphNodes.map((n) => [n.memoryId, n]))
      const newIds = uniqueEntries.map((e) => e.id)
      const newNodes = getNewNodePositions(newIds, allEntries, existingNodes)
      return {
        entries: allEntries,
        relations: allRels,
        graphNodes: [...s.graphNodes, ...newNodes],
      }
    })
  },

  getActiveCount: () => get().entries.length,
}),
    {
      name: 'sparta-memory',
      partialize: (state) => ({
        entries: state.entries,
        relations: state.relations,
      }),
    }
  )
)
