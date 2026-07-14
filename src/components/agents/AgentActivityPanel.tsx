import { useState, useEffect, useRef } from 'react'
import { useEventBus } from '@/stores/event-bus.store'
import { useProjectStore } from '@/stores/project.store'
import { useDiffReviewStore } from '@/stores/diff-review.store'
import {
  FileSearch, FilePen, FileX, Terminal, Globe, Brain,
  ChevronDown, ChevronRight, Loader2, Check, X,
} from 'lucide-react'

interface ActivityEntry {
  id: string
  toolName: string
  label: string
  input?: unknown
  status: 'running' | 'completed' | 'error'
  startedAt: number
  completedAt?: number
  durationMs?: number
  error?: string
}

const TOOL_ICONS: Record<string, typeof FileSearch> = {
  read_file_tool: FileSearch,
  read_files_tool: FileSearch,
  write_file_tool: FilePen,
  patch_file_tool: FilePen,
  delete_file_tool: FileX,
  search_files_tool: FileSearch,
  terminal_execute_tool: Terminal,
  terminal_execute_background_tool: Terminal,
  web_search_tool: Globe,
  web_search: Globe,
  web_fetch_tool: Globe,
}

function labelForTool(name: string, input: unknown): string {
  const inp = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  switch (name) {
    case 'read_file_tool':
      return `Leyó ${String(inp.path ?? '').split('/').pop() ?? ''}`
    case 'read_files_tool': {
      const paths = inp.paths as string[] | undefined
      return `Leyó ${paths?.length ?? 0} archivos`
    }
    case 'write_file_tool':
      return `Escribió ${String(inp.path ?? '').split('/').pop() ?? ''}`
    case 'patch_file_tool':
      return `Editó ${String(inp.path ?? '').split('/').pop() ?? ''}`
    case 'delete_file_tool':
      return `Eliminó ${String(inp.path ?? '').split('/').pop() ?? ''}`
    case 'search_files_tool':
      return `Buscó ${String(inp.pattern ?? inp.query ?? '')}`
    case 'terminal_execute_tool':
      return `Terminal: ${String(inp.command ?? '').slice(0, 40)}`
    case 'terminal_execute_background_tool':
      return `Terminal (bg): ${String(inp.command ?? '').slice(0, 40)}`
    case 'web_search_tool':
    case 'web_search':
      return `Buscó web: ${String(inp.query ?? '')}`
    case 'web_fetch_tool':
      return `Fetch: ${String(inp.url ?? '').slice(0, 50)}`
    default:
      return name
  }
}

