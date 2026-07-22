import { useState } from 'react'
import { motion } from 'framer-motion'
import { Book, Check, X, Loader2 } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  coding: 'var(--status-ok)',
  research: 'var(--accent)',
  writing: 'var(--status-warn)',
  productivity: 'var(--status-think)',
  automation: 'var(--text-on-accent)',
}

interface SkillCardProps {
  id: string
  name: string
  category: string
  description: string
  enabled: boolean
  onToggle: (id: string, newEnabled: boolean) => void
}

/**
 * SkillCard — muestra una skill con su categoría, descripción corta y switch on/off.
 *
 * Diseño consistente con ProviderCard y el resto del sistema de tarjetas.
 */
export function SkillCard({
  id,
  name,
  category,
  description,
  enabled,
  onToggle,
}: SkillCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const categoryColor = CATEGORY_COLORS[category.toLowerCase()] ?? 'var(--text-muted)'

  async function handleToggle() {
    setIsUpdating(true)
    try {
      await onToggle(id, !enabled)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${enabled ? 'var(--border-subtle)' : 'var(--border-normal)'}`,
        background: enabled ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        marginBottom: 6,
        fontFamily: 'var(--font-ui)',
        opacity: enabled ? 1 : 0.7,
        transition: 'opacity 0.15s',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--accent-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        <Book size={13} strokeWidth={1.5} />
      </div>

      {/* Name + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {name}
          <span
            style={{
              fontSize: 9,
              padding: '1px 5px',
              borderRadius: 4,
              background: `color-mix(in srgb, ${categoryColor} 15%, transparent)`,
              color: categoryColor,
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
            }}
          >
            {category}
          </span>
        </div>
        {description && (
          <div style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            marginTop: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 300,
          }}>
            {description}
          </div>
        )}
      </div>

      {/* Switch */}
      <button
        onClick={handleToggle}
        disabled={isUpdating}
        style={{
          position: 'relative',
          width: 32,
          height: 18,
          borderRadius: 9,
          border: 'none',
          background: enabled ? 'var(--status-ok)' : 'var(--border-normal)',
          cursor: isUpdating ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
          flexShrink: 0,
          opacity: isUpdating ? 0.6 : 1,
        }}
        aria-label={enabled ? `Desactivar ${name}` : `Activar ${name}`}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: enabled ? 16 : 2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'white',
            transition: 'left 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isUpdating ? (
            <Loader2 size={8} style={{ color: '#666', animation: 'spin 1s linear infinite' }} />
          ) : enabled ? (
            <Check size={8} strokeWidth={3} style={{ color: 'var(--status-ok)' }} />
          ) : (
            <X size={8} strokeWidth={2.5} style={{ color: '#999' }} />
          )}
        </span>
      </button>
    </motion.div>
  )
}