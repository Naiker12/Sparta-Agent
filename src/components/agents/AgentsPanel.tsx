import { useState, useEffect } from 'react'
import { useAgentStore } from '@/stores/agent.store'
import { useAgent } from '@/hooks/useAgent'
import { SubagentWatchPane } from './SubagentWatchPane'
import type { Task } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  idle: 'var(--text-muted)',
  running: 'var(--status-warn)',
  thinking: 'var(--status-think)',
  error: 'var(--status-err)',
  completed: 'var(--status-ok)',
}

const STATUS_LABELS: Record<string, string> = {
  idle: 'Inactivo',
  running: 'Ejecutando',
  thinking: 'Pensando',
  error: 'Error',
  completed: 'Completado',
}

function AgentCard({ agent }: { agent: { id: string; name: string; type: string; status: string; description: string; model: string; tools: string[] } }) {
  const { executeTask } = useAgent()
  const [taskInput, setTaskInput] = useState('')
  const [result, setResult] = useState('')
  const [running, setRunning] = useState(false)

  const tasks = useAgentStore.getState().tasks[agent.id] ?? []

  const handleExecute = async () => {
    if (!taskInput.trim() || running) return
    setRunning(true)
    setResult('')
    try {
      const res = await executeTask(agent.id, taskInput.trim())
      setResult(res)
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Error al ejecutar tarea')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: STATUS_COLORS[agent.status] ?? 'var(--text-muted)',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
          {agent.name}
        </span>
        <span style={{
          fontSize: 10.5,
          color: STATUS_COLORS[agent.status] ?? 'var(--text-muted)',
          fontFamily: 'var(--font-ui)',
          marginLeft: 'auto',
        }}>
          {STATUS_LABELS[agent.status] ?? agent.status}
        </span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
        {agent.description}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4 }}>
          {agent.type}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4 }}>
          {agent.model}
        </span>
        {agent.tools.map((t) => (
          <span key={t} style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4 }}>
            {t}
          </span>
        ))}
      </div>

      {agent.status === 'running' && tasks.length > 0 && (
        <TaskStepsList tasks={tasks} />
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          placeholder="Describe una tarea para este agente..."
          disabled={running}
          style={{
            flex: 1,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-normal)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleExecute}
          disabled={running || !taskInput.trim()}
          style={{
            padding: '6px 14px',
            background: running ? 'var(--bg-active)' : 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: 'white',
            fontSize: 11,
            fontFamily: 'var(--font-ui)',
            fontWeight: 500,
            cursor: running || !taskInput.trim() ? 'default' : 'pointer',
            opacity: running || !taskInput.trim() ? 0.6 : 1,
          }}
        >
          {running ? 'Ejecutando...' : 'Ejecutar'}
        </button>
      </div>

      {result && (
        <div style={{
          padding: '8px 10px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: 11.5,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          maxHeight: 200,
          overflowY: 'auto',
        }}>
          {result}
        </div>
      )}
    </div>
  )
}

function TaskStepsList({ tasks }: { tasks: Task[] }) {
  const latestTask = tasks[tasks.length - 1]
  if (!latestTask || latestTask.steps.length === 0) return null

  return (
    <div style={{
      background: 'var(--bg-input)',
      borderRadius: 'var(--radius-md)',
      padding: '6px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      {latestTask.steps.map((step) => (
        <div key={step.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
        }}>
          <StepIcon status={step.status} />
          <span style={{ color: 'var(--text-secondary)' }}>{step.name}</span>
          {step.durationMs !== undefined && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: 10 }}>
              {step.durationMs >= 1000 ? `${(step.durationMs / 1000).toFixed(1)}s` : `${step.durationMs}ms`}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function StepIcon({ status }: { status: string }) {
  if (status === 'completed') return <span style={{ color: 'var(--status-ok)', fontSize: 12 }}>✓</span>
  if (status === 'error') return <span style={{ color: 'var(--status-err)', fontSize: 12 }}>✕</span>
  if (status === 'running') return <span style={{ color: 'var(--status-warn)', fontSize: 12 }}>◌</span>
  return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>○</span>
}

export function AgentsPanel() {
  const { agents, createAgent } = useAgent()
  const [showNewForm, setShowNewForm] = useState(false)
  const [newAgent, setNewAgent] = useState({ name: '', type: 'research' as const, model: '', description: '' })
  const [watchAgentId, setWatchAgentId] = useState<string | null>(null)

  useEffect(() => {
    if (agents.length === 0) {
      createAgent({
        name: 'Investigador',
        type: 'research',
        model: 'gpt-4',
        description: 'Busca información y la consolida en informes estructurados.',
        tools: [],
      })
      createAgent({
        name: 'Asistente General',
        type: 'automation',
        model: 'gpt-4',
        description: 'Ejecuta tareas generales usando las herramientas MCP disponibles.',
        tools: [],
      })
    }
  }, [agents.length, createAgent])

  const handleCreate = () => {
    if (!newAgent.name.trim()) return
    createAgent({
      name: newAgent.name.trim(),
      type: newAgent.type,
      model: newAgent.model || 'gpt-4',
      description: newAgent.description.trim(),
    })
    setNewAgent({ name: '', type: 'research', model: '', description: '' })
    setShowNewForm(false)
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{
        flex: 1,
        padding: 20,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            margin: 0,
          }}>
            Agentes
          </h2>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            style={{
              padding: '5px 12px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: 11,
              fontFamily: 'var(--font-ui)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {showNewForm ? 'Cancelar' : '+ Nuevo agente'}
          </button>
        </div>

        {showNewForm && (
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <input
              value={newAgent.name}
              onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
              placeholder="Nombre del agente"
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-md)',
                padding: '7px 10px',
                fontSize: 12,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                outline: 'none',
              }}
            />
            <select
              value={newAgent.type}
              onChange={(e) => setNewAgent({ ...newAgent, type: e.target.value as typeof newAgent.type })}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-md)',
                padding: '7px 10px',
                fontSize: 12,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                outline: 'none',
              }}
            >
              <option value="research">Investigador</option>
              <option value="coding">Programador</option>
              <option value="automation">Automatización</option>
              <option value="project">Proyecto</option>
            </select>
            <textarea
              value={newAgent.description}
              onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
              placeholder="Descripción del agente"
              rows={2}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-md)',
                padding: '7px 10px',
                fontSize: 12,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                outline: 'none',
                resize: 'vertical',
              }}
            />
            <button
              onClick={handleCreate}
              disabled={!newAgent.name.trim()}
              style={{
                padding: '6px 14px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: 'white',
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
                fontWeight: 500,
                cursor: newAgent.name.trim() ? 'pointer' : 'default',
                opacity: newAgent.name.trim() ? 1 : 0.6,
                alignSelf: 'flex-end',
              }}
            >
              Crear agente
            </button>
          </div>
        )}

        {agents.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-ui)',
          }}>
            No hay agentes configurados. Crea uno para empezar.
          </div>
        ) : (
          agents.map((agent) => (
            <div key={agent.id} style={{ position: 'relative' }}>
              <AgentCard agent={agent} />
              {agent.status === 'running' && (
                <button
                  onClick={() => setWatchAgentId(agent.id)}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    padding: '3px 8px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-secondary)',
                    fontSize: 10,
                    fontFamily: 'var(--font-ui)',
                    cursor: 'pointer',
                  }}
                >
                  Ver
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {watchAgentId && (
        <SubagentWatchPane
          agentId={watchAgentId}
          onClose={() => setWatchAgentId(null)}
        />
      )}
    </div>
  )
}
