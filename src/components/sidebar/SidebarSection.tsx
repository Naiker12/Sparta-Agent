import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface SidebarSectionProps {
  title: string
  count?: number | string
  defaultOpen?: boolean
  action?: ReactNode
  children: ReactNode
}

export function SidebarSection({
  title,
  count,
  defaultOpen = true,
  action,
  children,
}: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '10px 8px 4px 10px',
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--text-muted)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ChevronDown
            size={10}
            strokeWidth={2}
            style={{
              transition: 'transform 0.15s',
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          />
          {title}
          {count !== undefined && (
            <span
              style={{
                marginLeft: 4,
                fontSize: 9.5,
                color: 'var(--text-muted)',
                fontWeight: 500,
                background: 'var(--bg-active)',
                padding: '1px 5px',
                borderRadius: 3,
                fontFamily: 'var(--font-mono)',
                letterSpacing: 0,
              }}
            >
              {count}
            </span>
          )}
        </button>
        <div style={{ flex: 1 }} />
        {action}
      </div>
      {open && <div>{children}</div>}
    </div>
  )
}
