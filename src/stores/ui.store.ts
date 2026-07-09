import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import type { SettingsTab } from '@/types'
import { IS_ELECTRON } from '@/lib/env-adapter'

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

  editorOpen: boolean
  terminalOpen: boolean
  editorWidth: number
  terminalHeight: number
  editorExplorerVisible: boolean
  editorExplorerWidth: number
  terminalSlotEl: HTMLDivElement | null

  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  toggleContextPanel: () => void
  setMainView: (view: MainView) => void
  goBack: () => void
  toggleSidebarSection: (key: string) => void
  setActiveSettingsTab: (tab: SettingsTab) => void

  toggleEditor: () => void
  toggleTerminal: () => void
  setEditorWidth: (width: number) => void
  setTerminalHeight: (height: number) => void
  toggleEditorExplorer: () => void
  setEditorExplorerWidth: (width: number) => void
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

  editorOpen: false,
  terminalOpen: false,
  editorWidth: 420,
  terminalHeight: 220,
  editorExplorerVisible: true,
  editorExplorerWidth: 260,
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

  toggleEditor: () => {
    if (!IS_ELECTRON) {
      toast.info('Editor disponible solo en app de escritorio', {
        description: 'Descarga Sparta Agent para acceder al editor de código.',
        duration: 4000,
      })
      return
    }
    set((s) => ({ editorOpen: !s.editorOpen }))
  },
  toggleTerminal: () => {
    if (!IS_ELECTRON) {
      toast.info('Terminal disponible solo en app de escritorio', {
        description: 'Descarga Sparta Agent para acceder a la terminal.',
        duration: 4000,
      })
      return
    }
    set((s) => ({ terminalOpen: !s.terminalOpen }))
  },
  setEditorWidth: (width) => set({ editorWidth: Math.min(800, Math.max(300, width)) }),
  setTerminalHeight: (height) => set({ terminalHeight: Math.min(500, Math.max(100, height)) }),
  toggleEditorExplorer: () => set((s) => ({ editorExplorerVisible: !s.editorExplorerVisible })),
  setEditorExplorerWidth: (width) => set({ editorExplorerWidth: Math.min(420, Math.max(180, width)) }),
  setTerminalSlotEl: (el) => set({ terminalSlotEl: el }),
}),
    {
      name: 'sparta-ui',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        sidebarExpandedSections: state.sidebarExpandedSections,
        activeSettingsTab: state.activeSettingsTab,
        editorOpen: state.editorOpen,
        editorWidth: state.editorWidth,
        terminalOpen: state.terminalOpen,
        terminalHeight: state.terminalHeight,
        editorExplorerVisible: state.editorExplorerVisible,
        editorExplorerWidth: state.editorExplorerWidth,
      }),
    }
  )
)
