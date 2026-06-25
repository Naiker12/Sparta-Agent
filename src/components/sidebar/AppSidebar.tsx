import { useState } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { Plus, Search, X, MessageSquare, Zap, Plug, Hash, Brain, Settings, SlidersHorizontal } from 'lucide-react'
import { useChatStore } from '@/stores/chat.store'
import { useSkillStore } from '@/stores/skill.store'
import { useMCPStore } from '@/stores/mcp.store'
import { useChannelStore } from '@/stores/channel.store'
import { useMemoryStore } from '@/stores/memory.store'
import { useUIStore, type MainView } from '@/stores/ui.store'
import { useSettingsStore } from '@/stores/settings.store'
import { SessionItem } from './SessionItem'

const NAV_ITEMS = [
  { type: 'sessions' as const, icon: MessageSquare, label: 'Sesiones' },
  { type: 'skills'   as const, icon: Zap,           label: 'Skills'   },
  { type: 'mcp'      as const, icon: Plug,          label: 'MCP'      },
  { type: 'channels' as const, icon: Hash,          label: 'Canales'  },
  { type: 'memory'   as const, icon: Brain,         label: 'Memoria'  },
]

export function AppSidebar() {
  const { sessions, createSession }   = useChatStore()
  const { skills }                    = useSkillStore()
  const { servers }                   = useMCPStore()
  const { channels }                  = useChannelStore()
  const { entries }                   = useMemoryStore()
  const { mainView, setMainView }     = useUIStore()
  const [query, setQuery]             = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const counts: Record<string, string | number> = {
    sessions: sessions.length,
    skills:   skills.length,
    mcp:      `${servers.filter(s => s.connected).length}/${servers.length}`,
    channels: channels.length,
    memory:   entries.length,
  }

  const filtered  = sessions.filter(s =>
    !query || s.title.toLowerCase().includes(query.toLowerCase())
  )
  const pinned    = filtered.filter(s => s.pinned)
  const unpinned  = filtered.filter(s => !s.pinned)

  return (
    <Sidebar collapsible="icon">

      {/* ── Header: Logo + New Session ── */}
      <SidebarHeader style={{ padding: 0, gap: 0 }}>

        {/* Logo */}
        <div className="sidebar-logo">
          <img src="/sparta-icon.png" alt="Sparta" />
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-title">SPARTA</span>
            <span className="sidebar-logo-subtitle">AGENT</span>
          </div>
        </div>

        {/* New Session Button */}
        <div style={{ padding: '0 12px 12px' }}>
          <button
            type="button"
            className="sidebar-new-session-btn"
            onClick={() => { createSession(); setMainView({ type: 'chat' }) }}
          >
            <Plus size={16} strokeWidth={2.5} className="btn-icon" />
            <span style={{ flex: 1, textAlign: 'left' }}>Nueva sesión</span>
            <span className="btn-kbd">⌘N</span>
          </button>
        </div>

      </SidebarHeader>

      {/* ── Content ── */}
      <SidebarContent style={{ gap: 0 }}>

        {/* Navigation Items */}
        <div className="sidebar-nav">
          {NAV_ITEMS.map(({ type, icon: Icon, label }) => {
            const isActive = mainView.type === type || (type === 'sessions' && mainView.type === 'chat')
            return (
              <button
                key={type}
                type="button"
                className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => setMainView({ type: type as MainView['type'] })}
              >
                {isActive && <span className="nav-indicator" />}
                <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} className="nav-icon" />
                <span className="nav-label">{label}</span>
                <span className="sidebar-nav-badge">{counts[type]}</span>
              </button>
            )
          })}
        </div>

        {/* Separator */}
        <div className="sidebar-separator" />

        {/* Pinned Section */}
        {pinned.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div className="sidebar-section-label">Fijados</div>
            <div className="sidebar-sessions-list">
              {pinned.map(s => (
                <SessionItem key={s.id} session={s} />
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div
          className={`sidebar-search-container ${searchFocused ? 'focused' : ''}`}
        >
          <Search size={15} strokeWidth={2} className="search-icon" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar sesiones..."
          />
          {query ? (
            <button type="button" className="search-action-btn" onClick={() => setQuery('')}>
              <X size={12} strokeWidth={2.5} />
            </button>
          ) : (
            <button type="button" className="search-action-btn" title="Filtrar">
              <SlidersHorizontal size={13} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Recientes Section */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="sidebar-section-label">Recientes</div>
          {unpinned.length === 0 && pinned.length === 0 ? (
            <div className="sidebar-empty-state">
              <p>Aún no hay sesiones.</p>
              <p>Crea una nueva sesión para empezar.</p>
            </div>
          ) : (
            <div className="sidebar-sessions-list" style={{ overflow: 'auto', flex: 1, paddingBottom: 16 }}>
              {unpinned.map(s => (
                <SessionItem key={s.id} session={s} />
              ))}
            </div>
          )}
        </div>

      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter style={{ padding: '8px 12px 12px', gap: 0 }}>
        <div className="sidebar-separator" style={{ margin: '0 4px 8px' }} />
        <button
          type="button"
          className="sidebar-footer-btn"
          onClick={() => useSettingsStore.getState().openSettings()}
        >
          <Settings size={18} strokeWidth={1.75} className="footer-icon" />
          <span>Configuración</span>
        </button>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
