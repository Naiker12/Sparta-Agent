import { motion } from 'framer-motion'
import { cn } from 'ia-sparta-core'
import { Brain, ChevronRight, Sparkles } from 'lucide-react'
import type { ThinkingStatus } from 'ia-sparta-core'

interface ThinkingPillProps {
  status: ThinkingStatus
  isExpanded: boolean
  elapsed: number
  activityCount?: number
  lastSkillName?: string | null
  className?: string
}

function formatThoughtDuration(seconds: number): string {
  if (seconds <= 0 || !Number.isFinite(seconds)) return '1s'
  const rounded = Math.max(1, Math.round(seconds))
  if (rounded < 60) return `${rounded}s`
  const mins = Math.floor(rounded / 60)
  const secs = rounded % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export function ThinkingPill({
  status,
  isExpanded,
  elapsed,
  activityCount = 0,
  lastSkillName,
  className,
}: ThinkingPillProps) {
  const isActive = status === 'starting' || status === 'streaming'

  const formattedElapsed = formatThoughtDuration(elapsed)
  const label = isActive
    ? 'Pensando...'
    : `Pensó durante ${formattedElapsed}`

  const activityDetail = activityCount > 0
    ? `${activityCount} ${activityCount === 1 ? 'acción' : 'acciones'} · ${formattedElapsed}`
    : formattedElapsed

  return (
    <motion.div
      initial={{ opacity: 0, y: 1 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12 }}
      className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground select-none', className)}
    >
      <div
        className={cn(
          'group/reasoning flex items-center gap-2 rounded-md py-1 pr-1.5 text-left text-xs font-medium text-[var(--text-secondary)] transition-colors',
          'hover:text-[var(--text-primary)] cursor-pointer'
        )}
      >
        {isActive ? (
          <Sparkles className="size-3 shrink-0 text-[var(--accent)] animate-pulse" />
        ) : (
          <Brain className="size-3.5 shrink-0 text-[var(--text-muted)] group-hover/reasoning:text-[var(--text-primary)] transition-colors" />
        )}

        {isActive ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
            <span className="animate-pulse">{label}</span>
            <span className="text-[10.5px] font-mono text-[var(--text-muted)]">
              {elapsed > 0 ? `${elapsed.toFixed(0)}s` : 'ahora'}
            </span>
          </span>
        ) : (
          <span className="font-medium text-[var(--text-secondary)] group-hover/reasoning:text-[var(--text-primary)] transition-colors">
            {!isActive && activityCount > 0 ? `Actividad · ${activityDetail}` : label}
          </span>
        )}

        {lastSkillName && (
          <span className="text-[10px] opacity-75 font-mono text-[var(--text-muted)] truncate max-w-36">
            · {lastSkillName.replace(/^[^\s]+\s/, '')}
          </span>
        )}

        <ChevronRight
          size={13}
          className={cn('shrink-0 text-[var(--text-muted)] transition-transform duration-200', isExpanded && 'rotate-90 text-[var(--text-primary)]')}
        />
      </div>
    </motion.div>
  )
}
