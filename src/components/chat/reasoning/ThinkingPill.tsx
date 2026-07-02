import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ChevronRightIcon, Loader2, Check } from 'lucide-react'
import type { ThinkingStatus } from '@/types'

interface ThinkingPillProps {
  status: ThinkingStatus
  tokensUsed: number
  isExpanded: boolean
  elapsed: number
  lastSkillName?: string | null
  className?: string
}

export function ThinkingPill({ status, tokensUsed, isExpanded, elapsed, lastSkillName, className }: ThinkingPillProps) {
  if (status === 'starting' || status === 'streaming') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1', className)}
        style={{ background: 'var(--status-think)' }}
      >
        <Loader2 className="size-3 text-white animate-spin" />
        <span className="text-[10px] font-mono text-white/80">{elapsed.toFixed(1)}s</span>
        <motion.span
          className="text-[10px] font-medium text-white"
        >
          Pensando...
        </motion.span>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'bg-status-think/10 text-status-think',
        className
      )}
    >
      <Check className="size-3 shrink-0" />
      <span className="text-[10px] font-medium">
        Pens\u00f3 por {elapsed.toFixed(1)}s
      </span>
      {lastSkillName && (
        <span className="text-[9px] text-status-think/60 ml-0.5 font-mono truncate max-w-[120px]">
          &middot; {lastSkillName.replace(/^[^\s]+\s/, '')}
        </span>
      )}
      {tokensUsed > 0 && (
        <span className="text-[9px] text-status-think/60 ml-0.5 font-mono">
          &middot; {tokensUsed.toLocaleString()} tok
        </span>
      )}
      <ChevronRightIcon
        className={cn('size-3 ml-0.5 transition-transform', isExpanded && 'rotate-90')}
      />
    </motion.div>
  )
}
