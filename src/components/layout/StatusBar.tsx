import { Bot, Clock } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { useProviderStore } from '@/stores/provider.store'
import { BrandIcon } from '@/components/ui/BrandIcon'

export function StatusBar() {
  const activeModel = useSettingsStore((s) => s.activeModel)
  const providers = useProviderStore((s) => s.providers)
  const activeProvider = providers.find((p) => p.defaultModel === activeModel)

  return (
    <div style={{
      height: 'var(--statusbar-h)',
      background: 'var(--bg-sidebar)',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      flexShrink: 0,
    }}>
      <SBItem>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--status-ok)',
          boxShadow: '0 0 0 2px rgba(34,197,94,0.2)',
        }} />
        Gateway ready
      </SBItem>
      <SBItem><Bot size={11} strokeWidth={1.5} />Agents</SBItem>
      <SBItem><Clock size={11} strokeWidth={1.5} />Cron</SBItem>

      <div style={{ flex: 1 }} />

      <SBItem style={{ borderLeft: '1px solid var(--border-subtle)' }}>
        {activeProvider ? <BrandIcon vendor={activeProvider.vendor} size={14} /> : null}
        {activeModel}
      </SBItem>
      <SBItem>0 tok</SBItem>
      <SBItem style={{ color: 'var(--text-muted)' }}>v0.1.0</SBItem>
    </div>
  )
}

function SBItem({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '0 10px',
      height: '100%',
      fontSize: 11,
      color: 'var(--text-secondary)',
      borderRight: '1px solid var(--border-subtle)',
      cursor: 'default',
      fontFamily: 'var(--font-ui)',
      ...style,
    }}>
      {children}
    </div>
  )
}
