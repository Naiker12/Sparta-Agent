import { useUIStore, type MainView } from 'ia-sparta-core'
import { useSettingsStore } from 'ia-sparta-core'
import { AppMenu } from './AppMenu'
import { Settings, PanelLeftOpen, PanelLeftClose } from 'lucide-react'
import { SpartaIcon } from 'ia-sparta-chat'
import { FEATURES } from 'ia-sparta-platform'
import { Button } from 'ia-sparta-design-system'
import {
  Tabs,
  TabsList,
  TabsHighlight,
  TabsHighlightItem,
  TabsTrigger,
} from 'ia-sparta-design-system'

const TABS: { type: MainView['type']; label: string }[] = [
  { type: 'chat', label: 'Chat' },
  { type: 'editor', label: 'Editor' },
  ...(FEATURES.terminal ? [{ type: 'terminal' as const, label: 'Terminal' }] : []),
  { type: 'agents', label: 'Agents' },
]

export function TitleBar() {
  const { mainView, setMainView, sidebarOpen, toggleSidebar, terminalOpen, toggleTerminal } = useUIStore()
  const { openSettings } = useSettingsStore()

  const activeValue = (() => {
    if (mainView.type === 'agents') return 'agents'
    if (mainView.type === 'editor') return 'editor'
    if (terminalOpen) return 'terminal'
    return 'chat'
  })()

  function handleTabClick(type: MainView['type']) {
    if (type === 'editor') {
      setMainView({ type: 'editor' })
      return
    }
    if (type === 'terminal') {
      toggleTerminal()
      if (mainView.type === 'agents' || mainView.type === 'sessions' || mainView.type === 'skills' || mainView.type === 'mcp' || mainView.type === 'channels' || mainView.type === 'memory' || mainView.type === 'editor') {
        setMainView({ type: 'chat' })
      }
      return
    }
    setMainView({ type } as MainView)
  }

  return (
    <div
      className="drag-region flex items-center shrink-0 select-none"
      style={{
        height: 'var(--titlebar-h)',
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 16px',
        paddingRight: (window as any).__ELECTRON__ ? 140 : 16,
        gap: 12,
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="no-drag"
        onClick={toggleSidebar}
        title={sidebarOpen ? 'Colapsar sidebar' : 'Expandir sidebar'}
      >
        {sidebarOpen ? <PanelLeftOpen size={14} strokeWidth={1.5} /> : <PanelLeftClose size={14} strokeWidth={1.5} />}
      </Button>

      <AppMenu />

      <div className="no-drag flex items-center gap-2 px-2">
        <SpartaIcon size={18} />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-display)', fontFamily: 'var(--font-ui)' }}>
          Sparta
        </span>
      </div>

      <div className="w-px h-[18px]" style={{ background: 'var(--border-normal)' }} />

      <Tabs value={activeValue} onValueChange={(v) => handleTabClick(v as MainView['type'])}>
        <TabsList
          className="no-drag"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <TabsHighlight
            style={{
              borderRadius: 6,
              background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            }}
          >
            {TABS.map((tab) => (
              <TabsHighlightItem key={tab.type} value={tab.type}>
                <TabsTrigger
                  value={tab.type}
                  style={{
                    padding: '6px 16px',
                    background: 'none',
                    border: 'none',
                    borderRadius: 6,
                    color: activeValue === tab.type ? 'var(--text-display)' : 'var(--text-muted)',
                    fontSize: 12,
                    fontFamily: 'var(--font-ui)',
                    fontWeight: activeValue === tab.type ? 600 : 400,
                    cursor: 'pointer',
                    position: 'relative',
                    zIndex: 1,
                    borderBottom: activeValue === tab.type ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'border-color 0.15s ease',
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

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="icon"
        className="no-drag"
        onClick={openSettings}
      >
        <Settings size={14} strokeWidth={1.5} />
      </Button>
    </div>
  )
}