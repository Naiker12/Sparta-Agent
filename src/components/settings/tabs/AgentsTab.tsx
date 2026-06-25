import { useAgentStore } from '@/stores/agent.store'
import { useTranslation } from '@/i18n'
import { SettingGroup } from './primitives'

const STATUS_MAP: Record<string, { color: string; labelKey: string }> = {
  idle: { color: 'var(--text-muted)', labelKey: 'agents.idle' },
  running: { color: 'var(--status-ok)', labelKey: 'agents.running' },
  thinking: { color: 'var(--status-think)', labelKey: 'agents.thinking' },
  error: { color: 'var(--destructive)', labelKey: 'agents.error' },
  completed: { color: 'var(--accent)', labelKey: 'agents.completed' },
}

export function AgentsTab() {
  const { agents, setActiveAgent, activeAgentId } = useAgentStore()
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title={t('agents.title')}
        description={t('agents.desc')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
          {agents.map((agent) => {
            const status = STATUS_MAP[agent.status] ?? STATUS_MAP.idle
            const isActive = agent.id === activeAgentId

            return (
              <button
                key={agent.id}
                onClick={() => setActiveAgent(agent.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  background: isActive ? 'var(--accent-muted)' : 'var(--bg-input)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.12s',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {agent.name}
                    </span>
                    <span style={{
                      fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: 'var(--text-muted)', background: 'var(--bg-active)',
                      padding: '1px 5px', borderRadius: 3,
                    }}>
                      {agent.type}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                    {agent.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span
                      style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: status.color, flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                      {t(status.labelKey)}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {agent.model}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                      {agent.tools.length} {t('agents.tools')}
                    </span>
                  </div>
                </div>
                {isActive && (
                  <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
                    {t('agents.active')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </SettingGroup>
    </div>
  )
}
