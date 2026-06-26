import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useUsageStore } from '@/stores/usage.store'
import { useChatStore } from '@/stores/chat.store'

interface TokenUsageDialogProps {
  open: boolean
  onClose: () => void
}

export function TokenUsageDialog({ open, onClose }: TokenUsageDialogProps) {
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const totalInput = useUsageStore((s) => s.totalInput)
  const totalOutput = useUsageStore((s) => s.totalOutput)
  const sessionObj = activeSessionId ? useUsageStore((s) => s.bySession[activeSessionId]) : undefined
  const byProvider = useUsageStore((s) => s.byProvider)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Uso de tokens</DialogTitle>
        </DialogHeader>
        <div style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MetricCard label="Turno actual input" value={0} />
            <MetricCard label="Turno actual output" value={0} />
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sesión actual
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MetricCard label="Input" value={sessionObj?.input ?? 0} />
            <MetricCard label="Output" value={sessionObj?.output ?? 0} />
          </div>

          {sessionObj && Object.keys(sessionObj.byProvider).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Por proveedor:</div>
              {Object.entries(sessionObj.byProvider).map(([providerId, usage]) => (
                <div key={providerId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', flex: 1 }}>{providerId.slice(0, 12)}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>I:{usage.input}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>O:{usage.output}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total general
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MetricCard label="Input total" value={totalInput} />
            <MetricCard label="Output total" value={totalOutput} />
          </div>

          {Object.keys(byProvider).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Por proveedor (total):</div>
              {Object.entries(byProvider).map(([providerId, usage]) => (
                <div key={providerId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', flex: 1 }}>{providerId.slice(0, 12)}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>I:{usage.input}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>O:{usage.output}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
        {value.toLocaleString()}
      </div>
    </div>
  )
}
