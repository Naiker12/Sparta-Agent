import { SettingGroup, SettingRowStatic } from '../../shared'

export function EnvironmentSection() {
  return (
    <SettingGroup
      title="Información del Entorno & Runtime"
      description="Versiones de bibliotecas de inferencia y detalles de la plataforma activa."
    >
      <SettingRowStatic
        label="Plataforma del Sistema"
        value="Windows x64 (10.0.26100)"
        hint="Arquitectura de hardware detectada"
      />
      <SettingRowStatic
        label="Sparta Agent Core"
        value="v2.4.0-stable"
        hint="Canal de compilación principal"
      />
      <SettingRowStatic
        label="Electron & Chromium"
        value="v34.0.0 / Chromium 132"
      />
      <SettingRowStatic
        label="Node.js Runtime"
        value="v22.12.0"
      />
      <SettingRowStatic
        label="Workspace Principal"
        value="D:\sparta-agent"
        hint="Raíz activa del proyecto Sparta Agent"
      />
      <SettingRowStatic
        label="Directorio de Modelos Locales"
        value="D:\sparta-agent\models"
        hint="Ruta predeterminada para pesos y cuantizaciones (.gguf)"
      />
    </SettingGroup>
  )
}
