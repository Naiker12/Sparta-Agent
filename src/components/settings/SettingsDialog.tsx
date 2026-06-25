import { useState } from 'react'
import { useSettingsStore } from '@/stores/settings.store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { XIcon } from 'lucide-react'
import { GeneralTab } from './tabs/GeneralTab'
import { AppearanceTab } from './tabs/AppearanceTab'
import { KeybindsTab } from './tabs/KeybindsTab'
import { ModelsTab } from './tabs/ModelsTab'
import { ApiKeysTab } from './tabs/ApiKeysTab'
import { McpTab } from './tabs/McpTab'
import { MemoryTab } from './tabs/MemoryTab'
import { SkillsTab } from './tabs/SkillsTab'
import { AgentsTab } from './tabs/AgentsTab'

type SettingsTab = 'general' | 'appearance' | 'keybinds' | 'models' | 'keys' | 'mcp' | 'memory' | 'skills' | 'agents'

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'keybinds', label: 'Keybinds' },
  { id: 'models', label: 'Models' },
  { id: 'keys', label: 'API Keys' },
  { id: 'mcp', label: 'MCP Servers' },
  { id: 'memory', label: 'Memory' },
  { id: 'skills', label: 'Skills' },
  { id: 'agents', label: 'Agents' },
]

export function SettingsDialog() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const { closeSettings } = useSettingsStore()

  const tabContent: Record<SettingsTab, React.ReactNode> = {
    general: <GeneralTab />,
    appearance: <AppearanceTab />,
    keybinds: <KeybindsTab />,
    models: <ModelsTab />,
    keys: <ApiKeysTab />,
    mcp: <McpTab />,
    memory: <MemoryTab />,
    skills: <SkillsTab />,
    agents: <AgentsTab />,
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
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        animation: 'modalBackdropIn 0.15s ease-out',
      }}
      onClick={closeSettings}
    >
      <div
        style={{
          width: 720,
          height: 520,
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
          overflow: 'hidden auto',
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

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <h2 style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
            }}>Settings</h2>
            <button onClick={closeSettings} style={{
              width: 24, height: 24,
              background: 'none', border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <XIcon size={14} />
            </button>
          </div>

          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: '16px 20px' }}>
              {tabContent[activeTab]}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
