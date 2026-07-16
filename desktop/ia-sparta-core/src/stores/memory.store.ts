import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MemoryEntry, MemoryRelation, MemoryGraphNode } from '../types'
import { useEventBus } from './event-bus.store'
import { computeRelations } from 'ia-sparta-core'
import { deleteEntry as chromaDeleteEntry } from 'ia-sparta-core'

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
  addEntriesFromExtraction: (entries: MemoryEntry[], relations: MemoryRelation[]) => void
  getActiveCount: () => number
  deleteEntriesBySourceMessageId: (messageId: string) => string[]
  rebuildGraph: () => void
}

function migrateMemoryState(persisted: unknown, version: number): MemoryState | unknown {
  const state = persisted as Partial<MemoryState> & Record<string, unknown>
  const entries = Array.isArray(state.entries) ? state.entries : []
  const relations = Array.isArray(state.relations) ? state.relations : []

  if (version < 2) {
    const cleanedEntries = entries.filter((entry) => {
      const item = entry as MemoryEntry
      const isLegacyAutoTurnFragment =
        item.source === 'auto' &&
        Boolean(item.sourceMessageId) &&
        item.category !== 'conversation_turn'
      return !isLegacyAutoTurnFragment
    })
    const validIds = new Set(cleanedEntries.map((entry) => (entry as MemoryEntry).id))
    return {
      ...state,
      entries: cleanedEntries,
      relations: relations.filter((rel) => {
        const item = rel as MemoryRelation
        return validIds.has(item.fromId) && validIds.has(item.toId)
      }),
      graphNodes: [],
    }
  }

  return persisted
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
    console.debug(`[memory:store] Added entry id=${id.slice(0,8)} category=${category ?? 'none'} content="${content.slice(0,60)}"`)
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
    const state = get()
    const filtered = state.entries.filter((e) => e.id !== id)
    if (filtered.length === state.entries.length) return
    const rels = state.relations.filter((r) => r.fromId !== id && r.toId !== id)
    const g = computeRelations(filtered, rels)
    set({ entries: filtered, relations: g })
    chromaDeleteEntry(id).catch(() => {})
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

  addEntriesFromExtraction: (newEntries, newRelations) => {
    set((s) => {
      const existingIds = new Set(s.entries.map((e) => e.id))
      const uniqueEntries = newEntries.filter((e) => !existingIds.has(e.id))
      const uniqueRels = newRelations.filter(
        (r) => !s.relations.some((er) => er.fromId === r.fromId && er.toId === r.toId && er.type === r.type)
      )
      return {
        entries: [...s.entries, ...uniqueEntries],
        relations: [...s.relations, ...uniqueRels],
      }
    })
  },

  getActiveCount: () => get().entries.length,

  deleteEntriesBySourceMessageId: (messageId: string) => {
    const state = get()
    const toDelete = state.entries.filter((e) => e.sourceMessageId === messageId)
    const deleteIds = new Set(toDelete.map((e) => e.id))
    set({
      entries: state.entries.filter((e) => !deleteIds.has(e.id)),
      relations: state.relations.filter((r) => !deleteIds.has(r.fromId) && !deleteIds.has(r.toId)),
    })
    console.debug(`[memory:store] Deleted ${toDelete.length} entries for messageId=${messageId.slice(0,8)}`)
    for (const entry of toDelete) {
      useEventBus.getState().dispatch({ type: 'memory:deleted', memoryId: entry.id, timestamp: Date.now() })
    }
    return toDelete.map((e) => e.id)
  },

  rebuildGraph: () => {
    const state = get()
    const g = computeRelations(state.entries, state.relations)
    const nodes: MemoryGraphNode[] = state.entries.map((e, i) => ({
      memoryId: e.id,
      position: {
        x: 100 + (i % 10) * 120,
        y: 100 + Math.floor(i / 10) * 120,
        z: 0,
      },
      radius: 20,
      color: e.category === 'entity' ? 'var(--accent)' : 'var(--status-think)',
    }))
    set({ relations: g, graphNodes: nodes })
    console.debug(`[memory:store] Rebuilt graph: ${g.length} relations, ${nodes.length} nodes`)
  },
}),
    {
      name: 'sparta-memory',
      version: 2,
      migrate: migrateMemoryState,
      partialize: (state) => ({
        entries: state.entries,
        relations: state.relations,
        graphNodes: state.graphNodes,
      }),
    }
  )
)
