import { create } from 'zustand'
import type { SpartaEvent } from '@/types'

interface EventBusState {
  events: SpartaEvent[]
  listeners: Set<(event: SpartaEvent) => void>
  dispatch: (event: SpartaEvent) => void
  subscribe: (listener: (event: SpartaEvent) => void) => () => void
  clear: () => void
}

export const useEventBus = create<EventBusState>((set, get) => ({
  events: [],
  listeners: new Set(),

  dispatch: (event: SpartaEvent) => {
    const state = get()
    state.listeners.forEach((listener) => listener(event))
    set((s) => ({ events: [...s.events.slice(-499), event] }))
  },

  subscribe: (listener) => {
    get().listeners.add(listener)
    return () => get().listeners.delete(listener)
  },

  clear: () => set({ events: [] }),
}))
