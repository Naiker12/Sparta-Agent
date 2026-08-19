import { useState } from 'react'
import { SettingGroup, SettingRow } from '../../shared'
import { useSettingsStore } from 'ia-sparta-core'
import { Plus, X, RotateCw } from 'lucide-react'

export function ShellFlagsSection() {
  const { shellProgram, shellFlags, setShellFlags } = useSettingsStore()
  const [newFlag, setNewFlag] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const effectiveCommand = `${shellProgram || 'powershell.exe'} ${shellFlags.join(' ')}`.trim()

  function handleAddFlag() {
    const val = newFlag.trim()
    if (!val) return
    setShellFlags([...shellFlags, val])
    setNewFlag('')
    setShowAdd(false)
  }

  function handleRemoveFlag(index: number) {
    setShellFlags(shellFlags.filter((_, i) => i !== index))
  }

  return (
    <SettingGroup
      title="Banderas & Argumentos de Inicio"
      description="Parámetros de invocación enviados al iniciar una nueva sesión de consola integrada."
      action={
        shellFlags.length > 0 ? (
          <button
            type="button"
            onClick={() => setShellFlags([])}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm, 6px)',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <RotateCw size={11} />
            <span>Restablecer</span>
          </button>
        ) : null
      }
    >
      <SettingRow
        label="Comando Efectivo de Inicio"
        description="Vista previa del comando con el que se invoca el subproceso."
      >
        <code
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm, 6px)',
            backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
            border: '1px solid var(--border-subtle)',
            color: 'var(--accent)',
            fontSize: 11.5,
            fontFamily: 'monospace',
          }}
        >
          {effectiveCommand}
        </code>
      </SettingRow>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Argumentos Configurados ({shellFlags.length})
          </span>
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
            <span>Añadir Bandera</span>
          </button>
        </div>

        {showAdd && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4 }}>
            <input
              value={newFlag}
              onChange={(e) => setNewFlag(e.target.value)}
              placeholder="-NoLogo, -ExecutionPolicy Bypass..."
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: '6px 12px',
                fontSize: 12,
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                flex: 1,
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFlag()
              }}
            />
            <button
              type="button"
              onClick={handleAddFlag}
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
              Guardar
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
          {shellFlags.map((flag, idx) => (
            <span
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 11.5,
                fontFamily: 'monospace',
              }}
            >
              <span>{flag}</span>
              <button
                type="button"
                onClick={() => handleRemoveFlag(idx)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      </div>
    </SettingGroup>
  )
}
