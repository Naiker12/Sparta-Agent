import { SettingGroup } from '../../shared'
import { usePermissionStore } from 'ia-sparta-core'
import { ShieldCheck, Trash2, Lock } from 'lucide-react'

export function PermissionsDrawerSection() {
  const { fileReads, fileWrites, terminalRules, mcpRules, removeRule, clearRules } = usePermissionStore()

  const allRules = [
    ...fileReads.map((r) => ({ ...r, category: 'Lectura' })),
    ...fileWrites.map((r) => ({ ...r, category: 'Escritura' })),
    ...terminalRules.map((r) => ({ ...r, category: 'Terminal' })),
    ...mcpRules.map((r) => ({ ...r, category: 'MCP' })),
  ]

  return (
    <SettingGroup
      title="Permisos & Reglas Granulares Concedidas"
      description="Listado de autorizaciones persistentes para herramientas MCP, accesos al sistema de archivos y ejecución de terminal."
      action={
        allRules.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('¿Deseas revocar todas las autorizaciones persistentes?')) {
                clearRules()
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm, 6px)',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--status-err, #EF4444)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={12} />
            <span>Revocar Todas</span>
          </button>
        ) : null
      }
    >
      <div style={{ padding: 14 }}>
        {allRules.length === 0 ? (
          <div
            style={{
              padding: '20px 16px',
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
            <ShieldCheck size={18} color="var(--text-muted)" />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              No hay permisos persistentes guardados
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Cada vez que autorices una acción con "Recordar para esta sesión", se listará aquí.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {allRules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md, 8px)',
                  backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Lock size={13} color="var(--accent)" />
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {rule.category}: {rule.target} • {rule.effect === 'allow' ? 'Permitido' : 'Denegado'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                  title="Revocar regla"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingGroup>
  )
}
