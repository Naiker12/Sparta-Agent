import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { StreamCursor } from './StreamCursor'
import { ThinkingPill } from './ThinkingPill'
import { ThinkingSkeletonRows } from './ThinkingSkeletonRows'
import { ThinkingStatusLine } from './ThinkingStatusLine'
import { SkillActivationBadge } from './SkillActivationBadge'
import { StreamStallIndicator } from './StreamStallIndicator'
import type { ThinkingStatus, PipelineStep } from '@/types'
import { useTranslation } from '@/i18n'

interface ThinkingBlockProps {
  content: string
  status: ThinkingStatus
  tokensUsed: number
  thinkingStatusText?: string
  pipelineSteps?: PipelineStep[]
  className?: string
  messageId?: string
  reasoningStartedAt?: number
}

const PREVIEW_MAX_LINES = 15
const PREVIEW_MAX_CHARS = 200

function lineIcon(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('search') || lower.includes('busca')) return '\ud83d\udd0d'
  if (lower.includes('read') || lower.includes('lee') || lower.includes('archivo')) return '\ud83d\udcc4'
  if (lower.includes('plan') || lower.includes('analiz') || lower.includes('razon')) return '\ud83e\udde0'
  if (lower.includes('execut') || lower.includes('ejecut') || lower.includes('run')) return '\u26a1'
  if (lower.includes('done') || lower.includes('complet') || lower.includes('finish')) return '\u2713'
  return '\u2192'
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

export function ThinkingBlock({ content, status, tokensUsed, thinkingStatusText, pipelineSteps, className, messageId, reasoningStartedAt }: ThinkingBlockProps) {
  const { t } = useTranslation()
  const savedState = useMemo(() => loadCollapseState(messageId), [messageId])
  const [isExpanded, setIsExpanded] = useState(
    savedState !== null ? savedState : (status === 'streaming' || status === 'starting')
  )
  const [showFullContent, setShowFullContent] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef(reasoningStartedAt ?? Date.now())
  const linesEndRef = useRef<HTMLDivElement>(null)
  const badgesEndRef = useRef<HTMLDivElement>(null)
  const prevBadgeCount = useRef(0)
  const userToggled = useRef(savedState !== null)
  const [isHovered, setIsHovered] = useState(false)

  const lines = useMemo(() => {
    if (!content) return []
    return content.split('\n').filter(Boolean).map((line, i) => ({
      id: `think-line-${i}`,
      icon: lineIcon(line),
      text: line,
    }))
  }, [content])

  const isLong = lines.length > PREVIEW_MAX_LINES || content.length > PREVIEW_MAX_CHARS
  const showingLines = useMemo(() => {
    if (showFullContent || status === 'streaming' || status === 'starting') return lines
    return isLong ? lines.slice(0, PREVIEW_MAX_LINES) : lines
  }, [lines, showFullContent, status, isLong])

  const skillBadges = useMemo(
    () => pipelineSteps?.filter((s) => s.id?.startsWith('skill-')) ?? [],
    [pipelineSteps]
  )

  const lastSkillName = useMemo(() => {
    const completed = skillBadges.filter((s) => s.status === 'completed')
    return completed.length > 0 ? completed[completed.length - 1].name : null
  }, [skillBadges])

  useEffect(() => {
    if (status === 'starting' || status === 'streaming') {
      if (!userToggled.current) setIsExpanded(true)
      startedAt.current = reasoningStartedAt ?? Date.now()
      setElapsed(0)
    }
  }, [status, reasoningStartedAt])

  useEffect(() => {
    if (status !== 'streaming' && status !== 'starting') return
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 100) / 10), 100)
    return () => clearInterval(interval)
  }, [status])

  useEffect(() => {
    if (userToggled.current && messageId) saveCollapseState(messageId, isExpanded)
  }, [isExpanded, messageId])

  useEffect(() => {
    if (skillBadges.length > prevBadgeCount.current && badgesEndRef.current)
      badgesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    prevBadgeCount.current = skillBadges.length
  }, [skillBadges.length])

  useEffect(() => {
    if (linesEndRef.current && (status === 'streaming' || status === 'starting'))
      linesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [showingLines.length, status])

  const handleToggle = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey) {
      document.querySelectorAll('[data-thinking-block]').forEach((el) => {
        const btn = el.querySelector('button')
        if (btn) btn.click()
      })
      return
    }
    userToggled.current = true
    setIsExpanded((v) => !v)
  }, [])

  const hasContent = content.length > 0 || lines.length > 0
  if (!hasContent && status === 'completed') return null

  return (
    <motion.div
      layout
      className={cn('thinking-block-v2', className)}
      data-thinking-block={messageId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={handleToggle}
        className="thinking-block-trigger"
        style={{
          background: isHovered && !isExpanded ? 'var(--bg-hover)' : 'transparent',
          borderRadius: 'var(--radius-md)',
          padding: '4px 6px',
          transition: 'background 0.15s',
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
            <div className="thinking-lines-v2">
              {(status === 'starting' || status === 'streaming') && !content && (
                <>
                  {thinkingStatusText ? (
                    <ThinkingStatusLine text={thinkingStatusText} />
                  ) : (
                    <ThinkingSkeletonRows />
                  )}
                </>
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

              {showingLines.length > 0 && (
                <AnimatePresence initial={false}>
                  {showingLines.map((line, idx) => (
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
                        {idx === showingLines.length - 1 && status === 'streaming' && <StreamCursor visible />}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
              <div ref={linesEndRef} />

              {status === 'completed' && showingLines.length === 0 && content && (
                <div className="thinking-line">
                  <span className="thinking-line-icon">{'\u2713'}</span>
                  <span className="thinking-line-text">{content}</span>
                </div>
              )}
            </div>

            {isLong && status === 'completed' && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowFullContent((v) => !v) }}
                className="thinking-expand-btn"
              >
                {showFullContent
                  ? t('chat.showLess')
                  : t('chat.showAllLines').replace('{{count}}', String(lines.length))}
              </button>
            )}

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
