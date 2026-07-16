import { usePlanStore } from '@/stores/plan.store'
import { CheckCircle, Circle, Play } from 'lucide-react'

export function PlanWatchPane() {
  const { steps, currentStep, complete, active } = usePlanStore()

  if (!active || steps.length === 0) return null

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: 10.5,
        fontWeight: 600,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-ui)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <Play size={11} />
        <span>Plan de ejecución</span>
        {complete && (
          <span style={{
            marginLeft: 'auto',
            color: 'var(--status-ok)',
            fontWeight: 500,
            textTransform: 'none',
            letterSpacing: 0,
            fontSize: 10,
          }}>
            Completado
          </span>
        )}
      </div>
      <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {steps.map((step, i) => {
          const isDone = i < currentStep
          const isCurrent = i === currentStep && !complete
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 6px',
                borderRadius: 'var(--radius-sm)',
                background: isCurrent ? 'var(--bg-active)' : 'transparent',
                fontSize: 11.5,
                fontFamily: 'var(--font-ui)',
                color: isDone ? 'var(--text-muted)' : isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                opacity: isDone ? 0.6 : 1,
              }}
            >
              {isDone ? (
                <CheckCircle size={13} style={{ color: 'var(--status-ok)', flexShrink: 0 }} />
              ) : isCurrent ? (
                <Play size={12} style={{ color: 'var(--status-warn)', flexShrink: 0 }} />
              ) : (
                <Circle size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              )}
              <span style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {step}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
