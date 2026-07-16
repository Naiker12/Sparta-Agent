import { useEffect, useState } from 'react'
import { useEventBus } from 'ia-sparta-core'
import type { SpartaEvent } from 'ia-sparta-core'

interface SubagentWatchPaneProps {
  onClose: () => void
}

interface ActiveSubagent {
  name: string
  taskSummary: string
  startedAt: number
  status: 'running' | 'completed'
  durationMs?: number
  success?: boolean
}

export function SubagentWatchPane({ onClose }: SubagentWatchPaneProps) {
  const [subagents, setSubagents] = useState<ActiveSubagent[]>([])
  const [events, setEvents] = useState<SpartaEvent[]>([])

  useEffect(() => {
    const unsub = useEventBus.getState().subscribe((event) => {
      if (event.type === 'subagent:started') {
        const e = event as { subagentName: string; taskSummary: string }
        setSubagents((prev) => [
          ...prev.filter((s) => s.name !== e.subagentName || s.status !== 'running'),
          { name: e.subagentName, taskSummary: e.taskSummary, startedAt: Date.now(), status: 'running' },
        ])
        setEvents((prev) => [...prev.slice(-99), event])
      } else if (event.type === 'subagent:completed') {
        const e = event as { subagentName: string; durationMs: number; success: boolean }
        setSubagents((prev) =>
          prev.map((s) =>
            s.name === e.subagentName && s.status === 'running'
              ? { ...s, status: 'completed', durationMs: e.durationMs, success: e.success }
              : s
          )
        )
        setEvents((prev) => [...prev.slice(-99), event])
      } else if (event.type === 'subagent:thinking') {
        setEvents((prev) => [...prev.slice(-99), event])
      }
    })
    return unsub
  }, [])

  return (
    <div style={{
      width: 340,
      borderLeft: '1px solid var(--border-strong)',
      background: 'var(--bg-modal)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            Subagentes en vivo
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
            {subagents.filter((s) => s.status === 'running').length} activos
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '3px 8px',
            background: 'none',
            border: '1px solid var(--border-normal)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            fontSize: 11,
            fontFamily: 'var(--font-ui)',
            cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {subagents.length === 0 && (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-ui)',
          }}>
            No hay subagentes trabajando en este momento.
          </div>
        )}

        {subagents.map((sa) => (
          <SubagentRow key={`${sa.name}-${sa.startedAt}`} subagent={sa} />
        ))}

        {events.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Eventos
            </div>
            {events.map((ev, i) => (
              <EventRow key={i} event={ev} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SubagentRow({ subagent }: { subagent: ActiveSubagent }) {
  const icon = SUBAGENT_ICONS[subagent.name] ?? '\ud83e\udd16'
  const displayName = subagent.name.charAt(0).toUpperCase() + subagent.name.slice(1)
  const durationLabel = subagent.durationMs !== undefined
    ? subagent.durationMs >= 1000 ? `${(subagent.durationMs / 1000).toFixed(1)}s` : `${subagent.durationMs}ms`
    : null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 8px',
      background: subagent.status === 'running' ? 'var(--bg-active)' : 'var(--bg-elevated)',
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${subagent.status === 'running' ? 'var(--status-warn)' : 'var(--border-subtle)'}`,
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
          {displayName}
        </div>
        <div style={{
          fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {subagent.taskSummary.slice(0, 80)}
        </div>
      </div>
      {subagent.status === 'running' ? (
        <span style={{ color: 'var(--status-warn)', fontSize: 11 }}>...</span>
      ) : (
        <span style={{ color: subagent.success !== false ? 'var(--status-ok)' : 'var(--status-err)', fontSize: 12 }}>
          {subagent.success !== false ? '\u2713' : '\u2717'}
        </span>
      )}
      {durationLabel && (
        <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>{durationLabel}</span>
      )}
    </div>
  )
}

const SUBAGENT_ICONS: Record<string, string> = {
  research: '\ud83d\udd0d',
  code: '\ud83d\udcbb',
  memory: '\ud83e\udde0',
  review: '\ud83d\udccb',
}

function EventRow({ event }: { event: SpartaEvent }) {
  let label: string
  let color: string
  switch (event.type) {
    case 'subagent:started': {
      const e = event as { subagentName: string }
      label = `${e.subagentName} iniciado`
      color = 'var(--status-warn)'
      break
    }
    case 'subagent:completed': {
      const e = event as { subagentName: string; success: boolean }
      label = `${e.subagentName} ${e.success ? 'completado' : 'fallido'}`
      color = e.success ? 'var(--status-ok)' : 'var(--status-err)'
      break
    }
    case 'subagent:thinking': {
      const e = event as { subagentName: string; statusText: string }
      label = `${e.subagentName}: ${e.statusText}`
      color = 'var(--status-think)'
      break
    }
    default:
      label = event.type
      color = 'var(--text-muted)'
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 6px',
      fontSize: 10.5,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-muted)',
    }}>
      <span style={{ color, flexShrink: 0, fontSize: 11 }}>●</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  )
}
