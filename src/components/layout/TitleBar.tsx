import { useUIStore, type MainView } from '@/stores/ui.store'
import { useSettingsStore } from '@/stores/settings.store'
import { AppMenu } from './AppMenu'
import { Settings, PanelLeftOpen, PanelLeftClose } from 'lucide-react'
import { SpartaIcon } from '@/components/chat/SpartaIcon'

const TABS: { type: MainView['type']; label: string }[] = [
  { type: 'chat', label: 'Chat' },
  { type: 'editor', label: 'Editor' },
  { type: 'terminal', label: 'Terminal' },
  { type: 'agents', label: 'Agents' },
]

export function TitleBar() {
  const { mainView, setMainView, sidebarOpen, toggleSidebar } = useUIStore()
  const { openSettings } = useSettingsStore()

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
          padding: '0 6px',
        }}
      >
        <SpartaIcon size={18} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-display)',
            fontFamily: 'var(--font-ui)',
            marginRight: 8,
          }}
        >
          Sparta
        </span>
      </div>

      <div
        className="no-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {TABS.map((tab) => {
          const isActive = mainView.type === tab.type
          return (
            <button
              key={tab.type}
              onClick={() => setMainView({ type: tab.type } as MainView)}
              style={{
                padding: '4px 12px',
                background: 'none',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--text-display)' : 'var(--text-muted)',
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
                fontWeight: isActive ? 500 : 400,
                cursor: 'pointer',
                transition: 'color 0.15s',
                position: 'relative',
              }}
            >
              {tab.label}
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 16,
                    height: 1.5,
                    background: 'var(--accent)',
                    borderRadius: 1,
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

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
