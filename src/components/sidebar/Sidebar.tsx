import { useState } from 'react'
import { Plus, Search, MessageSquare, Zap, Plug, Hash, Brain, Pin, Clock, Settings } from 'lucide-react'
import { useChatStore } from '@/stores/chat.store'
import { useSkillStore } from '@/stores/skill.store'
import { useMCPStore } from '@/stores/mcp.store'
import { useChannelStore } from '@/stores/channel.store'
import { useMemoryStore } from '@/stores/memory.store'
import { useUIStore } from '@/stores/ui.store'
import { useSettingsStore } from '@/stores/settings.store'
import { ProjectSwitcher } from './ProjectSwitcher'
import { SessionItem } from './SessionItem'
import { SidebarResizeHandle } from './SidebarResizeHandle'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

const NAV_ITEMS = [
  { type: 'sessions' as const, icon: MessageSquare, label: 'Sesiones' },
  { type: 'skills' as const, icon: Zap, label: 'Skills' },
  { type: 'mcp' as const, icon: Plug, label: 'MCP' },
  { type: 'channels' as const, icon: Hash, label: 'Canales' },
  { type: 'memory' as const, icon: Brain, label: 'Memoria' },
]

const COLLAPSED_W = 48

export function Sidebar() {
  const { sessions, createSession } = useChatStore()
  const { skills } = useSkillStore()
  const { servers } = useMCPStore()
  const { channels } = useChannelStore()
  const { entries } = useMemoryStore()
  const { sidebarOpen, sidebarWidth, mainView, setMainView } = useUIStore()
  const [query, setQuery] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const counts = {
    sessions: sessions.length,
    skills: skills.length,
    mcp: `${servers.filter(s => s.connected).length}/${servers.length}`,
    channels: channels.length,
    memory: entries.length,
  }

  const recentSessions = sessions.slice(0, 4)

  return (
    <div
      style={{
        width: sidebarOpen ? `${sidebarWidth}px` : `${COLLAPSED_W}px`,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        transition: isDragging ? 'none' : 'width 200ms ease',
        position: 'relative',
      }}
    >
      {sidebarOpen ? (
        <>
          <button
            onClick={() => { createSession(); setMainView({ type: 'chat' }) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              background: 'none',
              border: 'none',
              borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: 12.5,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <Plus size={13} strokeWidth={2} style={{ color: 'var(--accent)' }} />
            Nueva sesión
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 10,
                color: 'var(--text-muted)',
                background: 'var(--bg-active)',
                padding: '1px 5px',
                borderRadius: 3,
                fontFamily: 'var(--font-mono)',
              }}
            >
              Ctrl+N
            </span>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 12px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <Search size={12} color="var(--text-muted)" strokeWidth={1.5} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
              }}
            />
          </div>
        </>
      ) : null}

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
        {sidebarOpen && (
          <div style={{ paddingTop: 8 }}>
            <ProjectSwitcher />
          </div>
        )}

        <div style={{ padding: sidebarOpen ? '6px 0' : '8px 0', display: 'flex', flexDirection: 'column', alignItems: sidebarOpen ? 'stretch' : 'center', gap: 2 }}>
          {NAV_ITEMS.map(({ type, icon: Icon, label }) => {
            const isActive = mainView.type === type

            if (!sidebarOpen) {
              return (
                <Tooltip key={type}>
                  <TooltipTrigger
                    onClick={() => setMainView({ type } as any)}
                    className="sidebar-rail-btn"
                    data-active={isActive ? '' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    <Icon size={16} strokeWidth={1.5} />
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={6}>
                    {label}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return (
              <button
                key={type}
                onClick={() => setMainView({ type } as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  width: '100%',
                  background: isActive ? 'var(--bg-active)' : 'none',
                  border: 'none',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 12.5,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'none' }}
              >
                <Icon size={14} strokeWidth={1.5} style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }} />
                <span style={{ flex: 1 }}>{label}</span>
                <span
                  style={{
                  fontSize: 11,
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    background: isActive ? 'var(--accent-muted)' : 'var(--bg-active)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                  }}
                >
                  {counts[type]}
                </span>
              </button>
            )
          })}
        </div>

        {sidebarOpen && (
          <>
            <div style={{ padding: '6px 0', borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '8px 12px 4px',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <Pin size={10} strokeWidth={2} />
                Fijados
              </div>
              <p
                style={{
                  padding: '4px 14px 8px',
                  margin: 0,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                Shift-click en sesión para fijar
              </p>
            </div>

            <div style={{ padding: '0 0 6px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 12px 2px',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <Clock size={10} strokeWidth={2} />
                Recientes
              </div>
              {recentSessions.length === 0 ? (
                <p
                  style={{
                    padding: '4px 14px 8px',
                    margin: 0,
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  Aún no hay sesiones
                </p>
              ) : (
                recentSessions.map((session) => (
                  <SessionItem key={session.id} session={session} variant="compact" />
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ flexShrink: 0 }}>
        <Separator />
        {sidebarOpen ? (
          <button
            onClick={() => useSettingsStore.getState().openSettings()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              width: '100%',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 12.5,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <Settings size={14} strokeWidth={1.5} />
            Configuración
          </button>
        ) : (
          <Tooltip>
            <TooltipTrigger
              onClick={() => useSettingsStore.getState().openSettings()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                padding: '8px 0',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <Settings size={16} strokeWidth={1.5} />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={6}>
              Configuración
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <SidebarResizeHandle isCollapsed={!sidebarOpen} onDragChange={setIsDragging} />
    </div>
  )
}