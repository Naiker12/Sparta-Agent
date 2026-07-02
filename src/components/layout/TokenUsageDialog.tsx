import { X } from 'lucide-react'
import { useUsageStore } from '@/stores/usage.store'
import { useSessionStore } from '@/stores/session.store'
import { useProviderStore, getVendorLabel } from '@/stores/provider.store'

interface TokenUsageDialogProps {
  open: boolean
  onClose: () => void
}

export function TokenUsageDialog({ open, onClose }: TokenUsageDialogProps) {
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const totalInput = useUsageStore((s) => s.totalInput)
  const totalOutput = useUsageStore((s) => s.totalOutput)
  const currentTurnInput = useUsageStore((s) => s.currentTurnInput)
  const currentTurnOutput = useUsageStore((s) => s.currentTurnOutput)
  const sessionObj = useUsageStore((s) => activeSessionId ? s.bySession[activeSessionId] : undefined)
  const byProvider = useUsageStore((s) => s.byProvider)
  const providers = useProviderStore((s) => s.providers)

  function labelForProvider(providerId: string): string {
    const p = providers.find((pr) => pr.id === providerId)
    if (!p) return providerId.slice(0, 8)
    return p.label || getVendorLabel(p.vendor)
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
          width: 400, maxWidth: '92vw', maxHeight: '85vh',
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
            Uso de tokens
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MetricCard label="Turno actual input" value={currentTurnInput} />
            <MetricCard label="Turno actual output" value={currentTurnOutput} />
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          <div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)', textTransform: 'uppercase',
              letterSpacing: '0.05em', marginBottom: 8,
            }}>
              Sesión actual
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <MetricCard label="Input" value={sessionObj?.input ?? 0} />
              <MetricCard label="Output" value={sessionObj?.output ?? 0} />
            </div>
          </div>

          {sessionObj && Object.keys(sessionObj.byProvider).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Por proveedor:</div>
              {Object.entries(sessionObj.byProvider).map(([providerId, usage]) => (
                <div key={providerId} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-input)',
                }}>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', flex: 1 }}>{labelForProvider(providerId)}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>I:{usage.input}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>O:{usage.output}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          <div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)', textTransform: 'uppercase',
              letterSpacing: '0.05em', marginBottom: 8,
            }}>
              Total general
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <MetricCard label="Input total" value={totalInput} />
              <MetricCard label="Output total" value={totalOutput} />
            </div>
          </div>

          {Object.keys(byProvider).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Por proveedor (total):</div>
              {Object.entries(byProvider).map(([providerId, usage]) => (
                <div key={providerId} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-input)',
                }}>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', flex: 1 }}>{labelForProvider(providerId)}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>I:{usage.input}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>O:{usage.output}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--radius-md)',
      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
        {value.toLocaleString()}
      </div>
    </div>
  )
}
