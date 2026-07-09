import { ipcMain } from 'electron'

interface ListModelsRequest {
  vendor: string
  apiKey?: string
  serverUrl?: string
}

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

function normalizeOpenAIBase(baseUrl: string): string {
  const clean = baseUrl.replace(/\/+$/, '')
  return clean.endsWith('/v1') ? clean : `${clean}/v1`
}

function chatModelsOnly(models: string[]): string[] {
  const chatModels = models.filter((model) => {
    const id = model.toLowerCase()
    return !id.includes('embedding') && !id.includes('embed-')
  })
  return chatModels.length > 0 ? chatModels : models
}

export function registerModelsIPC(): void {
  ipcMain.handle('models:list', async (_event, req: ListModelsRequest) => {
    const vendor = req.vendor
    const localOpenAI = vendor === 'lmstudio' || vendor === 'llamacpp' || vendor === 'custom'

    try {
      if (vendor === 'ollama') {
        const base = (req.serverUrl || 'http://localhost:11434').replace(/\/+$/, '')
        const res = await fetch(`${base}/api/tags`)
        if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
        const data = await res.json()
        const models = (data.models || []).map((m: { name: string }) => m.name)
        return { models }
      }

      if (localOpenAI) {
        const base = normalizeOpenAIBase(req.serverUrl || 'http://localhost:1234')
        const headers: Record<string, string> = {}
        if (req.apiKey) headers.Authorization = `Bearer ${req.apiKey}`
        const res = await fetch(`${base}/models`, { headers })
        if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
        const data = await res.json()
        const models = chatModelsOnly((data.data || []).map((m: { id: string }) => m.id))
        return { models }
      }

      // Cloud providers: fetch from the main process to bypass browser CORS restrictions
      // (e.g. NVIDIA does not allow browser-side requests to integrate.api.nvidia.com).
      return await fetchCloudModels(vendor, req.apiKey, req.serverUrl)
    } catch (err) {
      return { models: [], error: err instanceof Error ? err.message : 'Connection failed' }
    }
  })
}

async function fetchCloudModels(
  vendor: string,
  apiKey?: string,
  serverUrl?: string,
): Promise<{ models: string[]; error?: string }> {
  switch (vendor) {
    case 'anthropic': {
      const res = await fetch(`${API_BASE.anthropic}/v1/models`, {
        headers: {
          'x-api-key': apiKey || '',
          'anthropic-version': '2023-06-01',
        },
      })
      if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
      const data = await res.json()
      const models = (data.data || []).map((m: { name: string; id?: string }) => m.id || m.name)
      return { models }
    }

    case 'google': {
      const res = await fetch(`${API_BASE.google}/v1beta/models?key=${apiKey || ''}`)
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
        headers: { 'api-key': apiKey || '' },
      })
      if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
      const data = await res.json()
      const models = (data.data || []).map((m: { id: string }) => m.id)
      return { models }
    }

    case 'together': {
      const res = await fetch(`${API_BASE.together}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey || ''}` },
      })
      if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
      const data = await res.json()
      const models = (data.data || []).map((m: { id: string; name?: string }) => m.id || m.name)
      return { models }
    }

    case 'fireworks': {
      const res = await fetch(`${API_BASE.fireworks}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey || ''}` },
      })
      if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
      const data = await res.json()
      const models = (data.data || []).map((m: { id: string }) => m.id)
      return { models }
    }

    case 'openrouter': {
      const res = await fetch(`${API_BASE.openrouter}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey || ''}` },
      })
      if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
      const data = await res.json()
      const models = (data.data || []).map((m: { id: string }) => m.id)
      return { models }
    }

    case 'cohere': {
      const res = await fetch(`${API_BASE.cohere}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey || ''}` },
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
        headers: { Authorization: `Bearer ${apiKey || ''}` },
      })
      if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
      const data = await res.json()
      const models = (data.data || []).map((m: { id: string }) => m.id)
      return { models: chatModelsOnly(models) }
    }
  }
}
