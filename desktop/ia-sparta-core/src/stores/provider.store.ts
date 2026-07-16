import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Provider, ProviderVendor, ProviderKind } from '../types'

const VENDOR_LABELS: Record<ProviderVendor, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  groq: 'Groq',
  mistral: 'Mistral',
  azure: 'Azure OpenAI',
  deepseek: 'DeepSeek',
  together: 'Together AI',
  fireworks: 'Fireworks AI',
  openrouter: 'OpenRouter',
  cohere: 'Cohere',
  perplexity: 'Perplexity',
  xai: 'xAI',
  nvidia: 'NVIDIA',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  llamacpp: 'llama.cpp',
  custom: 'Servidor personalizado',
}

export function getVendorLabel(vendor: ProviderVendor): string {
  return VENDOR_LABELS[vendor]
}

interface ProviderState {
  providers: Provider[]
  addProvider: (data: {
    vendor: ProviderVendor
    kind: ProviderKind
    label?: string
    apiKey?: string
    serverUrl?: string
    defaultModel?: string
  }) => string
  updateProvider: (id: string, patch: Partial<Provider>) => void
  removeProvider: (id: string) => void
  getByVendor: (vendor: ProviderVendor) => Provider | undefined
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      providers: [],

      addProvider: (data) => {
        const id = crypto.randomUUID()
        const provider: Provider = {
          id,
          vendor: data.vendor,
          kind: data.kind,
          label: data.label || VENDOR_LABELS[data.vendor],
          apiKey: data.apiKey,
          serverUrl: data.serverUrl,
          defaultModel: data.defaultModel,
          createdAt: new Date().toISOString(),
          usage: null,
        }
        set((s) => ({ providers: [...s.providers, provider] }))
        return id
      },

      updateProvider: (id, patch) =>
        set((s) => ({
          providers: s.providers.map((p) =>
            p.id === id ? { ...p, ...patch } : p
          ),
        })),

      removeProvider: (id) =>
        set((s) => ({
          providers: s.providers.filter((p) => p.id !== id),
        })),

      getByVendor: (vendor) =>
        get().providers.find((p) => p.vendor === vendor),
    }),
    {
      name: 'sparta-providers',
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version < 1) {
          const providers = Array.isArray(state.providers) ? state.providers : []
          return {
            providers: providers.map((p: Record<string, unknown>) => ({
              ...p,
              hasVaultKey: (p as { hasVaultKey?: boolean }).hasVaultKey ?? false,
              usage: (p as { usage?: unknown }).usage ?? null,
            })),
          }
        }
        return persisted
      },
    }
  )
)
