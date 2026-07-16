import { useThemeStore, type ThemeName } from '@/stores/theme.store'
import { useTranslation } from '@/i18n'

interface ThemeDef {
  name: ThemeName
  label: string
  accent: string
  bg: string
  sidebar: string
  group: 'dark' | 'light'
}

const THEMES: ThemeDef[] = [
  { name: 'midnight', label: 'Midnight', accent: '#6366F1', bg: '#0C0C10', sidebar: '#0F0F13', group: 'dark' },
  { name: 'obsidian', label: 'Obsidian', accent: '#FFFFFF', bg: '#050505', sidebar: '#080808', group: 'dark' },
  { name: 'emerald', label: 'Emerald', accent: '#10B981', bg: '#080D0A', sidebar: '#0A1109', group: 'dark' },
  { name: 'rose', label: 'Rose', accent: '#F43F5E', bg: '#0E0808', sidebar: '#120A0A', group: 'dark' },
  { name: 'amber', label: 'Amber', accent: '#F59E0B', bg: '#0E0C06', sidebar: '#120F08', group: 'dark' },
  { name: 'dracula', label: 'Dracula', accent: '#BD93F9', bg: '#191A24', sidebar: '#1B1C28', group: 'dark' },
  { name: 'catppuccin', label: 'Catppuccin', accent: '#CBA6F7', bg: '#1E1E2E', sidebar: '#181825', group: 'dark' },
  { name: 'nord', label: 'Nord', accent: '#88C0D0', bg: '#242933', sidebar: '#2E3440', group: 'dark' },
  { name: 'light', label: 'Light', accent: '#6366F1', bg: '#F4F4F7', sidebar: '#EBEBEF', group: 'light' },
  { name: 'linen', label: 'Lino', accent: '#C46A4A', bg: '#F7F2EA', sidebar: '#EFE9DF', group: 'light' },
  { name: 'sage', label: 'Salvia', accent: '#3A7D4A', bg: '#F3F7F2', sidebar: '#E8EDE6', group: 'light' },
  { name: 'mist', label: 'Bruma', accent: '#4A6A8A', bg: '#F2F4F7', sidebar: '#E6E9ED', group: 'light' },
  { name: 'sand', label: 'Arena', accent: '#8A6A3A', bg: '#F5F0E6', sidebar: '#EBE4D8', group: 'light' },
]

export function ThemePicker() {
  const { theme, setTheme } = useThemeStore()
  const { t } = useTranslation()
  const dark = THEMES.filter((th) => th.group === 'dark')
  const light = THEMES.filter((th) => th.group === 'light')

  function renderGrid(items: ThemeDef[]) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
      }}>
        {items.map((t) => (
          <button
            key={t.name}
            onClick={() => setTheme(t.name)}
            style={{
              border: `${theme === t.name ? '2px' : '1px'} solid ${theme === t.name ? t.accent : 'var(--border-normal)'}`,
              borderRadius: 8,
              overflow: 'hidden',
              cursor: 'pointer',
              background: 'none',
              padding: 0,
              transition: 'all 0.15s',
              transform: theme === t.name ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            <div style={{ display: 'flex', height: 48 }}>
              <div style={{ width: '32%', background: t.sidebar }} />
              <div style={{
                flex: 1,
                background: t.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ width: 20, height: 3, background: t.accent, borderRadius: 2 }} />
              </div>
            </div>
            <div style={{
              padding: '4px 0 5px',
              fontSize: 11,
              color: theme === t.name ? 'var(--accent)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              background: 'var(--bg-modal)',
              fontWeight: theme === t.name ? 500 : 400,
              textAlign: 'center',
            }}>
              {t.label}
            </div>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-ui)',
        marginBottom: 8,
      }}>
        {t('appearance.dark')}
      </div>
      {renderGrid(dark)}

      <div style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-ui)',
        marginTop: 16,
        marginBottom: 8,
      }}>
        {t('appearance.light')}
      </div>
      {renderGrid(light)}
    </div>
  )
}
