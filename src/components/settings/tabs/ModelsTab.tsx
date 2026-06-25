import { useSettingsStore } from '@/stores/settings.store'
import { SettingGroup } from './primitives'

interface ModelOption {
  id: string
  label: string
  provider: string
  description: string
  badge?: string
}

const MODELS: ModelOption[] = [
  {
    id: 'claude-opus-4',
    label: 'Claude Opus 4',
    provider: 'Anthropic',
    description: 'Modelo más capaz. Ideal para tareas complejas y razonamiento profundo.',
    badge: 'Recomendado',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    description: 'Balance entre velocidad, costo y capacidad. Buen default general.',
  },
  {
    id: 'claude-haiku',
    label: 'Claude Haiku',
    provider: 'Anthropic',
    description: 'El más rápido y económico. Para tareas simples y baja latencia.',
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Modelo multimodal de OpenAI. Requiere API key configurada.',
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'OpenAI',
    description: 'Versión económica de GPT-4o.',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'Google',
    description: 'Modelo de Google con ventana de contexto extendida.',
  },
]

export function ModelsTab() {
  const { defaultModel, setDefaultModel } = useSettingsStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title="Modelo por defecto"
        description="Modelo que se usará al crear nuevas sesiones."
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingTop: 4,
          }}
        >
          {MODELS.map((m) => {
            const isActive = defaultModel === m.id
            return (
              <button
                key={m.id}
                onClick={() => setDefaultModel(m.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  background: isActive ? 'var(--accent-muted)' : 'var(--bg-input)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-normal)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.12s',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border-strong)'}`,
                    background: isActive ? 'var(--accent)' : 'transparent',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {m.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {m.provider}
                    </span>
                    {m.badge && (
                      <span
                        style={{
                          fontSize: 9.5,
                          padding: '1px 6px',
                          borderRadius: 999,
                          background: 'var(--accent)',
                          color: 'white',
                          fontWeight: 500,
                        }}
                      >
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      marginTop: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    {m.description}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </SettingGroup>
    </div>
  )
}
