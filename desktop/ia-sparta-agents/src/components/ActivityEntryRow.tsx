import { memo } from 'react'
import { Brain, Loader2 } from 'lucide-react'
import { TOOL_ICONS } from './agent-activity-types'
import type { ActivityEntry } from './agent-activity-types'

interface EntryRowProps {
  entry: ActivityEntry
  onOpenFile: (path?: string) => void
}

export const ActivityEntryRow = memo(function ActivityEntryRow({ entry, onOpenFile }: EntryRowProps) {
  const Icon = TOOL_ICONS[entry.toolName] ?? Brain
  const isRunning = entry.status === 'running'
  const isError = entry.status === 'error'

  return (
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
            : 'var(--status-ok)',
        border: '1.5px solid var(--bg-surface)',
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
            onClick={() => onOpenFile(entry.filePath)}
          >
            {entry.label}
          </span>

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
  )
})

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const remain = (s % 60).toFixed(0)
  return `${m}m ${remain}s`
}
