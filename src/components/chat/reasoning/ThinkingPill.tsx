import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ChevronRightIcon, Check } from 'lucide-react'
import { getRandomSpinner, type SpinnerSet } from '@/lib/spinners'
import type { ThinkingStatus } from '@/types'

interface ThinkingPillProps {
  status: ThinkingStatus
  tokensUsed: number
  isExpanded: boolean
  elapsed: number
  lastSkillName?: string | null
  className?: string
}

const spinner = getRandomSpinner()

export function ThinkingPill({ status, tokensUsed, isExpanded, elapsed, lastSkillName, className }: ThinkingPillProps) {
  const [frame, setFrame] = useState(0)
  const spinnerRef = useRef<SpinnerSet>(spinner)

  useEffect(() => {
    if (status !== 'starting' && status !== 'streaming') return
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % spinnerRef.current.frames.length)
    }, spinnerRef.current.interval)
    return () => clearInterval(interval)
  }, [status])

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
        <span className="text-white text-[11px] font-mono leading-none" style={{ width: 10, textAlign: 'center' }}>
          {spinnerRef.current.frames[frame]}
        </span>
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
