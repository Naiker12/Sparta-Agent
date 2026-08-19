import { SettingGroup, SettingRow } from '../../shared'
import { Switch } from 'ia-sparta-design-system'
import { useSettingsStore } from 'ia-sparta-core'

export function MemoryTogglesSection() {
  const { memoryEnabled, semanticMemoryEnabled, toggleMemory, toggleSemanticMemory } = useSettingsStore()

  return (
    <SettingGroup
      title="Motor de Memoria & Contexto"
      description="Configuración de almacenamiento de contexto a largo plazo y recuperación semántica vectorial."
    >
      <SettingRow
        label="Memoria Persistente"
        description="Guarda fragmentos clave de conversaciones y decisiones arquitectónicas para reutilizarlos en sesiones futuras."
      >
        <Switch
          checked={memoryEnabled}
          onCheckedChange={toggleMemory}
        />
      </SettingRow>

      <SettingRow
        label="Memoria Semántica Vectorial (Embeddings)"
        description="Indexa el historial y archivos en una base de datos vectorial local para búsquedas por significado."
      >
        <Switch
          checked={semanticMemoryEnabled}
          onCheckedChange={toggleSemanticMemory}
        />
      </SettingRow>
    </SettingGroup>
  )
}
