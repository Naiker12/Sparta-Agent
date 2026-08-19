import { useState, useRef, useEffect } from 'react'
import { Plug, ChevronRight } from 'lucide-react'
import { useMCPStore } from 'ia-sparta-core'
import { BrandIcon } from 'ia-sparta-design-system'

function ToggleSwitch({ enabled }: { enabled: boolean }) {
  return (
    <span
      style={{
        width: 28,
        height: 16,
        borderRadius: 999,
        backgroundColor: enabled ? '#B45309' : '#DED7CB',
        position: 'relative',
        transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: 0,
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
        display: 'inline-block',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          transform: enabled ? 'translateX(12px)' : 'translateX(0)',
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </span>
  )
}

function resolveMcpVendor(name: string, id: string): string {
  const target = `${name} ${id}`.toLowerCase()
  if (target.includes('gmail')) return 'gmail'
  if (target.includes('drive')) return 'google-drive'
  if (target.includes('calendar')) return 'google-calendar'
  if (target.includes('chrome') || target.includes('devtools') || target.includes('browser')) return 'chrome'
  if (target.includes('onedrive') || target.includes('sharepoint')) return 'onedrive'
  if (target.includes('filesystem') || target.includes('file')) return 'filesystem'
  if (target.includes('fetch') || target.includes('web') || target.includes('search')) return 'fetch'
  if (target.includes('github') || target.includes('git')) return 'github'
  if (target.includes('notion')) return 'notion'
  if (target.includes('slack')) return 'slack'
  if (target.includes('sqlite') || target.includes('sql') || target.includes('postgres')) return 'sqlite'
  return 'filesystem'
}

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
          gap: 9,
          width: '100%',
          padding: '7px 10px',
          backgroundColor: open ? '#F5EFE6' : 'transparent',
          border: 'none',
          borderRadius: 10,
          color: open ? '#1C1713' : '#423A31',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'var(--font-ui, system-ui, sans-serif)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.12s ease',
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.backgroundColor = '#F5EFE6'
            e.currentTarget.style.color = '#1C1713'
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#423A31'
          }
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', color: '#8A7D6F' }}>
          <Plug size={15} strokeWidth={1.75} />
        </span>
        <span style={{ flex: 1 }}>Conectores MCP</span>
        <ChevronRight
          size={14}
          strokeWidth={2}
          style={{
            color: '#8A7D6F',
            transition: 'transform 0.15s ease',
            transform: open ? 'translateX(2px)' : 'none',
          }}
        />
      </button>

      {/* Side Submenu Popover */}
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 'calc(100% + 8px)',
            bottom: 0,
            zIndex: 9999,
            width: 270,
            backgroundColor: '#FFFFFF',
            border: '1px solid #EAE3D8',
            borderRadius: 16,
            boxShadow: '0 12px 32px -4px rgba(40, 25, 10, 0.14), 0 2px 8px rgba(0,0,0,0.04)',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            fontFamily: 'var(--font-ui, system-ui, sans-serif)',
          }}
        >
          {servers.length === 0 ? (
            <p
              style={{
                padding: '12px 10px',
                margin: 0,
                fontSize: 11.5,
                color: '#8A7D6F',
                textAlign: 'center',
              }}
            >
              No hay conectores MCP configurados
            </p>
          ) : (
            servers.map((server) => {
              const isEnabled = server.config.enabled
              const vendor = resolveMcpVendor(server.name, server.id)

              return (
                <button
                  key={server.id}
                  type="button"
                  onClick={() => useMCPStore.getState().toggleServer(server.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 9,
                    border: 'none',
                    backgroundColor: isEnabled ? '#FAF8F5' : 'transparent',
                    color: isEnabled ? '#1C1713' : '#5C5245',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: isEnabled ? 600 : 500,
                    transition: 'all 0.12s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isEnabled ? '#F5EFE6' : '#FAF8F5'
                    e.currentTarget.style.color = '#1C1713'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isEnabled ? '#FAF8F5' : 'transparent'
                    e.currentTarget.style.color = isEnabled ? '#1C1713' : '#5C5245'
                  }}
                >
                  {/* Status Dot */}
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: server.connected ? '#16A34A' : '#DC2626',
                      flexShrink: 0,
                    }}
                    title={server.connected ? 'Conectado' : 'Desconectado'}
                  />

                  {/* Brand SVGL Icon */}
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <BrandIcon vendor={vendor} size={15} />
                  </div>

                  {/* Server Name */}
                  <span
                    style={{
                      flex: 1,
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      fontSize: 11.5,
                    }}
                  >
                    {server.name}
                  </span>

                  {/* Toggle Switch */}
                  <ToggleSwitch enabled={isEnabled} />
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
