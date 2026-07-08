import type { ProviderVendor } from '@/types'

const API_BASE: Record<string, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  google: 'https://generativelanguage.googleapis.com',
  groq: 'https://api.groq.com/openai',
  mistral: 'https://api.mistral.ai',
  deepseek: 'https://api.deepseek.com',
  together: 'https://api.together.xyz',
  fireworks: 'https://api.fireworks.ai/inference',
  openrouter: 'https://openrouter.ai/api',
  cohere: 'https://api.cohere.ai',
  perplexity: 'https://api.perplexity.ai',
  xai: 'https://api.x.ai',
  nvidia: 'https://integrate.api.nvidia.com',
}

interface FetchModelsResult {
  models: string[]
  error?: string
}

function chatModelsOnly(models: string[]): string[] {
  const chatModels = models.filter((model) => {
    const id = model.toLowerCase()
    return !id.includes('embedding') && !id.includes('embed-')
  })
  return chatModels.length > 0 ? chatModels : models
}

export async function fetchModelsByVendor(
  vendor: ProviderVendor,
  apiKey: string,
  serverUrl?: string,
): Promise<FetchModelsResult> {
  try {
    switch (vendor) {
      case 'ollama': {
        if (typeof window !== 'undefined' && window.sparta?.fetchModels) {
          return window.sparta.fetchModels({ vendor, apiKey, serverUrl })
        }
        const url = `${serverUrl || 'http://localhost:11434'}/api/tags`
        const res = await fetch(url)
        if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
        const data = await res.json()
        const models = (data.models || []).map((m: { name: string }) => m.name)
        return { models }
      }

      case 'lmstudio':
      case 'llamacpp':
      case 'custom': {
        if (typeof window !== 'undefined' && window.sparta?.fetchModels) {
          return window.sparta.fetchModels({ vendor, apiKey, serverUrl })
        }
        const base = serverUrl || 'http://localhost:1234'
        const res = await fetch(`${base}/v1/models`)
        if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
        const data = await res.json()
        const models = chatModelsOnly((data.data || []).map((m: { id: string }) => m.id))
        return { models }
      }

      case 'anthropic': {
        const res = await fetch(`${API_BASE.anthropic}/v1/models`, {
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        })
        if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
        const data = await res.json()
        const models = (data.data || []).map((m: { name: string; id?: string }) => m.id || m.name)
        return { models }
      }

      case 'google': {
        const res = await fetch(`${API_BASE.google}/v1beta/models?key=${apiKey}`)
        if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
        const data = await res.json()
        const models = (data.models || [])
          .map((m: { name: string }) => m.name.replace('models/', ''))
          .filter((n: string) => !n.startsWith('tunedModels/'))
        return { models }
      }

      case 'azure': {
        const base = serverUrl || ''
        if (!base) return { models: [], error: 'Azure requires a resource endpoint URL.' }
        const res = await fetch(`${base}/openai/models?api-version=2024-02-01`, {
          headers: { 'api-key': apiKey },
        })
        if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
        const data = await res.json()
        const models = (data.data || []).map((m: { id: string }) => m.id)
        return { models }
      }

      case 'together': {
        const res = await fetch(`${API_BASE.together}/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
        const data = await res.json()
        const models = (data.data || []).map((m: { id: string; name?: string }) => m.id || m.name)
        return { models }
      }

      case 'fireworks': {
        const res = await fetch(`${API_BASE.fireworks}/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
        const data = await res.json()
        const models = (data.data || []).map((m: { id: string }) => m.id)
        return { models }
      }

      case 'openrouter': {
        const res = await fetch(`${API_BASE.openrouter}/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
        const data = await res.json()
        const models = (data.data || []).map((m: { id: string }) => m.id)
        return { models }
      }

      case 'cohere': {
        const res = await fetch(`${API_BASE.cohere}/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
        const data = await res.json()
        const models = (data.models || []).map((m: { name: string; id?: string }) => m.id || m.name)
        return { models }
      }

      default: {
        const base = API_BASE[vendor]
        if (!base) return { models: [], error: `Unknown provider: ${vendor}` }
        const res = await fetch(`${base}/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
        const data = await res.json()
        const models = (data.data || []).map((m: { id: string }) => m.id)
        return { models }
      }
    }
  } catch (err) {
    return { models: [], error: err instanceof Error ? err.message : 'Connection failed' }
  }
}
