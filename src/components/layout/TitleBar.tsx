import { useUIStore, type MainView } from '@/stores/ui.store'
import { useSettingsStore } from '@/stores/settings.store'
import { AppMenu } from './AppMenu'
import { Settings, PanelLeftOpen, PanelLeftClose } from 'lucide-react'
import { SpartaIcon } from '@/components/chat/SpartaIcon'
import { FEATURES } from '@/lib/env-adapter'
import {
  Tabs,
  TabsList,
  TabsHighlight,
  TabsHighlightItem,
  TabsTrigger,
} from '@/components/animate-ui/primitives/animate/tabs'

const TABS: { type: MainView['type']; label: string }[] = [
  { type: 'chat', label: 'Chat' },
  { type: 'editor', label: 'Editor' },
  ...(FEATURES.terminal ? [{ type: 'terminal' as const, label: 'Terminal' }] : []),
  { type: 'agents', label: 'Agents' },
]

export function TitleBar() {
  const { mainView, setMainView, sidebarOpen, toggleSidebar, editorOpen, terminalOpen, toggleEditor, toggleTerminal } = useUIStore()
  const { openSettings } = useSettingsStore()

  const activeValue = (() => {
    if (mainView.type === 'agents') return 'agents'
    if (editorOpen) return 'editor'
    if (terminalOpen) return 'terminal'
    return 'chat'
  })()

  function handleTabClick(type: MainView['type']) {
    if (type === 'editor') {
      toggleEditor()
      if (mainView.type === 'agents' || mainView.type === 'sessions' || mainView.type === 'skills' || mainView.type === 'mcp' || mainView.type === 'channels' || mainView.type === 'memory') {
        setMainView({ type: 'chat' })
      }
      return
    }
    if (type === 'terminal') {
      toggleTerminal()
      if (mainView.type === 'agents' || mainView.type === 'sessions' || mainView.type === 'skills' || mainView.type === 'mcp' || mainView.type === 'channels' || mainView.type === 'memory') {
        setMainView({ type: 'chat' })
      }
      return
    }
    setMainView({ type } as MainView)
  }

  return (
    <div
      className="drag-region"
      style={{
        height: 'var(--titlebar-h)',
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <button
        className="no-drag"
        onClick={toggleSidebar}
        title={sidebarOpen ? 'Colapsar sidebar' : 'Expandir sidebar'}
        style={{
          width: 28,
          height: 28,
          background: 'none',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        {sidebarOpen ? <PanelLeftOpen size={14} strokeWidth={1.5} /> : <PanelLeftClose size={14} strokeWidth={1.5} />}
      </button>

      <AppMenu />

      <div
        className="no-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 10px',
        }}
      >
        <SpartaIcon size={18} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-display)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          Sparta
        </span>
      </div>

      <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 12px' }} />

      <Tabs value={activeValue} onValueChange={(v) => handleTabClick(v as MainView['type'])}>
        <TabsList
          className="no-drag"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <TabsHighlight
            style={{
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--text-muted) 10%, transparent)',
            }}
          >
            {TABS.map((tab) => (
              <TabsHighlightItem key={tab.type} value={tab.type}>
                <TabsTrigger
                  value={tab.type}
                  style={{
                    padding: '4px 12px',
                    background: 'none',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    color: activeValue === tab.type ? 'var(--text-display)' : 'var(--text-muted)',
                    fontSize: 12,
                    fontFamily: 'var(--font-ui)',
                    fontWeight: activeValue === tab.type ? 500 : 400,
                    cursor: 'pointer',
                    position: 'relative',
                    zIndex: 1,
                  }}
                  whileHover={{ color: 'var(--text-display)' }}
                  transition={{ color: { duration: 0.15 } }}
                >
                  {tab.label}
                </TabsTrigger>
              </TabsHighlightItem>
            ))}
          </TabsHighlight>
        </TabsList>
      </Tabs>

      <div style={{ flex: 1 }} />

      <button
        className="no-drag"
        onClick={openSettings}
        style={{
          width: 28,
          height: 28,
          background: 'none',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        <Settings size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}
