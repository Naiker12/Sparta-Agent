import { ThemeSection } from './appearance/sections/ThemeSection'
import { TypographySection } from './appearance/sections/TypographySection'
import { PreferencesSection } from './appearance/sections/PreferencesSection'
import { SidebarNavSection } from './appearance/sections/SidebarNavSection'
import { ProfileMenuSection } from './appearance/sections/ProfileMenuSection'
import { RotateCw } from 'lucide-react'

export function AppearanceTab() {
  function handleResetPreferences() {
    if (window.confirm('¿Deseas restablecer toda la personalización de apariencia a los valores predeterminados de Sparta?')) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sparta-theme')
        localStorage.removeItem('sparta-appearance-prefs')
        window.location.reload()
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. Tema & Esquema de Color */}
      <ThemeSection />

      {/* 2. Tipografía & Fuentes */}
      <TypographySection />

      {/* 3. Preferencias & Accesibilidad */}
      <PreferencesSection />

      {/* 4. Navegación de la barra lateral */}
      <SidebarNavSection />

      {/* 5. Menú de la barra lateral (Perfil) */}
      <ProfileMenuSection />

      {/* 6. Footer con Botón Restablecer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, paddingBottom: 16 }}>
        <button
          type="button"
          onClick={handleResetPreferences}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 18px',
            borderRadius: 20,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          <RotateCw size={13} />
          <span>Restablecer la personalización</span>
        </button>
      </div>
    </div>
  )
}
