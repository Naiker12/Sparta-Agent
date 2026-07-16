import { X, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { useGatewayStore } from 'ia-sparta-core'
import { useProviderStore } from 'ia-sparta-core'
import { useSettingsStore } from 'ia-sparta-core'
import { useUIStore } from 'ia-sparta-core'

interface GatewayStatusDialogProps {
  open: boolean
  onClose: () => void
}

export function GatewayStatusDialog({ open, onClose }: GatewayStatusDialogProps) {
  const entries = useGatewayStore((s) => s.entries)
  const providers = useProviderStore((s) => s.providers)
  const setMainView = useUIStore((s) => s.setMainView)
  const openSettings = useSettingsStore((s) => s.openSettings)

  const errorEntries = entries.filter((e) => !e.ok)
  const hasRecentError = errorEntries.length > 0

  function formatTime(ts: number) {
    const diff = Date.now() - ts
    if (diff < 60000) return 'hace segundos'
    if (diff < 3600000) return `hace ${Math.floor(diff / 60000)}m`
    return `hace ${Math.floor(diff / 3600000)}h`
  }

  function handleConfigure() {
    onClose()
    openSettings()
    setMainView({ type: 'chat' })
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 520, maxWidth: '92vw', maxHeight: '85vh',
          background: 'var(--bg-modal)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 0', flexShrink: 0,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
            Gateway de API
          </h3>
          <button onClick={onClose} style={{
            width: 24, height: 24, background: 'none', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} />
          </button>
        </div>

        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px 20px 16px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: hasRecentError ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
          }}>
            {hasRecentError ? (
              <AlertCircle size={16} style={{ color: 'var(--status-err)', flexShrink: 0 }} />
            ) : (
              <CheckCircle size={16} style={{ color: 'var(--status-ok)', flexShrink: 0 }} />
            )}
            <span style={{
              fontSize: 12, color: hasRecentError ? 'var(--status-err)' : 'var(--status-ok)',
              fontFamily: 'var(--font-ui)', fontWeight: 500,
            }}>
              {hasRecentError ? 'Error reciente detectado' : 'Todos los proveedores funcionando'}
            </span>
          </div>

          <div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)', textTransform: 'uppercase',
              letterSpacing: '0.05em', marginBottom: 8,
            }}>
              Proveedores configurados ({providers.length})
            </div>

            {providers.length === 0 ? (
              <div style={{
                fontSize: 12, color: 'var(--text-secondary)',
                fontFamily: 'var(--font-ui)', textAlign: 'center', padding: 20,
              }}>
                No hay proveedores configurados.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {providers.map((p) => {
                  const lastEntry = entries.find((e) => e.providerId === p.id)
                  const isHealthy = lastEntry ? lastEntry.ok : true
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: isHealthy ? 'var(--status-ok)' : 'var(--status-err)', flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
                          {p.label}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                          {p.kind === 'local' ? 'Local' : p.hasVaultKey ? 'Key en vault' : 'Key en localStorage'}
                          {lastEntry && ` · ${formatTime(lastEntry.timestamp)}`}
                        </div>
                      </div>
                      {lastEntry && !lastEntry.ok && (
                        <div style={{
                          fontSize: 10, color: 'var(--status-err)', fontFamily: 'var(--font-ui)',
                          textAlign: 'right', maxWidth: 140,
                        }}>
                          {lastEntry.error ?? `HTTP ${lastEntry.status}`}
                        </div>
                      )}
                      <button
                        onClick={handleConfigure}
                        style={{
                          fontSize: 10, padding: '3px 8px', background: 'var(--bg-hover)',
                          border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-ui)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Configurar
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {errorEntries.length > 0 && (
            <div>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--status-err)',
                fontFamily: 'var(--font-ui)', textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: 6,
              }}>
                Últimos errores ({errorEntries.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {errorEntries.slice(0, 5).map((entry, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)',
                  }}>
                    <XCircle size={10} style={{ color: 'var(--status-err)', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{entry.vendor}</span>
                    <span style={{ fontSize: 10, color: 'var(--status-err)', fontFamily: 'var(--font-ui)' }}>{entry.error ?? `HTTP ${entry.status}`}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginLeft: 'auto' }}>{formatTime(entry.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entries.length > 0 && (
            <div>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                fontFamily: 'var(--font-ui)', textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: 6,
              }}>
                Requests recientes ({entries.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {entries.map((entry, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)',
                  }}>
                    {entry.ok ? <CheckCircle size={10} style={{ color: 'var(--status-ok)', flexShrink: 0 }} /> : <XCircle size={10} style={{ color: 'var(--status-err)', flexShrink: 0 }} />}
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{entry.vendor}</span>
                    <span style={{ fontSize: 10, color: entry.ok ? 'var(--text-secondary)' : 'var(--status-err)', fontFamily: 'var(--font-ui)' }}>{entry.ok ? `HTTP ${entry.status}` : (entry.error ?? `HTTP ${entry.status}`)}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{entry.latency}ms</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginLeft: 'auto' }}>{formatTime(entry.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
