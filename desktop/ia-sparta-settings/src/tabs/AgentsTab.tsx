import { useState } from 'react'
import {
  useSettingsStore,
  useSecurityStore,
  useAgentStore,
  usePermissionStore,
  type AgentAutonomyLevel,
  type SandboxMode,
  type QueuedMessagePolicy,
  type SecurityPreset,
  type ArtifactReviewPolicy,
  type PermissionActionKind,
  type PermissionRule,
} from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import { SettingGroup, SettingRow } from './primitives'
import {
  AlertTriangle,
  ArrowLeft,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  ShieldOff,
  Bot,
} from 'lucide-react'

type SubViewType = 'main' | 'file_permissions' | 'network_permissions' | 'terminal_permissions' | 'unsandboxed_permissions' | 'mcp_permissions'

const STATUS_MAP: Record<string, { color: string; labelKey: string }> = {
  idle: { color: 'var(--text-muted, #71717a)', labelKey: 'agents.idle' },
  running: { color: 'var(--status-ok, #10b981)', labelKey: 'agents.running' },
  thinking: { color: 'var(--status-think, #a855f7)', labelKey: 'agents.thinking' },
  error: { color: 'var(--destructive, #ef4444)', labelKey: 'agents.error' },
  completed: { color: 'var(--accent, #6366f1)', labelKey: 'agents.completed' },
}

const AUTONOMY_OPTIONS: { value: AgentAutonomyLevel; tKey: string; descKey: string }[] = [
  { value: 'always_ask', tKey: 'agents.alwaysAsk', descKey: 'agents.alwaysAskDesc' },
  { value: 'ask_risky', tKey: 'agents.askRisky', descKey: 'agents.askRiskyDesc' },
  { value: 'autonomous_readonly', tKey: 'agents.autonomousReadonly', descKey: 'agents.autonomousReadonlyDesc' },
]

const SANDBOX_OPTIONS: { value: SandboxMode; labelKey: string; descKey: string }[] = [
  { value: 'none', labelKey: 'agents.sandboxNone', descKey: 'agents.sandboxNoneDesc' },
  { value: 'docker', labelKey: 'agents.sandboxDocker', descKey: 'agents.sandboxDockerDesc' },
]

