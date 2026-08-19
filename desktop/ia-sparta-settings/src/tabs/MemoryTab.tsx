import { MemoryTogglesSection } from './memory/sections/MemoryTogglesSection'
import { MemoryMetricsSection } from './memory/sections/MemoryMetricsSection'
import { MemoryEntriesListSection } from './memory/sections/MemoryEntriesListSection'

export function MemoryTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. Motores & Toggles de Memoria */}
      <MemoryTogglesSection />

      {/* 2. Métricas & Estadísticas de Memoria */}
      <MemoryMetricsSection />

      {/* 3. Fragmentos de Conocimiento Almacenados */}
      <MemoryEntriesListSection />
    </div>
  )
}
