import { SettingGroup } from '../../shared'
import { useAgentStore } from 'ia-sparta-core'
import { Bot, CheckCircle, Clock, AlertCircle, Sparkles } from 'lucide-react'

const STATUS_ICONS: Record<string, typeof Bot> = {
  idle: Clock,
  running: Sparkles,
  thinking: Sparkles,
  error: AlertCircle,
  completed: CheckCircle,
}

export function SubagentTelemetrySection() {
  const { agents } = useAgentStore()

  return (
    <SettingGroup
      title="Subagentes & Hilos de Ejecución"
      description="Monitorea las tareas delegadas, estado de subagentes en segundo plano y cuotas de tokens consumidas."
    >
      <div style={{ padding: 14 }}>
        {agents.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-lg, 12px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
              }}
            >
              <Bot size={18} />
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
              No hay subagentes activos en este momento
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 360 }}>
              Cuando delegues tareas complejas o multi-paso, sus hilos de ejecución aparecerán aquí en tiempo real.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {agents.map((agent) => {
              const Icon = STATUS_ICONS[agent.status] || Bot
              return (
                <div
                  key={agent.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md, 8px)',
                    backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={16} color="var(--accent)" />
                    <div>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {agent.name || `Subagente ${agent.id}`}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block' }}>
                        Estado: {agent.status} • Tipo: {agent.type || 'General'}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--status-ok, #10B981)',
                      fontFamily: 'monospace',
                    }}
                  >
                    ACTIVO
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SettingGroup>
  )
}
