import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { StreamCursor } from './StreamCursor'
import { ThinkingPill } from './ThinkingPill'
import { ThinkingSkeletonRows } from './ThinkingSkeletonRows'
import { SkillActivationBadge } from './SkillActivationBadge'
import { StreamStallIndicator } from './StreamStallIndicator'
import type { ThinkingStatus, PipelineStep } from '@/types'

interface ThinkingBlockProps {
  content: string
  status: ThinkingStatus
  tokensUsed: number
  pipelineSteps?: PipelineStep[]
  className?: string
  messageId?: string
}

interface ThinkingLine {
  id: string
  icon: string
  text: string
}

const PREVIEW_MAX_HEIGHT = 160

function parseThinkingLine(text: string, index: number): ThinkingLine {
  const lower = text.toLowerCase()
  let icon = '\u2192'
  if (lower.includes('search') || lower.includes('busca')) icon = '\ud83d\udd0d'
  else if (lower.includes('read') || lower.includes('lee') || lower.includes('archivo')) icon = '\ud83d\udcc4'
  else if (lower.includes('plan') || lower.includes('analiz') || lower.includes('razon')) icon = '\ud83e\udde0'
  else if (lower.includes('execut') || lower.includes('ejecut') || lower.includes('run')) icon = '\u26a1'
  else if (lower.includes('done') || lower.includes('complet') || lower.includes('finish')) icon = '\u2713'
  return { id: `line-${index}`, icon, text }
}

function loadCollapseState(messageId?: string): boolean | null {
  if (!messageId) return null
  try {
    const stored = localStorage.getItem(`sparta:think:${messageId}`)
    if (stored !== null) return JSON.parse(stored)
  } catch { /* ignore */ }
  return null
}

function saveCollapseState(messageId: string, expanded: boolean) {
  try {
    localStorage.setItem(`sparta:think:${messageId}`, JSON.stringify(expanded))
  } catch { /* ignore */ }
}

