import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import type { SettingsTab } from '../types'

export type MainView =
  | { type: 'chat'; sessionId?: string }
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

  terminalOpen: boolean
  terminalHeight: number
  agentPanelWidth: number
  terminalSlotEl: HTMLDivElement | null

  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  toggleContextPanel: () => void
  setMainView: (view: MainView) => void
  goBack: () => void
  toggleSidebarSection: (key: string) => void
  setActiveSettingsTab: (tab: SettingsTab) => void

  toggleTerminal: () => void
  setTerminalHeight: (height: number) => void
  setAgentPanelWidth: (width: number) => void
  setTerminalSlotEl: (el: HTMLDivElement | null) => void
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

  terminalOpen: false,
  terminalHeight: 220,
  agentPanelWidth: 280,
  terminalSlotEl: null,

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

  toggleTerminal: () => {
    if (typeof window !== 'undefined' && !(window as any).__ELECTRON__) {
      toast.info('Terminal disponible solo en app de escritorio', {
        description: 'Descarga Sparta Agent para acceder a la terminal.',
        duration: 4000,
      })
      return
    }
    set((s) => ({ terminalOpen: !s.terminalOpen }))
  },
  setTerminalHeight: (height) => set({ terminalHeight: Math.min(500, Math.max(100, height)) }),
  setAgentPanelWidth: (width) => set({ agentPanelWidth: Math.min(500, Math.max(200, width)) }),
  setTerminalSlotEl: (el) => set({ terminalSlotEl: el }),
}),
    {
      name: 'sparta-ui',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        sidebarExpandedSections: state.sidebarExpandedSections,
        activeSettingsTab: state.activeSettingsTab,

        terminalOpen: state.terminalOpen,
        terminalHeight: state.terminalHeight,
        agentPanelWidth: state.agentPanelWidth,
      }),
    }
  )
)
