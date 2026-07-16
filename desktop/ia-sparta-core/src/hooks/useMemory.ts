import { useMemoryStore } from '../stores/memory.store'

export function useMemory() {
  const store = useMemoryStore()

  return {
    entries: store.entries,
    relations: store.relations,
    graphNodes: store.graphNodes,
    activeCount: store.getActiveCount(),
    isExtracting: false,
    addEntry: store.addEntry,
    updateEntry: store.updateEntry,
    deleteEntry: store.deleteEntry,
    addRelation: store.addRelation,
    rebuildGraph: store.rebuildGraph,
  }
}
