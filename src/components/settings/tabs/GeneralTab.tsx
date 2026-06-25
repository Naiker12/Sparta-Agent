import { useSettingsStore } from '@/stores/settings.store'
import { SettingRow, SettingGroup } from './primitives'

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 32,
        height: 16,
        borderRadius: 8,
        background: value ? 'var(--accent)' : 'var(--border-normal)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.15s',
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: 2,
          left: value ? 18 : 2,
          transition: 'left 0.15s',
        }}
      />
    </button>
  )
}

export function GeneralTab() {
  const { defaultModel, setDefaultModel, memoryEnabled, toggleMemory } = useSettingsStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup title="Defaults" description="Configuración base del agente.">
        <div style={{ paddingTop: 4 }}>
          <label
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              display: 'block',
              marginBottom: 6,
            }}
          >
            Default Model
          </label>
          <input
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
        </div>
      </SettingGroup>

      <SettingGroup title="Memory" description="Persistencia de recuerdos entre sesiones.">
        <SettingRow
          title="Memoria persistente"
          description="Permite que el agente guarde y recuerde contexto entre sesiones."
          control={<Toggle value={memoryEnabled} onChange={toggleMemory} />}
        />
      </SettingGroup>

      <SettingGroup title="Idioma" description="Idioma de la interfaz.">
        <SettingRow
          title="Idioma"
          description="Español (es-MX)"
          control={
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Próximamente
            </span>
          }
        />
      </SettingGroup>
    </div>
  )
}
