import { useState, useEffect } from 'react'
import { useMemoryStore } from '@/stores/memory.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useTranslation } from '@/i18n'
import { SettingGroup, SettingRow } from './primitives'
import { getIndexedCount, getEmbeddingModelLabel } from '@/services/memory/vector'

export function MemoryTab() {
  const { entries } = useMemoryStore()
  const { memoryEnabled, semanticMemoryEnabled, toggleMemory, toggleSemanticMemory } = useSettingsStore()
  const { t } = useTranslation()
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title={t('memory.title')}
        description={t('memory.desc')}
      >
        <SettingRow
          title={t('memory.persistentMemory')}
          description={t('memory.persistentMemoryDesc')}
          control={
            <button
              onClick={toggleMemory}
              style={{
                width: 32,
                height: 16,
                borderRadius: 8,
                background: memoryEnabled ? 'var(--accent)' : 'var(--border-normal)',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.15s',
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: 'white',
                  position: 'absolute',
                  top: 2,
                  left: memoryEnabled ? 18 : 2,
                  transition: 'left 0.15s',
                }}
              />
            </button>
          }
        />
      </SettingGroup>

      <SettingGroup
        title="Memoria semántica (ChromaDB)"
        description="Indexa recuerdos por significado usando embeddings vectoriales"
      >
        <SettingRow
          title="Memoria semántica"
          description={embeddingLabel ? `Embeddings: ${embeddingLabel}` : 'Requiere ChromaDB en localhost:8000 y un proveedor con embeddings (OpenAI u Ollama)'}
          control={
            <button
              onClick={toggleSemanticMemory}
              style={{
                width: 32,
                height: 16,
                borderRadius: 8,
                background: semanticMemoryEnabled ? 'var(--accent)' : 'var(--border-normal)',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.15s',
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: 'white',
                  position: 'absolute',
                  top: 2,
                  left: semanticMemoryEnabled ? 18 : 2,
                  transition: 'left 0.15s',
                }}
              />
            </button>
          }
        />
        {semanticMemoryEnabled && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>
            Entradas indexadas: {chromaCount}
          </div>
        )}
      </SettingGroup>

      <SettingGroup
        title={t('memory.memories')}
        description={t('memory.memoriesDesc')}
      >
        <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
          <StatCard label={t('memory.total')} value={entries.length} />
          <StatCard label={t('memory.auto')} value={autoCount} color="var(--accent)" />
          <StatCard label={t('memory.manual')} value={manualCount} color="var(--text-muted)" />
        </div>
      </SettingGroup>

      {entries.length > 0 && (
        <SettingGroup title={t('memory.preview')} description={t('memory.previewDesc')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
            {entries.slice(-3).reverse().map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: '8px 10px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-ui)',
                  lineHeight: 1.4,
                }}
              >
                {entry.content}
              </div>
            ))}
          </div>
        </SettingGroup>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '12px 16px',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: color ?? 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-ui)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
    </div>
  )
}
