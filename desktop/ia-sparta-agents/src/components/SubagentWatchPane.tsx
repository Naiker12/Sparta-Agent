import { useEffect, useState } from 'react'
import { useEventBus, useAgentStore } from 'ia-sparta-core'
import type { SpartaEvent, SubagentRun } from 'ia-sparta-core'

interface SubagentWatchPaneProps {
  onClose: () => void
}

export function SubagentWatchPane({ onClose }: SubagentWatchPaneProps) {
  const [events, setEvents] = useState<SpartaEvent[]>([])
  const subagentRuns = useAgentStore((s) => s.subagentRuns)
  const allRuns = Object.values(subagentRuns).flat()

  useEffect(() => {
    const unsub = useEventBus.getState().subscribe((event) => {
      if (
        event.type === 'subagent:started' ||
        event.type === 'subagent:thinking' ||
        event.type === 'subagent:step' ||
        event.type === 'subagent:completed' ||
        event.type === 'subagent:aborted'
      ) {
        setEvents((prev) => [...prev.slice(-99), event])
      }
    })
    return unsub
  }, [])

  const activeCount = allRuns.filter((s) => s.status === 'running').length

  const handleStop = (agentId: string, runName: string) => {
    useAgentStore.getState().completeSubagentRun(agentId, runName, 'error')
    useEventBus.getState().dispatch({
      type: 'subagent:aborted',
      subagentName: runName,
      reason: 'Detenido por el usuario',
      timestamp: Date.now(),
    })
  }

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
            {activeCount} activos
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
        {allRuns.length === 0 && (
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

        {Object.entries(subagentRuns).map(([agentId, runs]) =>
          runs.map((run) => (
            <SubagentRunCard
              key={`${run.name}-${run.startedAt}`}
              run={run}
              onStop={() => handleStop(agentId, run.name)}
            />
          ))
        )}

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

function SubagentRunCard({ run, onStop }: { run: SubagentRun; onStop: () => void }) {
  const icon = SUBAGENT_ICONS[run.name] ?? '\ud83e\udd16'
  const displayName = run.name.charAt(0).toUpperCase() + run.name.slice(1)
  const durationLabel = run.durationMs !== undefined
    ? run.durationMs >= 1000 ? `${(run.durationMs / 1000).toFixed(1)}s` : `${run.durationMs}ms`
    : null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '8px 10px',
      background: run.status === 'running' ? 'var(--bg-active)' : 'var(--bg-elevated)',
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${
        run.status === 'running' ? 'var(--status-warn)' :
        run.status === 'completed' ? 'var(--status-ok)' :
        run.status === 'error' ? 'var(--status-err)' :
        'var(--border-subtle)'
      }`,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            {displayName}
          </span>
          {run.status === 'running' && (
            <span style={{
              fontSize: 9.5,
              color: 'var(--status-warn)',
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {run.currentStep}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {run.taskSummary.slice(0, 80)}
        </div>

        {/* Timeline de pasos */}
        {run.steps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, paddingLeft: 4, borderLeft: '1px solid var(--border-subtle)' }}>
            {run.steps.map((step) => (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontFamily: 'var(--font-mono)' }}>
                {step.status === 'completed' && <span style={{ color: 'var(--status-ok)', fontSize: 10 }}>\u2713</span>}
                {step.status === 'error' && <span style={{ color: 'var(--status-err)', fontSize: 10 }}>\u2715</span>}
                {step.status === 'running' && <span style={{ color: 'var(--status-warn)', fontSize: 10 }}>\u25CC</span>}
                {step.status === 'pending' && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>\u25CB</span>}
                <span style={{ color: 'var(--text-muted)' }}>{step.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        {run.status === 'running' ? (
          <>
            <span style={{ color: 'var(--status-warn)', fontSize: 11 }}>...</span>
            <button
              onClick={onStop}
              title="Detener subagente"
              style={{
                padding: '2px 6px',
                background: 'var(--status-err)',
                border: 'none',
                borderRadius: 3,
                color: 'white',
                fontSize: 9,
                cursor: 'pointer',
                lineHeight: '14px',
              }}
            >
              \u2715
            </button>
          </>
        ) : (
          <span style={{ color: run.status === 'completed' ? 'var(--status-ok)' : 'var(--status-err)', fontSize: 12 }}>
            {run.status === 'completed' ? '\u2713' : '\u2717'}
          </span>
        )}
        {durationLabel && (
          <span style={{ color: 'var(--text-muted)', fontSize: 9.5 }}>{durationLabel}</span>
        )}
      </div>
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
    case 'subagent:step': {
      const e = event as { subagentName: string; stepLabel: string; status: string }
      label = `${e.subagentName}: ${e.stepLabel} (${e.status})`
      color = e.status === 'completed' ? 'var(--status-ok)' : 'var(--status-warn)'
      break
    }
    case 'subagent:completed': {
      const e = event as { subagentName: string; success: boolean }
      label = `${e.subagentName} ${e.success ? 'completado' : 'fallido'}`
      color = e.success ? 'var(--status-ok)' : 'var(--status-err)'
      break
    }
    case 'subagent:aborted': {
      const e = event as { subagentName: string; reason?: string }
      label = `${e.subagentName} detenido${e.reason ? `: ${e.reason}` : ''}`
      color = 'var(--status-err)'
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
      <span style={{ color, flexShrink: 0, fontSize: 11 }}>\u25CF</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  )
}