import { useState } from 'react'
import { Trash2, Shield } from 'lucide-react'
import type { Provider } from 'ia-sparta-core'
import { useProviderStore, getVendorLabel } from 'ia-sparta-core'
import { ConfirmDeleteDialog, BrandIcon } from 'ia-sparta-design-system'
import { removeFromVault } from 'ia-sparta-platform'

interface ProviderCardProps {
  provider: Provider
  isActive?: boolean
  onEdit: () => void
}

const VENDOR_FALLBACKS: Record<string, { defaultModel: string; endpoint: string }> = {
  openrouter: { defaultModel: 'liquid/lfm-2.5-2.6b:free', endpoint: 'https://openrouter.ai/api/v1' },
  openai: { defaultModel: 'gpt-4o', endpoint: 'https://api.openai.com/v1' },
  anthropic: { defaultModel: 'claude-3-5-sonnet-20241022', endpoint: 'https://api.anthropic.com/v1' },
  google: { defaultModel: 'gemini-2.5-flash', endpoint: 'https://generativelanguage.googleapis.com' },
  groq: { defaultModel: 'llama-3.3-70b-versatile', endpoint: 'https://api.groq.com/openai/v1' },
  deepseek: { defaultModel: 'deepseek-chat', endpoint: 'https://api.deepseek.com/v1' },
  ollama: { defaultModel: 'llama3.3', endpoint: 'http://localhost:11434' },
  lmstudio: { defaultModel: 'local-model', endpoint: 'http://localhost:1234/v1' },
  custom: { defaultModel: 'vllm-model', endpoint: 'http://localhost:8000/v1' },
  mistral: { defaultModel: 'mistral-large-latest', endpoint: 'https://api.mistral.ai/v1' },
  xai: { defaultModel: 'grok-2-latest', endpoint: 'https://api.x.ai/v1' },
  together: { defaultModel: 'meta-llama/llama-3.3-70b-instruct', endpoint: 'https://api.together.xyz/v1' },
  fireworks: { defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct', endpoint: 'https://api.fireworks.ai/inference/v1' },
  cohere: { defaultModel: 'command-r-plus', endpoint: 'https://api.cohere.ai/v1' },
  perplexity: { defaultModel: 'sonar', endpoint: 'https://api.perplexity.ai/v1' },
  nvidia: { defaultModel: 'meta/llama-3.3-70b-instruct', endpoint: 'https://integrate.api.nvidia.com/v1' },
  azure: { defaultModel: 'gpt-4o', endpoint: 'https://your-resource.openai.azure.com' },
}

export function ProviderCard({ provider, isActive, onEdit }: ProviderCardProps) {
  const { removeProvider } = useProviderStore()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const isLocal = provider.kind === 'local'
  const hasKey = Boolean(provider.hasVaultKey || provider.apiKey)
  const isOnline = isLocal || hasKey

  const fallback = VENDOR_FALLBACKS[provider.vendor] || { defaultModel: 'auto-model', endpoint: '' }
  const displayModel = provider.defaultModel || (provider.models && provider.models[0]) || fallback.defaultModel
  const displayEndpoint = provider.serverUrl || fallback.endpoint

  return (
    <div
      style={{
        padding: '10px 14px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #EAE3D8',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        transition: 'all 0.15s ease',
        flexWrap: 'wrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#DED6CA'
        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.03)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#EAE3D8'
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'
      }}
    >
      {/* Left: Avatar & Details */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 240, flex: 1 }}>
        {/* Brand Icon Circle */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            backgroundColor: '#F5EFE6',
            border: '1px solid #E6DFD5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <BrandIcon vendor={provider.vendor} size={18} />
        </div>

        {/* Content Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          {/* Top Line: Provider Name + Status Badge + Shield */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#2A241E',
                letterSpacing: '-0.01em',
              }}
            >
              {provider.label || getVendorLabel(provider.vendor)}
            </span>

            {/* Status Pill Badge */}
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '1.5px 6px',
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                backgroundColor: isActive
                  ? '#DCFCE7'
                  : isOnline
                  ? '#EFEAE1'
                  : '#FEE2E2',
                color: isActive
                  ? '#166534'
                  : isOnline
                  ? '#786C5E'
                  : '#991B1B',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  backgroundColor: isActive
                    ? '#22C55E'
                    : isOnline
                    ? '#A89F91'
                    : '#EF4444',
                }}
              />
              {isActive
                ? 'ACTIVO'
                : isOnline
                ? (isLocal ? 'LOCAL' : 'LISTO')
                : 'OFFLINE'}
            </span>

            {provider.hasVaultKey && (
              <span
                title="Clave cifrada en Vault seguro (0600)"
                style={{ color: '#16A34A', display: 'flex', alignItems: 'center' }}
              >
                <Shield size={11} />
              </span>
            )}
          </div>

          {/* Bottom Line: Model Pill Tag + Endpoint URL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {displayModel && (
              <span
                style={{
                  fontSize: 10.5,
                  fontFamily: 'var(--font-mono, monospace)',
                  backgroundColor: '#F5EFE6',
                  color: '#423A31',
                  padding: '1px 6px',
                  borderRadius: 5,
                  border: '1px solid #EBE5DB',
                  maxWidth: 240,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayModel}
              </span>
            )}

            {displayEndpoint && (
              <>
                <span style={{ fontSize: 9, color: '#A89F91' }}>•</span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: '#8A7D6F',
                    maxWidth: 280,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={displayEndpoint}
                >
                  {displayEndpoint}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions (Config button + Trash button) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onEdit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 600,
            color: '#423A31',
            backgroundColor: '#FAF8F5',
            border: '1px solid #DED7CB',
            padding: '4px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'all 0.12s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#EFEAE1'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FAF8F5'
          }}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          Config
        </button>

        <button
          onClick={() => setConfirmDeleteOpen(true)}
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            backgroundColor: 'transparent',
            border: 'none',
            color: '#9C8F80',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FEE2E2'
            e.currentTarget.style.color = '#DC2626'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#9C8F80'
          }}
          title="Eliminar proveedor"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        itemLabel={provider.label || getVendorLabel(provider.vendor)}
        onConfirm={async () => {
          await removeFromVault(provider.id, provider.vendor)
          removeProvider(provider.id)
        }}
      />
    </div>
  )
}
