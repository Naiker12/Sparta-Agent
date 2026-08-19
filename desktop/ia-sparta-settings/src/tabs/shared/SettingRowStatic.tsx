interface SettingRowStaticProps {
  label: string
  value: string
  hint?: string
}

export function SettingRowStatic({ label, value, hint }: SettingRowStaticProps) {
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
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            display: 'block',
          }}
        >
          {label}
        </span>
        {hint && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginTop: 2,
              display: 'block',
            }}
          >
            {hint}
          </span>
        )}
      </div>

      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono, monospace)',
          backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
          padding: '3px 8px',
          borderRadius: 'var(--radius-sm, 6px)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {value}
      </span>
    </div>
  )
}
