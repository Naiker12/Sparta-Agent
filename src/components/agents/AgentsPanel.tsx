import { useState } from 'react'
import { useAgentStore } from '@/stores/agent.store'
import { useAgent } from '@/hooks/useAgent'
import { SubagentWatchPane } from './SubagentWatchPane'
import type { Task } from '@/types'
import { useTranslation } from '@/i18n'

const STATUS_COLORS: Record<string, string> = {
  idle: 'var(--text-muted)',
  running: 'var(--status-warn)',
  thinking: 'var(--status-think)',
  error: 'var(--status-err)',
  completed: 'var(--status-ok)',
}

function AgentCard({ agent }: { agent: { id: string; name: string; type: string; status: string; description: string; model: string; tools: string[] } }) {
  const { executeTask } = useAgent()
  const { t } = useTranslation()
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
      setResult(err instanceof Error ? err.message : t('agents.taskError'))
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
          {t(`agents.${agent.status}`) || agent.status}
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
          placeholder={t('agents.describeTask')}
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
          {running ? t('agents.executing') : t('agents.execute')}
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
  const { t } = useTranslation()
  const [showNewForm, setShowNewForm] = useState(false)
  const [newAgent, setNewAgent] = useState({ name: '', type: 'research' as const, model: '', description: '' })
  const [showWatchPane, setShowWatchPane] = useState(false)

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
            {t('agents.panelTitle')}
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowWatchPane(!showWatchPane)}
              style={{
                padding: '5px 12px',
                background: showWatchPane ? 'var(--bg-active)' : 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t('chat.liveAgents')}
            </button>
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
              {showNewForm ? t('agents.cancel') : t('agents.newAgent')}
            </button>
          </div>
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
              placeholder={t('agents.agentName')}
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
              <option value="research">{t('agents.researcher')}</option>
              <option value="coding">{t('agents.programmer')}</option>
              <option value="automation">{t('agents.automation')}</option>
              <option value="project">{t('agents.project')}</option>
            </select>
            <textarea
              value={newAgent.description}
              onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
              placeholder={t('agents.agentDesc')}
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
              {t('agents.create')}
            </button>
          </div>
        )}

        {agents.length === 0 && !showWatchPane && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-ui)',
          }}>
            <div style={{ fontSize: 12 }}>{t('agents.noAgents')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
              Los subagentes internos (research, code, memory, review) se activan automáticamente cuando el modelo delega tareas.
            </div>
          </div>
        )}

        {agents.map((agent) => (
          <div key={agent.id}>
            <AgentCard agent={agent} />
          </div>
        ))}
      </div>

      {showWatchPane && (
        <SubagentWatchPane onClose={() => setShowWatchPane(false)} />
      )}
    </div>
  )
}
