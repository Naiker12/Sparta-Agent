import { useState, useCallback } from 'react'
import { useMemoryStore } from '@/stores/memory.store'
import { extractMemory } from '@/services/memory/extractor'
import { writeExtractedMemory } from '@/services/memory/graph-writer'

export function useMemory() {
  const store = useMemoryStore()
  const [isExtracting, setIsExtracting] = useState(false)

  const extractFromTurn = useCallback(async (
    userMessage: string,
    assistantResponse: string,
    sessionId: string,
    messageId: string,
    llmCall: (prompt: string) => Promise<string>
  ) => {
    setIsExtracting(true)
    try {
      const extracted = await extractMemory(userMessage, assistantResponse, llmCall)
      if (extracted.entities.length === 0 && extracted.facts.length === 0) return
      writeExtractedMemory(extracted, sessionId, messageId, {
        getEntries: () => store.entries,
        getRelations: () => store.relations,
        addEntry: (entry) => { store.addEntry(entry.content, entry.source, entry.category, entry.projectId, entry.sourceSessionId, entry.sourceMessageId) },
        updateEntry: store.updateEntry,
        deleteEntry: store.deleteEntry,
        addRelation: store.addRelation,
        updateRelation: store.updateRelation,
      })
      store.rebuildGraph()
    } finally {
      setIsExtracting(false)
    }
  }, [store])

  return {
    entries: store.entries,
    relations: store.relations,
    graphNodes: store.graphNodes,
    activeCount: store.getActiveCount(),
    isExtracting,
    addEntry: store.addEntry,
    updateEntry: store.updateEntry,
    deleteEntry: store.deleteEntry,
    addRelation: store.addRelation,
    rebuildGraph: store.rebuildGraph,
    extractFromTurn,
  }
}
