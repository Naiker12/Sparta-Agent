import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, X, AlertTriangle, FileText, Search, ChevronRight, Sparkles, FolderTree, Globe, Terminal as TerminalIcon, Pencil, Trash2, Wrench } from 'lucide-react'
import { SearchResultsList } from './SearchResultsList'
import { RunningCommandBlock } from './RunningCommandBlock'
import { inferToolSubstatus, substatusLabel, useMCPStore, getVendorForServer, useArtifactStore, useSessionStore } from 'ia-sparta-core'
import { BrandIcon } from 'ia-sparta-design-system'
import type { ToolCall, SearchProgressItem } from 'ia-sparta-core'

interface ToolTraceRowProps {
  toolCall: ToolCall
}

function parseSearchResultsFromToolCall(toolCall: ToolCall): SearchProgressItem[] {
  if (toolCall.searchProgress && toolCall.searchProgress.length > 0) {
    return toolCall.searchProgress
  }

  const output = toolCall.output
  if (!output || typeof output !== 'string' || !output.trim()) {
    return []
  }

  const items: SearchProgressItem[] = []

  // 1. Try parsing JSON array or JSON object
  try {
    const parsed = JSON.parse(output)
    const array = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.results)
      ? parsed.results
      : Array.isArray(parsed.organic_results)
      ? parsed.organic_results
      : Array.isArray(parsed.sources)
      ? parsed.sources
      : null

    if (array && array.length > 0) {
      for (const item of array) {
        if (typeof item === 'object' && item !== null) {
          const url = (item.url || item.link || item.href || '') as string
          const title = (item.title || item.name || item.snippet || url) as string
          if (url && url.startsWith('http')) {
            items.push({
              id: `parsed-${items.length}-${url}`,
              url,
              title: title.replace(/<[^>]+>/g, '').trim(),
              status: 'visited',
            })
          }
        }
      }
      if (items.length > 0) return items
    }
  } catch {
    // Not JSON
  }

  // 2. Parse numbered text lists ("1. Title\n URL: https://...")
  const blockRegex = /(?:^|\n)(\d+)\.\s+([^\n]+)(?:\n\s*URL:\s*(https?:\/\/[^\s\n]+))?/gi
  let match: RegExpExecArray | null
  while ((match = blockRegex.exec(output)) !== null) {
    const title = match[2]?.trim()
    const url = match[3]?.trim()
    if (url) {
      items.push({
        id: `parsed-ddg-${items.length}`,
        title: title || url,
        url,
        status: 'visited',
      })
    }
  }
  if (items.length > 0) return items

  // 3. Fallback: Parse markdown links [Title](URL) or plain URLs in text
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi
  while ((match = linkRegex.exec(output)) !== null) {
    const title = match[1]?.trim()
    const url = match[2]?.trim()
    if (url && !items.some(i => i.url === url)) {
      items.push({
        id: `parsed-md-${items.length}`,
        title: title || url,
        url,
        status: 'visited',
      })
    }
  }
  if (items.length > 0) return items

  // 4. Standalone URL regex fallback (e.g. "URL: https://...")
  const standaloneUrlRegex = /https?:\/\/[^\s\n"'>]+/gi
  const foundUrls = output.match(standaloneUrlRegex) || []
  for (const url of foundUrls) {
    if (!items.some(i => i.url === url)) {
      items.push({
        id: `parsed-url-${items.length}`,
        title: url,
        url,
        status: 'visited',
      })
    }
  }

  return items
}

