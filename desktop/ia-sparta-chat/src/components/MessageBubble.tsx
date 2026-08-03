import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ThinkingStatus } from 'ia-sparta-core'
import { Copy, Check, Pencil, CheckCircle, X, RefreshCw, Trash2, AlertCircle, Settings, ChevronDown } from 'lucide-react'
import type { Message, MessagePart, ToolCall } from 'ia-sparta-core'
import { useChatStore, useSettingsStore } from 'ia-sparta-core'
import { useEventBus } from 'ia-sparta-core'
import { useChatSession } from 'ia-sparta-core'
import { TimelineBlock, TurnActivityBadge } from './reasoning/TimelineBlock'
import { ThinkingPill } from './reasoning/ThinkingPill'
import { ThinkingLines } from './reasoning/ThinkingLines'
import { StreamCursor } from './reasoning/StreamCursor'
import { ToolTraceRow } from './reasoning/ToolTraceRow'
import { SubagentExecutionCard } from './reasoning/SubagentExecutionCard'
import { PipelineTrace } from './reasoning/PipelineTrace'
import { MessageActionsDialog } from './MessageActionsDialog'
import { SpartaIcon } from './SpartaIcon'
import { getMessageRenderState, getAssistantRenderGroups, splitTurnAtAnswer, shouldCollapseSteps, pickElapsedVerb, formatDuration } from 'ia-sparta-core'
import type { AssistantRenderGroup, ReasoningGroup } from 'ia-sparta-core'
import { MarkdownRenderer } from './MarkdownRenderer'
import { useTranslation } from 'ia-sparta-i18n'
import { parseUserMessageAttachments } from '../lib/attachment-pipeline'
import { AttachmentCard } from './input/AttachmentCard'

function cleanDisplayContent(text: string): string {
  if (!text) return ''
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  if (cleaned.startsWith('El usuario') && (cleaned.includes('¡') || cleaned.includes('Hola') || cleaned.includes('\n\n'))) {
    const match = /(¡[\s\S]*|Hola[\s\S]*|\n\n[\s\S]*)/.exec(cleaned)
    if (match && match[1].trim().length > 0) {
      cleaned = match[1].trim()
    }
  }
  return cleaned
}

interface MessageBubbleProps {
  message: Message
  isLastUser?: boolean
  isLastAssistant?: boolean
}