export function AgentActivityPanel() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [expanded, setExpanded] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const { activeProposal, queue, resolve, next } = useDiffReviewStore()
  const dispatch = useEventBus((s) => s.dispatch)

  useEffect(() => {
    const unsub = useEventBus.getState().subscribe((event) => {
      const e = event as unknown as Record<string, unknown>
      const type = e.type as string

      if (type === 'tool:called') {
        const toolName = (e.toolName ?? '') as string
        const id = (e.toolCallId ?? e.id ?? `${Date.now()}`) as string
        const input = e.input
        setEntries((prev) => [
          ...prev,
          {
            id,
            toolName,
            label: labelForTool(toolName, input),
            input,
            status: 'running',
            startedAt: Date.now(),
          },
        ])
      } else if (type === 'tool:result') {
        const toolName = (e.toolName ?? '') as string
        setEntries((prev) => {
          const updated = [...prev]
          // Find the last running entry with this tool name
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].toolName === toolName && updated[i].status === 'running') {
              updated[i] = {
                ...updated[i],
                status: 'completed',
                completedAt: Date.now(),
                durationMs: (e.durationMs as number) ?? (Date.now() - updated[i].startedAt),
              }
              break
            }
          }
          return updated
        })
      } else if (type === 'tool:error') {
        const toolName = (e.toolName ?? '') as string
        setEntries((prev) => {
          const updated = [...prev]
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].toolName === toolName && updated[i].status === 'running') {
              updated[i] = {
                ...updated[i],
                status: 'error',
                completedAt: Date.now(),
                error: (e.error as string) ?? 'Error',
              }
              break
            }
          }
          return updated
        })
      }
    })
    return unsub
  }, [])

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (expanded && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [entries.length, expanded])

  const runningCount = entries.filter((e) => e.status === 'running').length
  const recentEntries = entries.slice(-50) // Keep last 50

  const handleDiffRespond = async (approved: boolean) => {
    if (!activeProposal) return
    await window.editorBridge?.respondDiff({ requestId: activeProposal.requestId, approved })
    resolve(activeProposal.requestId, approved)
    dispatch({ type: 'editor:diff_resolved', filePath: activeProposal.filePath, approved, timestamp: Date.now() } as any)
    if (approved) {
      dispatch({ type: 'editor:open_file', filePath: activeProposal.filePath, timestamp: Date.now() } as any)
    }
    next()
  }

  const pendingCount = queue.filter((q) => q.status === 'pending').length

  return (
    <div style={{
      width: 280,
      borderLeft: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-ui)',
      fontSize: 12,
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Actividad del agente
          </span>
        </div>
        {runningCount > 0 && (
          <span style={{
            background: 'var(--accent)',
            color: 'white',
            borderRadius: 10,
            padding: '1px 6px',
            fontSize: 10,
            fontWeight: 600,
          }}>
            {runningCount}
          </span>
        )}
      </div>

      {/* Project info card */}
      {activeProject?.rootPath && (
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
          fontSize: 11,
        }}>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
            {activeProject.name}
          </span>
          <span style={{ marginLeft: 6, opacity: 0.6 }}>
            {activeProject.rootPath.split(/[/\\]/).pop()}
          </span>
        </div>
      )}

      {/* Pending diff review card */}
      {activeProposal && (
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(234, 179, 8, 0.04)',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 500, color: 'var(--text-primary)',
            marginBottom: 4,
          }}>
            Cambio propuesto
            {pendingCount > 1 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
                ({pendingCount} pendientes)
              </span>
            )}
          </div>
          <div style={{
            fontSize: 10, color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: 6,
          }}>
            {activeProposal.filePath.split(/[\\/]/).pop()}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => handleDiffRespond(false)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                padding: '4px 0', borderRadius: 5, cursor: 'pointer',
                fontSize: 11, fontFamily: 'var(--font-ui)',
                background: 'transparent', border: '1px solid var(--border-normal)',
                color: 'var(--status-err)',
              }}
            >
              <X size={11} /> Rechazar
            </button>
            <button
              onClick={() => handleDiffRespond(true)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                padding: '4px 0', borderRadius: 5, cursor: 'pointer',
                fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
                background: 'var(--accent)', border: '1px solid var(--accent)',
                color: '#fff',
              }}
            >
              <Check size={11} /> Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Activity list */}
      {expanded && (
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {recentEntries.length === 0 && (
            <div style={{
              padding: '20px 12px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 11,
            }}>
              Sin actividad ainda
            </div>
          )}
          {recentEntries.map((entry) => {
            const Icon = TOOL_ICONS[entry.toolName] ?? Brain
            const isRunning = entry.status === 'running'
            const isError = entry.status === 'error'
            return (
              <div
                key={entry.id}
                style={{
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  background: isRunning ? 'rgba(234, 179, 8, 0.06)' : 'transparent',
                  borderLeft: isRunning ? '2px solid var(--status-warn)' : '2px solid transparent',
                }}
              >
                <div style={{
                  flexShrink: 0,
                  marginTop: 1,
                  color: isRunning
                    ? 'var(--status-warn)'
                    : isError
                      ? 'var(--status-err)'
                      : 'var(--text-muted)',
                }}>
                  {isRunning ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : isError ? (
                    <X size={13} />
                  ) : (
                    <Check size={13} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: isRunning
                      ? 'var(--text-primary)'
                      : isError
                        ? 'var(--status-err)'
                        : 'var(--text-secondary)',
                  }}>
                    <Icon size={11} style={{ flexShrink: 0 }} />
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {entry.label}
                    </span>
                  </div>
                  {entry.durationMs !== undefined && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                      {entry.durationMs}ms
                    </div>
                  )}
                  {entry.error && (
                    <div style={{
                      fontSize: 10,
                      color: 'var(--status-err)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {entry.error}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
