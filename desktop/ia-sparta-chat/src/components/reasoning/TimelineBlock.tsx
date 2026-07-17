import { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from 'ia-sparta-core'
import { ThinkingPill } from './ThinkingPill'
import { ThinkingLines } from './ThinkingLines'
import { ToolTraceRow } from './ToolTraceRow'
import { ThinkingSkeletonRows } from './ThinkingSkeletonRows'
import { ThinkingStatusLine } from './ThinkingStatusLine'
import { SkillActivationBadge } from './SkillActivationBadge'
import { SubagentActivationBadge } from './SubagentActivationBadge'
import { StreamStallIndicator } from './StreamStallIndicator'
import type { Message, ThinkingStatus } from 'ia-sparta-core'

interface TimelineBlockProps {
  message: Message
  className?: string
}

function loadCollapseState(messageId?: string): boolean | null {
  if (!messageId) return null
  try {
    const stored = localStorage.getItem(`sparta:timeline:${messageId}`)
    if (stored !== null) return JSON.parse(stored)
  } catch { /* ignore */ }
  return null
}

function saveCollapseState(messageId: string, expanded: boolean) {
  try {
    localStorage.setItem(`sparta:timeline:${messageId}`, JSON.stringify(expanded))
  } catch { /* ignore */ }
}

/**
 * TimelineBlock — unified timeline of reasoning + tool calls.
 *
 * Renders a single disclosure (using ThinkingPill as trigger) whose body
 * iterates over message.parts in chronological order.
 *
 * Each part is either:
 *   - reasoning → rendered as ThinkingLines (same visual as before)
 *   - tool → rendered as ToolTraceRow (inline, no box/border in collapsed state)
 *
 * This matches the Hermes pattern where consecutive reasoning parts are grouped
 * into a single disclosure, and tool calls appear as inline rows between them.
 */
export function TimelineBlock({ message, className }: TimelineBlockProps) {
  const savedState = useMemo(() => loadCollapseState(message.id), [message.id])
  const [isExpanded, setIsExpanded] = useState(
    savedState !== null ? savedState : (message.isStreaming || message.thinkingStatus === 'starting' || message.thinkingStatus === 'streaming')
  )
  const [showFullContent, setShowFullContent] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef(message.reasoningStartedAt ?? Date.now())
  const userToggled = useRef(savedState !== null)
  const [isHovered, setIsHovered] = useState(false)

  const parts = message.parts ?? []
  const hasParts = parts.length > 0
  const hasReasoningText = (message.reasoningText?.trim().length ?? 0) > 0
  const hasToolCalls = (message.toolCalls?.length ?? 0) > 0
  const hasContent = hasParts || hasReasoningText || hasToolCalls

  // Derive thinking status from message state
  const status: ThinkingStatus = message.thinkingStatus ?? (message.isStreaming ? 'streaming' : 'completed')

  const skillBadges = useMemo(
    () => message.pipelineSteps?.filter((s) => s.id?.startsWith('skill-')) ?? [],
    [message.pipelineSteps]
  )

  const lastSkillName = useMemo(() => {
    const completed = skillBadges.filter((s) => s.status === 'completed')
    return completed.length > 0 ? completed[completed.length - 1].name : null
  }, [skillBadges])

  useEffect(() => {
    if (status === 'starting' || status === 'streaming') {
      if (!userToggled.current) setIsExpanded(true)
      startedAt.current = message.reasoningStartedAt ?? Date.now()
      setElapsed(0)
    }
  }, [status, message.reasoningStartedAt])

  // Auto-collapse when thinking completes (like Claude.ai behavior).
  // Respects manual user toggles — if the user opened it, keep it open.
  useEffect(() => {
    if (status === 'completed' && !userToggled.current) {
      setIsExpanded(false)
    }
  }, [status])

  useEffect(() => {
    if (status !== 'streaming' && status !== 'starting') return
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 100) / 10), 100)
    return () => clearInterval(interval)
  }, [status])

  useEffect(() => {
    if (userToggled.current && message.id) saveCollapseState(message.id, isExpanded)
  }, [isExpanded, message.id])

  const handleToggle = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey) {
      document.querySelectorAll('[data-timeline-block]').forEach((el) => {
        const btn = el.querySelector('button')
        if (btn) btn.click()
      })
      return
    }
    userToggled.current = true
    setIsExpanded((v) => !v)
  }, [])

  // If no parts, no reasoning text, and no tool calls, render nothing
  if (!hasContent && status === 'completed') return null

  // Hide trivial thinking: fast response (< 1s), no tool calls, short text.
  // Prevents the pill from flashing when the model barely thinks.
  const isTrivial = status === 'completed'
    && elapsed < 1
    && !hasToolCalls
    && (message.reasoningText?.length ?? 0) < 40
  if (isTrivial) return null

  return (
    <motion.div
      layout
      className={cn('timeline-block', className)}
      data-timeline-block={message.id}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={handleToggle}
        className="timeline-block-trigger"
        style={{
          background: isHovered && !isExpanded ? 'var(--bg-hover)' : 'transparent',
          borderRadius: 'var(--radius-md)',
          padding: '4px 6px',
          transition: 'background 0.15s',
          width: '100%',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <ThinkingPill
          status={status}
          tokensUsed={message.thinkingTokensUsed ?? 0}
          isExpanded={isExpanded}
          elapsed={elapsed}
          lastSkillName={lastSkillName}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="timeline-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="timeline-body">
              {/* Skeleton/status while starting */}
              {(status === 'starting' || status === 'streaming') && !hasReasoningText && !hasParts && (
                <>
                  {message.thinkingStatusText ? (
                    <ThinkingStatusLine text={message.thinkingStatusText} />
                  ) : (
                    <ThinkingSkeletonRows />
                  )}
                </>
              )}

              {/* Skill activation badges */}
              {skillBadges.map((step) => (
                <SkillActivationBadge
                  key={step.id}
                  skillName={(step.name ?? '').replace(/^[^\s]+\s/, '')}
                  skillIcon={(step.name ?? '').split(' ')[0] || '\ud83d\udce6'}
                  skillCategory={step.meta ?? ''}
                  status={step.status === 'completed' ? 'completed' : 'running'}
                />
              ))}

              {/* Render parts in chronological order */}
              {hasParts ? (
                parts.map((part) => {
                  if (part.kind === 'reasoning') {
                    return (
                      <ThinkingLines
                        key={part.id}
                        text={part.text}
                        isStreaming={status === 'streaming' && !part.completedAt}
                        showFullContent={showFullContent}
                        onToggleShowFull={() => setShowFullContent((v) => !v)}
                      />
                    )
                  }
                  if (part.kind === 'tool') {
                    const tc = message.toolCalls?.find((t) => t.id === part.toolCallId)
                    if (!tc) return null
                    return <ToolTraceRow key={part.id} toolCall={tc} />
                  }
                  if (part.kind === 'subagent') {
                    return (
                      <SubagentActivationBadge
                        key={part.id}
                        subagentName={part.subagentName}
                        taskSummary={part.taskSummary}
                        status={part.completedAt ? 'completed' : 'running'}
                        durationMs={part.durationMs}
                        success={part.success}
                      />
                    )
                  }
                  return null
                })
              ) : (
                /* Fallback: render reasoning text directly if no parts but has reasoningText */
                hasReasoningText && (
                  <ThinkingLines
                    text={message.reasoningText ?? ''}
                    isStreaming={status === 'streaming'}
                    showFullContent={showFullContent}
                    onToggleShowFull={() => setShowFullContent((v) => !v)}
                  />
                )
              )}

              {/* Fallback: render tool calls that aren't in parts (legacy data) */}
              {!hasParts && hasToolCalls && (
                <div style={{ marginTop: 4 }}>
                  {message.toolCalls!.map((tc) => (
                    <ToolTraceRow key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}
            </div>

            {/* Stream stall indicator */}
            {(status === 'streaming' || status === 'starting') && (
              <div style={{ padding: '0 6px 4px' }}>
                <StreamStallIndicator streaming={status === 'streaming'} message={message} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}