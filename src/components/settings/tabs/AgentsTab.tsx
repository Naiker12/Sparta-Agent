import { useSettingsStore, type AgentAutonomyLevel, type SandboxMode } from '@/stores/settings.store'
import { useSecurityStore } from '@/stores/security.store'
import { useAgentStore } from '@/stores/agent.store'
import { useTranslation } from '@/i18n'
import { SettingGroup, SettingRow } from './primitives'
import { ShieldOff, ShieldCheck, ExternalLink, AlertTriangle } from 'lucide-react'

const STATUS_MAP: Record<string, { color: string; labelKey: string }> = {
  idle: { color: 'var(--text-muted)', labelKey: 'agents.idle' },
  running: { color: 'var(--status-ok)', labelKey: 'agents.running' },
  thinking: { color: 'var(--status-think)', labelKey: 'agents.thinking' },
  error: { color: 'var(--destructive)', labelKey: 'agents.error' },
  completed: { color: 'var(--accent)', labelKey: 'agents.completed' },
}

const AUTONOMY_OPTIONS: { value: AgentAutonomyLevel; tKey: string; descKey: string }[] = [
  { value: 'always_ask', tKey: 'agents.alwaysAsk', descKey: 'agents.alwaysAskDesc' },
  { value: 'ask_risky', tKey: 'agents.askRisky', descKey: 'agents.askRiskyDesc' },
  { value: 'autonomous_readonly', tKey: 'agents.autonomousReadonly', descKey: 'agents.autonomousReadonlyDesc' },
]

const SANDBOX_OPTIONS: { value: SandboxMode; label: string; desc: string }[] = [
  { value: 'none', label: 'Sin sandbox', desc: 'Ejecución directa en el sistema (por defecto)' },
  { value: 'docker', label: 'Docker (próximamente)', desc: 'Aísla comandos en un contenedor efímero — no implementado aún' },
]

export function AgentsTab() {
  const { agents, setActiveAgent, activeAgentId } = useAgentStore()
  const {
    agentAutonomy, setAgentAutonomy,
    agentExecuteLocal, setAgentExecuteLocal,
    sandboxMode, setSandboxMode,
  } = useSettingsStore()
  const security = useSecurityStore()
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title={t('agents.policyTitle')}
        description={t('agents.policyDesc')}
      >
        <SettingRow
          title={t('agents.autonomyLevel')}
          description={t('agents.autonomyLevelDesc')}
          control={
            <select
              value={agentAutonomy}
              onChange={(e) => setAgentAutonomy(e.target.value as AgentAutonomyLevel)}
              style={{
                padding: '5px 8px',
                borderRadius: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                color: 'var(--text-primary)',
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                minWidth: 140,
              }}
            >
              {AUTONOMY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} title={t(opt.descKey)}>
                  {t(opt.tKey)}
                </option>
              ))}
            </select>
          }
        />
        <SettingRow
          title={t('agents.executeLocal')}
          description={t('agents.executeLocalDesc')}
          control={
            <label style={{
              position: 'relative',
              display: 'inline-block',
              width: 34,
              height: 20,
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={agentExecuteLocal}
                onChange={(e) => setAgentExecuteLocal(e.target.checked)}
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0,
                  position: 'absolute',
                }}
              />
              <span style={{
                position: 'absolute',
                inset: 0,
                background: agentExecuteLocal ? 'var(--accent)' : 'var(--border-strong)',
                borderRadius: 20,
                transition: 'all 0.15s',
              }}>
                <span style={{
                  position: 'absolute',
                  top: 2,
                  left: agentExecuteLocal ? 16 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'all 0.15s',
                }} />
              </span>
            </label>
          }
        />
        <SettingRow
          title={t('agents.securityStatus')}
          description={security.checked
            ? (security.loaded ? t('agents.securityLoaded') : t('agents.securityNotLoaded'))
            : t('agents.verifying')}
          control={
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontFamily: 'var(--font-ui)',
              color: security.loaded ? 'var(--status-ok)' : 'var(--status-err)',
            }}>
              {security.loaded ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
              <span>{security.loaded ? t('agents.securityActive') : t('agents.securityUnavailable')}</span>
            </div>
          }
        />
        <SettingRow
          title={t('agents.auditLog')}
          description={t('agents.auditLogDesc')}
          control={
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={async () => {
                  const result = await window.electron?.invoke('security:openAuditLog')
                  if (result?.ok === false) {
                    alert('Audit log not available. Security module is not loaded.')
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 6,
                  background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
                  color: 'var(--text-primary)', fontSize: 11,
                  fontFamily: 'var(--font-ui)', cursor: 'pointer',
                }}
              >
                <ExternalLink size={12} />
                <span>{t('agents.openAuditLog')}</span>
              </button>
            </div>
          }
        />
        <SettingRow
          title={t('agents.sandboxTitle')}
          description={t('agents.sandboxDesc')}
          control={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={sandboxMode}
                onChange={(e) => setSandboxMode(e.target.value as SandboxMode)}
                style={{
                  padding: '5px 8px', borderRadius: 6,
                  background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
                  color: 'var(--text-primary)', fontSize: 11,
                  fontFamily: 'var(--font-ui)', cursor: 'pointer', minWidth: 140,
                }}
              >
                {SANDBOX_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} title={opt.desc}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {sandboxMode !== 'none' && (
                <span style={{ display: 'flex', gap: 3, fontSize: 10, color: 'var(--status-warn)' }}>
                  <AlertTriangle size={11} />
                  <span>{t('agents.notImplemented')}</span>
                </span>
              )}
            </div>
          }
        />
      </SettingGroup>

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
