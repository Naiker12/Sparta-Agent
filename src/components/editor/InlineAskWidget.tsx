"use client"

import { useState, useEffect, useRef } from 'react'
import type { editor } from 'monaco-editor'
import { Send, X } from 'lucide-react'
import { useEventBus } from '@/stores/event-bus.store'

interface InlineAskWidgetProps {
  editor: editor.IStandaloneCodeEditor
  selection: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }
  filePath: string
  selectedText: string
  language: string
  onClose: () => void
}

/**
 * InlineAskWidget — floating input that appears below a code selection
 * when user presses Cmd+K or uses context menu. Sends the selection context
 * to the agent and displays the result as inline decorations.
 */
export function InlineAskWidget({ editor, selection, filePath, selectedText, language, onClose }: InlineAskWidgetProps) {
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dispatch = useEventBus((s) => s.dispatch)
  const widgetId = useRef(`inline-ask-${Date.now()}`)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || submitting) return

    setSubmitting(true)
    try {
      // Build context-aware message for the agent
      const contextMessage = {
        role: 'user' as const,
        content: `${prompt}\n\n\`\`\`${language}\n${selectedText}\n\`\`\``,
        metadata: {
          type: 'inline_edit_request',
          filePath,
          selection: {
            startLine: selection.startLineNumber,
            startCol: selection.startColumn,
            endLine: selection.endLineNumber,
            endCol: selection.endColumn,
          },
          selectedText,
        },
      }

      // Dispatch to chat system
      dispatch({
        type: 'chat:send_message',
        message: contextMessage,
        timestamp: Date.now(),
      } as any)

      // Show ghost text decoration to indicate request was sent
      showGhostDecoration(selection.startLineNumber, 'Enviando al agente...')
      
      onClose()
    } catch (error) {
      console.error('Failed to send inline ask:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const showGhostDecoration = (line: number, text: string) => {
    editor.deltaDecorations([], [
      {
        range: new (window as any).monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'inline-ask-ghost',
          glyphMarginClassName: 'inline-ask-glyph',
          after: {
            content: ` ${text}`,
            inlineClassName: 'inline-ask-after',
          },
        },
      },
    ])

    // Auto-remove after 3 seconds
    setTimeout(() => {
      editor.deltaDecorations([], [])
    }, 3000)
  }

  // Position widget below selection
  const position = editor.getScrolledVisiblePosition({
    lineNumber: selection.endLineNumber,
    column: selection.endColumn,
  })

  if (!position) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: position.left,
        top: position.top + 24,
        zIndex: 1000,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-normal)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        padding: '8px',
        minWidth: 320,
        maxWidth: 480,
      }}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="¿Qué querés cambiar de esto?"
            disabled={submitting}
            style={{
              flex: 1,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 10px',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={submitting || !prompt.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: '#fff',
              cursor: 'pointer',
              opacity: (submitting || !prompt.trim()) ? 0.5 : 1,
            }}
          >
            <Send size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </form>
    </div>
  )
}