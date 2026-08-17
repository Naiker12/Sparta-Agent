import { useState, useEffect } from 'react'
import { Brain, Sparkles, Database, ChevronDown, ChevronUp } from 'lucide-react'
import { useMemoryStore, useSettingsStore, getIndexedCount, getEmbeddingModelLabel } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import { Switch } from 'ia-sparta-design-system'

export function MemoryTab() {
  const { entries } = useMemoryStore()
  const { memoryEnabled, semanticMemoryEnabled, toggleMemory, toggleSemanticMemory } = useSettingsStore()
  const { t } = useTranslation()
  const [chromaCount, setChromaCount] = useState(0)
  const [embeddingLabel, setEmbeddingLabel] = useState('')
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)

  useEffect(() => {
    if (semanticMemoryEnabled) {
      getIndexedCount().then(setChromaCount).catch(() => setChromaCount(0))
      setEmbeddingLabel(getEmbeddingModelLabel())
    }
  }, [semanticMemoryEnabled])

  const autoCount = entries.filter((e) => e.source === 'auto').length
  const manualCount = entries.filter((e) => e.source === 'manual').length

  return (
    <div className="flex flex-col gap-6 py-2">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {t('memory.title') || 'Memoria'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('memory.desc') || 'Configuracion general de la memoria persistente y semantica.'}
        </p>
      </div>

      {/* Memory Toggle Cards */}
      <div className="flex flex-col gap-3">
        {/* Persistent Memory */}
        <div
          className="rounded-2xl p-card-lg flex items-center justify-between gap-6 transition-all"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-5 min-w-0 flex-1">
            <div
              className="size-icon-box rounded-2xl flex items-center justify-center border"
              style={{
                background: 'color-mix(in srgb, var(--status-ok) 12%, transparent)',
                borderColor: 'color-mix(in srgb, var(--status-ok) 22%, transparent)',
              }}
            >
              <Brain className="size-icon-sm" style={{ color: 'var(--status-ok)' }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {t('memory.persistentMemory') || 'Memoria persistente'}
                </h3>
                {memoryEnabled && (
                  <span
                    className="px-3 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      background: 'color-mix(in srgb, var(--status-ok) 12%, transparent)',
                      color: 'var(--status-ok)',
                      border: '1px solid color-mix(in srgb, var(--status-ok) 25%, transparent)',
                    }}
                  >
                    Activo
                  </span>
                )}
              </div>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {t('memory.persistentMemoryDesc') || 'Permite que el agente guarde contexto entre sesiones.'}
              </p>
            </div>
          </div>
          <Switch checked={memoryEnabled} onCheckedChange={toggleMemory} />
        </div>

        {/* Semantic Memory */}
        <div
          className="rounded-2xl p-card-lg flex items-center justify-between gap-6 transition-all"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-5 min-w-0 flex-1">
            <div
              className="size-icon-box rounded-2xl flex items-center justify-center border"
              style={{
                background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                borderColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
              }}
            >
              <Sparkles className="size-icon-sm" style={{ color: 'var(--accent)' }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Memoria semantica (ChromaDB)
                </h3>
                {semanticMemoryEnabled && (
                  <span
                    className="px-3 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      background: 'color-mix(in srgb, var(--status-ok) 12%, transparent)',
                      color: 'var(--status-ok)',
                      border: '1px solid color-mix(in srgb, var(--status-ok) 25%, transparent)',
                    }}
                  >
                    Conectado
                  </span>
                )}
              </div>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {embeddingLabel
                  ? `Indexa recuerdos por significado usando embeddings (${embeddingLabel})`
                  : 'Indexa recuerdos por significado usando embeddings vectoriales en localhost:8000'}
              </p>
              {semanticMemoryEnabled && (
                <div className="flex items-center gap-2 mt-2" style={{ color: 'var(--text-muted)' }}>
                  <Database className="size-icon-sm" style={{ color: 'var(--accent)' }} />
                  <span className="text-xs font-medium">{chromaCount} entradas indexadas en ChromaDB</span>
                </div>
              )}
            </div>
          </div>
          <Switch checked={semanticMemoryEnabled} onCheckedChange={toggleSemanticMemory} />
        </div>
      </div>

      {/* Stats Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {t('memory.memories') || 'RECUERDOS'}
          </span>
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Total: {entries.length} registros
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t('memory.auto') || 'AUTOMATICOS', value: autoCount },
            { label: t('memory.manual') || 'MANUALES', value: manualCount },
            { label: 'INDEXADAS', value: semanticMemoryEnabled ? chromaCount : '-' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-2xl flex flex-col items-center justify-center text-center transition-all"
              style={{
                padding: '20px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)' }}
            >
              <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</span>
              <span className="text-xs font-bold uppercase tracking-wider mt-1.5" style={{ color: 'var(--text-muted)' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Memory Preview */}
      {entries.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {t('memory.preview') || 'Recuerdos recientes'}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Mostrando {Math.min(entries.length, 5)} de {entries.length}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {entries.slice(-5).reverse().map((entry) => {
              const isExpanded = expandedEntryId === entry.id
              const isAuto = entry.source === 'auto'

              // Strip markdown symbols for clean preview
              const cleanText = entry.content
                .replace(/#{1,6}\s/g, '')
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/`/g, '')
                .replace(/^\s*[-*+]\s/gm, '')
                .trim()

              // Relative date
              const relDate = entry.createdAt
                ? (() => {
                    const diff = Date.now() - entry.createdAt
                    if (diff < 60_000) return 'ahora'
                    if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`
                    if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)} h`
                    return new Date(entry.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })
                  })()
                : ''

              return (
                <div
                  key={entry.id}
                  onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                  className="rounded-xl transition-all cursor-pointer overflow-hidden"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: `3px solid ${isAuto ? 'var(--accent)' : 'var(--status-ok)'}`,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = isAuto ? 'var(--accent)' : 'var(--status-ok)' }}
                >
                  {/* Card body */}
                  <div style={{ padding: '14px 16px' }}>
                    {/* Top row: badges + date */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{
                          background: isAuto
                            ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                            : 'color-mix(in srgb, var(--status-ok) 12%, transparent)',
                          color: isAuto ? 'var(--accent)' : 'var(--status-ok)',
                          border: `1px solid ${isAuto ? 'color-mix(in srgb, var(--accent) 22%, transparent)' : 'color-mix(in srgb, var(--status-ok) 22%, transparent)'}`,
                        }}
                      >
                        {isAuto ? 'auto' : 'manual'}
                      </span>
                      {entry.category && (
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full lowercase"
                          style={{
                            background: 'var(--bg-active)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {entry.category}
                        </span>
                      )}
                      <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>
                        {relDate}
                      </span>
                    </div>

                    {/* Content */}
                    <p
                      className={`text-sm leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {cleanText}
                    </p>

                    {/* Expand hint */}
                    {!isExpanded && cleanText.length > 120 && (
                      <div className="flex items-center gap-1 mt-2" style={{ color: 'var(--text-muted)' }}>
                        <ChevronDown className="size-icon-sm" />
                        <span className="text-[10px]">Ver más</span>
                      </div>
                    )}
                    {isExpanded && (
                      <div className="flex items-center gap-1 mt-2" style={{ color: 'var(--text-muted)' }}>
                        <ChevronUp className="size-icon-sm" />
                        <span className="text-[10px]">Ver menos</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
