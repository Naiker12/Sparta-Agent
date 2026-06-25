import { useMemoryStore } from '@/stores/memory.store'
import { useSettingsStore } from '@/stores/settings.store'
import { SettingGroup, SettingRow } from './primitives'

export function MemoryTab() {
  const { entries } = useMemoryStore()
  const { memoryEnabled, toggleMemory } = useSettingsStore()

  const autoCount = entries.filter((e) => e.source === 'auto').length
  const manualCount = entries.filter((e) => e.source === 'manual').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title="Estado"
        description="Configuración general de la memoria persistente."
      >
        <SettingRow
          title="Memoria persistente"
          description="Permite que el agente guarde contexto entre sesiones."
          control={
            <button
              onClick={toggleMemory}
              style={{
                width: 32,
                height: 16,
                borderRadius: 8,
                background: memoryEnabled ? 'var(--accent)' : 'var(--border-normal)',
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
                  left: memoryEnabled ? 18 : 2,
                  transition: 'left 0.15s',
                }}
              />
            </button>
          }
        />
      </SettingGroup>

      <SettingGroup
        title="Recuerdos"
        description="Entradas almacenadas en la memoria del agente."
      >
        <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
          <StatCard label="Total" value={entries.length} />
          <StatCard label="Automáticos" value={autoCount} color="var(--accent)" />
          <StatCard label="Manuales" value={manualCount} color="var(--text-muted)" />
        </div>
      </SettingGroup>

      {entries.length > 0 && (
        <SettingGroup title="Vista previa" description="Últimos recuerdos registrados.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
            {entries.slice(-3).reverse().map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: '8px 10px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-ui)',
                  lineHeight: 1.4,
                }}
              >
                {entry.content}
              </div>
            ))}
          </div>
        </SettingGroup>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '12px 16px',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: color ?? 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-ui)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
    </div>
  )
}
