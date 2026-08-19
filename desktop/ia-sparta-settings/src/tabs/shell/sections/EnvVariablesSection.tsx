import { useState } from 'react'
import { SettingGroup } from '../../shared'
import { useSettingsStore } from 'ia-sparta-core'
import { Plus, Trash2 } from 'lucide-react'

export function EnvVariablesSection() {
  const { envOverrides, setEnvOverrides } = useSettingsStore()
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const entries = Object.entries(envOverrides || {})

  function handleAddEnv() {
    const k = newKey.trim().toUpperCase()
    if (!k) return
    setEnvOverrides({
      ...(envOverrides || {}),
      [k]: newValue.trim(),
    })
    setNewKey('')
    setNewValue('')
    setShowAdd(false)
  }

  function handleRemoveEnv(key: string) {
    const updated = { ...(envOverrides || {}) }
    delete updated[key]
    setEnvOverrides(updated)
  }

  return (
    <SettingGroup
      title="Variables de Entorno Personalizadas"
      description="Inyecta variables de entorno específicas en cada proceso y terminal instanciada por Sparta Agent."
      action={
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm, 6px)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={11} />
          <span>Añadir Variable</span>
        </button>
      }
    >
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {showAdd && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="CLAVE (ej. NODE_ENV)"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: '6px 10px',
                fontSize: 11.5,
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                flex: 1,
                outline: 'none',
              }}
            />
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="VALOR (ej. development)"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: '6px 10px',
                fontSize: 11.5,
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                flex: 1.5,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleAddEnv}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-md, 8px)',
                backgroundColor: 'var(--accent)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Añadir
            </button>
          </div>
        )}

        {entries.length === 0 ? (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
            No hay variables de entorno sobreescritas.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md, 8px)',
                  backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>
                    {k}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>=</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {v}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveEnv(k)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2,
                  }}
                  title="Eliminar variable"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingGroup>
  )
}
