import { useState, useEffect } from 'react'
import { X, Bot, Clock, ChevronRight, Sparkles } from 'lucide-react'
import { useAgentStore, useChatStore, useSettingsStore, useSessionStore } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'

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
  const { t } = useTranslation()
  const agents = useAgentStore((s) => s.agents)
  const tasksByAgent = useAgentStore((s) => s.tasks)
  const activeAgentId = useAgentStore((s) => s.activeAgentId)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const sessions = useSessionStore((s) => s.sessions)
  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : null
  const agentAutonomy = useSettingsStore((s) => s.agentAutonomy)
  const sessionMode = useSettingsStore((s) => s.sessionMode)
  const isAgentMode = sessionMode === 'agent' || agentAutonomy === 'ask_risky'

  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => {
      setTick((t) => t + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [open])

  const runningAgents = agents.filter((a) => {
    if (a.status === 'running' || a.status === 'thinking') return true
    if (isStreaming && (a.id === 'builtin-code' || a.id === activeAgentId)) return true
    if (isAgentMode && (a.id === 'builtin-code' || a.id === activeAgentId)) return true
    return false
  })

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
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
          padding: '16px 20px', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} className="text-[var(--accent)]" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
              {t('chat.liveAgents') || 'Agentes en vivo'}
            </h3>
          </div>
          <button onClick={onClose} style={{
            width: 26, height: 26, background: 'none', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={15} />
          </button>
        </div>

        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {runningAgents.length === 0 ? (
            <div style={{
              padding: '32px 0', textAlign: 'center', fontSize: 12,
              color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
            }}>
              <Bot size={28} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: 10 }} />
              <div>{t('chat.noLiveAgents') || 'No hay agentes trabajando en este momento.'}</div>
            </div>
          ) : (
            runningAgents.map((agent) => {
              const tasks = tasksByAgent[agent.id] ?? []
              const latestTask = tasks[tasks.length - 1]
              const elapsed = latestTask ? formatElapsed(latestTask.createdAt) : formatElapsed(activeSession?.createdAt ?? Date.now())
              const steps = latestTask?.steps ?? []
              const currentStep = steps.filter((s) => s.status === 'running')[0] ?? steps[steps.length - 1]

              const agentStatusText = isStreaming
                ? (t('agents.running') || 'Ejecutando en vivo')
                : (agent.status === 'thinking' ? (t('agents.thinking') || 'Pensando') : (t('agents.active') || 'Activo'))

              const taskDescription = latestTask?.description || (isStreaming ? 'Procesando tareas e instrucciones...' : 'Agente activo listo para ejecutar herramientas autónomas.')

              return (
                <div
                  key={agent.id}
                  style={{
                    padding: '14px 16px', borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    cursor: onFocusAgent ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => { if (onFocusAgent) { onFocusAgent(agent.id); onClose() } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--status-ok, #10b981)',
                      boxShadow: '0 0 8px var(--status-ok, #10b981)',
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                      fontFamily: 'var(--font-ui)', flex: 1,
                    }}>{agent.name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: 'var(--status-ok, #10b981)',
                      background: 'rgba(16,185,129,0.12)', padding: '2px 8px', borderRadius: 10,
                      fontFamily: 'var(--font-ui)',
                    }}>
                      {agentStatusText}
                    </span>
                    {onFocusAgent && <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-ui)', marginBottom: 8, lineHeight: 1.4,
                  }}>
                    {taskDescription}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{elapsed}</span>
                    </div>
                    {currentStep && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                        Paso: {currentStep.name}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
