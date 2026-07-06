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
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 320, maxWidth: '92vw', maxHeight: '85vh',
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-ui)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Uso de Tokens
          </h3>
          <button onClick={onClose} style={{
            width: 20, height: 20, background: 'none', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0.8,
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
          >
            <X size={12} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Main Metrics Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr 1fr',
              fontSize: 9,
              fontWeight: 600,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: 4,
            }}>
              <div>Ámbito</div>
              <div style={{ textAlign: 'right' }}>Input</div>
              <div style={{ textAlign: 'right' }}>Output</div>
            </div>

            <MetricRow label="Turno actual" input={currentTurnInput} output={currentTurnOutput} isBold={false} />
            <MetricRow label="Sesión actual" input={sessionObj?.input ?? 0} output={sessionObj?.output ?? 0} isBold={false} />
            <MetricRow label="Total acumulado" input={totalInput} output={totalOutput} isBold={true} />
          </div>

          {/* Session Provider breakdown */}
          {sessionObj && Object.keys(sessionObj.byProvider).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Consumo por Proveedor
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(sessionObj.byProvider).map(([providerId, usage]) => (
                  <div key={providerId} style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 1fr',
                    fontSize: 10,
                    padding: '4px 6px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)',
                  }}>
                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {labelForProvider(providerId)}
                    </span>
                    <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                      {usage.input.toLocaleString()}
                    </span>
                    <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                      {usage.output.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Global breakdown */}
          {Object.keys(byProvider).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Totales por Proveedor
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(byProvider).map(([providerId, usage]) => (
                  <div key={providerId} style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 1fr',
                    fontSize: 10,
                    padding: '4px 6px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)',
                  }}>
                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {labelForProvider(providerId)}
                    </span>
                    <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                      {usage.input.toLocaleString()}
                    </span>
                    <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                      {usage.output.toLocaleString()}
                    </span>
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

interface MetricRowProps {
  label: string
  input: number
  output: number
  isBold?: boolean
}

function MetricRow({ label, input, output, isBold }: MetricRowProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr 1fr',
      padding: '4px 0',
      fontSize: 11,
      fontWeight: isBold ? 600 : 400,
      color: isBold ? 'var(--text-primary)' : 'var(--text-secondary)',
      borderBottom: isBold ? 'none' : '1px solid var(--border-subtle)',
    }}>
      <div>{label}</div>
      <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>{input.toLocaleString()}</div>
      <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>{output.toLocaleString()}</div>
    </div>
  )
}
