import { useState } from 'react'
import { useSettingsStore } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import { X } from 'lucide-react'
import { GeneralTab } from 'ia-sparta-settings'
import { AppearanceTab } from 'ia-sparta-settings'
import { KeybindsTab } from 'ia-sparta-settings'
import { ModelsTab } from 'ia-sparta-settings'
import { MemoryTab } from 'ia-sparta-settings'
import { SkillsTab } from 'ia-sparta-settings'
import { AgentsTab } from 'ia-sparta-settings'
import { SearchTab } from 'ia-sparta-settings'
import { ShellTab } from 'ia-sparta-settings'
import { HarnessesTab } from 'ia-sparta-settings'
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
    { id: 'harnesses', label: 'Herramientas IA' },
    { id: 'shell', label: 'Shell' },
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
        background: 'rgba(0,0,0,0.15)',
        animation: 'modalBackdropIn 0.15s ease-out',
      }}
      onClick={closeSettings}
    >
      <div
        style={{
          width: 'min(1100px, calc(100vw - 48px))',
          height: 'min(760px, calc(100vh - 48px))',
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
        <aside style={{
          width: 180,
          borderRight: '1px solid var(--border-subtle)',
          padding: '16px 10px',
          flexShrink: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {tabs.map(({ id, label }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md, 10px)',
                  background: isActive ? 'var(--accent-muted)' : 'transparent',
                  border: 'none',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                {label}
              </button>
            )
          })}
        </aside>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 28px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}>
            <h2 style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
            }}>{t('settings.title')}</h2>
            <button onClick={closeSettings} style={{
              width: 28, height: 28,
              background: 'none', border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <X size={16} />
            </button>
          </div>

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


