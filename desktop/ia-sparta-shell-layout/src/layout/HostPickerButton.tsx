import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Monitor, Check } from 'lucide-react'

export function HostPickerButton() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hostname = typeof process !== 'undefined' && process.env?.COMPUTERNAME 
    ? process.env.COMPUTERNAME 
    : 'DESKTOP-SPARTA'
  const [selectedHost, setSelectedHost] = useState(hostname)

  const hosts = [
    { id: hostname, name: hostname, type: 'Local Machine', active: true },
    { id: 'sparta-sidecar-1', name: 'Sparta Python Sidecar', type: 'LangGraph Daemon', active: false },
  ]

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative' }} className="no-drag">
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          background: open ? 'var(--bg-active)' : 'transparent',
          border: '1px solid transparent',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          fontSize: 11.5,
          fontFamily: 'var(--font-mono)',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.12s',
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = 'var(--bg-hover)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
        title="Seleccionar Host de Ejecución (Traycer Host Selector)"
      >
        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 110 }}>
          {selectedHost}
        </span>
        <ChevronDown size={12} style={{ opacity: 0.7 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            zIndex: 100,
            width: 220,
            background: 'var(--bg-modal)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Hosts Disponibles
          </div>
          {hosts.map((h) => (
            <div
              key={h.id}
              onClick={() => {
                setSelectedHost(h.name)
                setOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: 'var(--radius-md)',
                background: selectedHost === h.name ? 'var(--accent-muted)' : 'transparent',
                color: selectedHost === h.name ? 'var(--accent)' : 'var(--text-primary)',
                fontSize: 11.5,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Monitor size={13} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{h.name}</span>
                  <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{h.type}</span>
                </div>
              </div>
              {selectedHost === h.name && <Check size={12} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
