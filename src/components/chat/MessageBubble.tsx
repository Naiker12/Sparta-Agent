import { useState } from 'react'
import { Copy, Check, Pencil, CheckCheck, X, RotateCw, Trash2, RefreshCw } from 'lucide-react'
import type { Message } from '@/types'
import { useChatStore } from '@/stores/chat.store'
import { useEventBus } from '@/stores/event-bus.store'
import { useChatSession } from '@/hooks/useChatSession'
import { ThinkingBlock } from './reasoning/ThinkingBlock'
import { SearchProgressBlock } from './reasoning/SearchProgressBlock'
import { ToolCallSummary } from './reasoning/ToolCallSummary'
import { ToolCallDiffView } from './reasoning/ToolCallDiffView'
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

function getFollowUpSuggestions(content: string, lang: string): string[] {
  const text = content.toLowerCase()
  const isEs = lang === 'es'

  // 1. Code
  if (
    text.includes('javascript') ||
    text.includes('typescript') ||
    text.includes('react') ||
    text.includes('const ') ||
    text.includes('function ') ||
    text.includes('import ') ||
    text.includes('def ') ||
    text.includes('class ')
  ) {
    return isEs
      ? ['Explícame cómo funciona este código paso a paso', '¿Cómo puedo manejar errores y excepciones en este código?', 'Escribe pruebas unitarias para esta lógica']
      : ['Explain how this code works step by step', 'How can I handle errors and exceptions here?', 'Write unit tests for this logic']
  }

  // 2. Styles
  if (text.includes('css') || text.includes('flexbox') || text.includes('style') || text.includes('design') || text.includes('html')) {
    return isEs
      ? ['¿Cómo hago que este diseño sea responsivo para móviles?', 'Agrega una animación de entrada suave al componente', '¿Cuáles son las mejores prácticas para estructurar este HTML/CSS?']
      : ['How do I make this design responsive for mobile?', 'Add a smooth entrance animation to the component', 'What are best practices for structuring this HTML/CSS?']
  }

  // 3. Backend, databases, APIs
  if (text.includes('sql') || text.includes('database') || text.includes('base de datos') || text.includes('api') || text.includes('jwt') || text.includes('auth') || text.includes('server')) {
    return isEs
      ? ['¿Cómo puedo proteger esta API contra ataques comunes?', 'Muéstrame cómo conectar esto a una base de datos', '¿Cuáles son las ventajas y desventajas de este diseño de backend?']
      : ['How can I protect this API against common attacks?', 'Show me how to connect this to a database', 'What are the pros and cons of this backend design?']
  }

  // 4. Research
  if (text.includes('noticias') || text.includes('investiga') || text.includes('resultados') || text.includes('información') || text.includes('artículo') || text.includes('news') || text.includes('research') || text.includes('results') || text.includes('article')) {
    return isEs
      ? ['Profundiza más en el punto más importante', '¿Cuáles son las fuentes originales de esta información?', 'Dame un resumen ejecutivo en formato de lista']
      : ['Go deeper into the most important point', 'What are the original sources of this information?', 'Give me an executive summary in list format']
  }

  // 5. Generic
  return isEs
    ? ['Muéstrame un ejemplo práctico de esto', '¿Cuáles son las alternativas a este enfoque?', 'Dame una explicación simplificada']
    : ['Show me a practical example of this', 'What are the alternatives to this approach?', 'Give me a simplified explanation']
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
  const { t, lang } = useTranslation()
  const suggestions = !isUser ? (message.suggestions ?? getFollowUpSuggestions(message.content, lang)) : []

  const hasReasoningText = (message.reasoningText?.trim().length ?? 0) > 0
  const hasThinking = !isUser && (
    message.isStreaming ||
    message.thinkingStatus === 'starting' ||
    message.thinkingStatus === 'streaming' ||
    ((message.thinkingStatus === 'completed' || message.thinkingStatus === 'collapsed') && hasReasoningText) ||
    hasReasoningText
  )
  const isSearchTool = (toolName: string) => {
    const normalized = toolName.toLowerCase()
    return (
      normalized === 'web_search' ||
      normalized === 'web_search_tool' ||
      normalized.includes('web_search') ||
      normalized.includes('search_tool')
    )
  }

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
          ) : null}

          {/* Search progress — VIVO durante búsqueda web */}
          {(message.searchProgress && message.searchProgress.length > 0) ||
            (message.toolCalls?.some((tc) => isSearchTool(tc.toolName) && tc.status === 'running')) ? (
            <div style={{ marginTop: 8 }}>
              <SearchProgressBlock
                items={message.searchProgress ?? []}
                isActive={
                  message.toolCalls?.some((tc) => isSearchTool(tc.toolName) && tc.status === 'running') ??
                  false
                }
                query={message.searchQuery}
              />
            </div>
          ) : null}

          {/* Tool calls — antes del texto */}
          {message.toolCalls && message.toolCalls.filter((tc) => !isSearchTool(tc.toolName)).length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tool Calls ({message.toolCalls.filter((tc) => !isSearchTool(tc.toolName)).length})
              </div>
              {message.toolCalls
                .filter((tc) => !isSearchTool(tc.toolName))
                .map((tc) => (
                  <div key={tc.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <ToolCallSummary toolCall={tc} />
                    <ToolCallDiffView
                      toolName={tc.toolName}
                      input={tc.input}
                      output={tc.output}
                    />
                  </div>
                ))}
            </div>
          )}

          {/* Pipeline trace */}
          {message.pipelineSteps && message.pipelineSteps.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <PipelineTrace steps={message.pipelineSteps} message={message} />
            </div>
          )}

          {/* Thinking block */}
          {hasThinking && (
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <ThinkingBlock
                content={message.reasoningText ?? ''}
                status={message.thinkingStatus ?? (message.isStreaming ? 'streaming' : 'completed')}
                tokensUsed={message.thinkingTokensUsed ?? 0}
                thinkingStatusText={message.thinkingStatusText}
                pipelineSteps={message.pipelineSteps}
                messageId={message.id}
              />
            </div>
          )}

          {renderState.kind === 'thinking_pending' && !hasThinking && (
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <ThinkingBlock content="" status="starting" tokensUsed={0} thinkingStatusText={message.thinkingStatusText} messageId={message.id} />
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
              {isUser && isLastUser && <IconButton icon={<RotateCw size={11} />} onClick={() => sendMessage(message.content)} title={t('chat.resend')} />}
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
