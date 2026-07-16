import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, Brain } from 'lucide-react'
import type { Message } from 'ia-sparta-core'
import type { PipelineStep as IPipelineStep } from 'ia-sparta-core'

export function PipelineTrace({ steps, message }: { steps: IPipelineStep[]; message: Message }) {
  const allSteps: IPipelineStep[] = []

  if (message.thinkingStatus && message.thinkingStatus !== 'idle') {
    allSteps.push({
      id: 'thinking',
      name: 'Razonamiento interno',
      meta: message.thinkingTokensUsed ? `${message.thinkingTokensUsed} tok` : undefined,
      status: message.thinkingStatus === 'completed' ? 'completed' : 'running',
      timestamp: message.reasoningStartedAt ?? Date.now(),
      durationMs: message.reasoningStartedAt && message.reasoningCompletedAt
        ? message.reasoningCompletedAt - message.reasoningStartedAt
        : undefined,
    })
  }

  allSteps.push(...steps)

  if (allSteps.length === 0) return null

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
        {allSteps.map((step) => (
          <motion.div
            key={step.id ?? step.name}
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
              color: step.status === 'running' ? 'var(--status-thinking)' : 'var(--text-secondary)',
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

function StepIcon({ status }: { status: IPipelineStep['status'] }) {
  const base: React.CSSProperties = { flexShrink: 0 }
  if (status === 'completed')
    return <Check size={12} strokeWidth={2.5} style={{ ...base, color: 'var(--status-ok)' }} />
  if (status === 'error')
    return <span style={{ ...base, color: 'var(--status-err)', fontSize: 12 }}>✕</span>
  if (status === 'running')
    return <Brain size={12} strokeWidth={1.5} style={{ ...base, color: 'var(--status-thinking)', animation: 'pulse 1.5s ease infinite' }} />
  return (
    <Loader2
      size={12}
      strokeWidth={2}
      style={{ ...base, color: 'var(--status-warn)', animation: 'spin 1s linear infinite' }}
    />
  )
}
