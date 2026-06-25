import type { ReactNode } from 'react'

interface SettingRowProps {
  title: string
  description?: string
  control: ReactNode
}

export function SettingRow({ title, description, control }: SettingRowProps) {
  return (
    <div
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
          {title}
        </div>
        {description && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              marginTop: 2,
              lineHeight: 1.5,
            }}
          >
            {description}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  )
}

interface SettingGroupProps {
  title: string
  description?: string
  children: ReactNode
}

export function SettingGroup({ title, description, children }: SettingGroupProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 8 }}>
        <h3
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </h3>
        {description && (
          <p
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              margin: '2px 0 0',
            }}
          >
            {description}
          </p>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  )
}
