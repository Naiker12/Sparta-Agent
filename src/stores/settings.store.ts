import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { SessionMode, Language } from '@/interfaces/settings.interface'

interface SettingsStore {
  settingsOpen: boolean
  defaultModel: string
  input: string
  activeModel: string
  memoryEnabled: boolean
  webSearchEnabled: boolean
  reasoningEnabled: boolean
  sessionMode: SessionMode
  apiKeys: Record<string, string>
  language: Language

  openSettings: () => void
  closeSettings: () => void
  setInput: (val: string) => void
  setDefaultModel: (model: string) => void
  setApiKey: (provider: string, key: string) => void
  toggleMemory: () => void
  toggleWebSearch: () => void
  toggleReasoning: () => void
  setSessionMode: (mode: SessionMode) => void
  setLanguage: (lang: Language) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
  settingsOpen: false,
  defaultModel: 'claude-sonnet-4-6',
  input: '',
  activeModel: 'claude-sonnet-4-6',
  memoryEnabled: true,
  webSearchEnabled: false,
  reasoningEnabled: true,
  sessionMode: 'chat',
  apiKeys: {},
  language: 'es',

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setInput: (val) => set({ input: val }),
  setDefaultModel: (model) => set({ defaultModel: model, activeModel: model }),
  setApiKey: (provider, key) =>
    set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key } })),
  toggleMemory: () => set((s) => ({ memoryEnabled: !s.memoryEnabled })),
  toggleWebSearch: () => set((s) => ({ webSearchEnabled: !s.webSearchEnabled })),
  toggleReasoning: () => set((s) => ({ reasoningEnabled: !s.reasoningEnabled })),
  setSessionMode: (mode) => set({ sessionMode: mode }),
  setLanguage: (lang) => set({ language: lang }),
}),
    {
      name: 'sparta-settings',
      partialize: (state) => ({
        defaultModel: state.defaultModel,
        activeModel: state.activeModel,
        memoryEnabled: state.memoryEnabled,
        webSearchEnabled: state.webSearchEnabled,
        reasoningEnabled: state.reasoningEnabled,
        sessionMode: state.sessionMode,
        language: state.language,
        apiKeys: state.apiKeys,
      }),
    }
  )
)
