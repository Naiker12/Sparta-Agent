import { ThemePicker } from '../ThemePicker'
import { SettingGroup } from './primitives'

export function AppearanceTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title="Tema"
        description="Cambia el aspecto visual de la aplicación. Los cambios se aplican al instante."
      >
        <div style={{ paddingTop: 4 }}>
          <ThemePicker />
        </div>
      </SettingGroup>

      <SettingGroup title="Tipografía" description="Familia tipográfica de la interfaz.">
        <SettingRowStatic
          title="Fuente UI"
          value="Geist / Inter"
        />
        <SettingRowStatic title="Fuente mono" value="Geist Mono" />
        <SettingRowStatic title="Tamaño base" value="13px" />
      </SettingGroup>

      <SettingGroup title="Ventana" description="Opciones visuales de la ventana.">
        <SettingRowStatic title="Transparencia" value="Desactivada" />
        <SettingRowStatic title="Bordes redondeados" value="Activados" />
      </SettingGroup>
    </div>
  )
}

function SettingRowStatic({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '10px 0',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 500,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {value}
      </div>
    </div>
  )
}
