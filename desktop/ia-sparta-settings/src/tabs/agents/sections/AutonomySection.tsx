import { SettingGroup, SettingRow } from '../../shared'
import { Switch } from 'ia-sparta-design-system'
import { useSettingsStore, usePermissionStore, type AgentAutonomyLevel, type SandboxMode, type QueuedMessagePolicy } from 'ia-sparta-core'

const AUTONOMY_OPTIONS: { value: AgentAutonomyLevel; label: string; desc: string }[] = [
  { value: 'always_ask', label: 'Preguntar siempre', desc: 'Solicita confirmación antes de cada acción' },
  { value: 'ask_risky', label: 'Preguntar solo riesgosas', desc: 'Solo pide confirmación para comandos destructivos' },
  { value: 'autonomous_readonly', label: 'Autonomía de lectura', desc: 'Permite lecturas automáticas, pregunta para escrituras' },
]

const SANDBOX_OPTIONS: { value: SandboxMode; label: string; desc: string }[] = [
  { value: 'none', label: 'Sin aislamiento (Host)', desc: 'Ejecuta directamente en el entorno local' },
  { value: 'docker', label: 'Contenedor Docker', desc: 'Aísla la ejecución en un contenedor seguro' },
]

export function AutonomySection() {
  const {
    agentAutonomy,
    setAgentAutonomy,
    agentExecuteLocal,
    setAgentExecuteLocal,
    sandboxMode,
    setSandboxMode,
  } = useSettingsStore()

  const { queuedMessages, setQueuedMessages } = usePermissionStore()

  return (
    <SettingGroup
      title="Autonomía & Ejecución de Agentes"
      description="Define el nivel de independencia, políticas de sandbox y ejecución de herramientas locales."
    >
      {/* 1. Nivel de Autonomía */}
      <SettingRow
        label="Nivel de Autonomía del Agente"
        description="Grado de libertad para ejecutar herramientas MCP, comandos y operaciones en disco."
      >
        <select
          value={agentAutonomy}
          onChange={(e) => setAgentAutonomy(e.target.value as AgentAutonomyLevel)}
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '6px 12px',
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            outline: 'none',
          }}
        >
          {AUTONOMY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </SettingRow>

      {/* 2. Ejecutar Comandos Locales */}
      <SettingRow
        label="Ejecución de Comandos Locales"
        description="Permite al agente proponer y ejecutar instrucciones en PowerShell o terminal del sistema."
      >
        <Switch
          checked={agentExecuteLocal}
          onCheckedChange={setAgentExecuteLocal}
        />
      </SettingRow>

      {/* 3. Modo Sandbox */}
      <SettingRow
        label="Entorno de Ejecución (Sandbox)"
        description="Aislamiento de procesos para comandos generados por agentes de código."
      >
        <select
          value={sandboxMode}
          onChange={(e) => setSandboxMode(e.target.value as SandboxMode)}
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '6px 12px',
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            outline: 'none',
          }}
        >
          {SANDBOX_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </SettingRow>

      {/* 4. Política de Mensajes en Cola */}
      <SettingRow
        label="Política de Mensajes en Cola"
        description="Comportamiento cuando llegan nuevos mensajes del usuario mientras el agente está procesando."
      >
        <select
          value={queuedMessages || 'queue_after_turn'}
          onChange={(e) => setQueuedMessages(e.target.value as QueuedMessagePolicy)}
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '6px 12px',
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            outline: 'none',
          }}
        >
          <option value="queue_after_turn">Encolar para el siguiente turno</option>
          <option value="steer_active_turn">Redirigir turno activo (Steer)</option>
          <option value="interrupt_immediately">Interrumpir de inmediato</option>
        </select>
      </SettingRow>
    </SettingGroup>
  )
}
