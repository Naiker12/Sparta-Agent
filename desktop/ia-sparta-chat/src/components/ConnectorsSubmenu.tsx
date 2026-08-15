import { useState, useRef, useEffect } from 'react'
import { Plug, ChevronRight, Check } from 'lucide-react'
import { useMCPStore } from 'ia-sparta-core'

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
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '6px 8px',
          background: open ? 'var(--bg-hover)' : 'none',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: open ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontSize: 12,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.background = 'var(--bg-hover)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = 'none'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
          <Plug size={14} strokeWidth={1.5} />
        </span>
        <span style={{ flex: 1 }}>Conectores</span>
        <ChevronRight
          size={14}
          strokeWidth={1.5}
          style={{
            color: 'var(--text-muted)',
            transition: 'transform 0.15s ease',
            transform: open ? 'translateX(2px)' : 'none',
          }}
        />
      </button>

      {/* ── Side Submenu Popover Window (matching Image 4) ── */}
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 'calc(100% + 8px)',
            bottom: 0,
            zIndex: 9999,
            width: 240,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-normal)',
            borderRadius: 14,
            boxShadow: '0 12px 36px rgba(0,0,0,0.22)',
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            animation: 'fadeIn 0.12s ease-out',
          }}
        >
          {servers.length === 0 ? (
            <p
              style={{
                padding: '12px 10px',
                margin: 0,
                fontSize: 11.5,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-ui)',
                textAlign: 'center',
              }}
            >
              No hay conectores MCP configurados
            </p>
          ) : (
            servers.map((server) => {
              const isEnabled = server.config.enabled
              return (
                <button
                  key={server.id}
                  type="button"
                  onClick={() => useMCPStore.getState().toggleServer(server.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: isEnabled ? 'var(--bg-active)' : 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'var(--font-ui)',
                    transition: 'all 0.12s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isEnabled) e.currentTarget.style.background = 'var(--bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isEnabled) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: server.connected ? '#10b981' : '#ef4444',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {server.name}
                  </span>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: isEnabled ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                      background: isEnabled ? 'var(--accent)' : 'var(--bg-input)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      flexShrink: 0,
                    }}
                  >
                    {isEnabled && <Check size={12} strokeWidth={3} />}
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
