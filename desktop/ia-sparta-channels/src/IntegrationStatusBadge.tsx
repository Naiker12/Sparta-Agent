import type { IntegrationStatus } from 'ia-sparta-core'

interface IntegrationStatusBadgeProps {
  status: IntegrationStatus
  size?: number
}

export function IntegrationStatusBadge({ status, size = 6 }: IntegrationStatusBadgeProps) {
  const colors: Record<IntegrationStatus, string> = {
    not_configured: 'var(--text-muted)',
    connecting: 'var(--status-warn)',
    connected: 'var(--status-ok)',
    error: 'var(--status-err)',
  }

  const isPulsing = status === 'connecting' || status === 'connected'

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colors[status],
        boxShadow: `0 0 4px 1px ${colors[status]}66`,
        animation: isPulsing ? 'pulse-dot 2s infinite' : 'none',
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  )
}
