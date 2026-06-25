import { useThemeStore, type ThemeName } from '@/stores/theme.store'

const THEMES: { name: ThemeName; label: string; accent: string; bg: string; sidebar: string }[] = [
  { name: 'midnight', label: 'Midnight', accent: '#6366F1', bg: '#0C0C10', sidebar: '#0F0F13' },
  { name: 'obsidian', label: 'Obsidian', accent: '#FFFFFF', bg: '#050505', sidebar: '#080808' },
  { name: 'emerald', label: 'Emerald', accent: '#10B981', bg: '#080D0A', sidebar: '#0A1109' },
  { name: 'rose', label: 'Rose', accent: '#F43F5E', bg: '#0E0808', sidebar: '#120A0A' },
  { name: 'amber', label: 'Amber', accent: '#F59E0B', bg: '#0E0C06', sidebar: '#120F08' },
  { name: 'dracula', label: 'Dracula', accent: '#BD93F9', bg: '#191A24', sidebar: '#1B1C28' },
  { name: 'catppuccin', label: 'Catppuccin', accent: '#CBA6F7', bg: '#1E1E2E', sidebar: '#181825' },
  { name: 'nord', label: 'Nord', accent: '#88C0D0', bg: '#242933', sidebar: '#2E3440' },
  { name: 'light', label: 'Light', accent: '#6366F1', bg: '#F4F4F7', sidebar: '#EBEBEF' },
]

export function ThemePicker() {
  const { theme, setTheme } = useThemeStore()

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 8,
      marginTop: 8,
    }}>
      {THEMES.map((t) => (
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
