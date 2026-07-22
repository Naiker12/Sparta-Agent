import { useState } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from 'ia-sparta-design-system'
import { Plus, Search, X, MessageSquare, Zap, Plug, Hash, Brain, Settings, SlidersHorizontal } from 'lucide-react'
import { useSessionStore } from 'ia-sparta-core'
import { useSessionTabsStore } from 'ia-sparta-core'
import { useSkillStore } from 'ia-sparta-core'
import { useMCPStore } from 'ia-sparta-core'
import { useChannelStore } from 'ia-sparta-core'
import { useMemoryStore } from 'ia-sparta-core'
import { useUIStore, type MainView } from 'ia-sparta-core'
import { useSettingsStore } from 'ia-sparta-core'
import { SessionItem } from './SessionItem'
import { useTranslation } from 'ia-sparta-i18n'

export function AppSidebar() {
  const { sessions, resetActiveSession }   = useSessionStore()
  const { activeSkillIds }            = useSkillStore()
  const { servers }                   = useMCPStore()
  const { channels }                  = useChannelStore()
  const { entries }                   = useMemoryStore()
  const { mainView, setMainView }     = useUIStore()
  const [query, setQuery]             = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const { t } = useTranslation()

  const NAV_ITEMS = [
    { type: 'sessions' as const, icon: MessageSquare, label: t('sidebar.sessions') },
    { type: 'skills'   as const, icon: Zap,           label: 'Skills'   },
    { type: 'mcp'      as const, icon: Plug,          label: 'MCP'      },
    { type: 'channels' as const, icon: Hash,          label: t('chat.activeSkills') === 'Código' ? 'Canales' : 'Channels' },
    { type: 'memory'   as const, icon: Brain,         label: t('settings.memory') },
  ]

  const counts: Record<string, string | number> = {
    sessions: sessions.length,
    skills:   activeSkillIds.length > 0 ? `${activeSkillIds.length}` : '0',
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
        <div className="sidebar-new-session-wrapper" style={{ padding: '0 12px 12px' }}>
          <button
            type="button"
            className="sidebar-new-session-btn"
            onClick={() => {
              const tabs = useSessionTabsStore.getState().openTabs
              for (const id of [...tabs]) {
                useSessionTabsStore.getState().closeTab(id)
              }
              resetActiveSession()
              setMainView({ type: 'chat' })
            }}
          >
            <Plus size={16} strokeWidth={2.5} className="btn-icon" />
            <span className="btn-label" style={{ flex: 1, textAlign: 'left' }}>{t('sidebar.newSession')}</span>
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
            <div className="sidebar-section-label">{t('sidebar.pin') === 'Fijar' ? 'Fijados' : 'Pinned'}</div>
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
            placeholder={t('sidebar.search')}
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
          <div className="sidebar-section-label">{t('sidebar.pin') === 'Fijar' ? 'Recientes' : 'Recent'}</div>
          {unpinned.length === 0 && pinned.length === 0 ? (
            <div className="sidebar-empty-state">
              <p>{t('sidebar.emptyState')}</p>
              <p>{t('chat.welcome').split('.')[0] + '.'}</p>
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
      <SidebarFooter className="sidebar-footer-wrapper" style={{ padding: '8px 12px 12px', gap: 0 }}>
        <div className="sidebar-separator" style={{ margin: '0 4px 8px' }} />
        <button
          type="button"
          className="sidebar-footer-btn"
          onClick={() => useSettingsStore.getState().openSettings()}
        >
          <Settings size={18} strokeWidth={1.75} className="footer-icon" />
          <span className="footer-label">{t('sidebar.settings')}</span>
        </button>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
