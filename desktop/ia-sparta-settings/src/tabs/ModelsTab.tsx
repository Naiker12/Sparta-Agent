import { useState } from 'react'
import { Plus, Server, Sparkles } from 'lucide-react'
import type { ProviderVendor, Provider } from 'ia-sparta-core'
import { useProviderStore, useSettingsStore } from 'ia-sparta-core'
import { ProviderCard, AIProviderModal, LocalModelsDiscoveryBadge } from 'ia-sparta-providers'
import { SettingGroup } from './shared'

export function ModelsTab() {
  const { activeModel } = useSettingsStore()
  const { providers } = useProviderStore()

  // Modal dialog state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [initialVendor, setInitialVendor] = useState<ProviderVendor>('ollama')

  function handleOpenNew() {
    setEditingProvider(null)
    setInitialVendor('ollama')
    setModalOpen(true)
  }

  function handleEditProvider(provider: Provider) {
    setEditingProvider(provider)
    setInitialVendor(provider.vendor)
    setModalOpen(true)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 860,
        width: '100%',
        fontFamily: 'var(--font-ui, system-ui, -apple-system, sans-serif)',
      }}
    >
      {/* Tarjeta Contenedora Principal */}
      <SettingGroup
        title="Proveedores y Modelos Conectados"
        description="Configura servidores de inferencia, endpoints locales (Ollama, vLLM, LM Studio) y proveedores comerciales con enrutamiento inteligente."
        action={
          <button
            onClick={handleOpenNew}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              backgroundColor: 'var(--accent)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              transition: 'all 0.15s ease',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <Plus size={13} strokeWidth={2.5} /> Conectar Proveedor
          </button>
        }
      >
        {/* Card Body: Provider Items List */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 12,
          }}
        >
          {providers.length === 0 ? (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-lg, 12px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                }}
              >
                <Server size={18} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                No hay proveedores conectados
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.4 }}>
                Conecta Ollama, vLLM, LM Studio, OpenAI, Anthropic, Gemini o cualquier servidor OpenAI compatible.
              </div>
              <button
                onClick={handleOpenNew}
                style={{
                  marginTop: 6,
                  padding: '6px 14px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md, 8px)',
                  cursor: 'pointer',
                }}
              >
                + Conectar Primer Proveedor
              </button>
            </div>
          ) : (
            providers.map((p) => {
              const isActive = Boolean(
                activeModel &&
                  (p.defaultModel === activeModel ||
                    (p.models && p.models.includes(activeModel))),
              )
              return (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  isActive={isActive}
                  onEdit={() => handleEditProvider(p)}
                />
              )
            })
          )}
        </div>

        {/* Footer info & Local Discovery Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-subtle)',
            padding: '10px 16px',
            backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Sparkles size={12} color="var(--accent)" />
            {providers.length} {providers.length === 1 ? 'proveedor configurado' : 'proveedores configurados'}
          </span>
          <LocalModelsDiscoveryBadge />
        </div>
      </SettingGroup>

      {/* Modal Dialog Master-Detail */}
      <AIProviderModal
        open={modalOpen}
        initialVendor={initialVendor}
        editProvider={editingProvider}
        onClose={() => {
          setModalOpen(false)
          setEditingProvider(null)
        }}
      />
    </div>
  )
}
