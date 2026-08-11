import { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from 'ia-sparta-core'
import { ThinkingPill } from './ThinkingPill'
import { ThinkingLines } from './ThinkingLines'
import { ToolTraceRow } from './ToolTraceRow'
import { ThinkingSkeletonRows } from './ThinkingSkeletonRows'
import { ThinkingStatusLine } from './ThinkingStatusLine'
import { SkillActivationBadge } from './SkillActivationBadge'
import { SubagentExecutionCard } from './SubagentExecutionCard'
import { StreamStallIndicator } from './StreamStallIndicator'
import { Eye } from 'lucide-react'
import type { Message, ThinkingStatus } from 'ia-sparta-core'
import { formatDuration } from 'ia-sparta-core'

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

function hasSelectionInside(container: HTMLElement | null): boolean {
  if (!container) return false
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false
  const range = sel.getRangeAt(0)
  return container.contains(range.commonAncestorContainer)
}

export function TimelineBlock({ message, className }: TimelineBlockProps) {
  const savedState = useMemo(() => loadCollapseState(message.id), [message.id])
  const status: ThinkingStatus = !message.isStreaming
    ? 'completed'
    : (message.thinkingStatus ?? 'streaming')

  // Auto-expand during live streaming like Traycer AI
  const isStreamingActive = status === 'streaming' || status === 'starting'
  const [isExpanded, setIsExpanded] = useState(
    savedState !== null ? savedState : isStreamingActive
  )
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef(message.reasoningStartedAt ?? Date.now())
  const userToggled = useRef(savedState !== null)
  const blockRef = useRef<HTMLDivElement>(null)

  const parts = message.parts ?? []
  const hasParts = parts.length > 0
  const hasReasoningText = (message.reasoningText?.trim().length ?? 0) > 0
  const hasToolCalls = (message.toolCalls?.length ?? 0) > 0

  const skillBadges = useMemo(
    () => message.pipelineSteps?.filter((s) => s.id?.startsWith('skill-')) ?? [],
    [message.pipelineSteps]
  )

  const lastSkillName = useMemo(() => {
    const completed = skillBadges.filter((s) => s.status === 'completed')
    return completed.length > 0 ? completed[completed.length - 1].name : null
  }, [skillBadges])

  // Timer loop for elapsed seconds
  useEffect(() => {
    const rawMsg = (message as unknown) as Record<string, unknown>
    const durationMs = typeof rawMsg.reasoningDurationMs === 'number' ? rawMsg.reasoningDurationMs : 0
    if (status !== 'streaming' && status !== 'starting') {
      if (durationMs > 0) setElapsed(durationMs / 1000)
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const diffSec = Math.max(0, (now - startedAt.current) / 1000)
      setElapsed(diffSec)
    }, 200)

    return () => clearInterval(interval)
  }, [status, message])

  useEffect(() => {
    if (userToggled.current && message.id) saveCollapseState(message.id, isExpanded)
  }, [isExpanded, message.id])

  // Sync userToggled ref when message changes
  useEffect(() => {
    userToggled.current = savedState !== null
  }, [message.id, savedState])

  // Auto-expand during live streaming, auto-collapse on finish (unless user manually toggled)
  useEffect(() => {
    if (!userToggled.current) {
      setIsExpanded(isStreamingActive)
    }
  }, [isStreamingActive])

  const handleToggle = useCallback(() => {
    if (hasSelectionInside(blockRef.current)) return
    userToggled.current = true
    setIsExpanded((v) => !v)
  }, [])

  // Always show the thinking pill above every assistant response so the user can inspect duration & execution.

  return (
    <div
      ref={blockRef}
      className={cn('timeline-block flex flex-col gap-1', className)}
      data-timeline-block={message.id}
    >
      {/* Reasoning Header Button (🧠 Thought for 1s / Thinking) */}
      <button
        onClick={handleToggle}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <ThinkingPill
          status={status}
          isExpanded={isExpanded}
          elapsed={elapsed}
          lastSkillName={lastSkillName}
        />
      </button>

      {/* Full Reasoning Trace Body (Left Rail Layout) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="timeline-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                marginLeft: 20,
                paddingLeft: 12,
                borderLeft: '1px solid var(--border-subtle)',
                marginTop: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {(status === 'starting' || status === 'streaming') && !hasReasoningText && !hasParts && (
                <>
                  {message.thinkingStatusText ? (
                    <ThinkingStatusLine text={message.thinkingStatusText} />
                  ) : (
                    <ThinkingSkeletonRows />
                  )}
                </>
              )}

              {skillBadges.map((step) => (
                <SkillActivationBadge
                  key={step.id}
                  skillName={(step.name ?? '').replace(/^[^\s]+\s/, '')}
                  skillIcon={(step.name ?? '').split(' ')[0] || '📦'}
                  skillCategory={step.meta ?? ''}
                  status={step.status === 'completed' ? 'completed' : 'running'}
                />
              ))}

              {hasParts ? (
                parts.map((part) => {
                  if (part.kind === 'reasoning') {
                    return (
                      <ThinkingLines
                        key={part.id}
                        text={part.text}
                        isStreaming={status === 'streaming' && !part.completedAt}
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
                      <SubagentExecutionCard
                        key={part.id}
                        subagentName={part.subagentName}
                        taskSummary={part.taskSummary}
                        status={part.completedAt ? (part.success === false ? 'failed' : 'completed') : 'running'}
                        durationMs={part.durationMs}
                        success={part.success}
                        steps={part.steps}
                      />
                    )
                  }
                  return null
                })
              ) : hasReasoningText ? (
                <ThinkingLines
                  text={message.reasoningText ?? ''}
                  isStreaming={status === 'streaming'}
                />
              ) : (
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: '2px 0' }}>
                  ✓ Proceso de generación e inferencia completado en {formatDuration(elapsed || 1)}.
                </div>
              )}

              {!hasParts && hasToolCalls && (
                <div style={{ marginTop: 4 }}>
                  {message.toolCalls!.map((tc) => (
                    <ToolTraceRow key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}
            </div>

            {(status === 'streaming' || status === 'starting') && (
              <div style={{ padding: '4px 0 0 20px' }}>
                <StreamStallIndicator streaming={status === 'streaming'} message={message} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function TurnActivityBadge({ message }: { message: Message }) {
  const elapsed = useMemo(() => {
    if (message.reasoningStartedAt && message.reasoningCompletedAt) {
      return Math.max(1, (message.reasoningCompletedAt - message.reasoningStartedAt) / 1000)
    }
    if (message.reasoningStartedAt) {
      return Math.max(1, (Date.now() - message.reasoningStartedAt) / 1000)
    }
    return 0
  }, [message.reasoningStartedAt, message.reasoningCompletedAt])

  const hasReasoning = Boolean(message.reasoningText?.trim() || message.toolCalls?.length || message.reasoningStartedAt)
  if (!hasReasoning) return null

  const displayElapsed = elapsed > 0 ? elapsed : 1

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-ui)',
        marginRight: 6,
        userSelect: 'none',
      }}
    >
      <Eye size={12} style={{ color: 'var(--text-muted)' }} />
      <span>Razonó durante {formatDuration(displayElapsed)}</span>
    </div>
  )
}
