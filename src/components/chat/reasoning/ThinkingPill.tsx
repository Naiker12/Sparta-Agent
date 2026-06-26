import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { SparklesIcon } from 'lucide-react'

const THINKING_LABELS = [
  'Analizando...',
  'Buscando en memoria...',
  'Procesando...',
  'Construyendo respuesta...',
  'Razonando...',
]

interface ThinkingPillProps {
  isThinking: boolean
  label?: string
  className?: string
  tokensUsed?: number
}

export function ThinkingPill({ isThinking, label = 'Thinking', className, tokensUsed }: ThinkingPillProps) {
  const [labelIndex, setLabelIndex] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    if (!isThinking) {
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
  }, [isThinking])

  if (!isThinking) return null

  const elapsed = Date.now() - startedAt.current
  const displayLabel = elapsed > 5000 ? THINKING_LABELS[labelIndex] : label

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm bg-status-thinking/10 px-2 py-0.5',
        className
      )}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      >
        <SparklesIcon className="size-3 text-status-thinking" />
      </motion.div>

      <motion.span
        key={displayLabel}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="text-[10px] font-medium text-status-thinking"
      >
        {displayLabel}
      </motion.span>

      {tokensUsed !== undefined && (
        <span className="text-[9px] text-status-thinking/60 ml-1">
          {tokensUsed} tok
        </span>
      )}

      <span className="flex gap-0.5">
        <motion.span
          className="size-1 bg-status-thinking rounded-full"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
        />
        <motion.span
          className="size-1 bg-status-thinking rounded-full"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
        />
        <motion.span
          className="size-1 bg-status-thinking rounded-full"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
        />
      </span>
    </motion.div>
  )
}
