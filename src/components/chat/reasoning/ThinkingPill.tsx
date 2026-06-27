import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { BrainIcon, ChevronRightIcon, Loader2 } from 'lucide-react'
import type { ThinkingStatus } from '@/types'

const THINKING_LABELS = [
  'Analizando...',
  'Buscando en memoria...',
  'Procesando...',
  'Construyendo respuesta...',
  'Razonando...',
]

interface ThinkingPillProps {
  status: ThinkingStatus
  tokensUsed: number
  isExpanded: boolean
  className?: string
}

export function ThinkingPill({ status, tokensUsed, isExpanded, className }: ThinkingPillProps) {
  const [labelIndex, setLabelIndex] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    if (status !== 'streaming') {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    startedAt.current = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt.current
      if (elapsed > 5000) {
        setLabelIndex((i) => (i + 1) % THINKING_LABELS.length)
      }
    }, 4000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [status])

  if (status === 'streaming') {
    const elapsed = Date.now() - startedAt.current
    const displayLabel = elapsed > 5000 ? THINKING_LABELS[labelIndex] : 'Pensando...'

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className={cn('inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5', className)}
        style={{ background: 'var(--status-thinking)' }}
      >
        <Loader2 className="size-3 text-white animate-spin" />
        <motion.span
          key={displayLabel}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="text-[10px] font-medium text-white"
        >
          {displayLabel}
        </motion.span>
        <span className="flex gap-0.5 ml-1">
          <motion.span
            className="size-1 bg-white/60 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
          />
          <motion.span
            className="size-1 bg-white/60 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
          />
          <motion.span
            className="size-1 bg-white/60 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
          />
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5',
        'bg-status-thinking/10 text-status-thinking',
        className
      )}
    >
      <BrainIcon className="size-3 shrink-0" />
      <span className="text-[10px] font-medium">Razonamiento</span>
      {tokensUsed > 0 && (
        <span className="text-[9px] text-status-thinking/60 ml-0.5">
          {tokensUsed.toLocaleString()} tok
        </span>
      )}
      <ChevronRightIcon
        className={cn('size-3 ml-0.5 transition-transform', isExpanded && 'rotate-90')}
      />
    </motion.div>
  )
}
