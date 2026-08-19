import { useState, useEffect } from 'react'
import { SettingGroup, HardwareCard } from '../../shared'
import { useMemoryStore, useSettingsStore, getIndexedCount, getEmbeddingModelLabel } from 'ia-sparta-core'
import { Brain, Database, Sparkles } from 'lucide-react'

export function MemoryMetricsSection() {
  const { entries } = useMemoryStore()
  const { semanticMemoryEnabled } = useSettingsStore()
  const [chromaCount, setChromaCount] = useState(0)
  const [embeddingLabel, setEmbeddingLabel] = useState('')

  useEffect(() => {
    if (semanticMemoryEnabled) {
      getIndexedCount().then(setChromaCount).catch(() => setChromaCount(0))
      setEmbeddingLabel(getEmbeddingModelLabel())
    }
  }, [semanticMemoryEnabled])

  const autoCount = entries.filter((e) => e.source === 'auto').length
  const manualCount = entries.filter((e) => e.source === 'manual').length

  return (
    <SettingGroup
      title="Telemetría & Estadísticas de Memoria"
      description="Resumen de recuerdos consolidados, fuentes de captura e índices vectoriales activos."
    >
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <HardwareCard
          title="Recuerdos Automáticos"
          percentage={Math.min(100, autoCount * 10)}
          detail={`${autoCount} aprendidos`}
          subDetail="Extraídos en chat"
          icon={<Sparkles size={16} />}
        />

        <HardwareCard
          title="Recuerdos Manuales"
          percentage={Math.min(100, manualCount * 15)}
          detail={`${manualCount} guardados`}
          subDetail="Añadidos por usuario"
          icon={<Brain size={16} />}
        />

        <HardwareCard
          title="Vectores Indexados"
          percentage={semanticMemoryEnabled ? Math.min(100, chromaCount) : 0}
          detail={`${chromaCount} embeddings`}
          subDetail={embeddingLabel || 'ChromaDB Local'}
          icon={<Database size={16} />}
        />
      </div>
    </SettingGroup>
  )
}
