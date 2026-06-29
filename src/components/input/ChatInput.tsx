import { useRef, useState, useEffect } from 'react'
import { Plus, Mic, ArrowUp, Square, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useSettingsStore } from '@/stores/settings.store'
import { useChatStore } from '@/stores/chat.store'
import { useProviderStore } from '@/stores/provider.store'
import { useChatSession } from '@/hooks/useChatSession'
import { cn } from '@/lib/utils'
import { messagingAdapter } from '@/lib/messaging-adapter'
import { ModelPicker } from './ModelPicker'
import { AttachMenu } from './AttachMenu'
import { SlashCommandMenu, executeSlashCommand, type SlashCommand } from './SlashCommandMenu'

interface ChatInputProps {
  className?: string
}

export function ChatInput({ className }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const [showSlash, setShowSlash] = useState(false)
  const { input, setInput } = useSettingsStore()
  const isStreaming = useChatStore((s) => s.isStreaming)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const providers = useProviderStore((s) => s.providers)
  const hasProvider = providers.some((p) => p.kind === 'local' || p.apiKey || p.hasVaultKey)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const injectWhileStreaming = useChatStore((s) => s.injectWhileStreaming)
  const { sendMessage } = useChatSession()

  useEffect(() => {
    setShowSlash(input.startsWith('/') && input.length > 0)
  }, [input])

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function handleSend() {
    const text = input.trim()
    if (!text) return
    if (!hasProvider) return

    if (executeSlashCommand(text)) {
      setInput('')
      return
    }

    if (isStreaming) {
      injectWhileStreaming(text)
      setInput('')
      toast.info('Mensaje encolado para cuando termine la respuesta actual')
      return
    }

    sendMessage(text)
    setInput('')
  }

  function handleStop() {
    const sid = activeSessionId
    if (sid) {
      stopStreaming(sid)
      messagingAdapter.abortMessage(sid)
    } else {
      stopStreaming()
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (hasProvider) {
        handleSend()
      }
    }
  }

  function handleSlashSelect(cmd: SlashCommand) {
    setInput(cmd.usage)
    setShowSlash(false)
    textareaRef.current?.focus()
  }

  const [isRedirectMode, setIsRedirectMode] = useState(false)

  useEffect(() => {
    if (isStreaming) {
      setIsRedirectMode(true)
    } else {
      setIsRedirectMode(false)
    }
  }, [isStreaming])

  const placeholder = !hasProvider
    ? 'Configura un proveedor para chatear...'
    : isStreaming && isRedirectMode
    ? 'Escribe para redirigir al agente...'
    : isStreaming
    ? 'Generando respuesta...'
    : 'Ask anything...'

  const canSend = input.trim().length > 0 && hasProvider

  return (
    <div className={className} style={{ position: 'relative' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {!hasProvider && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            marginBottom: 8,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--status-warn)',
            background: 'color-mix(in srgb, var(--status-warn) 8%, transparent)',
            fontSize: 12,
            color: 'var(--status-warn)',
            fontFamily: 'var(--font-ui)',
          }}>
            <AlertCircle size={14} strokeWidth={1.5} />
            <span>
              No hay proveedores con API key configurados.{' '}
              <button
                onClick={() => useSettingsStore.getState().openSettings()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: 12,
                  padding: 0,
                  fontFamily: 'var(--font-ui)',
                }}
              >
                Configura un proveedor
              </button>
              {' '}(Ajustes &gt; Modelos) para empezar a chatear.
            </span>
          </div>
        )}

        <div className={cn('chat-input-wrapper', isStreaming && 'is-streaming')}>
          <div
            style={{
              background: 'var(--bg-input)',
              borderRadius: 'inherit',
              boxShadow: focused
                ? '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px var(--accent-glow)'
                : '0 4px 20px rgba(0,0,0,0.3)',
              transition: 'box-shadow 0.15s',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              padding: '10px 12px 8px',
              gap: 8,
            }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowAttach(!showAttach)}
                  style={{
                    width: 28,
                    height: 28,
                    background: showAttach ? 'var(--bg-active)' : 'none',
                    border: '1px solid var(--border-normal)',
                    borderRadius: 'var(--radius-md)',
                    color: showAttach ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <Plus size={13} strokeWidth={2} />
                </button>
                {showAttach && <AttachMenu onClose={() => setShowAttach(false)} />}
              </div>

              <div style={{ flex: 1, position: 'relative' }}>
                {showSlash && (
                  <SlashCommandMenu
                    text={input}
                    onSelect={handleSlashSelect}
                    onClose={() => setShowSlash(false)}
                    inputRef={textareaRef}
                  />
                )}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); autoResize() }}
                  onKeyDown={handleKey}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder={placeholder}
                  rows={1}
                  style={{
                    flex: 1,
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 13.5,
                    fontFamily: 'var(--font-ui)',
                    lineHeight: 1.55,
                    resize: 'none',
                    minHeight: 22,
                    maxHeight: 120,
                    caretColor: hasProvider ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                />
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px 10px',
              gap: 6,
            }}>
              <ModelPicker />

              <div style={{ flex: 1 }} />

              {isStreaming && (
                <div style={{ fontSize: 10, color: 'var(--status-warn)', fontFamily: 'var(--font-ui)', paddingRight: 4 }}>
                  Escribe para redirigir
                </div>
              )}
              <button style={{
                width: 28, height: 28,
                background: 'none',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'color 0.15s',
              }}>
                <Mic size={13} strokeWidth={1.5} />
              </button>

              {isStreaming ? (
                <button
                  onClick={handleStop}
                  style={{
                    width: 28, height: 28,
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  <Square size={11} strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  onClick={() => canSend && handleSend()}
                  style={{
                    width: 28, height: 28,
                    background: canSend ? 'var(--accent)' : 'var(--bg-active)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    color: canSend ? 'white' : 'var(--text-muted)',
                    cursor: canSend ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                    transform: canSend ? 'scale(1)' : 'scale(0.95)',
                  }}
                >
                  <ArrowUp size={13} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
