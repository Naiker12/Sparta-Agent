import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface HarnessHistoryEntry {
  id: string
  harnessId: string
  timestamp: number
  action: 'detected' | 'launched' | 'version_checked'
  detail?: string
}

interface HarnessHistoryState {
  entries: HarnessHistoryEntry[]
  addEntry: (entry: Omit<HarnessHistoryEntry, 'id' | 'timestamp'>) => void
  clearHistory: () => void
}

export const useHarnessHistoryStore = create<HarnessHistoryState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((s) => ({
          entries: [
            {
              ...entry,
              id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              timestamp: Date.now(),
            },
            ...s.entries,
          ].slice(0, 200),
        })),
      clearHistory: () => set({ entries: [] }),
    }),
    { name: 'sparta-harness-history' }
  )
)
