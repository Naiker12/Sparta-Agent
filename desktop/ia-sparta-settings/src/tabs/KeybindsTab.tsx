import { SettingGroup } from './primitives'
import { useTranslation } from 'ia-sparta-i18n'

interface Keybind {
  id: string
  labelKey: string
  descKey?: string
  combo: string
}

const KEYBINDS: Keybind[] = [
  { id: 'new-session', labelKey: 'keybinds.newSession', descKey: 'keybinds.newSessionDesc', combo: 'Ctrl + N' },
  { id: 'open-settings', labelKey: 'keybinds.openSettings', combo: 'Ctrl + ,' },
  { id: 'toggle-sidebar', labelKey: 'keybinds.toggleSidebar', combo: 'Ctrl + \\' },
  { id: 'toggle-explorer', labelKey: 'keybinds.toggleExplorer', combo: 'Ctrl + B' },
  { id: 'toggle-terminal', labelKey: 'keybinds.toggleTerminal', combo: 'Ctrl + `' },
  { id: 'switch-chat', labelKey: 'keybinds.switchChat', combo: 'Ctrl + 1' },
  { id: 'switch-terminal', labelKey: 'keybinds.switchTerminal', combo: 'Ctrl + 3' },
  { id: 'switch-agents', labelKey: 'keybinds.switchAgents', combo: 'Ctrl + 4' },
  { id: 'send-message', labelKey: 'keybinds.sendMessage', combo: 'Enter' },
  { id: 'newline', labelKey: 'keybinds.newline', combo: 'Shift + Enter' },
  { id: 'search', labelKey: 'keybinds.search', combo: 'Ctrl + K' },
  { id: 'close-modal', labelKey: 'keybinds.closeModal', combo: 'Escape' },
]

export function KeybindsTab() {
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title={t('keybinds.title')}
        description={t('keybinds.desc')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
          {KEYBINDS.map((kb) => (
            <div
              key={kb.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '10px 0',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 500,
                  }}
                >
                  {t(kb.labelKey)}
                </div>
                {kb.descKey && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-ui)',
                      marginTop: 2,
                    }}
                  >
                    {t(kb.descKey)}
                  </div>
                )}
              </div>
              <KbdCombo combo={kb.combo} />
            </div>
          ))}
        </div>
      </SettingGroup>
    </div>
  )
}

function KbdCombo({ combo }: { combo: string }) {
  const parts = combo.split('+').map((p) => p.trim())
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {parts.map((p, i) => (
        <span key={i}>
          <kbd
            style={{
              display: 'inline-block',
              padding: '2px 6px',
              fontSize: 10.5,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-sm)',
              minWidth: 18,
              textAlign: 'center',
            }}
          >
            {p}
          </kbd>
        </span>
      ))}
    </div>
  )
}
