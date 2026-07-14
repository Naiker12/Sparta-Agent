import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useEventBus } from '@/stores/event-bus.store'
import { useProjectStore } from '@/stores/project.store'
import { useDiffReviewStore } from '@/stores/diff-review.store'
import {
  FileSearch, FilePen, FileX, Terminal, Globe, Brain,
  ChevronDown, ChevronRight, Loader2, Check, X,
  Sparkles,
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
  filePath?: string
  linesAdded?: number
  linesRemoved?: number
  turnIndex: number
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

function labelForTool(name: string, input: unknown): { label: string; filePath?: string } {
  const inp = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const rawPath = String(inp.path ?? '')
  const fileName = rawPath.split(/[\\/]/).pop() ?? ''
  switch (name) {
    case 'read_file_tool':
      return { label: `Leyó ${fileName}`, filePath: rawPath || undefined }
    case 'read_files_tool': {
      const paths = inp.paths as string[] | undefined
      return { label: `Leyó ${paths?.length ?? 0} archivos` }
    }
    case 'write_file_tool':
      return { label: `Escribió ${fileName}`, filePath: rawPath || undefined }
    case 'patch_file_tool':
      return { label: `Editó ${fileName}`, filePath: rawPath || undefined }
    case 'delete_file_tool':
      return { label: `Eliminó ${fileName}`, filePath: rawPath || undefined }
    case 'search_files_tool':
      return { label: `Buscó ${String(inp.pattern ?? inp.query ?? '')}` }
    case 'terminal_execute_tool':
      return { label: `Terminal: ${String(inp.command ?? '').slice(0, 40)}` }
    case 'terminal_execute_background_tool':
      return { label: `Terminal (bg): ${String(inp.command ?? '').slice(0, 40)}` }
    case 'web_search_tool':
    case 'web_search':
      return { label: `Buscó web: ${String(inp.query ?? '')}` }
    case 'web_fetch_tool':
      return { label: `Fetch: ${String(inp.url ?? '').slice(0, 50)}` }
    default:
      return { label: name }
  }
}

function computeDiffStats(original: string, updated: string): { added: number; removed: number } {
  const origLines = original.split('\n')
  const newLines = updated.split('\n')
  let removed = 0
  let added = 0
  const maxLen = Math.max(origLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i]
    const n = newLines[i]
    if (o !== undefined && n === undefined) {
      removed++
    } else if (o === undefined && n !== undefined) {
      added++
    } else if (o !== n) {
      removed++
      added++
    }
  }
  return { added, removed }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const remain = (s % 60).toFixed(0)
  return `${m}m ${remain}s`
}

