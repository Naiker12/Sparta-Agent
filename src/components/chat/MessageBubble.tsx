import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Check, Pencil, Trash2, CheckCheck, X, RotateCw } from 'lucide-react'
import type { Message } from '@/types'
import { useChatStore } from '@/stores/chat.store'
import { useEventBus } from '@/stores/event-bus.store'
import { useChatSession } from '@/hooks/useChatSession'
import { ThinkingBlock } from './reasoning/ThinkingBlock'
import { ThinkingPill } from './reasoning/ThinkingPill'
import { PipelineTrace } from './reasoning/PipelineTrace'
import { MessageActionsDialog } from './MessageActionsDialog'
import { SpartaIcon } from './SpartaIcon'

interface MessageBubbleProps {
  message: Message
  isLastUser?: boolean
}

type DialogState =
  | { kind: 'none' }
  | { kind: 'delete' }
  | { kind: 'share' }
  | { kind: 'edit' }
  | { kind: 'regenerate' }

export function MessageBubble({ message, isLastUser = false }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const showThinkingPill = message.isStreaming && !message.content && !message.reasoningText
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' })
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)
  const { updateMessage, deleteMessage } = useChatStore()
  const { sendMessage } = useChatSession()
  const dispatch = useEventBus((s) => s.dispatch)

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

  function handleDelete() {
    deleteMessage(message.sessionId, message.id)
    dispatch({ type: 'message:deleted', sessionId: message.sessionId, messageId: message.id, timestamp: Date.now() })
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

          {showThinkingPill && (
            <div style={{ marginBottom: 8 }}>
              <ThinkingPill isThinking label="Thinking" />
            </div>
          )}

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
                  <CheckCheck size={12} />
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
          ) : message.content && (
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
              {message.content}
            </div>
          )}

          <AnimatePresence>
            {message.reasoningText && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                style={{ marginTop: 8 }}
              >
                <ThinkingBlock content={message.reasoningText} collapsed={!message.isStreaming} />
              </motion.div>
            )}
          </AnimatePresence>

          {message.toolCalls && message.toolCalls.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <PipelineTrace
                steps={message.toolCalls.map((tc) => ({
                  id: tc.id,
                  name: tc.toolName,
                  meta: typeof tc.input === 'string' ? tc.input : undefined,
                  status:
                    tc.status === 'completed'
                      ? 'done' as const
                      : tc.status === 'running'
                      ? 'running' as const
                      : 'error' as const,
                  durationMs: tc.durationMs,
                }))}
              />
            </div>
          )}

          {!message.isStreaming && message.content && !editing && (
            <div
              className="message-actions-bar"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                marginTop: 6,
              }}
            >
              <IconButton icon={copied ? <Check size={11} /> : <Copy size={11} />} onClick={handleCopy} title="Copiar" />
              {isUser && isLastUser && <IconButton icon={<Pencil size={11} />} onClick={() => { setEditValue(message.content); setEditing(true) }} title="Editar" />}
              {isUser && isLastUser && <IconButton icon={<RotateCw size={11} />} onClick={() => sendMessage(message.content)} title="Reenviar" />}
              {isUser && isLastUser && <IconButton icon={<Trash2 size={11} />} onClick={handleDelete} title="Eliminar" />}
            </div>
          )}
        </div>
      </div>

      <MessageActionsDialog
        message={message}
        sessionId={message.sessionId}
        state={dialog}
        onClose={() => setDialog({ kind: 'none' })}
      />
    </>
  )
}

function IconButton({ icon, onClick, title }: { icon: React.ReactNode; onClick: () => void; title: string }) {
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
