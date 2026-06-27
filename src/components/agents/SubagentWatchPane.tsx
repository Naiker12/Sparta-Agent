import { useEffect, useState } from 'react'
import { useAgentStore } from '@/stores/agent.store'
import { useEventBus } from '@/stores/event-bus.store'
import type { TaskStep } from '@/types'
import type { SpartaEvent } from '@/types/events'

interface SubagentWatchPaneProps {
  agentId: string
  onClose: () => void
}

export function SubagentWatchPane({ agentId, onClose }: SubagentWatchPaneProps) {
  const [events, setEvents] = useState<SpartaEvent[]>([])
  const agent = useAgentStore((s) => s.agents.find((a) => a.id === agentId))
  const tasks = useAgentStore((s) => s.tasks[agentId] ?? [])

  useEffect(() => {
    const unsub = useEventBus.getState().subscribe((event) => {
      const isRelevantType = event.type.startsWith('agent:') || event.type.startsWith('tool:') || event.type.startsWith('pipeline:')
      if (!isRelevantType) return

      // Filter by namespace so parallel subagents don't mix their logs.
      const eventNs = typeof event.ns === 'string' ? event.ns : ''
      const belongsToThisAgent =
        event.agentId === agentId ||
        (agent?.namespace && eventNs.includes(agent.namespace)) ||
        (agent?.type && eventNs.includes(agent.type))

      // If the event has no namespace/agentId metadata, show it for backward compatibility.
      const hasRouting = Boolean(event.agentId || eventNs)
      if (hasRouting && !belongsToThisAgent) return

      setEvents((prev) => [...prev.slice(-99), event])
    })
    return unsub
  }, [agentId, agent?.namespace, agent?.type])

  const latestTask = tasks[tasks.length - 1]

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
            {agent?.name ?? 'Subagente'}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
            {agent?.status === 'running' ? 'En ejecución...' : agent?.status === 'completed' ? 'Completado' : agent?.status ?? 'Inactivo'}
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
        {latestTask && latestTask.steps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Pasos
            </div>
            {latestTask.steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </div>
        )}

        {events.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 8, marginBottom: 4 }}>
              Eventos en vivo
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

function StepRow({ step }: { step: TaskStep }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 6px',
      background: step.status === 'running' ? 'var(--bg-active)' : 'transparent',
      borderRadius: 'var(--radius-sm)',
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
    }}>
      <StepIcon status={step.status} />
      <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {step.name}
      </span>
      {step.durationMs !== undefined && (
        <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>
          {step.durationMs >= 1000 ? `${(step.durationMs / 1000).toFixed(1)}s` : `${step.durationMs}ms`}
        </span>
      )}
    </div>
  )
}

function StepIcon({ status }: { status: string }) {
  if (status === 'completed') return <span style={{ color: 'var(--status-ok)', fontSize: 12 }}>✓</span>
  if (status === 'error') return <span style={{ color: 'var(--status-err)', fontSize: 12 }}>✕</span>
  if (status === 'running') return <span style={{ color: 'var(--status-warn)', fontSize: 12 }}>◌</span>
  return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>○</span>
}

function EventRow({ event }: { event: SpartaEvent }) {
  const label = getEventLabel(event)
  const color = getEventColor(event.type)

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

function getEventLabel(event: SpartaEvent): string {
  const ns = typeof (event as { ns?: string }).ns === 'string' ? ` [${(event as { ns?: string }).ns}]` : ''
  let label: string
  switch (event.type) {
    case 'agent:started':
      label = 'Agente iniciado'
      break
    case 'agent:completed':
      label = 'Agente completado'
      break
    case 'agent:error':
      label = `Error: ${(event as { error: string }).error}`
      break
    case 'tool:called':
      label = `Tool: ${(event as { toolName: string }).toolName}`
      break
    case 'tool:result':
      label = `Tool OK: ${(event as { toolName: string }).toolName}`
      break
    case 'tool:error':
      label = `Tool ERROR: ${(event as { toolName: string }).toolName}`
      break
    default:
      label = event.type
  }
  return `${label}${ns}`
}

function getEventColor(type: string): string {
  if (type.includes('error')) return 'var(--status-err)'
  if (type.includes('completed') || type.includes('result')) return 'var(--status-ok)'
  if (type.includes('started') || type.includes('called') || type.includes('running')) return 'var(--status-warn)'
  return 'var(--text-muted)'
}
