interface SessionItemProps {
  title: string
  active: boolean
  onClick: () => void
}

export function SessionItem({ title, active, onClick }: SessionItemProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        cursor: 'pointer',
        background: active ? 'var(--bg-active)' : 'transparent',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 12.5,
        fontFamily: 'var(--font-ui)',
        transition: 'all 0.12s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--bg-hover)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      <span
        style={{
          color: active ? 'var(--accent)' : 'var(--text-muted)',
          fontSize: 11,
        }}
      >
        {active ? '›' : '·'}
      </span>
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title || 'Nueva sesión'}
      </span>
    </div>
  )
}
