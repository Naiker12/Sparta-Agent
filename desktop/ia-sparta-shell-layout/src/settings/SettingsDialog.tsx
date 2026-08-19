import { useState, useMemo } from 'react'
import { useSettingsStore } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import {
  X,
  SlidersHorizontal,
  Palette,
  Keyboard,
  Cpu,
  Wrench,
  Terminal,
  Brain,
  Sparkles,
  Bot,
  Search,
  Mic,
  Activity,
  Database,
} from 'lucide-react'
import {
  GeneralTab,
  AppearanceTab,
  KeybindsTab,
  ModelsTab,
  MemoryTab,
  SkillsTab,
  AgentsTab,
  SearchTab,
  ShellTab,
  HarnessesTab,
  VoiceTab,
  SystemTab,
  DataTab,
} from 'ia-sparta-settings'
import type { SettingsTab } from 'ia-sparta-core'

interface TabItem {
  id: SettingsTab
  label: string
  icon: typeof SlidersHorizontal
  category: 'config' | 'ai_voice' | 'system_data' | 'agents_skills'
  isNew?: boolean
  keywords?: string[]
}

export function SettingsDialog() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [searchQuery, setSearchQuery] = useState('')
  const { closeSettings } = useSettingsStore()
  const { t } = useTranslation()

  const tabs: TabItem[] = [
    {
      id: 'general',
      label: t('settings.general'),
      icon: SlidersHorizontal,
      category: 'config',
      keywords: ['modelo', 'idioma', 'razonamiento', 'esfuerzo', 'budget'],
    },
    {
      id: 'appearance',
      label: t('settings.appearance'),
      icon: Palette,
      category: 'config',
      keywords: ['tema', 'color', 'fuente', 'dark', 'light', 'diseño'],
    },
    {
      id: 'keybinds',
      label: t('settings.keybinds'),
      icon: Keyboard,
      category: 'config',
      keywords: ['atajos', 'teclado', 'shortcuts'],
    },
    {
      id: 'models',
      label: t('settings.models'),
      icon: Cpu,
      category: 'ai_voice',
      keywords: ['proveedor', 'openai', 'anthropic', 'gemini', 'api key', 'ollama'],
    },
    {
      id: 'voice',
      label: 'Voz & Audio',
      icon: Mic,
      category: 'ai_voice',
      isNew: true,
      keywords: ['dictado', 'stt', 'tts', 'micrófono', 'whisper', 'lectura', 'hablar'],
    },
    {
      id: 'harnesses',
      label: 'Herramientas IA',
      icon: Wrench,
      category: 'ai_voice',
      keywords: ['mcp', 'tools', 'conectores', 'notion', 'drive', 'github'],
    },
    {
      id: 'system',
      label: 'Sistema & Hardware',
      icon: Activity,
      category: 'system_data',
      isNew: true,
      keywords: ['cpu', 'ram', 'vram', 'gpu', 'disco', 'cuda', 'vulkan', 'unsloth'],
    },
    {
      id: 'data',
      label: 'Datos & Archivo',
      icon: Database,
      category: 'system_data',
      isNew: true,
      keywords: ['historial', 'chats', 'exportar', 'importar', 'borrar', 'backup'],
    },
    {
      id: 'shell',
      label: 'Terminal / Shell',
      icon: Terminal,
      category: 'system_data',
      keywords: ['powershell', 'cmd', 'bash', 'entorno', 'variables'],
    },
    {
      id: 'memory',
      label: t('settings.memory'),
      icon: Brain,
      category: 'agents_skills',
      keywords: ['memoria', 'semántica', 'contexto', 'vector'],
    },
    {
      id: 'skills',
      label: t('settings.skills'),
      icon: Sparkles,
      category: 'agents_skills',
      keywords: ['habilidades', 'plugins', 'skills'],
    },
    {
      id: 'agents',
      label: t('settings.agents'),
      icon: Bot,
      category: 'agents_skills',
      keywords: ['autonomía', 'permisos', 'subagentes', 'modo'],
    },
    {
      id: 'search',
      label: 'Búsqueda Web',
      icon: Search,
      category: 'agents_skills',
      keywords: ['web', 'google', 'tavily', 'brave'],
    },
  ]

  const categories = [
    { id: 'config' as const, label: 'Configuración' },
    { id: 'ai_voice' as const, label: 'Modelos & Voz' },
    { id: 'system_data' as const, label: 'Sistema & Datos' },
    { id: 'agents_skills' as const, label: 'Agentes & Memoria' },
  ]

  // Filter tabs by search query
  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return tabs
    const q = searchQuery.toLowerCase().trim()
    return tabs.filter((t) => {
      if (t.label.toLowerCase().includes(q)) return true
      if (t.id.toLowerCase().includes(q)) return true
      if (t.keywords && t.keywords.some((k) => k.toLowerCase().includes(q))) return true
      return false
    })
  }, [tabs, searchQuery])

  const tabContent: Record<SettingsTab, React.ReactNode> = {
    general: <GeneralTab />,
    appearance: <AppearanceTab />,
    keybinds: <KeybindsTab />,
    models: <ModelsTab />,
    voice: <VoiceTab />,
    system: <SystemTab />,
    data: <DataTab />,
    harnesses: <HarnessesTab />,
    shell: <ShellTab />,
    memory: <MemoryTab />,
    skills: <SkillsTab />,
    agents: <AgentsTab />,
    search: <SearchTab />,
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        animation: 'modalBackdropIn 0.15s ease-out',
      }}
      onClick={closeSettings}
    >
      <div
        style={{
          width: 'min(1120px, calc(100vw - 48px))',
          height: 'min(780px, calc(100vh - 48px))',
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-2xl, 20px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex',
          overflow: 'hidden',
          animation: 'modalScaleIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <aside
          style={{
            width: 230,
            borderRight: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            padding: '14px 10px',
            flexShrink: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Top Pill Search Bar: "Buscar en la configuración" */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 999,
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              marginBottom: 4,
            }}
          >
            <Search size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en la configuración"
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 12,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                width: '100%',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Grouped Tabs List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {categories.map((cat) => {
              const catTabs = filteredTabs.filter((t) => t.category === cat.id)
              if (catTabs.length === 0) return null

              return (
                <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Category Header Label */}
                  <div
                    style={{
                      padding: '2px 10px 4px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '-0.01em',
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    {cat.label}
                  </div>

                  {/* Tabs in Category */}
                  {catTabs.map(({ id, label, icon: Icon, isNew }) => {
                    const isActive = activeTab === id
                    return (
                      <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          textAlign: 'left',
                          padding: '7px 12px',
                          borderRadius: 'var(--radius-md, 8px)',
                          background: isActive ? 'var(--bg-hover)' : 'transparent',
                          border: isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
                          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontSize: 12.5,
                          fontWeight: isActive ? 700 : 500,
                          fontFamily: 'var(--font-ui)',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                          gap: 8,
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <Icon size={14} color={isActive ? 'var(--accent)' : 'var(--text-muted)'} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {label}
                          </span>
                        </div>

                        {isNew && (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 4,
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              color: 'var(--status-ok, #10B981)',
                              fontFamily: 'monospace',
                            }}
                          >
                            NUEVO
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}

            {filteredTabs.length === 0 && (
              <div style={{ padding: '14px 10px', fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center' }}>
                No se encontraron secciones para "{searchQuery}".
              </div>
            )}
          </div>
        </aside>

        {/* Content View */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: 'var(--bg-base)' }}>
          {/* Content Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 28px',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                margin: 0,
              }}
            >
              {tabs.find((t) => t.id === activeTab)?.label || t('settings.title')}
            </h2>

            <button
              onClick={closeSettings}
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
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Tab Body */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
            <div style={{ padding: '24px 32px' }}>
              {tabContent[activeTab]}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
