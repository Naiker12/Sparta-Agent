import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsStore {
  settingsOpen: boolean
  defaultModel: string
  input: string
  activeModel: string
  memoryEnabled: boolean
  apiKeys: Record<string, string>

  openSettings: () => void
  closeSettings: () => void
  setInput: (val: string) => void
  sendMessage: () => void
  setDefaultModel: (model: string) => void
  setApiKey: (provider: string, key: string) => void
  toggleMemory: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
  settingsOpen: false,
  defaultModel: 'claude-sonnet-4-6',
  input: '',
  activeModel: 'claude-sonnet-4-6',
  memoryEnabled: true,
  apiKeys: {},

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setInput: (val) => set({ input: val }),
  sendMessage: () => {
    const { input } = get()
    if (!input.trim()) return
    console.log('send:', input)
    set({ input: '' })
  },
  setDefaultModel: (model) => set({ defaultModel: model, activeModel: model }),
  setApiKey: (provider, key) =>
    set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key } })),
  toggleMemory: () => set((s) => ({ memoryEnabled: !s.memoryEnabled })),
}),
    {
      name: 'sparta-settings',
      partialize: (state) => ({
        defaultModel: state.defaultModel,
        activeModel: state.activeModel,
        memoryEnabled: state.memoryEnabled,
        apiKeys: state.apiKeys,
      }),
    }
  )
)