export function ThinkingBlock({ content, status, tokensUsed, pipelineSteps, className, messageId }: ThinkingBlockProps) {
  const savedState = useMemo(() => loadCollapseState(messageId), [messageId])
  const [isExpanded, setIsExpanded] = useState(
    savedState !== null ? savedState : (status === 'streaming' || status === 'starting')
  )
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef(Date.now())
  const linesEndRef = useRef<HTMLDivElement>(null)
  const linesContainerRef = useRef<HTMLDivElement>(null)
  const badgesEndRef = useRef<HTMLDivElement>(null)
  const prevBadgeCount = useRef(0)
  const userToggled = useRef(savedState !== null)
  const accumulatedContent = useRef('')
  const allLines = useRef<ThinkingLine[]>([])
  const streamingIndex = useRef(0)
  const [isHovered, setIsHovered] = useState(false)

  const [displayedLines, setDisplayedLines] = useState<ThinkingLine[]>([])
  const pendingLinesRef = useRef<ThinkingLine[]>([])

  if (content && content.length > accumulatedContent.current.length) {
    const newText = content.slice(accumulatedContent.current.length)
    accumulatedContent.current = content
    if (newText) {
      const newLines = newText.split('\n').filter(Boolean).map((line) => parseThinkingLine(line, streamingIndex.current++))
      allLines.current.push(...newLines)
    }
  } else if (!content) {
    accumulatedContent.current = ''
    allLines.current = []
    streamingIndex.current = 0
  }
  const lines = allLines.current

  const hasContent = content.length > 0 || lines.length > 0
  if (!hasContent && status === 'completed') return null

  const isLong = content.length > 200 || lines.length > 15

  useEffect(() => {
    pendingLinesRef.current = lines
    const timer = setTimeout(() => setDisplayedLines([...pendingLinesRef.current]), 50)
    return () => clearTimeout(timer)
  }, [lines])

  useEffect(() => {
    if (status === 'starting' || status === 'streaming') {
      if (!userToggled.current) setIsExpanded(true)
      startedAt.current = Date.now()
      setElapsed(0)
    }
    if (status === 'completed' && !userToggled.current) {
      const timer = setTimeout(() => setIsExpanded(false), 600)
      return () => clearTimeout(timer)
    }
  }, [status])

  useEffect(() => {
    if (status !== 'streaming' && status !== 'starting') return
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 100) / 10), 100)
    return () => clearInterval(interval)
  }, [status])

  useEffect(() => {
    if (userToggled.current && messageId) saveCollapseState(messageId, isExpanded)
  }, [isExpanded, messageId])

  const skillBadges = useMemo(
    () => pipelineSteps?.filter((s) => s.id?.startsWith('skill-')) ?? [],
    [pipelineSteps]
  )

  const lastSkillName = useMemo(() => {
    const completed = skillBadges.filter((s) => s.status === 'completed')
    return completed.length > 0 ? completed[completed.length - 1].name : null
  }, [skillBadges])

  useEffect(() => {
    if (skillBadges.length > prevBadgeCount.current && badgesEndRef.current)
      badgesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    prevBadgeCount.current = skillBadges.length
  }, [skillBadges.length])

  useEffect(() => {
    if (linesEndRef.current && (status === 'streaming' || status === 'starting'))
      linesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [displayedLines.length, status])

  function handleToggle(e: React.MouseEvent) {
    if (e.shiftKey) {
      document.querySelectorAll('[data-thinking-block]').forEach((el) => {
        const btn = el.querySelector('button')
        if (btn) btn.click()
      })
      return
    }
    userToggled.current = true
    setIsExpanded((v) => !v)
  }

  return (
    <motion.div
      layout
      className={cn('thinking-block-v2', className)}
      data-thinking-block={messageId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderRadius: 'var(--radius-md)',
        transition: 'background 0.15s',
        background: isHovered && !isExpanded ? 'var(--bg-hover)' : 'transparent',
      }}
    >
      <button
        onClick={handleToggle}
        className="thinking-block-trigger"
        style={{
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          border: 'none',
          background: 'none',
          padding: '4px 6px',
          borderRadius: 'var(--radius-md)',
          transition: 'background 0.1s',
          outline: 'none',
        }}
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
            <div
              className="thinking-lines-v2"
              ref={linesContainerRef}
              style={{
                maxHeight: isLong && status === 'completed' ? PREVIEW_MAX_HEIGHT : 'none',
                overflowY: isLong && status === 'completed' ? 'hidden' : 'visible',
                maskImage: isLong && status === 'completed'
                  ? 'linear-gradient(to bottom, black 60%, transparent 100%)'
                  : 'none',
                WebkitMaskImage: isLong && status === 'completed'
                  ? 'linear-gradient(to bottom, black 60%, transparent 100%)'
                  : 'none',
                padding: '0 6px 4px',
              }}
            >
              {(status === 'starting' || status === 'streaming') && !content && <ThinkingSkeletonRows />}

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

              {displayedLines.length > 0 && (
                <AnimatePresence initial={false}>
                  {displayedLines.map((line, idx) => (
                    <motion.div
                      key={line.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="thinking-line"
                    >
                      <span className="thinking-line-icon">{line.icon}</span>
                      <span className="thinking-line-text">
                        {line.text}
                        {idx === displayedLines.length - 1 && status === 'streaming' && <StreamCursor visible />}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
              <div ref={linesEndRef} />

              {status === 'completed' && displayedLines.length === 0 && content && (
                <div className="thinking-line" style={{ padding: '4px 0' }}>
                  <span className="thinking-line-icon">\u2713</span>
                  <span className="thinking-line-text">{content}</span>
                </div>
              )}

              {isLong && status === 'completed' && (
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 10,
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-ui)',
                    cursor: 'pointer',
                    padding: '4px 0',
                    opacity: 0.7,
                    transition: 'opacity 0.1s',
                  }}
                  onClick={(e) => { e.stopPropagation(); handleToggle(e) }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                >
                  Mostrar todo ({lines.length} l\u00edneas)
                </div>
              )}
            </div>

            {(status === 'streaming' || status === 'starting') && (
              <div style={{ padding: '0 6px 4px' }}>
                <StreamStallIndicator streaming={status === 'streaming'} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
