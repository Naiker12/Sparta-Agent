import { useEffect, useRef } from 'react'
import { TitleBar } from './TitleBar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/sidebar/AppSidebar'
import { SidebarResizeHandle } from '@/components/sidebar/SidebarResizeHandle'
import { StatusBar } from './StatusBar'
import { ChatArea } from '../chat/ChatArea'
import { SettingsDialog } from '../settings/SettingsDialog'
import { EditorPanel, TerminalPanel, AgentsPanel } from '@/App'
import { SessionsView } from '@/components/views/SessionsView'
import { SkillsView } from '@/components/views/SkillsView'
import { McpView } from '@/components/views/McpView'
import { ChannelsView } from '@/components/views/ChannelsView'
import { MemoryView } from '@/components/views/MemoryView'
import { initTheme } from '@/stores/theme.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useUIStore } from '@/stores/ui.store'

const PANELS: Record<string, React.ReactNode> = {
  chat: <ChatArea />,
  editor: <EditorPanel />,
  terminal: <TerminalPanel />,
  agents: <AgentsPanel />,
  sessions: <SessionsView />,
  skills: <SkillsView />,
  mcp: <McpView />,
  channels: <ChannelsView />,
  memory: <MemoryView />,
}

export function AppShell() {
  useEffect(() => {
    initTheme()
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
