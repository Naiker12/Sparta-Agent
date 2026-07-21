import { create } from 'zustand'
import { useChatStore } from './chat.store'
import { useSessionStore } from './session.store'

const MAX_LIVE_TABS = 4

interface SessionTabsState {
  openTabs: string[]
  focusedTabId: string | null

  openTab: (sessionId: string) => void
  focusTab: (sessionId: string) => void
  closeTab: (sessionId: string) => void
  closeOtherTabs: (sessionId: string) => void
  closeTabsToRight: (sessionId: string) => void
  moveTab: (fromIndex: number, toIndex: number) => void

  getLiveSessionIds: () => string[]
  isTabLive: (sessionId: string) => boolean
}

export const useSessionTabsStore = create<SessionTabsState>()((set, get) => ({
  openTabs: [],
  focusedTabId: null,

  openTab: (sessionId: string) => {
    set((s) => {
      if (s.openTabs.includes(sessionId)) {
        return { focusedTabId: sessionId }
      }
      const next = [...s.openTabs, sessionId]
      return { openTabs: next, focusedTabId: sessionId }
    })
    useSessionStore().switchSession(sessionId)
  },

  focusTab: (sessionId: string) => {
    set((s) => {
      if (!s.openTabs.includes(sessionId)) return s
      const next = s.openTabs.filter((id) => id !== sessionId)
      next.push(sessionId)
      return { openTabs: next, focusedTabId: sessionId }
    })
    useSessionStore().switchSession(sessionId)
  },

  closeTab: (sessionId: string) => {
    set((s) => {
      const next = s.openTabs.filter((id) => id !== sessionId)
      let newFocus = s.focusedTabId
      if (newFocus === sessionId) {
        newFocus = next.length > 0 ? next[next.length - 1] : null
      }
      return { openTabs: next, focusedTabId: newFocus }
    })
    const state = get()
    if (state.focusedTabId) {
      useSessionStore().switchSession(state.focusedTabId)
    } else {
      useSessionStore().resetActiveSession()
    }
  },

  closeOtherTabs: (sessionId: string) => {
    set({ openTabs: [sessionId], focusedTabId: sessionId })
    useSessionStore().switchSession(sessionId)
  },

  closeTabsToRight: (sessionId: string) => {
    set((s) => {
      const idx = s.openTabs.indexOf(sessionId)
      if (idx === -1) return s
      const next = s.openTabs.slice(0, idx + 1)
      const newFocus = s.openTabs.indexOf(s.focusedTabId ?? '') <= idx
        ? s.focusedTabId
        : sessionId
      return { openTabs: next, focusedTabId: newFocus ?? sessionId }
    })
    const state = get()
    if (state.focusedTabId) {
      useSessionStore().switchSession(state.focusedTabId)
    }
  },

  moveTab: (fromIndex: number, toIndex: number) => {
    set((s) => {
      const next = [...s.openTabs]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return { openTabs: next }
    })
  },

  getLiveSessionIds: () => {
    const { openTabs } = get()
    const streamingBySession = useChatStore.getState().streamingBySession
    const live: string[] = []
    for (const id of openTabs) {
      if (streamingBySession[id]?.isStreaming) {
        live.push(id)
      } else if (live.length < MAX_LIVE_TABS) {
        live.push(id)
      }
    }
    return live
  },

  isTabLive: (sessionId: string) => {
    return get().getLiveSessionIds().includes(sessionId)
  },
}))

// Derived selector: activeSessionId from focusedTabId
export function getFocusedSessionId(): string | null {
  return useSessionTabsStore.getState().focusedTabId
}
