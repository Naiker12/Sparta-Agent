import { Bell } from 'lucide-react'
import { BrandIcon } from 'ia-sparta-design-system'
import type { IntegrationProvider } from 'ia-sparta-core'

const PROVIDER_INFO: Record<IntegrationProvider, { name: string; vendor: string; desc: string }> = {
  discord: { name: 'Discord', vendor: 'discord', desc: 'Conecta tu servidor de Discord y recibe mensajes en tiempo real.' },
  slack: { name: 'Slack', vendor: 'slack', desc: 'Integra los canales de tu workspace de Slack.' },
  whatsapp: { name: 'WhatsApp', vendor: 'whatsapp', desc: 'Recibe y envía mensajes desde WhatsApp.' },
  email: { name: 'Email', vendor: '', desc: 'Gestiona correos electrónicos desde Sparta Agent.' },
  telegram: { name: 'Telegram', vendor: 'telegram', desc: '' },
}

interface ComingSoonPanelProps {
  provider: IntegrationProvider
}

export function ComingSoonPanel({ provider }: ComingSoonPanelProps) {
  const info = PROVIDER_INFO[provider]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 }}>
      <div
        style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, opacity: 0.5,
        }}
      >
        {info.vendor ? <BrandIcon vendor={info.vendor} size={32} /> : '\u2709\uFE0F'}
      </div>

      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
        {info.name}
      </div>

      <div
        style={{
          fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--status-warn)',
          fontFamily: 'var(--font-ui)', padding: '3px 10px',
          background: 'rgba(245,158,11,0.1)', borderRadius: 'var(--radius-sm)',
        }}
      >
        Próximamente
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', textAlign: 'center', maxWidth: 320, lineHeight: 1.6, margin: 0 }}>
        {info.desc}
      </p>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textAlign: 'center', maxWidth: 320, margin: 0 }}>
        Esta integración estará disponible en una próxima versión de Sparta Agent.
      </p>

      <button
        disabled
        style={{
          marginTop: 8, padding: '6px 16px', background: 'var(--bg-active)',
          border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-md)',
          color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-ui)',
          cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <Bell size={11} strokeWidth={1.5} />
        Notifícame cuando esté lista
      </button>
    </div>
  )
}
