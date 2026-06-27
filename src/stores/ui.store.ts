import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SettingsTab } from '@/types'

export type MainView =
  | { type: 'chat'; sessionId?: string }
  | { type: 'editor' }
  | { type: 'terminal' }
  | { type: 'agents' }
  | { type: 'sessions' }
  | { type: 'skills' }
  | { type: 'mcp' }
  | { type: 'channels'; channelId?: string }
  | { type: 'memory' }

interface UIState {
  sidebarOpen: boolean
  sidebarWidth: number
  contextPanelOpen: boolean
  mainView: MainView
  previousMainView: MainView | null
  sidebarExpandedSections: Record<string, boolean>
  activeSettingsTab: SettingsTab

  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  toggleContextPanel: () => void
  setMainView: (view: MainView) => void
  goBack: () => void
  toggleSidebarSection: (key: string) => void
  setActiveSettingsTab: (tab: SettingsTab) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
  sidebarOpen: true,
  sidebarWidth: 280,
  setSidebarWidth: (width) => set({ sidebarWidth: Math.min(480, Math.max(220, width)) }),
  contextPanelOpen: true,
  mainView: { type: 'chat' },
  previousMainView: null,
  sidebarExpandedSections: {},
  activeSettingsTab: 'general',

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleContextPanel: () => set((s) => ({ contextPanelOpen: !s.contextPanelOpen })),
  setMainView: (view) => set((state) => ({
    previousMainView: state.mainView,
    mainView: view,
  })),
  goBack: () => set((state) => ({
    mainView: state.previousMainView ?? { type: 'chat' },
    previousMainView: null,
  })),
  toggleSidebarSection: (key) =>
    set((s) => ({
      sidebarExpandedSections: {
        ...s.sidebarExpandedSections,
        [key]: !s.sidebarExpandedSections[key],
      },
    })),
  setActiveSettingsTab: (tab) => set({ activeSettingsTab: tab }),
}),
    {
      name: 'sparta-ui',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        sidebarExpandedSections: state.sidebarExpandedSections,
        activeSettingsTab: state.activeSettingsTab,
      }),
    }
  )
)
