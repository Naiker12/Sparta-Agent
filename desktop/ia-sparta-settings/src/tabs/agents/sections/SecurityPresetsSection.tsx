import { SettingGroup, SettingRow } from '../../shared'
import { usePermissionStore, type SecurityPreset, type ArtifactReviewPolicy } from 'ia-sparta-core'
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react'

export function SecurityPresetsSection() {
  const {
    securityPreset,
    setSecurityPreset,
    artifactReviewPolicy,
    setArtifactReviewPolicy,
  } = usePermissionStore()

  return (
    <SettingGroup
      title="Perfiles de Seguridad & Políticas de Artefactos"
      description="Configura salvaguardas preventivas para la manipulación de código, archivos y artefactos de ejecución."
    >
      {/* 1. Presets de Seguridad */}
      <SettingRow
        label="Perfil de Seguridad Activo"
        description="Ajusta el rigor de las confirmaciones según el nivel de confianza de las tareas."
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: 3,
            gap: 2,
          }}
        >
          {[
            { id: 'strict' as const, label: 'Estricto', icon: ShieldAlert },
            { id: 'default' as const, label: 'Equilibrado', icon: ShieldCheck },
            { id: 'custom' as const, label: 'Personalizado', icon: Shield },
          ].map((item) => {
            const isSelected = securityPreset === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSecurityPreset(item.id as SecurityPreset)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  backgroundColor: isSelected ? 'var(--bg-surface)' : 'transparent',
                  border: isSelected ? '1px solid var(--border-subtle)' : '1px solid transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                <Icon size={13} color={isSelected ? 'var(--accent)' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </SettingRow>

      {/* 2. Política de Revisión de Artefactos */}
      <SettingRow
        label="Revisión de Artefactos de Ejecución"
        description="Comportamiento al generar planes ejecutables (.md) antes de iniciar modificaciones en el proyecto."
      >
        <select
          value={artifactReviewPolicy || 'always_ask'}
          onChange={(e) => setArtifactReviewPolicy(e.target.value as ArtifactReviewPolicy)}
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
          <option value="always_ask">Revisión Obligatoria (Requiere clic "Proceder")</option>
          <option value="auto_apply">Proceder Automáticamente</option>
          <option value="never_ask">Sin confirmación</option>
        </select>
      </SettingRow>
    </SettingGroup>
  )
}
