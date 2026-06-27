import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { StreamCursor } from './StreamCursor'
import { ThinkingPill } from './ThinkingPill'
import type { ThinkingStatus } from '@/types'

interface ThinkingBlockProps {
  content: string
  status: ThinkingStatus
  tokensUsed: number
  className?: string
}

export function ThinkingBlock({ content, status, tokensUsed, className }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(status === 'streaming')
  const prevStatus = useRef(status)
  const contentEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prevStatus.current === 'streaming' && status === 'completed' && content) {
      const timer = setTimeout(() => setIsExpanded(false), 1200)
      prevStatus.current = status
      return () => clearTimeout(timer)
    }
    if (status === 'streaming') {
      setIsExpanded(true)
    }
    prevStatus.current = status
  }, [status, content])

  useEffect(() => {
    if (contentEndRef.current && status === 'streaming') {
      contentEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [content, status])

  const canToggle = status !== 'streaming'

  return (
    <motion.div
      layout
      className={cn('rounded-sm border border-[#2A2A35] bg-bg-surface overflow-hidden', className)}
    >
      <button
        onClick={() => canToggle && setIsExpanded((v) => !v)}
        disabled={!canToggle}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-status-thinking hover:bg-bg-elevated transition-colors"
        style={{ cursor: canToggle ? 'pointer' : 'default' }}
      >
        <ThinkingPill status={status} tokensUsed={tokensUsed} isExpanded={isExpanded} />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="thinking-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-[#2A2A35] px-3 py-2" style={{ maxHeight: 240, overflowY: 'auto' }}>
              {content && (
                <pre
                  className="text-xs leading-relaxed whitespace-pre-wrap"
                  style={{
                    color: status === 'streaming' ? 'var(--text-muted)' : 'var(--text-secondary)',
                    opacity: status === 'streaming' ? 0.7 : 1,
                    fontStyle: status === 'streaming' ? 'italic' : 'normal',
                    fontFamily: 'var(--font-mono)',
                    margin: 0,
                  }}
                >
                  {content}
                  {status === 'streaming' && <StreamCursor visible />}
                </pre>
              )}
              <div ref={contentEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
