import { useRef, useState } from 'react'
import { Plus, Mic, ArrowUp, Square, AlertCircle } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { useChatStore } from '@/stores/chat.store'
import { useProviderStore } from '@/stores/provider.store'
import { useChatSession } from '@/hooks/useChatSession'
import { cn } from '@/lib/utils'
import { ModelPicker } from './ModelPicker'
import { AttachMenu } from './AttachMenu'

export function ChatInput() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const { input, setInput } = useSettingsStore()
  const isStreaming = useChatStore((s) => s.isStreaming)
  const providers = useProviderStore((s) => s.providers)
  const hasProvider = providers.some((p) => p.kind === 'local' || p.apiKey)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const { sendMessage } = useChatSession()

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function handleSend() {
    const text = input.trim()
    if (!text || isStreaming) return
    if (!hasProvider) return
    sendMessage(text)
    setInput('')
  }

  function handleStop() {
    stopStreaming()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isStreaming) {
        handleStop()
      } else if (hasProvider) {
        handleSend()
      }
    }
  }

  const canSend = input.trim().length > 0 && hasProvider

  return (
    <div style={{ padding: '12px 20px 18px', position: 'relative' }}>
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

              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize() }}
                onKeyDown={handleKey}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={hasProvider ? "Ask anything..." : "Configura un proveedor para chatear..."}
                rows={1}
                style={{
                  flex: 1,
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

            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px 10px',
              gap: 6,
            }}>
              <ModelPicker />

              <div style={{ flex: 1 }} />

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
