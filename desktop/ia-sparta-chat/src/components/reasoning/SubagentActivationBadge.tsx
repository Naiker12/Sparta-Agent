import { motion } from 'framer-motion'
import { ThinkingOrb } from 'thinking-orbs'

const SUBAGENT_ICONS: Record<string, string> = {
  research: '\ud83d\udd0d',
  code: '\ud83d\udcbb',
  memory: '\ud83e\udde0',
  review: '\ud83d\udd0d',
}

interface SubagentActivationBadgeProps {
  subagentName: string
  taskSummary: string
  status: 'running' | 'completed'
  durationMs?: number
  success?: boolean
}

export function SubagentActivationBadge({
  subagentName,
  taskSummary,
  status,
  durationMs,
  success,
}: SubagentActivationBadgeProps) {
  const icon = SUBAGENT_ICONS[subagentName] ?? '\ud83e\udd16'
  const displayName = subagentName.charAt(0).toUpperCase() + subagentName.slice(1)
  const durationLabel = durationMs !== undefined
    ? durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${status === 'running' ? 'var(--status-warn)' : 'var(--border-subtle)'}`,
        background: status === 'running'
          ? 'color-mix(in srgb, var(--status-warn) 8%, transparent)'
          : 'var(--bg-elevated)',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        marginBottom: 4,
      }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ color: status === 'running' ? 'var(--status-warn)' : 'var(--text-secondary)', fontWeight: 500 }}>
        {displayName}
      </span>
      <span style={{
        color: 'var(--text-muted)', fontSize: 10,
        background: 'var(--bg-active)', padding: '0px 4px', borderRadius: 2,
        maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {taskSummary.slice(0, 60)}
      </span>
      {status === 'running' ? (
        subagentName === 'memory' ? (
          <ThinkingOrb state="listening" size={20} />
        ) : (
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-warn)', flexShrink: 0 }}
          />
        )
      ) : (
        <span style={{ color: success !== false ? 'var(--status-ok)' : 'var(--status-err)', fontSize: 12 }}>
          {success !== false ? '\u2713' : '\u2717'}
        </span>
      )}
      {durationLabel && (
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{durationLabel}</span>
      )}
    </motion.div>
  )
}
