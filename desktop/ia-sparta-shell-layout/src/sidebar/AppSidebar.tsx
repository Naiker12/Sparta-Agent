import { useState, useRef, useEffect } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from 'ia-sparta-design-system'
import {
  Plus, Search, X, MessageSquare, Zap, Plug, Hash, Brain, Settings,
  SlidersHorizontal, Trash2, Check, Shield, Pin, Clock, ArrowDown, Calendar, Box
} from 'lucide-react'
import { useSessionStore } from 'ia-sparta-core'
import { useSessionTabsStore } from 'ia-sparta-core'
import { useChatStore } from 'ia-sparta-core'
import { useSkillStore } from 'ia-sparta-core'
import { useMCPStore } from 'ia-sparta-core'
import { useChannelStore } from 'ia-sparta-core'
import { useMemoryStore } from 'ia-sparta-core'
import { useProviderStore } from 'ia-sparta-core'
import { useUIStore, type MainView } from 'ia-sparta-core'
import { useSettingsStore } from 'ia-sparta-core'
import { SessionItem } from './SessionItem'
import { useTranslation } from 'ia-sparta-i18n'

type FilterMode = 'all' | 'chat' | 'agent' | 'pinned'
type SortBy = 'recent' | 'oldest' | 'alphabetical'

export function AppSidebar() {
  const { sessions, resetActiveSession, deleteAllSessions } = useSessionStore()
  const { activeSkillIds }            = useSkillStore()
  const { servers }                   = useMCPStore()
  const { channels }                  = useChannelStore()
  const { entries }                   = useMemoryStore()
  const { providers }                 = useProviderStore()
  const { mainView, setMainView }     = useUIStore()
  const [query, setQuery]             = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [filterOpen, setFilterOpen]   = useState(false)
  const [filterMode, setFilterMode]   = useState<FilterMode>('all')
  const [sortBy, setSortBy]           = useState<SortBy>('recent')
  const filterRef                     = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (!filterOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [filterOpen])

  const totalModels = providers.reduce((acc, p) => acc + (p.models?.length ?? 0), 0)

  const NAV_ITEMS = [
    { type: 'models'   as const, icon: Box,           label: 'Model Hub' },
    { type: 'skills'   as const, icon: Zap,           label: 'Skills'   },
    { type: 'mcp'      as const, icon: Plug,          label: 'MCP'      },
    { type: 'channels' as const, icon: Hash,          label: t('chat.activeSkills') === 'Código' ? 'Canales' : 'Channels' },
    { type: 'memory'   as const, icon: Brain,         label: t('settings.memory') || 'Memoria' },
  ]

  const counts: Record<string, string | number> = {
    models:   `${totalModels}`,
    skills:   activeSkillIds.length > 0 ? `${activeSkillIds.length}` : '0',
    mcp:      `${servers.filter(s => s.connected).length}/${servers.length}`,
    channels: channels.length,
    memory:   entries.length,
  }

  // 1. Filtrado por texto y por modo
  const filtered = sessions.filter((s) => {
    if (query && !s.title.toLowerCase().includes(query.toLowerCase())) {
      return false
    }
    if (filterMode === 'chat') {
      return s.sessionMode !== 'agent'
    }
    if (filterMode === 'agent') {
      return s.sessionMode === 'agent'
    }
    if (filterMode === 'pinned') {
      return !!s.pinned
    }
    return true
  })

  // 2. Ordenamiento
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return (a.title || '').localeCompare(b.title || '')
    }
    if (sortBy === 'oldest') {
      return (a.createdAt || 0) - (b.createdAt || 0)
    }
    // 'recent' (default)
    const timeA = a.updatedAt || a.createdAt || 0
    const timeB = b.updatedAt || b.createdAt || 0
    return timeB - timeA
  })

  const pinned    = sorted.filter(s => s.pinned)
  const unpinned  = sorted.filter(s => !s.pinned)

  const isFilterActive = filterMode !== 'all' || sortBy !== 'recent'

  function handleDeleteAllSessions() {
    if (window.confirm('¿Estás seguro de que deseas eliminar todas las conversaciones de chat? Se borrará todo el historial y no se podrá recuperar.')) {
      deleteAllSessions()
      useChatStore.getState().deleteAllMessages()
      const tabs = useSessionTabsStore.getState().openTabs
      for (const id of [...tabs]) {
        useSessionTabsStore.getState().closeTab(id)
      }
      resetActiveSession()
    }
  }

  return (
    <Sidebar collapsible="icon">

      {/* ── Header: Logo + New Session ── */}
      <SidebarHeader style={{ padding: 0, gap: 0 }}>

        {/* Logo */}
        <div className="sidebar-logo">
          <img src="./sparta-icon.png" alt="Sparta" />
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
              const newId = useSessionStore.getState().createSession()
              useSessionTabsStore.getState().openTab(newId)
              setMainView({ type: 'chat', sessionId: newId })
            }}
          >
            <Plus size={16} strokeWidth={2.5} className="btn-icon" />
            <span className="btn-label" style={{ flex: 1, textAlign: 'left' }}>{t('sidebar.newSession') || 'Nueva conversación'}</span>
            <span className="btn-kbd">⌘N</span>
          </button>
        </div>

      </SidebarHeader>

      {/* ── Content ── */}
      <SidebarContent style={{ gap: 0 }}>

        {/* Navigation Items */}
        <div className="sidebar-nav">
          {NAV_ITEMS.map(({ type, icon: Icon, label }) => {
            const isActive = mainView.type === type
            return (
              <button
                key={type}
                type="button"
                className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setMainView({ type: type as MainView['type'] })
                }}
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
        {pinned.length > 0 && filterMode !== 'pinned' && (
          <div style={{ marginBottom: 8 }}>
            <div className="sidebar-section-label">{t('sidebar.pin') === 'Fijar' ? 'Fijados' : 'Pinned'}</div>
            <div className="sidebar-sessions-list">
              {pinned.map(s => (
                <SessionItem key={s.id} session={s} />
              ))}
            </div>
          </div>
        )}

        {/* Search & Filter Bar with Popover */}
        <div style={{ position: 'relative', margin: '0 10px 8px' }} ref={filterRef}>
          <div
            className={`sidebar-search-container ${searchFocused ? 'focused' : ''}`}
            style={{ margin: 0, width: '100%' }}
          >
            <Search size={15} strokeWidth={2} className="search-icon" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={t('sidebar.search') || 'Buscar en sidebar...'}
            />
            {query ? (
              <button type="button" className="search-action-btn" onClick={() => setQuery('')}>
                <X size={12} strokeWidth={2.5} />
              </button>
            ) : (
              <button
                type="button"
                className="search-action-btn"
                title="Filtros y ordenación de conversaciones"
                onClick={() => setFilterOpen(!filterOpen)}
                style={{
                  color: isFilterActive ? '#B45309' : undefined,
                  backgroundColor: isFilterActive ? '#F5EFE6' : undefined,
                  borderRadius: 6,
                }}
              >
                <SlidersHorizontal size={13} strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Interactive Filter Dropdown Popover */}
          {filterOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: 220,
                backgroundColor: '#FFFFFF',
                border: '1px solid #EAE3D8',
                borderRadius: 14,
                boxShadow: '0 12px 32px -4px rgba(40, 25, 10, 0.14), 0 2px 8px rgba(0,0,0,0.04)',
                padding: '8px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontFamily: 'var(--font-ui, system-ui, sans-serif)',
              }}
            >
              {/* Sección 1: Filtrar por tipo */}
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#8A7D6F',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 6px',
                    display: 'block',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  Filtrar por
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                  {[
                    { id: 'all' as const, label: 'Todas las sesiones', count: sessions.length },
                    { id: 'chat' as const, label: 'Modo Chat', icon: MessageSquare },
                    { id: 'agent' as const, label: 'Modo Agente', icon: Shield },
                    { id: 'pinned' as const, label: 'Fijadas', icon: Pin },
                  ].map((item) => {
                    const isSelected = filterMode === item.id
                    const Icon = item.icon

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setFilterMode(item.id)
                          setFilterOpen(false)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 8,
                          border: 'none',
                          backgroundColor: isSelected ? '#F5EFE6' : 'transparent',
                          color: isSelected ? '#1C1713' : '#5C5245',
                          fontSize: 11.5,
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.12s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#FAF8F5'
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {Icon && <Icon size={12} color={isSelected ? '#B45309' : '#8A7D6F'} />}
                          <span>{item.label}</span>
                        </span>
                        {isSelected ? (
                          <Check size={12} color="#B45309" strokeWidth={2.5} />
                        ) : item.count !== undefined ? (
                          <span style={{ fontSize: 10, color: '#8A7D6F' }}>{item.count}</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Divisor */}
              <div style={{ height: 1, backgroundColor: '#F0ECE4', margin: '2px 0' }} />

              {/* Sección 2: Ordenación */}
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#8A7D6F',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 6px',
                    display: 'block',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  Ordenar por
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                  {[
                    { id: 'recent' as const, label: 'Más recientes', icon: Clock },
                    { id: 'oldest' as const, label: 'Más antiguas', icon: Calendar },
                    { id: 'alphabetical' as const, label: 'Alfabético A-Z', icon: ArrowDown },
                  ].map((item) => {
                    const isSelected = sortBy === item.id
                    const Icon = item.icon

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSortBy(item.id)
                          setFilterOpen(false)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 8,
                          border: 'none',
                          backgroundColor: isSelected ? '#F5EFE6' : 'transparent',
                          color: isSelected ? '#1C1713' : '#5C5245',
                          fontSize: 11.5,
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.12s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#FAF8F5'
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon size={12} color={isSelected ? '#B45309' : '#8A7D6F'} />
                          <span>{item.label}</span>
                        </span>
                        {isSelected && <Check size={12} color="#B45309" strokeWidth={2.5} />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Botón de restablecer si hay filtros activos */}
              {isFilterActive && (
                <>
                  <div style={{ height: 1, backgroundColor: '#F0ECE4', margin: '2px 0' }} />
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode('all')
                      setSortBy('recent')
                      setFilterOpen(false)
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#B45309',
                      fontSize: 10.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    Restablecer filtros
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Recientes Section */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingRight: 12,
          }}>
            <div className="sidebar-section-label">
              {filterMode === 'pinned'
                ? 'Fijadas'
                : filterMode === 'agent'
                  ? 'Modo Agente'
                  : filterMode === 'chat'
                    ? 'Modo Chat'
                    : (t('sidebar.pin') === 'Fijar' ? 'Recientes' : 'Recent')}
            </div>
            {sessions.length > 0 && (
              <button
                type="button"
                className="sidebar-vaciar-btn"
                onClick={handleDeleteAllSessions}
                title="Vaciar todos los chats e historial de sesiones"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 10,
                  fontFamily: 'var(--font-ui)',
                  transition: 'color 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <Trash2 size={11} strokeWidth={2} />
                <span className="sidebar-vaciar-text">Vaciar</span>
              </button>
            )}
          </div>

          {unpinned.length === 0 && pinned.length === 0 ? (
            <div className="sidebar-empty-state">
              <p>{t('sidebar.emptyState') || 'No hay conversaciones aún.'}</p>
              <p>{(t('chat.welcome') || 'Describe tu tarea.').split('.')[0] + '.'}</p>
            </div>
          ) : (
            <div className="sidebar-sessions-list" style={{ overflow: 'auto', flex: 1, paddingBottom: 16 }}>
              {(filterMode === 'pinned' ? pinned : unpinned).map(s => (
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
          <span className="footer-label">{t('sidebar.settings') || 'Configuración'}</span>
        </button>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
