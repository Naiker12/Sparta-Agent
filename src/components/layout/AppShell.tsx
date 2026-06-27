import { lazy, Suspense, useEffect, useRef } from 'react'
import { TitleBar } from './TitleBar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/sidebar/AppSidebar'
import { SidebarResizeHandle } from '@/components/sidebar/SidebarResizeHandle'
import { StatusBar } from './StatusBar'
import { ChatArea } from '../chat/ChatArea'
import { SettingsDialog } from '../settings/SettingsDialog'
import { EditorPanel, TerminalPanel, AgentsPanel } from '@/App'
import { initTheme } from '@/stores/theme.store'
import { useCronEngine } from '@/hooks/useCronEngine'
import { useSettingsStore } from '@/stores/settings.store'
import { useUIStore } from '@/stores/ui.store'
import { useChatStore } from '@/stores/chat.store'

const SessionsView = lazy(() => import('@/components/views/SessionsView').then(m => ({ default: m.SessionsView })))
const SkillsView = lazy(() => import('@/components/views/SkillsView').then(m => ({ default: m.SkillsView })))
const McpView = lazy(() => import('@/components/views/McpView').then(m => ({ default: m.McpView })))
const ChannelsView = lazy(() => import('@/components/views/ChannelsView').then(m => ({ default: m.ChannelsView })))
const MemoryView = lazy(() => import('@/components/views/MemoryView').then(m => ({ default: m.MemoryView })))

function ViewSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ minHeight: 200 }}>
      <div className="flex flex-col items-center gap-3">
        <div className="size-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-[var(--text-muted)]">Cargando...</span>
      </div>
    </div>
  )
}

const PANELS: Record<string, React.ReactNode> = {
  chat: <ChatArea />,
  editor: <EditorPanel />,
  terminal: <TerminalPanel />,
  agents: <AgentsPanel />,
  sessions: <Suspense fallback={<ViewSkeleton />}><SessionsView /></Suspense>,
  skills: <Suspense fallback={<ViewSkeleton />}><SkillsView /></Suspense>,
  mcp: <Suspense fallback={<ViewSkeleton />}><McpView /></Suspense>,
  channels: <Suspense fallback={<ViewSkeleton />}><ChannelsView /></Suspense>,
  memory: <Suspense fallback={<ViewSkeleton />}><MemoryView /></Suspense>,
}

export function AppShell() {
  useCronEngine()

  useEffect(() => {
    initTheme()
    useChatStore.getState().cleanupStaleSessions()
  }, [])

  const { settingsOpen } = useSettingsStore()
  const { mainView, sidebarOpen, sidebarWidth } = useUIStore()
  const prevType = useRef(mainView.type)
  const direction = useRef(1)

  if (mainView.type !== prevType.current) {
    const order = Object.keys(PANELS)
    direction.current = order.indexOf(mainView.type) > order.indexOf(prevType.current) ? 1 : -1
    prevType.current = mainView.type
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-base)] overflow-hidden">
      <TitleBar />
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <SidebarProvider
          open={sidebarOpen}
          onOpenChange={(open) => useUIStore.setState({ sidebarOpen: open })}
          style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
        >
          <div className="relative" style={{ flexShrink: 0 }}>
            <AppSidebar />
            <SidebarResizeHandle />
          </div>
          <div
            key={mainView.type}
            className="flex flex-1 min-h-0"
            style={{ animation: 'viewFadeIn 0.18s ease-out' }}
          >
            {PANELS[mainView.type]}
          </div>
        </SidebarProvider>
      </div>
      <StatusBar />
      {settingsOpen && <SettingsDialog />}
    </div>
  )
}
