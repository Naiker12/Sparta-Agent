import { useState } from 'react'
import { SettingGroup } from '../../shared'
import { useMemoryStore } from 'ia-sparta-core'
import { Brain, ChevronDown, ChevronUp } from 'lucide-react'

export function MemoryEntriesListSection() {
  const { entries } = useMemoryStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <SettingGroup
      title="Fragmentos de Conocimiento Almacenados"
      description="Base de datos de contexto recuperable utilizada por los agentes para mantener coherencia en el proyecto."
    >
      <div style={{ padding: 14 }}>
        {entries.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-lg, 12px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Brain size={18} color="var(--text-muted)" />
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
              No hay fragmentos de memoria almacenados
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              A medida que interactúes con el asistente, los patrones y directivas clave se consolidarán aquí.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.id
              const isAuto = entry.source === 'auto'
              const text = entry.content || ''

              return (
                <div
                  key={entry.id}
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  style={{
                    backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: `3px solid ${isAuto ? 'var(--accent)' : 'var(--status-ok, #10B981)'}`,
                    borderRadius: 'var(--radius-md, 8px)',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        backgroundColor: isAuto ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: isAuto ? 'var(--accent)' : 'var(--status-ok, #10B981)',
                        fontFamily: 'monospace',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isAuto ? 'Automático' : 'Manual'}
                    </span>

                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : ''}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      margin: 0,
                      lineHeight: 1.45,
                      overflow: isExpanded ? 'visible' : 'hidden',
                      display: isExpanded ? 'block' : '-webkit-box',
                      WebkitLineClamp: isExpanded ? undefined : 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {text}
                  </p>

                  {text.length > 100 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--text-muted)' }}>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      <span>{isExpanded ? 'Ver menos' : 'Ver más'}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SettingGroup>
  )
}
