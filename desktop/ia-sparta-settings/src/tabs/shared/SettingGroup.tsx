import type { ReactNode } from 'react'

interface SettingGroupProps {
  title: string
  description?: string
  children: ReactNode
  action?: ReactNode
}

export function SettingGroup({ title, description, children, action }: SettingGroupProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h3>
          {description && (
            <p
              style={{
                fontSize: 11.5,
                color: 'var(--text-secondary)',
                margin: '2px 0 0 0',
                lineHeight: 1.4,
              }}
            >
              {description}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>

      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg, 12px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  )
}
