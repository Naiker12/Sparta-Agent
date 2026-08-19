import { useState } from 'react'
import { SettingGroup, SettingRow } from '../../shared'
import { useThemeStore } from 'ia-sparta-core'
import { Sun, Moon, Laptop, Check } from 'lucide-react'

export function ThemeSection() {
  const { setTheme } = useThemeStore()
  const [colorScheme, setColorScheme] = useState<'light' | 'dark' | 'system'>('dark')
  const [palettePreset, setPalettePreset] = useState<'standard' | 'classic' | 'minimal'>('standard')
  const [accentColor, setAccentColor] = useState('#17B888')
  const [bgColor, setBgColor] = useState('#181818')
  const [fgColor, setFgColor] = useState('#ECECEC')

  function handleAccentChange(newColor: string) {
    setAccentColor(newColor)
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--accent', newColor)
      document.documentElement.style.setProperty('--accent-muted', `${newColor}22`)
    }
  }

  function handleBgChange(newColor: string) {
    setBgColor(newColor)
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--bg-base', newColor)
      document.documentElement.style.setProperty('--bg-surface', newColor)
    }
  }

  function handleFgChange(newColor: string) {
    setFgColor(newColor)
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--text-primary', newColor)
    }
  }

  return (
    <SettingGroup
      title="Tema & Esquema de Color"
      description="Personaliza el aspecto general, paleta de colores y tonalidades de la interfaz."
    >
      {/* 1. Esquema de Color (Claro / Oscuro / Sistema) */}
      <SettingRow
        label="Esquema de color"
        description="Claro, oscuro o según la preferencia de tu sistema operativo."
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
            { id: 'light' as const, label: 'Claro', icon: Sun },
            { id: 'dark' as const, label: 'Oscuro', icon: Moon },
            { id: 'system' as const, label: 'Sistema', icon: Laptop },
          ].map((item) => {
            const isSelected = colorScheme === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setColorScheme(item.id)
                  if (item.id === 'light') setTheme('light')
                  else if (item.id === 'dark') setTheme('obsidian')
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  backgroundColor: isSelected ? 'var(--bg-surface)' : 'transparent',
                  border: isSelected ? '1px solid var(--border-subtle)' : '1px solid transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={13} color={isSelected ? 'var(--accent)' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </SettingRow>

      {/* 2. Paleta de Colores (Presets Visuales Limpios) */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
            Paleta de colores
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Colores y acentos preconfigurados en modo claro y oscuro.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { id: 'standard' as const, label: 'Estándar', accent: '#10B981', bg: '#1A1E26', theme: 'emerald' as const },
            { id: 'classic' as const, label: 'Clásica', accent: '#3B82F6', bg: '#1E2430', theme: 'midnight' as const },
            { id: 'minimal' as const, label: 'Minimalista', accent: '#FFFFFF', bg: '#161920', theme: 'obsidian' as const },
          ].map((preset) => {
            const isSelected = palettePreset === preset.id
            return (
              <div
                key={preset.id}
                onClick={() => {
                  setPalettePreset(preset.id)
                  handleAccentChange(preset.accent)
                  setTheme(preset.theme)
                }}
                style={{
                  border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Mini Preview Card */}
                <div
                  style={{
                    height: 52,
                    borderRadius: 6,
                    backgroundColor: preset.bg,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ width: '60%', height: 4, borderRadius: 2, backgroundColor: '#475569' }} />
                  <div style={{ width: '40%', height: 4, borderRadius: 2, backgroundColor: '#334155' }} />
                  <div style={{ width: '30%', height: 4, borderRadius: 2, backgroundColor: preset.accent }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {preset.label}
                  </span>
                  {isSelected && <Check size={13} color="var(--accent)" strokeWidth={3} />}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. Personalización Individual de Colores (Hex editable con swatch) */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Personalización del tema activo
        </span>

        {/* Acento */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Acento</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px',
              borderRadius: 20,
              backgroundColor: accentColor,
              color: '#FFFFFF',
              fontSize: 11.5,
              fontWeight: 700,
              fontFamily: 'monospace',
              cursor: 'pointer',
              position: 'relative',
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            }}
          >
            <input
              type="color"
              value={accentColor}
              onChange={(e) => handleAccentChange(e.target.value)}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%',
              }}
            />
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
            <span>{accentColor.toUpperCase()}</span>
          </div>
        </div>

        {/* Fondo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Fondo</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px',
              borderRadius: 20,
              backgroundColor: bgColor,
              border: '1px solid var(--border-subtle)',
              color: '#ECECEC',
              fontSize: 11.5,
              fontWeight: 700,
              fontFamily: 'monospace',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <input
              type="color"
              value={bgColor}
              onChange={(e) => handleBgChange(e.target.value)}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%',
              }}
            />
            <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1px solid #ECECEC' }} />
            <span>{bgColor.toUpperCase()}</span>
          </div>
        </div>

        {/* Primer plano */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Primer plano</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px',
              borderRadius: 20,
              backgroundColor: fgColor,
              border: '1px solid var(--border-subtle)',
              color: '#1C1713',
              fontSize: 11.5,
              fontWeight: 700,
              fontFamily: 'monospace',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <input
              type="color"
              value={fgColor}
              onChange={(e) => handleFgChange(e.target.value)}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%',
              }}
            />
            <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1px solid #1C1713' }} />
            <span>{fgColor.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </SettingGroup>
  )
}
