import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '@/lib/utils'

export interface TerminalTab {
  id: string
  title: string
  auto: boolean
  cwd: string
  reviveBuffer?: string
  kind: 'user' | 'agent'
  procId?: string
}

interface TerminalState {
  tabs: TerminalTab[]
  activeTabId: string | null
  createTab: (cwd?: string) => string
  closeTab: (id: string) => void
  selectTab: (id: string) => void
  renameTab: (id: string, title: string) => void
  reportShell: (id: string, shell: string) => void
  updateReviveBuffer: (id: string, buffer: string) => void
  ensureAgentTab: (procId: string, title: string) => string | null
  closeAgentTabByProc: (procId: string) => boolean
  ensureAtLeastOneTab: () => void
}

const MAX_REVIVE_BUFFER_CHARS = 48_000
const surfacedProcs = new Set<string>()

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set, get) => ({
      tabs: [{ id: generateId(), title: 'Terminal', auto: true, cwd: '', kind: 'user' }],
      activeTabId: null,

      createTab: (cwd = '') => {
        const id = generateId()
        set((s) => ({ tabs: [...s.tabs, { id, title: 'Terminal', auto: true, cwd, kind: 'user' }] }))
        set({ activeTabId: id })
        return id
      },

      closeTab: (id) => {
        const { tabs, activeTabId } = get()
        const index = tabs.findIndex((t) => t.id === id)
        if (index < 0) return
        const next = tabs.filter((t) => t.id !== id)
        set({ tabs: next.length ? next : [{ id: generateId(), title: 'Terminal', auto: true, cwd: '', kind: 'user' }] })
        if (activeTabId === id) {
          const fallback = next[index] ?? next[index - 1] ?? get().tabs[0]
          set({ activeTabId: fallback?.id ?? null })
        }
      },

      selectTab: (id) => {
        if (get().tabs.some((t) => t.id === id)) set({ activeTabId: id })
      },

      renameTab: (id, title) => {
        const trimmed = title.trim()
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, title: trimmed || t.title, auto: false } : t)),
        }))
      },

      reportShell: (id, shell) => {
        const name = shell.trim()
        if (!name) return
        set((s) => ({ tabs: s.tabs.map((t) => (t.id === id && t.auto ? { ...t, title: name } : t)) }))
      },

      updateReviveBuffer: (id, buffer) => {
        const capped = buffer.length > MAX_REVIVE_BUFFER_CHARS ? buffer.slice(-MAX_REVIVE_BUFFER_CHARS) : buffer
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id && t.kind === 'user' ? { ...t, reviveBuffer: capped } : t)),
        }))
      },

      ensureAgentTab: (procId, title) => {
        const existing = get().tabs.find((t) => t.procId === procId)
        if (existing) return existing.id
        if (surfacedProcs.has(procId)) return null
        surfacedProcs.add(procId)
        const id = generateId()
        set((s) => ({
          tabs: [...s.tabs, { id, title: title || 'agente', auto: false, cwd: '', kind: 'agent', procId }],
        }))
        return id
      },

      closeAgentTabByProc: (procId) => {
        const tab = get().tabs.find((t) => t.kind === 'agent' && t.procId === procId)
        if (!tab) return false
        get().closeTab(tab.id)
        return true
      },

      ensureAtLeastOneTab: () => {
        if (get().tabs.length === 0) get().createTab()
      },
    }),
    {
      name: 'sparta.terminal.v1',
      partialize: (state) => ({
        tabs: state.tabs.filter((t) => t.kind === 'user'),
        activeTabId: state.activeTabId,
      }),
    }
  )
)
