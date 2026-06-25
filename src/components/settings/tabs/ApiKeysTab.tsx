import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { SettingGroup } from './primitives'

interface ProviderConfig {
  id: string
  name: string
  placeholder: string
  docsUrl: string
}

const PROVIDERS: ProviderConfig[] = [
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...', docsUrl: 'console.anthropic.com' },
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...', docsUrl: 'platform.openai.com' },
  { id: 'google', name: 'Google AI', placeholder: 'AIza...', docsUrl: 'aistudio.google.com' },
  { id: 'groq', name: 'Groq', placeholder: 'gsk_...', docsUrl: 'console.groq.com' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...', docsUrl: 'openrouter.ai' },
]

export function ApiKeysTab() {
  const { apiKeys, setApiKey } = useSettingsStore()
  const [reveal, setReveal] = useState<Record<string, boolean>>({})

  const toggleReveal = (id: string) =>
    setReveal((r) => ({ ...r, [id]: !r[id] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title="Proveedores"
        description="Claves de API para los proveedores de modelos. Se guardan localmente."
      >
        <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
          {PROVIDERS.map((p) => {
            const value = apiKeys[p.id] || ''
            const isRevealed = !!reveal[p.id]
            return (
              <div
                key={p.id}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-ui)',
                        fontWeight: 500,
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-ui)',
                        marginTop: 1,
                      }}
                    >
                      Obtén tu clave en {p.docsUrl}
                    </div>
                  </div>
                  {value && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: 'var(--accent-glow)',
                        color: 'var(--accent)',
                        fontWeight: 500,
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      Configurada
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type={isRevealed ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => setApiKey(p.id, e.target.value)}
                    placeholder={p.placeholder}
                    style={{
                      flex: 1,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-normal)',
                      borderRadius: 'var(--radius-md)',
                      padding: '6px 10px',
                      fontSize: 11.5,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => toggleReveal(p.id)}
                    title={isRevealed ? 'Ocultar' : 'Mostrar'}
                    style={{
                      width: 30,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-normal)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </SettingGroup>
    </div>
  )
}
