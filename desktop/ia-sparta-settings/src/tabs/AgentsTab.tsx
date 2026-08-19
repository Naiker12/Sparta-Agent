import { AutonomySection } from './agents/sections/AutonomySection'
import { SecurityPresetsSection } from './agents/sections/SecurityPresetsSection'
import { SubagentTelemetrySection } from './agents/sections/SubagentTelemetrySection'
import { PermissionsDrawerSection } from './agents/sections/PermissionsDrawerSection'

export function AgentsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. Nivel de Autonomía & Sandbox */}
      <AutonomySection />

      {/* 2. Presets de Seguridad & Artefactos */}
      <SecurityPresetsSection />

      {/* 3. Subagentes & Telemetría */}
      <SubagentTelemetrySection />

      {/* 4. Permisos & Reglas Granulares */}
      <PermissionsDrawerSection />
    </div>
  )
}
