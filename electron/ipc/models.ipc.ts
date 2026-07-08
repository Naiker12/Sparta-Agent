import { ipcMain } from 'electron'

interface ListModelsRequest {
  vendor: string
  apiKey?: string
  serverUrl?: string
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

    if (vendor !== 'ollama' && !localOpenAI) {
      return { models: [], error: `Unsupported IPC model provider: ${vendor}` }
    }

    try {
      if (vendor === 'ollama') {
        const base = (req.serverUrl || 'http://localhost:11434').replace(/\/+$/, '')
        const res = await fetch(`${base}/api/tags`)
        if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
        const data = await res.json()
        const models = (data.models || []).map((m: { name: string }) => m.name)
        return { models }
      }

      const base = normalizeOpenAIBase(req.serverUrl || 'http://localhost:1234')
      const headers: Record<string, string> = {}
      if (req.apiKey) headers.Authorization = `Bearer ${req.apiKey}`
      const res = await fetch(`${base}/models`, { headers })
      if (!res.ok) return { models: [], error: `HTTP ${res.status}: ${res.statusText}` }
      const data = await res.json()
      const models = chatModelsOnly((data.data || []).map((m: { id: string }) => m.id))
      return { models }
    } catch (err) {
      return { models: [], error: err instanceof Error ? err.message : 'Connection failed' }
    }
  })
}
