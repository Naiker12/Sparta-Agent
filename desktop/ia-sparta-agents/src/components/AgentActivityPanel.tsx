import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useEventBus, useProjectStore, useDiffReviewStore } from 'ia-sparta-core'
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { ActivityEntryRow } from './ActivityEntryRow'
import { DiffReviewCard } from './DiffReviewCard'
import { labelForTool, computeDiffStats, formatDuration } from './agent-activity-types'
import type { ActivityEntry } from './agent-activity-types'

interface VirtualizedActivityListProps {
  entries: ActivityEntry[]
  onOpenFile: (filePath?: string) => void
  parentRef: React.RefObject<HTMLDivElement>
}

function VirtualizedActivityList({ entries, onOpenFile, parentRef }: VirtualizedActivityListProps) {
  const [scrollTop, setScrollTop] = useState(0)
  const ROW_HEIGHT = 56
  const containerHeight = parentRef.current?.clientHeight ?? 400
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 3)
  const endIndex = Math.min(entries.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + 3)
  const visibleEntries = entries.slice(startIndex, endIndex)

  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const handler = () => setScrollTop(el.scrollTop)
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [parentRef])

  return (
    <div style={{ position: 'relative', height: `${entries.length * ROW_HEIGHT}px` }}>
      <div style={{ position: 'absolute', left: 18, top: 0, bottom: 0, width: 1, background: 'var(--border-normal)', zIndex: 0 }} />
      {visibleEntries.map((entry, vIdx) => {
        const idx = startIndex + vIdx
        const showTurnDivider = idx === 0 || entries[idx - 1].turnIndex < entry.turnIndex
        return (
          <div
            key={entry.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${idx * ROW_HEIGHT}px)`,
            }}
          >
            {showTurnDivider && idx > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px 4px', position: 'relative', zIndex: 1 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border-normal)' }} />
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>turno</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border-normal)' }} />
              </div>
            )}
            <ActivityEntryRow entry={entry} onOpenFile={onOpenFile} />
          </div>
        )
      })}
    </div>
  )
}

export function AgentActivityPanel() {
  const agentPanelWidth = useUIStore((s) => s.agentPanelWidth)
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
        setEntries((prev) => [
          ...prev,
          { id, toolName, label, input, status: 'running', startedAt: Date.now(), filePath, turnIndex: trackTurnRef.current },
        ])
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
    const uniqueFiles = new Set(recentEntries.filter((e) => e.filePath).map((e) => e.filePath)).size
    const totalMs = recentEntries.reduce((sum, e) => sum + (e.durationMs ?? 0), 0)
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
      width: agentPanelWidth,
      borderLeft: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-ui)',
      fontSize: 12,
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Accent bar */}
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
              width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
              animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0,
            }} />
          )}
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {runningCount > 0 ? 'Agente trabajando…' : 'Actividad del agente'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {runningCount > 0 && (
            <span style={{
              background: 'var(--accent)', color: '#fff', borderRadius: 10,
              padding: '1px 6px', fontSize: 10, fontWeight: 600,
              animation: 'scaleIn 0.15s ease',
            }}>
              {runningCount}
            </span>
          )}
        </div>
      </div>

      {/* Project info */}
      {activeProject?.rootPath && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 11 }}>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{activeProject.name}</span>
          <span style={{ marginLeft: 6, opacity: 0.6 }}>{activeProject.rootPath.split(/[/\\]/).pop()}</span>
        </div>
      )}

      {/* Diff review card */}
      {activeProposal && (
        <DiffReviewCard activeProposal={activeProposal} pendingCount={pendingCount} onRespond={handleDiffRespond} />
      )}

      {/* Activity list */}
      {expanded && (
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0', position: 'relative' }}>
          {recentEntries.length === 0 && (
            <div style={{ padding: '32px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>Sin actividad todavía</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, opacity: 0.6, lineHeight: 1.4 }}>Escribile una tarea al agente para empezar</div>
            </div>
          )}

          {recentEntries.length > 0 && (
            <VirtualizedActivityList
              entries={recentEntries}
              onOpenFile={handleOpenFile}
              parentRef={listRef}
            />
          )}
        </div>
      )}

      {/* Session summary footer */}
      {sessionStats.totalActions > 0 && (
        <div style={{
          padding: '6px 12px', borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', fontSize: 10, color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
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
