import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, X, AlertTriangle, FileText, SquarePen, Trash2, Search, Terminal, Globe, Pen, ChevronRight } from 'lucide-react'
import { SearchResultsList } from './SearchResultsList'
import { inferToolSubstatus, substatusLabel } from 'ia-sparta-core'
import type { ToolCall } from 'ia-sparta-core'

interface ToolTraceRowProps {
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
      const mode = toolCall.status === 'running'
        ? 'Proponiendo cambio'
        : toolCall.status === 'completed'
          ? (input?.append ? 'Cambio añadido' : 'Cambio aplicado')
          : 'Cambio no aplicado'
      return {
        icon: <SquarePen size={iconSize} strokeWidth={1.5} />,
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
        icon: <Pen size={iconSize} strokeWidth={1.5} />,
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

/**
 * ToolTraceRow — inline tool call trace that looks like a thinking-line.
 * No box/border in collapsed state. Expands to show details.
 */
export function ToolTraceRow({ toolCall }: ToolTraceRowProps) {
  const [expanded, setExpanded] = useState(toolCall.status === 'running')
  const [liveSubstatus, setLiveSubstatus] = useState(toolCall.substatus)
  const { icon, label, description } = getToolCallSummary(toolCall)
  const isSearch = toolCall.toolName === 'web_search' || toolCall.toolName === 'web_search_tool'
  const isFetch = toolCall.toolName === 'web_fetch' || toolCall.toolName === 'web_fetch_tool'
  const hasSearchResults = (toolCall.searchProgress && toolCall.searchProgress.length > 0) || false

  // Live-update substatus while running
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (toolCall.status !== 'running' || !toolCall.startedAt) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setLiveSubstatus(inferToolSubstatus(toolCall.toolName, toolCall.startedAt!, toolCall.searchProgress?.length))
    }, 2000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [toolCall.status, toolCall.toolName, toolCall.startedAt])

  return (
    <div className="tool-trace-row">
      <button
        onClick={() => setExpanded(!expanded)}
        className="tool-trace-row-trigger thinking-line"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '2px 6px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 11.5,
          fontFamily: 'var(--font-ui)',
          textAlign: 'left',
          borderRadius: 'var(--radius-sm)',
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

        {toolCall.status === 'running' && liveSubstatus && (
          <span style={{
            color: 'var(--text-muted)',
            fontSize: 10,
            fontFamily: 'var(--font-ui)',
            fontStyle: 'italic',
          }}>
            {substatusLabel(liveSubstatus)}
          </span>
        )}

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

        <ChevronRight
          size={12}
          style={{
            color: 'var(--text-muted)',
            flexShrink: 0,
            transition: 'transform 0.15s',
            transform: expanded ? 'rotate(90deg)' : 'none',
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
              padding: '4px 10px 8px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              {/* Search results — inline, no card */}
              {hasSearchResults && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Resultados de búsqueda
                  </div>
                  <SearchResultsList items={toolCall.searchProgress!} />
                </div>
              )}

              {/* Error display */}
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

              {/* Output for fetch tools — markdown rendered.
                  NOTA: para búsquedas (isSearch) ya no volvemos a volcar
                  `toolCall.output` aquí. Ese texto es el resultado crudo que
                  recibe el LLM (incluye líneas tipo "IMPORTANTE: no repitas
                  la lista de resultados" dirigidas al modelo, no al usuario)
                  y antes se filtraba directo a la UI. La lista ya parseada
                  (SearchResultsList, arriba) es lo único que debe verse. */}
              {toolCall.output && toolCall.status !== 'error' && isFetch && !isSearch && (
                <DetailSection label="Contenido leído" content={toolCall.output} />
              )}

              {/* Output for non-search tools — technical detail */}
              {toolCall.output && toolCall.status !== 'error' && !isSearch && !isFetch && (
                <DetailSection label="Output" content={toolCall.output} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DetailSection({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <pre
        aria-label={label}
        style={{
          margin: 0,
          padding: '9px 10px',
          maxHeight: 190,
          overflow: 'auto',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-normal)',
          background: 'var(--bg-input)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11.5,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {content}
      </pre>
    </div>
  )
}