export function MessageBubble({ message, isLastUser = false, isLastAssistant = false }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const renderState = getMessageRenderState(message.content, message.reasoningText, message.isStreaming ?? false)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)
  const [dialog, setDialog] = useState<{ kind: 'none' } | { kind: 'delete' } | { kind: 'regenerate' }>({ kind: 'none' })
  const { updateMessage } = useChatStore()
  const { sendMessage } = useChatSession()
  const dispatch = useEventBus((s) => s.dispatch)
  const { t } = useTranslation()
  const hasInterleavedTextParts = message.parts?.some(p => p.kind === 'text')
  const splitTurn = useMemo(() => {
    if (!hasInterleavedTextParts || message.isStreaming || !message.parts) return null
    return splitTurnAtAnswer(message.parts, false)
  }, [hasInterleavedTextParts, message.isStreaming, message.parts])
  const isErrorMessage = !isUser && (message.content.startsWith('Error:') || message.content.toLowerCase().includes('api key'))
  const userParsed = useMemo(() => {
    if (!isUser) return { cleanText: message.content, attachments: [] }
    return parseUserMessageAttachments(message.content)
  }, [isUser, message.content])

  const suggestions = !isUser && !isErrorMessage ? (message.suggestions ?? []) : []

  function handleCopy() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function handleEditSave() {
    if (!editValue.trim()) return
    updateMessage(message.id, { content: editValue })
    dispatch({ type: 'message:edited', sessionId: message.sessionId, messageId: message.id, timestamp: Date.now() })
    setEditing(false)
  }

  function handleEditCancel() {
    setEditValue(message.content)
    setEditing(false)
  }

  return (
    <>
      <div
        className="message-row"
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          position: 'relative',
        }}
      >
        <div
          style={{
            maxWidth: isUser ? 480 : 600,
            width: isUser ? undefined : '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
              justifyContent: isUser ? 'flex-end' : 'flex-start',
            }}
          >
            {!isUser && (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: 'var(--accent-muted)',
                    color: 'var(--accent)',
                  }}
                >
                  <SpartaIcon size={16} />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  Sparta Agent
                </span>
              </>
            )}
            <span
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {editing ? (
            <div>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 60,
                  padding: '8px 10px',
                  fontSize: 13.5,
                  fontFamily: 'var(--font-ui)',
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--accent)',
                  borderRadius: 'var(--radius-md)',
                  outline: 'none',
                  resize: 'vertical',
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <button
                  onClick={handleEditSave}
                  disabled={!editValue.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', fontSize: 11,
                    background: 'var(--accent)', border: 'none',
                    borderRadius: 'var(--radius-sm)', color: 'white',
                    cursor: editValue.trim() ? 'pointer' : 'not-allowed',
                    fontFamily: 'var(--font-ui)',
                    opacity: editValue.trim() ? 1 : 0.5,
                  }}
                >
                  <CheckCircle size={12} />
                  Guardar
                </button>
                <button
                  onClick={handleEditCancel}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', fontSize: 11,
                    background: 'var(--bg-hover)', border: 'none',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'var(--font-ui)',
                  }}
                >
                  <X size={12} />
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {/* Interleaved parts: render reasoning + text in chronological order — with merged reasoning groups */}
          {!isUser && hasInterleavedTextParts && message.parts ? (
            <InterleavedRenderer
              parts={message.parts}
              isStreaming={message.isStreaming ?? false}
              toolCalls={message.toolCalls ?? []}
              reasoningStartedAt={message.reasoningStartedAt}
              reasoningCompletedAt={message.reasoningCompletedAt}
              messageId={message.id}
            />
          ) : (
            <>
              {/* Unified Timeline ABOVE the response (thinking first, answer below) — legacy fallback */}
              {!isUser && (
                <div style={{ marginBottom: 8 }}>
                  <TimelineBlock message={message} />
                </div>
              )}

              {/* Response text BELOW thinking block — legacy fallback */}
              {renderState.kind === 'generating' || renderState.kind === 'responding' || renderState.kind === 'done' ? (
                <>
                  {isUser ? (
                    <div>
                      {userParsed.attachments.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          {userParsed.attachments.map((att) => (
                            <AttachmentCard key={att.id} attachment={att} readOnly />
                          ))}
                        </div>
                      )}
                      {userParsed.cleanText && (
                        <MarkdownRenderer
                          content={userParsed.cleanText}
                          isStreaming={false}
                        />
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-ui)',
                        wordBreak: 'break-word',
                      }}
                    >
                      {isErrorMessage ? (
                        <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: 'var(--text-primary)',
                            fontSize: 13,
                            lineHeight: 1.5,
                            fontFamily: 'var(--font-ui)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            marginTop: 4,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontWeight: 600, fontSize: 13 }}>
                            <AlertCircle size={16} />
                            <span>Error del Proveedor de IA</span>
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>
                            {renderState.content.replace(/^Error:\s*/i, '')}
                          </div>
                          {(renderState.content.toLowerCase().includes('api key') ||
                            renderState.content.toLowerCase().includes('expirada') ||
                            renderState.content.toLowerCase().includes('inválida') ||
                            renderState.content.toLowerCase().includes('configura')) && (
                            <div style={{ paddingTop: 2 }}>
                              <button
                                type="button"
                                onClick={() => useSettingsStore.getState().openSettings()}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '6px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'var(--accent)',
                                  color: 'white',
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontFamily: 'var(--font-ui)',
                                }}
                              >
                                <Settings size={13} />
                                Configurar API Key en Ajustes ⚙️
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <MarkdownRenderer
                          content={cleanDisplayContent(renderState.content)}
                          isStreaming={renderState.kind === 'responding' || renderState.kind === 'generating'}
                        />
                      )}
                    </div>
                  )}
                  {!isUser && (renderState.kind === 'responding' || renderState.kind === 'generating') && <StreamCursor visible />}
                </>
              ) : null}
            </>
          )}

          {/* Pipeline trace (kept separate as it's not part of the reasoning/tool timeline) */}
          {message.pipelineSteps && message.pipelineSteps.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <PipelineTrace steps={message.pipelineSteps} message={message} />
            </div>
          )}

          {isLastAssistant && !message.isStreaming && suggestions.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, marginBottom: 4 }}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 12px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 16,
                    color: 'var(--text-secondary)',
                    fontSize: 11.5,
                    fontFamily: 'var(--font-ui)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                    e.currentTarget.style.color = 'var(--accent)'
                    e.currentTarget.style.background = 'var(--accent-muted)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                    e.currentTarget.style.background = 'var(--bg-surface)'
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Empty response fallback */}
          {!isUser && renderState.kind === 'empty_error' && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 10px',
                border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                background: 'var(--bg-surface)',
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: 'var(--font-ui)',
              }}
            >
              {t('chat.emptyError')}
            </div>
          )}

          {!message.isStreaming && (message.content || renderState.kind === 'empty_error') && !editing && message.thinkingStatus !== 'streaming' && (
            <div
              className="message-actions-bar"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                marginTop: 6,
              }}
            >
              {!isUser && !splitTurn && <TurnActivityBadge message={message} />}
              <IconButton icon={copied ? <Check size={11} /> : <Copy size={11} />} onClick={handleCopy} title={t('chat.copy')} />
              {isUser && isLastUser && <IconButton icon={<Pencil size={11} />} onClick={() => { setEditValue(message.content); setEditing(true) }} title={t('chat.edit')} />}
              {isUser && isLastUser && <IconButton icon={<RefreshCw size={11} />} onClick={() => sendMessage(message.content)} title={t('chat.resend')} />}
              {!isUser && <IconButton icon={<RefreshCw size={11} />} onClick={() => setDialog({ kind: 'regenerate' })} title={t('chat.regenerate')} />}
              <IconButton icon={<Trash2 size={11} />} onClick={() => setDialog({ kind: 'delete' })} title={t('chat.delete')} style={{ marginLeft: 2, color: 'var(--text-muted)' }} />
            </div>
          )}
        </div>
        <MessageActionsDialog
          message={message}
          sessionId={message.sessionId}
          state={dialog}
          onClose={() => setDialog({ kind: 'none' })}
        />
      </div>
    </>
  )
}

