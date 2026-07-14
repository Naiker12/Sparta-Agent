import { useState } from 'react'
import { Copy, Check, Pencil, CheckCircle, X, RefreshCw, Trash2 } from 'lucide-react'
import type { Message } from '@/types'
import { useChatStore } from '@/stores/chat.store'
import { useEventBus } from '@/stores/event-bus.store'
import { useChatSession } from '@/hooks/useChatSession'
import { TimelineBlock } from './reasoning/TimelineBlock'
import { StreamCursor } from './reasoning/StreamCursor'
import { PipelineTrace } from './reasoning/PipelineTrace'
import { MessageActionsDialog } from './MessageActionsDialog'
import { SpartaIcon } from './SpartaIcon'
import { getMessageRenderState } from '@/lib/message-render-state'
import { MarkdownRenderer } from './MarkdownRenderer'
import { useTranslation } from '@/i18n'

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
  const isErrorMessage = !isUser && message.content.startsWith('Error:')
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

          {/* Unified Timeline */}
          {!isUser && (
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <TimelineBlock message={message} />
            </div>
          )}

          {/* Pipeline trace (kept separate as it's not part of the reasoning/tool timeline) */}
          {message.pipelineSteps && message.pipelineSteps.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <PipelineTrace steps={message.pipelineSteps} message={message} />
            </div>
          )}

          {renderState.kind === 'generating' || renderState.kind === 'responding' || renderState.kind === 'done' ? (
            <>
              {isUser ? (
                <div
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-ui)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {renderState.content}
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
                  <MarkdownRenderer
                    content={renderState.content}
                    isStreaming={renderState.kind === 'responding' || renderState.kind === 'generating'}
                  />
                </div>
              )}
              {!isUser && (renderState.kind === 'responding' || renderState.kind === 'generating') && <StreamCursor visible />}
            </>
          ) : null}

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