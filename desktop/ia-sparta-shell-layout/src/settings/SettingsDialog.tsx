import { useState } from 'react'
import { useSettingsStore } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import { X } from 'lucide-react'
import { GeneralTab } from 'ia-sparta-settings'
import { AppearanceTab } from 'ia-sparta-settings'
import { KeybindsTab } from 'ia-sparta-settings'
import { ModelsTab } from 'ia-sparta-settings'
import { McpTab } from 'ia-sparta-settings'
import { MemoryTab } from 'ia-sparta-settings'
import { SkillsTab } from 'ia-sparta-settings'
import { AgentsTab } from 'ia-sparta-settings'
import { SearchTab } from 'ia-sparta-settings'
import type { SettingsTab } from 'ia-sparta-core'

export function SettingsDialog() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const { closeSettings } = useSettingsStore()
  const { t } = useTranslation()

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: t('settings.general') },
    { id: 'appearance', label: t('settings.appearance') },
    { id: 'keybinds', label: t('settings.keybinds') },
    { id: 'models', label: t('settings.models') },
    { id: 'mcp', label: t('settings.mcp') },
    { id: 'memory', label: t('settings.memory') },
    { id: 'skills', label: t('settings.skills') },
    { id: 'agents', label: t('settings.agents') },
    { id: 'search', label: 'Búsqueda' },
  ]

  const tabContent: Record<SettingsTab, React.ReactNode> = {
    general: <GeneralTab />,
    appearance: <AppearanceTab />,
    keybinds: <KeybindsTab />,
    models: <ModelsTab />,
    mcp: <McpTab />,
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
        background: 'rgba(0,0,0,0.15)',
        animation: 'modalBackdropIn 0.15s ease-out',
      }}
      onClick={closeSettings}
    >
      <div
        style={{
          width: 900,
          height: 640,
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex',
          overflow: 'hidden',
          animation: 'modalScaleIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <aside style={{
          width: 160,
          borderRight: '1px solid var(--border-subtle)',
          paddingTop: 12,
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 16px',
                background: activeTab === id ? 'var(--accent-muted)' : 'none',
                border: 'none',
                color: activeTab === id ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (activeTab !== id) e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (activeTab !== id) e.currentTarget.style.background = 'none' }}
            >
              {label}
            </button>
          ))}
        </aside>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}>
            <h2 style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
            }}>{t('settings.title')}</h2>
            <button onClick={closeSettings} style={{
              width: 24, height: 24,
              background: 'none', border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
            <div style={{ padding: '16px 20px' }}>
              {tabContent[activeTab]}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
