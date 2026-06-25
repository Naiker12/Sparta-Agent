import { useMemoryStore } from '@/stores/memory.store'

export function useMemory() {
  const store = useMemoryStore()
  return {
    entries: store.entries,
    activeCount: store.getActiveCount(),
    addEntry: store.addEntry,
    updateEntry: store.updateEntry,
    deleteEntry: store.deleteEntry,
  }
}