function InterleavedRenderer({ parts, isStreaming, toolCalls, reasoningStartedAt, reasoningCompletedAt, messageId }: {
  parts: MessagePart[]
  isStreaming: boolean
  toolCalls: ToolCall[]
  reasoningStartedAt?: number
  reasoningCompletedAt?: number
  messageId: string
}) {
  const split = useMemo(
    () => splitTurnAtAnswer(parts, isStreaming),
    [parts, isStreaming]
  )

  const groups = useMemo(
    () => getAssistantRenderGroups(parts, isStreaming),
    [parts, isStreaming]
  )

  if (split) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <StepRunSummary
          steps={split.steps}
          toolCalls={toolCalls}
          reasoningStartedAt={reasoningStartedAt}
          reasoningCompletedAt={reasoningCompletedAt}
          messageId={messageId}
        />
        {split.answer.map((group) => (
          <GroupRenderer key={group.id} group={group} isStreaming={false} toolCalls={toolCalls} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.map((group) => (
        <GroupRenderer key={group.id} group={group} isStreaming={isStreaming} toolCalls={toolCalls} />
      ))}
      {isStreaming && <StreamCursor visible />}
    </div>
  )
}

function GroupRenderer({ group, isStreaming, toolCalls }: {
  group: AssistantRenderGroup
  isStreaming: boolean
  toolCalls: ToolCall[]
}) {
  if (group.kind === 'reasoning') {
    return <ReasoningGroupBlock group={group} />
  }
  if (group.kind === 'text') {
    return (
      <MarkdownRenderer
        content={cleanDisplayContent(group.content)}
        isStreaming={isStreaming}
      />
    )
  }
  if (group.kind === 'tool') {
    const tc = toolCalls.find((t) => t.id === group.toolCallId)
    if (!tc) return null
    return <ToolTraceRow toolCall={tc} />
  }
  if (group.kind === 'subagent') {
    return (
      <SubagentExecutionCard
        subagentName={group.subagentName}
        taskSummary={group.taskSummary}
        status={group.completedAt ? (group.success === false ? 'failed' : 'completed') : 'running'}
        durationMs={group.durationMs}
        success={group.success}
      />
    )
  }
  return null
}

function ReasoningGroupBlock({ group }: { group: ReasoningGroup }) {
  const isActive = group.isStreaming
  const status: ThinkingStatus = isActive ? 'streaming' : 'completed'

  const savedState = useMemo(() => {
    try {
      const stored = localStorage.getItem(`sparta:reasoning:${group.id}`)
      if (stored !== null) return JSON.parse(stored)
    } catch { /* ignore */ }
    return null
  }, [group.id])

  const [isExpanded, setIsExpanded] = useState(savedState !== null ? savedState : isActive)
  const [elapsed, setElapsed] = useState(0)
  const userToggled = useRef(savedState !== null)
  const startedAtRef = useRef(group.startedAt)

  useEffect(() => {
    if (isActive) {
      startedAtRef.current = group.startedAt
      setElapsed(0)
    }
  }, [isActive, group.startedAt])

  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(() => {
      setElapsed((Date.now() - startedAtRef.current) / 1000)
    }, 200)
    return () => clearInterval(interval)
  }, [isActive])

  useEffect(() => {
    if (userToggled.current && group.id) {
      try { localStorage.setItem(`sparta:reasoning:${group.id}`, JSON.stringify(isExpanded)) } catch { /* ignore */ }
    }
  }, [isExpanded, group.id])

  useEffect(() => {
    if (userToggled.current) return
    if (isActive) {
      setIsExpanded(true)
    } else {
      setIsExpanded(false)
    }
  }, [isActive])

  const handleToggle = useCallback(() => {
    userToggled.current = true
    setIsExpanded((v: boolean) => !v)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
        <ThinkingPill status={status} isExpanded={isExpanded} elapsed={elapsed} lastSkillName={null} />
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="reasoning-content"
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
              }}
            >
              <ThinkingLines text={group.text} isStreaming={isActive} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StepRunSummary({ steps, toolCalls, reasoningStartedAt, reasoningCompletedAt, messageId }: {
  steps: AssistantRenderGroup[]
  toolCalls: ToolCall[]
  reasoningStartedAt?: number
  reasoningCompletedAt?: number
  messageId: string
}) {
  const verb = useMemo(() => pickElapsedVerb(messageId), [messageId])

  const elapsed = useMemo(() => {
    if (reasoningStartedAt !== undefined && reasoningCompletedAt !== undefined && reasoningCompletedAt > reasoningStartedAt) {
      return (reasoningCompletedAt - reasoningStartedAt) / 1000
    }
    return null
  }, [reasoningStartedAt, reasoningCompletedAt])

  const label = useMemo(() => {
    if (elapsed !== null) return `${verb} for ${formatDuration(elapsed)}`
    const stepRowCount = steps.filter(g => g.kind !== 'text').length
    return stepRowCount === 1 ? '1 step' : `${stepRowCount} steps`
  }, [verb, elapsed, steps])

  const collapse = useMemo(() => shouldCollapseSteps(steps), [steps])

  const savedState = useMemo(() => {
    try {
      const stored = localStorage.getItem(`sparta:step-summary:${messageId}`)
      if (stored !== null) return JSON.parse(stored)
    } catch { /* ignore */ }
    return null
  }, [messageId])

  const [isExpanded, setIsExpanded] = useState(savedState === true)

  const handleToggle = useCallback(() => {
    setIsExpanded((v) => {
      const next = !v
      try { localStorage.setItem(`sparta:step-summary:${messageId}`, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [messageId])

  if (!collapse) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {steps.map((group) => (
          <GroupRenderer key={group.id} group={group} isStreaming={false} toolCalls={toolCalls} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <button
        onClick={handleToggle}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <span className="font-medium">{label}</span>
        <ChevronDown
          size={13}
          style={{
            color: 'var(--text-muted)',
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="step-run-content"
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
                gap: 6,
              }}
            >
              {steps.map((group) => (
                <GroupRenderer key={group.id} group={group} isStreaming={false} toolCalls={toolCalls} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function IconButton({ icon, onClick, title, style: extraStyle }: { icon: React.ReactNode; onClick: () => void; title: string; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        padding: 0,
        background: 'none',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'all 0.1s',
        ...extraStyle,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-hover)'
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none'
        e.currentTarget.style.color = 'var(--text-muted)'
      }}
    >
      {icon}
    </button>
  )
}