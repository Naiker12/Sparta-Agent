import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check, Loader2, X } from 'lucide-react'
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'
import type { ToolCall } from '@/types'

interface ToolCallSummaryProps {
  toolCall: ToolCall
}

export function ToolCallSummary({ toolCall }: ToolCallSummaryProps) {
  const [expanded, setExpanded] = useState(false)

  function extractInputPreview(input: unknown): string {
    if (!input) return ''
    if (typeof input === 'string') return input.slice(0, 60) + (input.length > 60 ? '…' : '')
    if (typeof input === 'object') {
      const obj = input as Record<string, unknown>
      for (const key of ['query', 'url', 'path', 'command', 'text', 'content', 'topic']) {
        const val = obj[key]
        if (typeof val === 'string' && val) return val.slice(0, 60) + (val.length > 60 ? '…' : '')
      }
      const firstStr = Object.values(obj).find((v) => typeof v === 'string')
      if (firstStr) return String(firstStr).slice(0, 60) + (String(firstStr).length > 60 ? '…' : '')
    }
    const str = JSON.stringify(input)
    return str.length > 60 ? str.slice(0, 60) + '…' : str
  }

  const inputStr = typeof toolCall.input === 'string'
    ? toolCall.input
    : JSON.stringify(toolCall.input, null, 2)

  const inputPreview = extractInputPreview(toolCall.input)

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '5px 10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 11.5,
          fontFamily: 'var(--font-mono)',
          textAlign: 'left',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <StatusIcon status={toolCall.status} />

        <span style={{
          color: toolCall.status === 'running' ? 'var(--status-warn)' : 'var(--text-secondary)',
          fontWeight: 500,
          minWidth: 80,
        }}>
          {toolCall.toolName}
        </span>

        <span style={{
          color: 'var(--text-muted)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {inputPreview}
        </span>

        {toolCall.durationMs !== undefined && (
          <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>
            {toolCall.durationMs >= 1000
              ? `${(toolCall.durationMs / 1000).toFixed(1)}s`
              : `${toolCall.durationMs}ms`}
          </span>
        )}

        <ChevronDown
          size={12}
          style={{
            color: 'var(--text-muted)',
            flexShrink: 0,
            transition: 'transform 0.15s',
            transform: expanded ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              borderTop: '1px solid var(--border-subtle)',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <DetailSection label="Input" content={inputStr} />
              {toolCall.status === 'error' && (toolCall.error || toolCall.output) && (
                <div style={{
                  fontSize: 11,
                  color: 'var(--status-err)',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'pre-wrap',
                  background: 'color-mix(in srgb, var(--status-err) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--status-err) 20%, transparent)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                }}>
                  ✕ Error: {toolCall.error ?? toolCall.output}
                </div>
              )}
              {toolCall.output && toolCall.status !== 'error' && (
                toolCall.toolName === 'web_search' || toolCall.toolName === 'web_search_tool'
                  ? (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Resultados
                      </div>
                      <div style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-ui)',
                      }}>
                        <MarkdownRenderer content={toolCall.output} />
                      </div>
                    </div>
                  )
                  : <DetailSection label="Output" content={toolCall.output} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DetailSection({ label, content }: { label: string; content: string }) {
  const [truncated, setTruncated] = useState(true)
  const isLong = content.length > 200

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{
        fontSize: 11.5,
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: truncated && isLong ? 60 : 'none',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {content}
        {isLong && truncated && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            background: 'linear-gradient(to left, var(--bg-elevated), transparent)',
            paddingLeft: 20,
          }}>
            <button
              onClick={() => setTruncated(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ver más
            </button>
          </div>
        )}
        {isLong && !truncated && (
          <button
            onClick={() => setTruncated(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: 11,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
              padding: 0,
              display: 'block',
              marginTop: 4,
            }}
          >
            ver menos
          </button>
        )}
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: ToolCall['status'] }) {
  if (status === 'completed')
    return <Check size={12} strokeWidth={2.5} style={{ color: 'var(--status-ok)', flexShrink: 0 }} />
  if (status === 'error')
    return <X size={12} strokeWidth={2.5} style={{ color: 'var(--status-err)', flexShrink: 0 }} />
  return (
    <Loader2
      size={12}
      strokeWidth={2}
      style={{ color: 'var(--status-warn)', flexShrink: 0, animation: 'spin 1s linear infinite' }}
    />
  )
}
