import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check, Loader2, X, AlertTriangle, FileText, PenSquare, Trash2, Search, Terminal, Globe, Edit3 } from 'lucide-react'
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'
import type { ToolCall } from '@/types'

interface ToolCallSummaryProps {
  toolCall: ToolCall
}

function getToolCallSummary(toolCall: ToolCall): { icon: React.ReactNode; label: string; description: string } {
  const input = toolCall.input as Record<string, unknown> | undefined
  const path = (input?.path ?? input?.file_path ?? '') as string | undefined
  const query = (input?.query ?? '') as string | undefined
  const command = (input?.command ?? '') as string | undefined
  const pattern = (input?.pattern ?? '') as string | undefined
  const searchContent = (input?.content ?? '') as string | undefined
  const url = (input?.url ?? '') as string | undefined

  const truncate = (s: string, max = 50) =>
    s.length > max ? s.slice(0, max) + '…' : s

  const iconSize = 12

  switch (toolCall.toolName) {
    case 'read_file_tool':
      return {
        icon: <FileText size={iconSize} strokeWidth={1.5} />,
        label: 'Leyendo archivo',
        description: path ? truncate(path) : '',
      }
    case 'write_file_tool': {
      const mode = input?.append ? 'Añadiendo a' : 'Escribiendo'
      return {
        icon: <PenSquare size={iconSize} strokeWidth={1.5} />,
        label: mode,
        description: path ? truncate(path) : '',
      }
    }
    case 'delete_file_tool':
      return {
        icon: <Trash2 size={iconSize} strokeWidth={1.5} />,
        label: 'Eliminando',
        description: path ? truncate(path) : '',
      }
    case 'patch_file_tool':
      return {
        icon: <Edit3 size={iconSize} strokeWidth={1.5} />,
        label: 'Editando archivo',
        description: path ? truncate(path) : '',
      }
    case 'search_files_tool':
      return {
        icon: <Search size={iconSize} strokeWidth={1.5} />,
        label: 'Buscando archivos',
        description: pattern ? `*${truncate(pattern)}*` : searchContent ? `«${truncate(searchContent)}»` : '',
      }
    case 'terminal_execute_tool':
    case 'terminal_execute_background_tool':
      return {
        icon: <Terminal size={iconSize} strokeWidth={1.5} />,
        label: 'Ejecutando comando',
        description: command ? truncate(command, 40) : '',
      }
    case 'web_search':
    case 'web_search_tool':
      return {
        icon: <Globe size={iconSize} strokeWidth={1.5} />,
        label: 'Buscando en la web',
        description: query ? truncate(query, 40) : '',
      }
    case 'web_fetch':
    case 'web_fetch_tool':
      return {
        icon: <Globe size={iconSize} strokeWidth={1.5} />,
        label: 'Leyendo página',
        description: url ? truncate(url, 40) : '',
      }
    default:
      return {
        icon: null,
        label: toolCall.toolName.replace(/_tool$/, '').replace(/_/g, ' '),
        description: '',
      }
  }
}

export function ToolCallSummary({ toolCall }: ToolCallSummaryProps) {
  const [expanded, setExpanded] = useState(false)
  const { icon, label, description } = getToolCallSummary(toolCall)

  const inputStr = typeof toolCall.input === 'string'
    ? toolCall.input
    : JSON.stringify(toolCall.input, null, 2)

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
          fontFamily: 'var(--font-ui)',
          textAlign: 'left',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <StatusIcon status={toolCall.status} error={toolCall.error} />

        {icon && (
          <span style={{ color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
            {icon}
          </span>
        )}

        <span style={{
          color: toolCall.status === 'running' ? 'var(--status-warn)' : 'var(--text-secondary)',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>

        {description && (
          <span style={{
            color: 'var(--text-muted)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}>
            {description}
          </span>
        )}

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
                  color: isInterrupted(toolCall.error) ? 'var(--status-warn)' : 'var(--status-err)',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'pre-wrap',
                  background: isInterrupted(toolCall.error)
                    ? 'color-mix(in srgb, var(--status-warn) 8%, transparent)'
                    : 'color-mix(in srgb, var(--status-err) 8%, transparent)',
                  border: isInterrupted(toolCall.error)
                    ? '1px solid color-mix(in srgb, var(--status-warn) 20%, transparent)'
                    : '1px solid color-mix(in srgb, var(--status-err) 20%, transparent)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                }}>
                  {isInterrupted(toolCall.error) ? '⚠ Interrumpido: ' : '✕ Error: '}{toolCall.error ?? toolCall.output}
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

function isInterrupted(error?: string): boolean {
  return (error ?? '').startsWith('Interrumpido')
}

function StatusIcon({ status, error }: { status: ToolCall['status']; error?: string }) {
  if (status === 'completed')
    return <Check size={12} strokeWidth={2.5} style={{ color: 'var(--status-ok)', flexShrink: 0 }} />
  if (status === 'error') {
    if (isInterrupted(error)) {
      return <AlertTriangle size={12} strokeWidth={2.5} style={{ color: 'var(--status-warn)', flexShrink: 0 }} />
    }
    return <X size={12} strokeWidth={2.5} style={{ color: 'var(--status-err)', flexShrink: 0 }} />
  }
  return (
    <Loader2
      size={12}
      strokeWidth={2}
      style={{ color: 'var(--status-warn)', flexShrink: 0, animation: 'spin 1s linear infinite' }}
    />
  )
}