export function AgentActivityPanel() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [expanded, setExpanded] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const { activeProposal, queue, resolve, next } = useDiffReviewStore()
  const dispatch = useEventBus((s) => s.dispatch)

  const trackTurnRef = useRef(0)

  useEffect(() => {
    const unsub = useEventBus.getState().subscribe((event) => {
      const e = event as unknown as Record<string, unknown>
      const type = e.type as string

      if (type === 'agent:started') {
        trackTurnRef.current++
        return
      }

      if (type === 'tool:called') {
        const toolName = (e.toolName ?? '') as string
        const id = (e.toolCallId ?? e.id ?? `${Date.now()}`) as string
        const input = e.input
        const { label, filePath } = labelForTool(toolName, input)
        setEntries((prev) => {
          return [
            ...prev,
            {
              id,
              toolName,
              label,
              input,
              status: 'running',
              startedAt: Date.now(),
              filePath,
              turnIndex: trackTurnRef.current,
            },
          ]
        })
      } else if (type === 'tool:result') {
        const toolName = (e.toolName ?? '') as string
        setEntries((prev) => {
          const updated = [...prev]
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
      } else if (type === 'editor:diff_proposed') {
        const filePath = (e.filePath ?? '') as string
        const original = (e.originalContent ?? '') as string
        const newContent = (e.newContent ?? '') as string
        if (original !== undefined && newContent !== undefined) {
          const { added, removed } = computeDiffStats(original, newContent)
          setEntries((prev) => {
            const updated = [...prev]
            for (let i = updated.length - 1; i >= 0; i--) {
              const entryFilePath = updated[i].filePath
              if (entryFilePath && filePath.endsWith(entryFilePath)) {
                updated[i] = { ...updated[i], linesAdded: added, linesRemoved: removed }
                break
              }
            }
            return updated
          })
        }
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    if (expanded && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [entries.length, expanded])

  const runningCount = entries.filter((e) => e.status === 'running').length
  const recentEntries = entries.slice(-50)

  const sessionStats = useMemo(() => {
    const totalActions = recentEntries.length
    const uniqueFiles = new Set(
      recentEntries
        .filter((e) => e.filePath)
        .map((e) => e.filePath)
    ).size
    const totalMs = recentEntries.reduce(
      (sum, e) => sum + (e.durationMs ?? 0),
      0
    )
    return { totalActions, uniqueFiles, totalMs }
  }, [recentEntries])

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

  const handleOpenFile = useCallback((filePath?: string) => {
    if (!filePath) return
    dispatch({ type: 'editor:open_file', filePath, timestamp: Date.now() } as any)
  }, [dispatch])

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
      {/* Accent bar — visible when agent is active */}
      <div style={{
        height: 2,
        background: runningCount > 0
          ? 'linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%)'
          : 'var(--border-subtle)',
        backgroundSize: runningCount > 0 ? '200% 100%' : undefined,
        animation: runningCount > 0 ? 'shimmer-sweep 2s linear infinite' : undefined,
        flexShrink: 0,
      }} />

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
          {runningCount > 0 && (
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'pulse 1.5s ease-in-out infinite',
              flexShrink: 0,
            }} />
          )}
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {runningCount > 0 ? 'Agente trabajando…' : 'Actividad del agente'}
          </span>
        </div>
        {runningCount > 0 && (
          <span style={{
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 10,
            padding: '1px 6px',
            fontSize: 10,
            fontWeight: 600,
            animation: 'scaleIn 0.15s ease',
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
          background: 'color-mix(in srgb, var(--status-warn) 6%, var(--bg-surface))',
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
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--status-err)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '' }}
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
                transition: 'filter 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = '' }}
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
            position: 'relative',
          }}
        >
          {recentEntries.length === 0 && (
            <div style={{
              padding: '32px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}>
              <Sparkles size={20} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>
                Sin actividad todavía
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, opacity: 0.6, lineHeight: 1.4 }}>
                Escribile una tarea al agente para empezar
              </div>
            </div>
          )}

          {recentEntries.length > 0 && (
            <div style={{ position: 'relative' }}>
              {/* Timeline connector line */}
              <div style={{
                position: 'absolute',
                left: 18,
                top: 0,
                bottom: 0,
                width: 1,
                background: 'var(--border-normal)',
                zIndex: 0,
              }} />

              {recentEntries.map((entry, idx) => {
                const Icon = TOOL_ICONS[entry.toolName] ?? Brain
                const isRunning = entry.status === 'running'
                const isError = entry.status === 'error'
                const showTurnDivider = idx === 0 || recentEntries[idx - 1].turnIndex < entry.turnIndex

                return (
                  <div key={entry.id}>
                    {showTurnDivider && idx > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px 4px',
                        position: 'relative',
                        zIndex: 1,
                      }}>
                        <div style={{
                          flex: 1,
                          height: 1,
                          background: 'var(--border-normal)',
                        }} />
                        <span style={{
                          fontSize: 9,
                          color: 'var(--text-muted)',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          flexShrink: 0,
                        }}>
                          turno
                        </span>
                        <div style={{
                          flex: 1,
                          height: 1,
                          background: 'var(--border-normal)',
                        }} />
                      </div>
                    )}
                    <div
                      style={{
                        padding: '5px 12px 5px 10px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        background: isRunning
                          ? 'color-mix(in srgb, var(--status-warn) 6%, transparent)'
                          : 'transparent',
                        position: 'relative',
                        zIndex: 1,
                        transition: 'background 0.15s',
                      }}
                    >
                      {/* Status dot on timeline */}
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        flexShrink: 0,
                        marginTop: 4,
                        marginLeft: 0,
                        background: isRunning
                          ? 'var(--status-warn)'
                          : isError
                            ? 'var(--status-err)'
                            : 'var(--border-normal)',
                        border: isRunning
                          ? 'none'
                          : isError
                            ? 'none'
                            : '1.5px solid var(--bg-surface)',
                        animation: isRunning ? 'pulse 1.2s ease-in-out infinite' : undefined,
                      }} />

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
                            cursor: entry.filePath ? 'pointer' : undefined,
                          }}
                            title={entry.filePath ?? entry.label}
                            onClick={() => handleOpenFile(entry.filePath)}
                          >
                            {entry.label}
                          </span>

                          {/* Diff stats chip */}
                          {entry.linesAdded !== undefined && entry.linesRemoved !== undefined && (
                            <span style={{
                              flexShrink: 0,
                              fontSize: 9,
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 500,
                              display: 'inline-flex',
                              gap: 2,
                            }}>
                              {entry.linesAdded > 0 && (
                                <span style={{
                                  color: 'var(--status-ok)',
                                  background: 'color-mix(in srgb, var(--status-ok) 10%, transparent)',
                                  padding: '0 3px',
                                  borderRadius: 2,
                                }}>
                                  +{entry.linesAdded}
                                </span>
                              )}
                              {entry.linesRemoved > 0 && (
                                <span style={{
                                  color: 'var(--status-err)',
                                  background: 'color-mix(in srgb, var(--status-err) 10%, transparent)',
                                  padding: '0 3px',
                                  borderRadius: 2,
                                }}>
                                  −{entry.linesRemoved}
                                </span>
                              )}
                            </span>
                          )}

                          {isRunning && (
                            <Loader2 size={10} className="animate-spin" style={{ flexShrink: 0, color: 'var(--status-warn)' }} />
                          )}
                        </div>
                        {entry.durationMs !== undefined && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                            {formatDuration(entry.durationMs)}
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
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Session summary footer */}
      {sessionStats.totalActions > 0 && (
        <div style={{
          padding: '6px 12px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          fontSize: 10,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}>
          <span>{sessionStats.totalActions} acciones</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{sessionStats.uniqueFiles} archivos</span>
          {sessionStats.totalMs > 0 && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{formatDuration(sessionStats.totalMs)}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
