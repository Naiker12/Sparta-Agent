import { useState } from 'react'
import { SettingGroup, SettingRow } from '../../shared'
import { Switch } from 'ia-sparta-design-system'

export function PreferencesSection() {
  const [pointerCursors, setPointerCursors] = useState(false)
  const [reduceMotion, setReduceMotion] = useState<'system' | 'enabled' | 'disabled'>('system')
  const [uiFontSize, setUiFontSize] = useState(15)
  const [codeFontSize, setCodeFontSize] = useState(13)
  const [fontSmoothing, setFontSmoothing] = useState(true)
  const [pinSidebar, setPinSidebar] = useState(true)

  return (
    <SettingGroup
      title="Preferencias Visuales & Accesibilidad"
      description="Ajustes de interacción de cursor, escala de fuentes en píxeles y animaciones de movimiento."
    >
      {/* 1. Cursores de Puntero */}
      <SettingRow
        label="Usar cursores de puntero"
        description="Cambia el cursor a un puntero (mano) al pasar por encima de elementos interactivos."
      >
        <Switch
          checked={pointerCursors}
          onCheckedChange={setPointerCursors}
        />
      </SettingRow>

      {/* 2. Reducir el Movimiento */}
      <SettingRow
        label="Reducir el movimiento"
        description="Reduce las animaciones o sigue la configuración del sistema."
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: 2,
            gap: 2,
          }}
        >
          {[
            { id: 'system' as const, label: 'Sistema' },
            { id: 'enabled' as const, label: 'Activado' },
            { id: 'disabled' as const, label: 'Desactivado' },
          ].map((item) => {
            const isSelected = reduceMotion === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setReduceMotion(item.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  backgroundColor: isSelected ? 'var(--bg-surface)' : 'transparent',
                  border: isSelected ? '1px solid var(--border-subtle)' : '1px solid transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 11.5,
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </SettingRow>

      {/* 3. Tamaño de fuente de la interfaz (px input) */}
      <SettingRow
        label="Tamaño de fuente de la interfaz"
        description="Ajusta el tamaño base usado en la interfaz de Sparta."
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '4px 8px',
              width: 54,
            }}
          >
            <input
              type="number"
              value={uiFontSize}
              onChange={(e) => setUiFontSize(Number(e.target.value))}
              min={11}
              max={22}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontFamily: 'monospace',
                textAlign: 'center',
              }}
            />
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>px</span>
        </div>
      </SettingRow>

      {/* 4. Tamaño de fuente del código (px input) */}
      <SettingRow
        label="Tamaño de fuente del código"
        description="Ajusta el tamaño base usado para el código y editores."
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '4px 8px',
              width: 54,
            }}
          >
            <input
              type="number"
              value={codeFontSize}
              onChange={(e) => setCodeFontSize(Number(e.target.value))}
              min={10}
              max={20}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontFamily: 'monospace',
                textAlign: 'center',
              }}
            />
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>px</span>
        </div>
      </SettingRow>

      {/* 5. Suavizado de fuentes */}
      <SettingRow
        label="Suavizado de fuentes"
        description="Usa antialiasing subpíxel para suavizar el texto en pantallas de alta densidad."
      >
        <Switch
          checked={fontSmoothing}
          onCheckedChange={setFontSmoothing}
        />
      </SettingRow>

      {/* 6. Fijar la barra lateral */}
      <SettingRow
        label="Fijar la barra lateral por defecto"
        description="Mantén la barra lateral expandida en lugar de contraerla a iconos."
      >
        <Switch
          checked={pinSidebar}
          onCheckedChange={setPinSidebar}
        />
      </SettingRow>
    </SettingGroup>
  )
}
