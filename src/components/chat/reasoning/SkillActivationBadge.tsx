import { motion } from 'framer-motion'

interface SkillActivationBadgeProps {
  skillName: string
  skillIcon: string
  skillCategory: string
  status: 'running' | 'completed'
}

export function SkillActivationBadge({
  skillName,
  skillIcon,
  skillCategory,
  status,
}: SkillActivationBadgeProps) {
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
      <span style={{ fontSize: 13 }}>{skillIcon}</span>
      <span style={{ color: status === 'running' ? 'var(--status-warn)' : 'var(--text-secondary)', fontWeight: 500 }}>
        {skillName}
      </span>
      {skillCategory && (
        <span style={{
          color: 'var(--text-muted)', fontSize: 10,
          background: 'var(--bg-active)', padding: '0px 4px', borderRadius: 2,
        }}>
          {skillCategory}
        </span>
      )}
      {status === 'running' ? (
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-warn)', flexShrink: 0 }}
        />
      ) : (
        <span style={{ color: 'var(--status-ok)', fontSize: 12 }}>{'\u2713'}</span>
      )}
    </motion.div>
  )
}
