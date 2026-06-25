import { useState, useRef, useEffect } from 'react'
import { Plug, ChevronRight } from 'lucide-react'
import { useMCPStore } from '@/stores/mcp.store'

export function ConnectorsSubmenu() {
  const { servers } = useMCPStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '7px 10px',
          background: open ? 'var(--bg-hover)' : 'none',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          fontSize: 12.5,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = 'none' }}
      >
        <Plug size={14} strokeWidth={1.5} />
        <span style={{ flex: 1 }}>Conectores</span>
        <ChevronRight
          size={12}
          strokeWidth={1.5}
          style={{
            color: 'var(--text-muted)',
            transition: 'transform 0.15s',
            transform: open ? 'rotate(90deg)' : 'none',
          }}
        />
      </button>

      {open && (
        <div
          style={{
            marginLeft: 8,
            borderLeft: '1px solid var(--border-subtle)',
            paddingLeft: 4,
          }}
        >
          {servers.length === 0 ? (
            <p
              style={{
                padding: '6px 10px',
                margin: 0,
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              No hay conectores disponibles
            </p>
          ) : (
            servers.map((server) => (
              <label
                key={server.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-ui)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: server.connected ? 'var(--status-ok)' : 'var(--status-err)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{server.name}</span>
                <input
                  type="checkbox"
                  checked={server.config.enabled}
                  onChange={() => useMCPStore.getState().toggleServer(server.id)}
                  style={{ cursor: 'pointer' }}
                />
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}
