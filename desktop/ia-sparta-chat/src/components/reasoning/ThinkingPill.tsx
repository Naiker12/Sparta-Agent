import { motion } from 'framer-motion'
import { cn } from 'ia-sparta-core'
import { ChevronRight, Check, Sparkles } from 'lucide-react'
import { ThinkingOrb } from 'thinking-orbs'
import { Marker, MarkerIcon, MarkerContent } from '@/components/ui/marker'
import { resolveOrbState, type OrbState } from './thinking-orbs-map'
import type { ThinkingStatus, ReasoningOrigin } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import { thinkingLabel } from './thinking-utils'

interface ThinkingPillProps {
  status: ThinkingStatus
  tokensUsed: number
  isExpanded: boolean
  elapsed: number
  lastSkillName?: string | null
  activeToolName?: string | null
  activeSkillName?: string | null
  activeSubagentName?: string | null
  origin?: ReasoningOrigin
  className?: string
}

export function ThinkingPill({
  status,
  tokensUsed,
  isExpanded,
  elapsed,
  lastSkillName,
  activeToolName,
  activeSkillName,
  activeSubagentName,
  origin = 'native',
  className,
}: ThinkingPillProps) {
  const { t } = useTranslation()

  const isActive = status === 'starting' || status === 'streaming'
  const label = thinkingLabel(status, t('chat.thinking'), t('chat.thinking'))
  const isEmulated = origin === 'emulated'

  const orbState: OrbState = resolveOrbState({
    status,
    activeTool: activeToolName,
    activeSkill: activeSkillName,
    activeSubagent: activeSubagentName,
  })

  // Format seconds elapsed with 1 decimal place
  const formattedSeconds = `${elapsed > 0 ? elapsed.toFixed(1) : '0.0'}s`

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="inline-flex"
    >
      <Marker
        role="status"
        variant="default"
        className={cn(
          'cursor-pointer select-none transition-all duration-200 border border-border/50 shadow-xs hover:border-accent/40 bg-muted/40 text-foreground hover:bg-muted/60',
          className
        )}
      >
        <MarkerIcon>
          {isActive ? (
            <ThinkingOrb state={orbState} size={20} paused={!isActive} />
          ) : isEmulated ? (
            <Sparkles size={13} className="text-amber-500 shrink-0" />
          ) : (
            <Check size={13} className="text-emerald-500 shrink-0" />
          )}
        </MarkerIcon>

        <MarkerContent shimmer={isActive} className="flex items-center gap-1.5 text-[11px] text-foreground">
          <span className="font-sans font-medium">{label}</span>

          {/* Seconds elapsed display */}
          <span className="font-mono text-[10.5px] font-semibold opacity-90 text-foreground/80">
            ({formattedSeconds})
          </span>

          {lastSkillName && (
            <span className="text-[9.5px] opacity-65 truncate max-w-[120px] font-mono">
              &middot; {lastSkillName.replace(/^[^\s]+\s/, '')}
            </span>
          )}

          {tokensUsed > 0 && (
            <span className="text-[9.5px] opacity-65 font-mono">
              &middot; {tokensUsed.toLocaleString()} {t('chat.tokensUnit')}
            </span>
          )}
        </MarkerContent>

        <ChevronRight
          size={12}
          className={cn('ml-1 shrink-0 transition-transform duration-200 opacity-70', isExpanded && 'rotate-90')}
        />
      </Marker>
    </motion.div>
  )
}