export function AgentsTab() {
  const { agents, setActiveAgent, activeAgentId } = useAgentStore()
  const {
    agentAutonomy, setAgentAutonomy,
    agentExecuteLocal, setAgentExecuteLocal,
    sandboxMode, setSandboxMode,
  } = useSettingsStore()

  const permissions = usePermissionStore()
  const security = useSecurityStore()
  const { t } = useTranslation()

  // Navigation State between Main View and Sub-views
  const [subView, setSubView] = useState<SubViewType>('main')

  // Rule Form State inside Sub-views
  const [newTarget, setNewTarget] = useState('')
  const [newEffect, setNewEffect] = useState<'allow' | 'deny'>('allow')
  const [targetKind, setTargetKind] = useState<PermissionActionKind>('file_read')

  const handleAddRule = (kind: PermissionActionKind) => {
    if (!newTarget.trim()) return
    permissions.addRule({
      kind,
      target: newTarget.trim(),
      effect: newEffect,
    })
    setNewTarget('')
  }

  // Render Sub-view for File Permissions (Antigravity Image 1 replica)
  if (subView === 'file_permissions') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-ui)' }}>
        <button
          onClick={() => setSubView('main')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
            padding: 0,
            width: 'fit-content',
          }}
        >
          <ArrowLeft size={14} />
          <span>{t('agents.back') || 'Volver'} (Back)</span>
        </button>

        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          File Permissions
        </h2>

        {/* File Reads Section */}
        <SettingGroup
          title="File Reads"
          description="Allow/deny agent read access to specific files or directories."
        >
          <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Ej. d:/sparta-agent/src/* o *.json"
                value={targetKind === 'file_read' ? newTarget : ''}
                onChange={(e) => {
                  setTargetKind('file_read')
                  setNewTarget(e.target.value)
                }}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-normal)',
                  color: 'var(--text-primary)',
                  fontSize: 11,
                }}
              />
              <select
                value={targetKind === 'file_read' ? newEffect : 'allow'}
                onChange={(e) => {
                  setTargetKind('file_read')
                  setNewEffect(e.target.value as 'allow' | 'deny')
                }}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-normal)',
                  color: 'var(--text-primary)',
                  fontSize: 11,
                }}
              >
                <option value="allow">Allow</option>
                <option value="deny">Deny</option>
              </select>
              <button
                onClick={() => handleAddRule('file_read')}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-normal)',
                  color: 'var(--text-primary)',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Add
              </button>
            </div>

            {permissions.fileReads.map((rule) => (
              <RuleRow key={rule.id} rule={rule} onRemove={() => permissions.removeRule(rule.id)} />
            ))}
          </div>
        </SettingGroup>

        {/* File Writes Section */}
        <SettingGroup
          title="File Writes"
          description="Allow/deny agent write access to specific files or directories."
        >
          <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Ej. d:/sparta-agent/dist/*"
                value={targetKind === 'file_write' ? newTarget : ''}
                onChange={(e) => {
                  setTargetKind('file_write')
                  setNewTarget(e.target.value)
                }}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-normal)',
                  color: 'var(--text-primary)',
                  fontSize: 11,
                }}
              />
              <select
                value={targetKind === 'file_write' ? newEffect : 'allow'}
                onChange={(e) => {
                  setTargetKind('file_write')
                  setNewEffect(e.target.value as 'allow' | 'deny')
                }}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-normal)',
                  color: 'var(--text-primary)',
                  fontSize: 11,
                }}
              >
                <option value="allow">Allow</option>
                <option value="deny">Deny</option>
              </select>
              <button
                onClick={() => handleAddRule('file_write')}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-normal)',
                  color: 'var(--text-primary)',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Add
              </button>
            </div>

            {permissions.fileWrites.map((rule) => (
              <RuleRow key={rule.id} rule={rule} onRemove={() => permissions.removeRule(rule.id)} />
            ))}
          </div>
        </SettingGroup>
      </div>
    )
  }

  // Generic Sub-view helper for Network, Terminal, Unsandboxed, MCP
  const renderGenericSubView = (
    kind: PermissionActionKind,
    title: string,
    description: string,
    rulesList: PermissionRule[],
    placeholder: string
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-ui)' }}>
      <button
        onClick={() => setSubView('main')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          fontSize: 12,
          cursor: 'pointer',
          padding: 0,
          width: 'fit-content',
        }}
      >
        <ArrowLeft size={14} />
        <span>{t('agents.back') || 'Volver'} (Back)</span>
      </button>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
        {title}
      </h2>

      <SettingGroup title={title} description={description}>
        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder={placeholder}
              value={targetKind === kind ? newTarget : ''}
              onChange={(e) => {
                setTargetKind(kind)
                setNewTarget(e.target.value)
              }}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                color: 'var(--text-primary)',
                fontSize: 11,
              }}
            />
            <select
              value={targetKind === kind ? newEffect : 'allow'}
              onChange={(e) => {
                setTargetKind(kind)
                setNewEffect(e.target.value as 'allow' | 'deny')
              }}
              style={{
                padding: '6px 8px',
                borderRadius: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                color: 'var(--text-primary)',
                fontSize: 11,
              }}
            >
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </select>
            <button
              onClick={() => handleAddRule(kind)}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                color: 'var(--text-primary)',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Add
            </button>
          </div>

          {rulesList.map((rule) => (
            <RuleRow key={rule.id} rule={rule} onRemove={() => permissions.removeRule(rule.id)} />
          ))}
        </div>
      </SettingGroup>
    </div>
  )

  if (subView === 'network_permissions') {
    return renderGenericSubView(
      'network_url',
      t('agents.networkAccessRules') || 'Network Access Rules',
      t('agents.networkAccessRulesDesc') || 'Configure allowed and denied URLs for reading.',
      permissions.networkRules,
      'Ej. api.github.com o *.openai.com'
    )
  }

  if (subView === 'terminal_permissions') {
    return renderGenericSubView(
      'terminal_command',
      t('agents.terminalCommands') || 'Terminal Commands',
      t('agents.terminalCommandsDesc') || 'Configure allowed terminal commands.',
      permissions.terminalRules,
      'Ej. git, pnpm, npm, pytest'
    )
  }

  if (subView === 'unsandboxed_permissions') {
    return renderGenericSubView(
      'unsandboxed_command',
      t('agents.commandsOutsideSandbox') || 'Commands Outside Sandbox',
      t('agents.commandsOutsideSandboxDesc') || 'Configure allowed commands outside the sandbox.',
      permissions.unsandboxedRules,
      'Ej. docker, cargo, make'
    )
  }

  if (subView === 'mcp_permissions') {
    return renderGenericSubView(
      'mcp_tool',
      t('agents.mcpTools') || 'MCP Tools',
      t('agents.mcpToolsDesc') || 'Configure external tools via Model Context Protocol.',
      permissions.mcpRules,
      'Ej. filesystem/* o sqlite/query'
    )
  }

  // ── Main Antigravity v2 Settings View (Matching User Images 1, 2, 3 Exactly) ─────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-ui)' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          {t('agents.panelTitle') || 'Agent'}
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
          {t('agents.policyDesc') || 'Configure agent execution, queued message delivery, and permissions.'}
        </p>
      </div>

      {/* ── 1. Execution Section (Antigravity Image 3) ─────────────── */}
      <SettingGroup
        title={t('agents.execution') || 'Execution'}
        description={t('agents.executionDesc') || 'Configure execution flow and queued message delivery.'}
      >
        <SettingRow
          title={t('agents.queuedMessages') || 'Queued Messages'}
          description={t('agents.queuedMessagesDesc') || 'Configure when follow-up messages are sent.'}
          control={
            <select
              value={permissions.queuedMessages}
              onChange={(e) => permissions.setQueuedMessages(e.target.value as QueuedMessagePolicy)}
              style={{
                padding: '5px 8px',
                borderRadius: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                color: 'var(--text-primary)',
                fontSize: 11,
                cursor: 'pointer',
                minWidth: 150,
              }}
            >
              <option value="queue_after_turn">{t('agents.queueAfterTurn') || 'Queue After Turn'}</option>
              <option value="steer_immediately">{t('agents.steerImmediately') || 'Steer Immediately'}</option>
              <option value="buffer_until_idle">{t('agents.bufferUntilIdle') || 'Buffer Until Idle'}</option>
            </select>
          }
        />
      </SettingGroup>

      {/* ── 2. Agent Settings Section (Antigravity Image 3) ────────── */}
      <SettingGroup
        title={t('agents.agentSettings') || 'Agent Settings'}
        description={t('agents.agentSettingsDesc') || 'Predefined security presets, autonomy level, and command sandbox.'}
      >
        <SettingRow
          title={t('agents.securityPreset') || 'Security Preset'}
          description={t('agents.securityPresetDesc') || 'Choose a predefined security preset for the agent. This controls terminal auto-execution policy, and file access policy.'}
          control={
            <select
              value={permissions.securityPreset}
              onChange={(e) => permissions.setSecurityPreset(e.target.value as SecurityPreset)}
              style={{
                padding: '5px 8px',
                borderRadius: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                color: 'var(--text-primary)',
                fontSize: 11,
                cursor: 'pointer',
                minWidth: 140,
              }}
            >
              <option value="default">{t('agents.presetDefault') || 'Default'}</option>
              <option value="strict">{t('agents.presetStrict') || 'Strict'}</option>
              <option value="permissive">{t('agents.presetPermissive') || 'Permissive'}</option>
              <option value="custom">{t('agents.presetCustom') || 'Custom'}</option>
            </select>
          }
        />
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
            <button
              onClick={async () => {
                const result = await window.electron?.invoke('security:openAuditLog') as { ok?: boolean } | undefined
                if (result?.ok === false) {
                  alert('Audit log not available. Security module is not loaded.')
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 6,
                background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
                color: 'var(--text-primary)', fontSize: 11, cursor: 'pointer',
              }}
            >
              <ExternalLink size={12} />
              <span>{t('agents.openAuditLog')}</span>
            </button>
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
                  color: 'var(--text-primary)', fontSize: 11, cursor: 'pointer', minWidth: 140,
                }}
              >
                {SANDBOX_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} title={t(opt.descKey)}>
                    {t(opt.labelKey)}
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

      {/* ── 3. Agent Behavior Section (Antigravity Image 3) ────────── */}
      <SettingGroup
        title={t('agents.agentBehavior') || 'Agent Behavior'}
        description={t('agents.agentBehaviorDesc') || 'Interaction policies during content and artifact generation.'}
      >
        <SettingRow
          title={t('agents.artifactReviewPolicy') || 'Artifact Review Policy'}
          description={t('agents.artifactReviewPolicyDesc') || "Specifies Agent's behavior when asking for review on artifacts, which are documents it creates to enable a richer conversation experience."}
          control={
            <select
              value={permissions.artifactReviewPolicy}
              onChange={(e) => permissions.setArtifactReviewPolicy(e.target.value as ArtifactReviewPolicy)}
              style={{
                padding: '5px 8px',
                borderRadius: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                color: 'var(--text-primary)',
                fontSize: 11,
                cursor: 'pointer',
                minWidth: 140,
              }}
            >
              <option value="always_ask">{t('agents.alwaysAskArtifact') || 'Always Ask'}</option>
              <option value="auto_approve_safe">{t('agents.autoApproveSafeArtifact') || 'Auto Approve Safe'}</option>
              <option value="never_ask">{t('agents.neverAskArtifact') || 'Never Ask'}</option>
            </select>
          }
        />
      </SettingGroup>

      {/* ── 4. File Permissions Section (Antigravity Image 2) ──────── */}
      <SettingGroup
        title={t('agents.filePermissions') || 'File Permissions'}
        description={t('agents.filePermissionsDesc') || 'Configure allowed and denied paths for file reads and writes.'}
      >
        <SettingRow
          title={t('agents.fileAccessRules') || 'File Access Rules'}
          description={t('agents.fileAccessRulesDesc') || 'Configure allowed and denied paths for file reads and writes.'}
          control={
            <button
              onClick={() => setSubView('file_permissions')}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                color: 'var(--text-primary)',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {t('agents.open') || 'Open'}
            </button>
          }
        />
      </SettingGroup>

      {/* ── 5. Network Permissions Section (Antigravity Image 2) ───── */}
      <SettingGroup
        title={t('agents.networkPermissions') || 'Network Permissions'}
        description={t('agents.networkPermissionsDesc') || 'Configure allowed and denied URLs for reading.'}
      >
        <SettingRow
          title={t('agents.networkAccessRules') || 'Network Access Rules'}
          description={t('agents.networkAccessRulesDesc') || 'Configure allowed and denied URLs for reading.'}
          control={
            <button
              onClick={() => setSubView('network_permissions')}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                color: 'var(--text-primary)',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {t('agents.open') || 'Open'}
            </button>
          }
        />
      </SettingGroup>

      {/* ── 6. Terminal & Tooling Permissions (Antigravity Image 2) ──── */}
      <SettingGroup
        title={t('agents.terminalPermissions') || 'Terminal & Tooling Permissions'}
        description={t('agents.terminalPermissionsDesc') || 'Configure allowed terminal commands, unsandboxed commands, and MCP tools.'}
      >
        <SettingRow
          title={t('agents.terminalCommands') || 'Terminal Commands'}
          description={t('agents.terminalCommandsDesc') || 'Configure allowed terminal commands.'}
          control={
            <button
              onClick={() => setSubView('terminal_permissions')}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                color: 'var(--text-primary)',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {t('agents.open') || 'Open'}
            </button>
          }
        />
        <SettingRow
          title={t('agents.commandsOutsideSandbox') || 'Commands Outside Sandbox'}
          description={t('agents.commandsOutsideSandboxDesc') || 'Configure allowed commands outside the sandbox.'}
          control={
            <button
              onClick={() => setSubView('unsandboxed_permissions')}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                color: 'var(--text-primary)',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {t('agents.open') || 'Open'}
            </button>
          }
        />
        <SettingRow
          title={t('agents.mcpTools') || 'MCP Tools'}
          description={t('agents.mcpToolsDesc') || 'Configure external tools via Model Context Protocol.'}
          control={
            <button
              onClick={() => setSubView('mcp_permissions')}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                color: 'var(--text-primary)',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {t('agents.open') || 'Open'}
            </button>
          }
        />
      </SettingGroup>

      {/* ── 7. Registered Agents Overview List ───────────────────────── */}
      <SettingGroup
        title={t('agents.title') || 'Registered Agents'}
        description={t('agents.desc') || 'Agentes de IA activos y configurados.'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
          {agents.map((agent) => {
            const statusInfo = STATUS_MAP[agent.status] ?? STATUS_MAP.idle
            const isActive = agent.id === activeAgentId

            return (
              <button
                key={agent.id}
                onClick={() => setActiveAgent(agent.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: isActive ? 'var(--accent-muted, rgba(99,102,241,0.1))' : 'var(--bg-input)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.12s',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <Bot size={15} style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {agent.name}
                    </span>
                    <span style={{
                      fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: 'var(--text-muted)', background: 'var(--bg-active)',
                      padding: '1px 5px', borderRadius: 3,
                    }}>
                      {agent.type}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: statusInfo.color, flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    {t(statusInfo.labelKey)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </SettingGroup>
    </div>
  )
}

function RuleRow({ rule, onRemove }: { rule: PermissionRule; onRemove: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        borderRadius: 6,
        background: 'var(--bg-input)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {rule.effect === 'allow' ? (
          <ShieldCheck size={14} style={{ color: 'var(--status-ok)' }} />
        ) : (
          <ShieldAlert size={14} style={{ color: 'var(--destructive)' }} />
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>
          {rule.target}
        </span>
        <span
          style={{
            fontSize: 9.5,
            padding: '1px 5px',
            borderRadius: 3,
            background: rule.effect === 'allow' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: rule.effect === 'allow' ? 'var(--status-ok)' : 'var(--destructive)',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {rule.effect}
        </span>
      </div>
      <button
        onClick={onRemove}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: 2,
        }}
        title="Eliminar regla"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
