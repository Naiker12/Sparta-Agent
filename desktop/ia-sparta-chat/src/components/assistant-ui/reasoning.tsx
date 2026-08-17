import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ThinkingPill } from '../reasoning/ThinkingPill'
import { TimelineBlock } from '../reasoning/TimelineBlock'
import type { Message, ThinkingStatus } from 'ia-sparta-core'

export interface ReasoningProps {
  message: Message
  status?: ThinkingStatus
  elapsed?: number
  activityCount?: number
  source?: 'sparta' | 'harness'
  harnessLabel?: string
  className?: string
}

export function Reasoning({
  message,
  status: customStatus,
  elapsed: customElapsed = 0,
  activityCount = 0,
  source = 'sparta',
  harnessLabel,
  className,
}: ReasoningProps) {
  const [expanded, setExpanded] = useState(false)
  const status = customStatus ?? (!message.isStreaming ? 'completed' : (message.thinkingStatus ?? 'streaming'))

  const labelSuffix = harnessLabel ? `vía ${harnessLabel}` : source === 'harness' ? 'vía CLI externa' : undefined

  return (
    <div className={`flex flex-col gap-1 select-none ${className ?? ''}`}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="self-start focus:outline-none"
        type="button"
      >
        <ThinkingPill
          status={status}
          isExpanded={expanded}
          elapsed={customElapsed}
          activityCount={activityCount}
          lastSkillName={labelSuffix}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden pl-4 border-l-2 border-[var(--border-subtle)] my-1"
          >
            <TimelineBlock message={message} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
