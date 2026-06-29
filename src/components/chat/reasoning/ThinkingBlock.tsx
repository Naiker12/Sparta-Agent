import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { StreamCursor } from './StreamCursor'
import { ThinkingPill } from './ThinkingPill'
import { ThinkingSkeletonRows } from './ThinkingSkeletonRows'
import { SkillActivationBadge } from './SkillActivationBadge'
import type { ThinkingStatus, PipelineStep } from '@/types'

interface ThinkingBlockProps {
  content: string
  status: ThinkingStatus
  tokensUsed: number
  hasResponseContent?: boolean
  pipelineSteps?: PipelineStep[]
  className?: string
}

interface ThinkingLine {
  id: string
  icon: string
  text: string
}

function parseThinkingLine(text: string): ThinkingLine {
  const lower = text.toLowerCase()
  let icon = '\u2192'
  if (lower.includes('search') || lower.includes('busca')) icon = '\ud83d\udd0d'
  else if (lower.includes('read') || lower.includes('lee') || lower.includes('archivo')) icon = '\ud83d\udcc4'
  else if (lower.includes('plan') || lower.includes('analiz') || lower.includes('razon')) icon = '\ud83e\udde0'
  else if (lower.includes('execut') || lower.includes('ejecut') || lower.includes('run')) icon = '\u26a1'
  else if (lower.includes('done') || lower.includes('complet') || lower.includes('finish')) icon = '\u2713'
  return { id: crypto.randomUUID(), icon, text }
}

export function ThinkingBlock({ content, status, tokensUsed, hasResponseContent = false, pipelineSteps, className }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(status === 'streaming' || status === 'starting')
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef(Date.now())
  const collapseTimer = useRef<ReturnType<typeof setTimeout>>()
  const badgesEndRef = useRef<HTMLDivElement>(null)
  const prevBadgeCount = useRef(0)

  const lines = useMemo(() => {
    if (!content) return []
    return content.split('\n').filter(Boolean).map((line) => parseThinkingLine(line))
  }, [content])

  useEffect(() => {
    if (status === 'starting' || status === 'streaming') {
      startedAt.current = Date.now()
      setIsExpanded(true)
      setElapsed(0)
      if (collapseTimer.current) clearTimeout(collapseTimer.current)
    }
  }, [status])

  useEffect(() => {
    if (status !== 'streaming' && status !== 'starting') return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 100) / 10)
    }, 100)
    return () => clearInterval(interval)
  }, [status])

  useEffect(() => {
    if (status === 'completed' && hasResponseContent) {
      collapseTimer.current = setTimeout(() => setIsExpanded(false), 1200)
      return () => { if (collapseTimer.current) clearTimeout(collapseTimer.current) }
    }
  }, [status, hasResponseContent])

  const skillBadges = useMemo(
    () => pipelineSteps?.filter((s) => s.id?.startsWith('skill-')) ?? [],
    [pipelineSteps]
  )

  const lastSkillName = useMemo(() => {
    const completed = skillBadges.filter((s) => s.status === 'completed')
    if (completed.length === 0) return null
    return completed[completed.length - 1].name ?? null
  }, [skillBadges])

  useEffect(() => {
    if (skillBadges.length > prevBadgeCount.current && badgesEndRef.current) {
      badgesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    prevBadgeCount.current = skillBadges.length
  }, [skillBadges.length])

  const canToggle = status !== 'streaming' && status !== 'starting'

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
        <ThinkingPill
          status={status}
          tokensUsed={tokensUsed}
          isExpanded={isExpanded}
          elapsed={elapsed}
          lastSkillName={lastSkillName}
        />
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
            <div className="thinking-lines">
              {status === 'starting' && !content && (
                <ThinkingSkeletonRows />
              )}

              {skillBadges.map((step) => (
                <SkillActivationBadge
                  key={step.id}
                  skillName={(step.name ?? '').replace(/^[^\s]+\s/, '')}
                  skillIcon={(step.name ?? '').split(' ')[0] || '\ud83d\udce6'}
                  skillCategory={step.meta ?? ''}
                  status={step.status === 'completed' ? 'completed' : 'running'}
                />
              ))}
              <div ref={badgesEndRef} />

              {lines.length > 0 && (
                <AnimatePresence initial={false}>
                  {lines.map((line, idx) => (
                    <motion.div
                      key={line.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: 0 }}
                      className="thinking-line"
                    >
                      <span className="thinking-line-icon">{line.icon}</span>
                      <span className="thinking-line-text">
                        {line.text}
                        {idx === lines.length - 1 && status === 'streaming' && (
                          <StreamCursor visible />
                        )}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}

              {status === 'completed' && lines.length === 0 && content && (
                <div className="thinking-line" style={{ padding: '4px 0' }}>
                  <span className="thinking-line-icon">\u2713</span>
                  <span className="thinking-line-text">{content}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
