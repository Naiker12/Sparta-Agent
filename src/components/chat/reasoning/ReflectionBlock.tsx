import { motion } from 'framer-motion'
import type { ThinkingStatus } from '@/types'

interface ReflectionBlockProps {
  error?: string
  status?: ThinkingStatus
}

export function ReflectionBlock({ error, status = 'streaming' }: ReflectionBlockProps) {
  const isActive = status === 'streaming' || status === 'starting'

  return (
    <motion.div
      layout
      style={{
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
        marginTop: 8,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          fontSize: 11,
          color: 'var(--status-warn)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <span>🔄</span>
        <span style={{ flex: 1 }}>
          {isActive ? 'Analizando el error...' : 'Reintentando con corrección'}
        </span>
        {error && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--status-err)',
              background: 'color-mix(in srgb, var(--status-err) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--status-err) 20%, transparent)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
            }}
            title={error}
          >
            Error detectado
          </span>
        )}
      </div>
    </motion.div>
  )
}
