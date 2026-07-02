import { useMemo } from 'react'
import { useEventBus } from '@/stores/event-bus.store'
import type { SpartaEvent } from '@/types'

interface TimelineEntry {
  type: string
  label: string
  icon: string
  startedAt: number
  durationMs?: number
  status: 'running' | 'completed' | 'error'
}

const EVENT_ICONS: Record<string, string> = {
  'thinking:started': '🧠',
  'thinking:completed': '✓',
  'tool:called': '🔧',
  'tool:result': '✓',
  'tool:error': '⚠',
  'search:progress': '🔍',
  'skill:activated': '✨',
}

function buildTimelineEntries(events: SpartaEvent[]): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  const toolStartTimes: Record<string, number> = {}

  for (const event of events) {
    const e = event as unknown as Record<string, unknown>
    const type = e.type as string
    const timestamp = (e.timestamp as number) || Date.now()

    if (type === 'thinking:started') {
      entries.push({ type, label: 'Pensando', icon: EVENT_ICONS[type], startedAt: timestamp, status: 'running' })
    } else if (type === 'thinking:completed') {
      const started = entries.find((entry) => entry.type === 'thinking:started' && entry.status === 'running')
      if (started) {
        started.status = 'completed'
        started.durationMs = timestamp - started.startedAt
      }
    } else if (type === 'tool:called') {
      const toolCall = e.toolCall as { id?: string; toolName?: string } | undefined
      const id = toolCall?.id || String(timestamp)
      const name = toolCall?.toolName || 'tool'
      toolStartTimes[id] = timestamp
      entries.push({ type, label: `${name}`, icon: EVENT_ICONS[type], startedAt: timestamp, status: 'running' })
    } else if (type === 'tool:result') {
      const id = (e.toolCallId as string) || String(timestamp)
      const existing = entries.find((entry) => entry.type === 'tool:called' && entry.status === 'running')
      if (existing) {
        existing.status = 'completed'
        existing.durationMs = timestamp - (toolStartTimes[id] || existing.startedAt)
      }
    } else if (type === 'tool:error') {
      const existing = entries.find((entry) => entry.type === 'tool:called' && entry.status === 'running')
      if (existing) {
        existing.status = 'error'
      } else {
        entries.push({ type, label: 'Error de tool', icon: EVENT_ICONS[type], startedAt: timestamp, status: 'error' })
      }
    } else if (type === 'search:progress') {
      const stage = e.stage as string
      const query = e.query as string | undefined
      if (stage === 'searching') {
        entries.push({ type, label: `Buscando: ${query || ''}`, icon: EVENT_ICONS[type], startedAt: timestamp, status: 'running' })
      } else if (stage === 'done') {
        const running = entries.find((entry) => entry.type === 'search:progress' && entry.status === 'running')
        if (running) {
          running.status = 'completed'
          running.durationMs = timestamp - running.startedAt
        }
      }
    } else if (type === 'skill:activated') {
      const skillName = e.skillName as string
      entries.push({ type, label: `Skill: ${skillName}`, icon: EVENT_ICONS[type], startedAt: timestamp, status: 'completed' })
    }
  }

  return entries
}

export function EventTimeline({ messageId }: { messageId: string }) {
  const events = useEventBus((s) =>
    s.events.filter((e) => {
      const ev = e as unknown as Record<string, unknown>
      return 'messageId' in ev && (ev.messageId as string) === messageId
    })
  )

  const entries = useMemo(() => buildTimelineEntries(events), [events])

  if (entries.length === 0) return null

  return (
    <div
      style={{
        marginTop: 8,
        padding: '6px 10px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-ui)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 6,
        }}
      >
        Eventos
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map((entry, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: entry.status === 'error' ? 'var(--status-err)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <span>{entry.icon}</span>
            <span style={{ flex: 1 }}>{entry.label}</span>
            {entry.durationMs !== undefined && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {entry.durationMs >= 1000 ? `${(entry.durationMs / 1000).toFixed(1)}s` : `${entry.durationMs}ms`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
