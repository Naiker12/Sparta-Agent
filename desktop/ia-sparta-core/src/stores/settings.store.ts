import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { SessionMode, Language, ReasoningEffort } from '../types'

export type AgentAutonomyLevel = 'always_ask' | 'ask_risky' | 'autonomous_readonly'
export type SandboxMode = 'none' | 'docker'

interface SettingsStore {
  settingsOpen: boolean
  defaultModel: string
  input: string
  activeModel: string
  memoryEnabled: boolean
  semanticMemoryEnabled: boolean
  webSearchEnabled: boolean
  reasoningEnabled: boolean
  reasoningBudget: number
  reasoningEffort: ReasoningEffort
  sessionMode: SessionMode
  apiKeys: Record<string, string>
  language: Language
  agentAutonomy: AgentAutonomyLevel
  agentExecuteLocal: boolean
  sandboxMode: SandboxMode

  openSettings: () => void
  closeSettings: () => void
  setInput: (val: string) => void
  setDefaultModel: (model: string) => void
  setApiKey: (provider: string, key: string) => void
  toggleMemory: () => void
  toggleSemanticMemory: () => void
  toggleWebSearch: () => void
  toggleReasoning: () => void
  setReasoningEffort: (effort: ReasoningEffort) => void
  setReasoningBudget: (budget: number) => void
  setSessionMode: (mode: SessionMode) => void
  setLanguage: (lang: Language) => void
  setAgentAutonomy: (level: AgentAutonomyLevel) => void
  setAgentExecuteLocal: (val: boolean) => void
  setSandboxMode: (mode: SandboxMode) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
  settingsOpen: false,
  defaultModel: 'claude-sonnet-4-6',
  input: '',
  activeModel: 'claude-sonnet-4-6',
  memoryEnabled: true,
  semanticMemoryEnabled: false,
  webSearchEnabled: false,
  // Extended reasoning is valuable for hard tasks but adds a long provider
  // preamble to ordinary chat and simple file edits. Users can enable it per
  // model when they need it.
  reasoningEnabled: false,
  reasoningBudget: 2048,
  reasoningEffort: 'minimal',
  sessionMode: 'chat',
  apiKeys: {},
  language: 'es',
  agentAutonomy: 'ask_risky',
  agentExecuteLocal: true,
  sandboxMode: 'none',

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setInput: (val) => set({ input: val }),
  setDefaultModel: (model) => set({ defaultModel: model, activeModel: model }),
  setApiKey: (provider, key) =>
    set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key } })),
  toggleMemory: () => set((s) => ({ memoryEnabled: !s.memoryEnabled })),
  toggleSemanticMemory: () => set((s) => ({ semanticMemoryEnabled: !s.semanticMemoryEnabled })),
  toggleWebSearch: () => set((s) => ({ webSearchEnabled: !s.webSearchEnabled })),
  toggleReasoning: () => set((s) => ({ reasoningEnabled: !s.reasoningEnabled })),
  setReasoningEffort: (effort) => set({ reasoningEffort: effort }),
  setReasoningBudget: (budget) => set({ reasoningBudget: budget }),
  setSessionMode: (mode) => set({ sessionMode: mode }),
  setLanguage: (lang) => set({ language: lang }),
  setAgentAutonomy: (level) => set({ agentAutonomy: level }),
  setAgentExecuteLocal: (val) => set({ agentExecuteLocal: val }),
  setSandboxMode: (mode) => set({ sandboxMode: mode }),
}),
    {
      name: 'sparta-settings',
      version: 7,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>
        if (version < 2) {
          state.semanticMemoryEnabled = false
        }
        if (version < 3) {
          state.reasoningBudget = 8000
        }
        if (version < 4) {
          state.reasoningEffort = 'medium'
        }
        if (version < 5) {
          state.agentAutonomy = 'ask_risky'
          state.agentExecuteLocal = false
        }
        if (version < 6) {
          state.sandboxMode = 'none'
        }
        if (version < 7) {
          state.reasoningEnabled = false
          state.reasoningBudget = 2048
          state.reasoningEffort = 'minimal'
        }
        return state
      },
      partialize: (state) => ({
        defaultModel: state.defaultModel,
        activeModel: state.activeModel,
        memoryEnabled: state.memoryEnabled,
        semanticMemoryEnabled: state.semanticMemoryEnabled,
        webSearchEnabled: state.webSearchEnabled,
        reasoningEnabled: state.reasoningEnabled,
        reasoningEffort: state.reasoningEffort,
        sessionMode: state.sessionMode,
        language: state.language,
        apiKeys: state.apiKeys,
        agentAutonomy: state.agentAutonomy,
        agentExecuteLocal: state.agentExecuteLocal,
        sandboxMode: state.sandboxMode,
      }),
    }
  )
)
