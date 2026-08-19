import type { ReactNode } from 'react'

export interface SettingRowProps {
  label?: string
  title?: string
  description?: string
  children?: ReactNode
  control?: ReactNode
  action?: ReactNode
  danger?: boolean
}

export function SettingRow({
  label,
  title,
  description,
  children,
  control,
  action,
  danger,
}: SettingRowProps) {
  const displayLabel = label || title || ''
  const displayControl = children || control

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        gap: 16,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: danger ? 'var(--status-err, #EF4444)' : 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            display: 'block',
          }}
        >
          {displayLabel}
        </span>
        {description && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginTop: 2,
              display: 'block',
              lineHeight: 1.4,
            }}
          >
            {description}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {displayControl}
        {action}
      </div>
    </div>
  )
}
