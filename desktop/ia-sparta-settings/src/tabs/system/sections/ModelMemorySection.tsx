import { useState } from 'react'
import { SettingGroup, SettingRow } from '../../shared'
import { Switch } from 'ia-sparta-design-system'

export function ModelMemorySection() {
  const [keepInVram, setKeepInVram] = useState(true)
  const [noReserveRam, setNoReserveRam] = useState(false)
  const [contextShift, setContextShift] = useState(true)

  return (
    <SettingGroup
      title="Gestión de Memoria y VRAM"
      description="Políticas de retención de pesos y asignación de memoria para acelerar la inferencia recurrente."
    >
      <SettingRow
        label="Mantener el modelo en la memoria de la GPU"
        description="Mantiene los pesos cargados en VRAM tras cada respuesta para evitar latencias de recarga."
      >
        <Switch
          checked={keepInVram}
          onCheckedChange={setKeepInVram}
        />
      </SettingRow>

      <SettingRow
        label="No reservar RAM del sistema"
        description="Libera la memoria RAM del sistema una vez que los pesos se transfieren a la VRAM de la GPU."
      >
        <Switch
          checked={noReserveRam}
          onCheckedChange={setNoReserveRam}
        />
      </SettingRow>

      <SettingRow
        label="Smart Context Shift (KV Cache)"
        description="Reutiliza el cálculo de tokens anteriores para acelerar conversaciones largas."
      >
        <Switch
          checked={contextShift}
          onCheckedChange={setContextShift}
        />
      </SettingRow>
    </SettingGroup>
  )
}
