import { MessageSquare, Terminal, PanelLeftOpen, PanelLeftClose } from 'lucide-react'
import { useUIStore, type MainView } from 'ia-sparta-core'
import { AppMenu } from './AppMenu'
import { SpartaIcon } from 'ia-sparta-chat'
import { FEATURES, IS_ELECTRON } from 'ia-sparta-platform'
import { Button } from 'ia-sparta-design-system'
import { ResourceMonitorPopover } from './ResourceMonitorPopover'
import { TabStrip } from 'ia-sparta-tabs'

const TABS: { type: MainView['type']; label: string; icon: any }[] = [
  { type: 'chat', label: 'Chat', icon: MessageSquare },
  ...(FEATURES.terminal ? [{ type: 'terminal' as const, label: 'Terminal', icon: Terminal }] : []),
]

export function TitleBar() {
  const { mainView, setMainView, sidebarOpen, toggleSidebar, terminalOpen, toggleTerminal } = useUIStore()

  const activeValue = (() => {
    if (mainView.type === 'agents') return 'agents'
    if (terminalOpen) return 'terminal'
    return 'chat'
  })()

  function handleTabClick(type: MainView['type']) {
    if (type === 'terminal') {
      toggleTerminal()
      if (mainView.type === 'agents' || mainView.type === 'sessions' || mainView.type === 'skills' || mainView.type === 'mcp' || mainView.type === 'channels' || mainView.type === 'memory') {
        setMainView({ type: 'chat' })
      }
      return
    }
    if (terminalOpen) toggleTerminal()
    setMainView({ type } as MainView)
  }

  return (
    <div
      className="drag-region flex items-center shrink-0 select-none"
      style={{
        height: 'var(--titlebar-h)',
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 14px',
        paddingRight: IS_ELECTRON ? 140 : 14,
        gap: 10,
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="no-drag"
        onClick={toggleSidebar}
        title={sidebarOpen ? 'Colapsar sidebar' : 'Expandir sidebar'}
        style={{ width: 28, height: 28 }}
      >
        {sidebarOpen ? <PanelLeftOpen size={14} strokeWidth={1.5} /> : <PanelLeftClose size={14} strokeWidth={1.5} />}
      </Button>

      <AppMenu />

      {/* Brand logo & Title */}
      <div className="no-drag flex items-center gap-2 px-1">
        <SpartaIcon size={16} />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-display)', fontFamily: 'var(--font-ui)', letterSpacing: '0.02em' }}>
          Sparta
        </span>
      </div>

      <div className="w-px h-[14px]" style={{ background: 'var(--border-subtle)' }} />

      {/* ── Segmented Control Tabs (Chat / Terminal) ── */}
      <div
        className="no-drag flex items-center"
        style={{
          padding: 2,
          borderRadius: 8,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          gap: 2,
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeValue === tab.type
          const Icon = tab.icon
          return (
            <button
              key={tab.type}
              type="button"
              onClick={() => handleTabClick(tab.type)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                borderRadius: 6,
                border: 'none',
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 11.5,
                fontWeight: isActive ? 600 : 500,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              <Icon size={12} strokeWidth={isActive ? 2 : 1.5} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      <TabStrip />

      <div className="flex-1" />

      <ResourceMonitorPopover />
    </div>
  )
}
