import { useState, useEffect } from 'react'
import { X, Bot, Clock, ChevronRight } from 'lucide-react'
import { useAgentStore } from '@/stores/agent.store'

interface AgentsStatusDialogProps {
  open: boolean
  onClose: () => void
  onFocusAgent?: (agentId: string) => void
}

function formatElapsed(startedAt: number): string {
  const secs = Math.floor((Date.now() - startedAt) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  return `${mins}m ${secs % 60}s`
}

export function AgentsStatusDialog({ open, onClose, onFocusAgent }: AgentsStatusDialogProps) {
  const agents = useAgentStore((s) => s.agents)
  const tasksByAgent = useAgentStore((s) => s.tasks)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => {
      setTick((t) => t + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [open])

  const runningAgents = agents.filter((a) => a.status === 'running' || a.status === 'thinking')

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 460, maxWidth: '92vw', maxHeight: '85vh',
          background: 'var(--bg-modal)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        data-tick={tick}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 0', flexShrink: 0,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
            Agentes en vivo
          </h3>
          <button onClick={onClose} style={{
            width: 24, height: 24, background: 'none', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} />
          </button>
        </div>

        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px 20px 16px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {runningAgents.length === 0 ? (
            <div style={{
              padding: '24px 0', textAlign: 'center', fontSize: 12,
              color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
            }}>
              <Bot size={24} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 8 }} />
              <div>No hay agentes trabajando en este momento.</div>
            </div>
          ) : (
            runningAgents.map((agent) => {
              const tasks = tasksByAgent[agent.id] ?? []
              const latestTask = tasks[tasks.length - 1]
              const elapsed = latestTask ? formatElapsed(latestTask.createdAt) : '\u2014'
              const steps = latestTask?.steps ?? []
              const currentStep = steps.filter((s) => s.status === 'running')[0] ?? steps[steps.length - 1]

              return (
                <div
                  key={agent.id}
                  style={{
                    padding: '12px 14px', borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    cursor: onFocusAgent ? 'pointer' : 'default',
                  }}
                  onClick={() => { if (onFocusAgent) { onFocusAgent(agent.id); onClose() } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: agent.status === 'thinking' ? 'var(--status-think)' : 'var(--status-warn)',
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                      fontFamily: 'var(--font-ui)', flex: 1,
                    }}>{agent.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                      {agent.status === 'thinking' ? 'Pensando' : 'Ejecutando'}
                    </span>
                    {onFocusAgent && <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                  {latestTask && (
                    <div style={{
                      fontSize: 11, color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-ui)', marginBottom: 6, lineHeight: 1.4,
                    }}>
                      {latestTask.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{elapsed}</span>
                    </div>
                    {currentStep && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                        Paso: {currentStep.name}
                      </div>
                    )}
                    {steps.length > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                        {steps.filter((s) => s.status === 'completed').length}/{steps.length} pasos
                      </div>
                    )}
                  </div>
                  {steps.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                      {steps.map((step) => (
                        <div key={step.id} style={{
                          flex: 1, height: 3, borderRadius: 2,
                          background: step.status === 'completed' ? 'var(--status-ok)' :
                            step.status === 'running' ? 'var(--status-warn)' :
                            step.status === 'error' ? 'var(--status-err)' : 'var(--bg-active)',
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
