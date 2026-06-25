import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, Brain } from 'lucide-react'

export type PipelineStep = {
  id: string
  name: string
  meta?: string
  status: 'running' | 'done' | 'error' | 'thinking'
  durationMs?: number
}

export function PipelineTrace({ steps }: { steps: PipelineStep[] }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
    }}>
      <AnimatePresence initial={false}>
        {steps.map((step) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11.5,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <StepIcon status={step.status} />

            <span style={{
              color: step.status === 'thinking' ? 'var(--status-think)' : 'var(--text-secondary)',
              minWidth: 80,
              fontSize: 11.5,
              fontFamily: 'var(--font-mono)',
            }}>
              {step.name}
            </span>

            {step.meta && (
              <span style={{
                color: 'var(--text-muted)',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 11.5,
                fontFamily: 'var(--font-mono)',
              }}>
                {step.meta}
              </span>
            )}

            {step.durationMs !== undefined && (
              <span style={{
                color: 'var(--text-muted)',
                marginLeft: 'auto',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
              }}>
                {step.durationMs >= 1000
                  ? `${(step.durationMs / 1000).toFixed(1)}s`
                  : `${step.durationMs}ms`
                }
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function StepIcon({ status }: { status: PipelineStep['status'] }) {
  const base: React.CSSProperties = { flexShrink: 0 }
  if (status === 'done')
    return <Check size={12} strokeWidth={2.5} style={{ ...base, color: 'var(--status-ok)' }} />
  if (status === 'error')
    return <span style={{ ...base, color: 'var(--status-err)', fontSize: 12 }}>✕</span>
  if (status === 'thinking')
    return <Brain size={12} strokeWidth={1.5} style={{ ...base, color: 'var(--status-think)', animation: 'pulse 1.5s ease infinite' }} />
  return (
    <Loader2
      size={12}
      strokeWidth={2}
      style={{ ...base, color: 'var(--status-warn)', animation: 'spin 1s linear infinite' }}
    />
  )
}