function getToolCallSummary(toolCall: ToolCall): { icon: React.ReactNode; label: string; description: string } {
  const input = toolCall.input as Record<string, unknown> | undefined
  const path = (input?.path ?? input?.file_path ?? input?.directory ?? '') as string | undefined
  const query = (input?.query ?? input?.q ?? toolCall.searchQuery ?? '') as string | undefined
  const skillId = (input?.id ?? input?.skill_id ?? input?.name ?? '') as string | undefined
  const action = (input?.action ?? '') as string | undefined

  const truncate = (s: string, max = 50) =>
    s.length > max ? s.slice(0, max) + '…' : s

  const iconSize = 12

  switch (toolCall.toolName) {
    case 'web_search':
    case 'web_search_tool':
      return {
        icon: <Globe size={iconSize} strokeWidth={1.5} />,
        label: 'Buscando en la web',
        description: query ? `«${truncate(query)}»` : (toolCall.searchQuery ? `«${truncate(toolCall.searchQuery)}»` : ''),
      }
    case 'web_fetch':
    case 'web_fetch_tool':
      return {
        icon: <Globe size={iconSize} strokeWidth={1.5} />,
        label: 'Leyendo sitio web',
        description: (path || input?.url) ? truncate((path || input?.url) as string) : '',
      }
    case 'skills_list':
    case 'skills_list_tool':
      return {
        icon: <Sparkles size={iconSize} strokeWidth={1.5} />,
        label: 'Consultando catálogo de skills',
        description: '',
      }
    case 'skill_view':
    case 'skill_view_tool':
      return {
        icon: <Sparkles size={iconSize} strokeWidth={1.5} />,
        label: 'Leyendo skill',
        description: skillId ? truncate(skillId) : '',
      }
    case 'skill_manage':
    case 'skill_manage_tool':
      return {
        icon: <Sparkles size={iconSize} strokeWidth={1.5} />,
        label: action ? `Skill: ${action}` : 'Gestionando skill',
        description: skillId ? truncate(skillId) : '',
      }
    case 'read_directory_tool':
    case 'list_directory_tool':
      return {
        icon: <FolderTree size={iconSize} strokeWidth={1.5} />,
        label: 'Explorando directorio',
        description: path ? truncate(path) : '.',
      }
    case 'grep_search':
    case 'grep_search_tool':
      return {
        icon: <Search size={iconSize} strokeWidth={1.5} />,
        label: 'Buscando en el código',
        description: query ? `«${truncate(query)}»` : '',
      }
    case 'read_file_tool':
      return {
        icon: <FileText size={iconSize} strokeWidth={1.5} />,
        label: 'Leyendo archivo',
        description: path ? truncate(path) : '',
      }
    case 'write_file_tool': {
      const modeLabel = toolCall.status === 'running'
        ? 'Proponiendo cambio'
        : toolCall.status === 'completed'
          ? (input?.append ? 'Cambio añadido' : 'Cambio aplicado')
          : 'Cambio no aplicado'
      return {
        icon: <FileText size={iconSize} strokeWidth={1.5} />,
        label: modeLabel,
        description: path ? truncate(path) : '',
      }
    }
    case 'read_file':
      return {
        icon: <FileText size={iconSize} strokeWidth={1.5} />,
        label: 'Leyendo archivo',
        description: path ? truncate(path) : '',
      }
    case 'write_file':
      return {
        icon: <FileText size={iconSize} strokeWidth={1.5} />,
        label: 'Escribiendo archivo',
        description: path ? truncate(path) : '',
      }
    case 'edit_file':
      return {
        icon: <Pencil size={iconSize} strokeWidth={1.5} />,
        label: 'Editando archivo',
        description: path ? truncate(path) : '',
      }
    case 'delete_file':
      return {
        icon: <Trash2 size={iconSize} strokeWidth={1.5} />,
        label: 'Eliminando archivo',
        description: path ? truncate(path) : '',
      }
    case 'list_directory':
      return {
        icon: <FolderTree size={iconSize} strokeWidth={1.5} />,
        label: 'Listando directorio',
        description: path ? truncate(path) : '.',
      }
    case 'run_command':
      return {
        icon: <TerminalIcon size={iconSize} strokeWidth={1.5} />,
        label: 'Ejecutando comando',
        description: input?.command ? truncate(String(input.command)) : '',
      }
    default: {
      // Try to resolve as an MCP server tool — show brand icon if found
      const server = useMCPStore.getState().servers.find(s =>
        s.tools.some(t => t.name === toolCall.toolName)
      )
      if (server) {
        const vendor = getVendorForServer(server.id)
        return {
          icon: vendor
            ? <BrandIcon vendor={vendor} size={iconSize} />
            : <Wrench size={iconSize} strokeWidth={1.5} />,
          label: `Usando ${server.name}`,
          description: toolCall.toolName,
        }
      }
      return {
        icon: <FileText size={iconSize} strokeWidth={1.5} />,
        label: toolCall.toolName,
        description: path ? truncate(path) : '',
      }
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
export function ToolTraceRow(props: ToolTraceRowProps) {
  if (props.toolCall.toolName === 'run_command') {
    return <RunningCommandBlock toolCall={props.toolCall} />
  }
  return <ToolTraceRowContent {...props} />
}

function ToolTraceRowContent({ toolCall }: ToolTraceRowProps) {
  const [expanded, setExpanded] = useState(toolCall.status === 'running')
  const [liveSubstatus, setLiveSubstatus] = useState(toolCall.substatus)
  const { icon, label, description } = getToolCallSummary(toolCall)
  const writeFilePath = useMemo(() => {
    if (toolCall.toolName !== 'write_file_tool' && toolCall.toolName !== 'write_file') return null
    const input = toolCall.input as Record<string, unknown> | undefined
    return (input?.path ?? input?.file_path ?? input?.directory ?? null) as string | null
  }, [toolCall.toolName, toolCall.input])
  const isSearch = toolCall.toolName === 'web_search' || toolCall.toolName === 'web_search_tool'
  const isFetch = toolCall.toolName === 'web_fetch' || toolCall.toolName === 'web_fetch_tool'

  const searchItems = useMemo(() => {
    if (!isSearch) return []
    return parseSearchResultsFromToolCall(toolCall)
  }, [isSearch, toolCall.searchProgress, toolCall.output])
  const hasSearchResults = searchItems.length > 0

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

        {isSearch && hasSearchResults && (
          <span style={{
            color: 'var(--text-muted)',
            fontSize: 10,
            fontFamily: 'var(--font-ui)',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            padding: '1px 6px',
            borderRadius: '10px',
            fontWeight: 500,
            flexShrink: 0,
          }}>
            {searchItems.length} resultados
          </span>
        )}

        {toolCall.durationMs !== undefined && (
          <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>
            {toolCall.durationMs >= 1000
              ? `${(toolCall.durationMs / 1000).toFixed(1)}s`
              : `${toolCall.durationMs}ms`}
          </span>
        )}

        {writeFilePath && (toolCall.status === 'completed' || toolCall.status === 'running') && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              const activeSid = useSessionStore.getState().activeSessionId
              useArtifactStore.getState().open(writeFilePath, activeSid ?? undefined)
              useArtifactStore.getState().bump()
            }}
            style={{
              background: 'none', border: '1px solid var(--border-subtle)',
              borderRadius: 4, padding: '1px 6px', cursor: 'pointer',
              color: toolCall.status === 'running' ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 10, fontFamily: 'var(--font-ui)',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
            title="Ver vista previa"
          >
            {toolCall.status === 'running' ? 'En vivo' : 'Vista previa'}
          </button>
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
              padding: '6px 10px 8px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              {/* Search results card */}
              {hasSearchResults && (
                <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)]/50 p-2 my-1">
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-ui)',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    <span>Resultados de búsqueda</span>
                    <span style={{ fontWeight: 500, opacity: 0.8, textTransform: 'none' }}>
                      {searchItems.length} fuentes encontradas
                    </span>
                  </div>
                  <SearchResultsList items={searchItems} />
                  {toolCall.status === 'completed' && (
                    <div style={{
                      marginTop: 6,
                      paddingTop: 4,
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <span>✓ Se extrajeron y analizaron {searchItems.length} fuentes de la web</span>
                    </div>
                  )}
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

              {/* Output fallback if no search items parsed */}
              {toolCall.output && toolCall.status !== 'error' && isSearch && !hasSearchResults && (
                <DetailSection label="Resultado de búsqueda" content={toolCall.output} />
              )}

              {/* Output for fetch tools */}
              {toolCall.output && toolCall.status !== 'error' && isFetch && !isSearch && (
                <DetailSection label="Contenido leído" content={toolCall.output} />
              )}

              {/* Output for non-search tools */}
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
