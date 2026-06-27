import { ipcMain } from 'electron'
import { getKey } from '../vault'

/**
 * @deprecated La búsqueda web se delega al sidecar Python via tool web_search.
 * Mantenido temporalmente para compatibilidad con flujos que aún usan search:web.
 * Eliminar cuando se migre completamente al Python sidecar.
 */

interface SearchResult {
  title: string
  url: string
  snippet: string
}

export function registerSearchIPC() {
  ipcMain.handle('search:web', async (_event, query: string, count = 5): Promise<SearchResult[]> => {
    console.warn('[search:web] DEPRECATED - use Python sidecar web_search tool instead')
    const apiKey = getKey('brave-search')
    if (!apiKey) {
      throw new Error('No hay API key de Brave Search configurada. Ve a Configuración > Búsqueda para agregar una.')
    }

    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
      {
        headers: {
          'X-Subscription-Token': apiKey,
          Accept: 'application/json',
        },
      },
    )

    if (!res.ok) {
      throw new Error(`Brave Search error ${res.status}: ${res.statusText}`)
    }

    const data = await res.json()
    return (data.web?.results ?? []).map((r: any) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }))
  })
}
