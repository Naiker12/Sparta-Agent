export interface SearchResult {
  title: string
  url: string
  snippet: string
}

async function getBraveSearchKeyWeb(): Promise<string | null> {
  const key = localStorage.getItem('sparta-key-brave-search')
  if (key) return key
  return null
}

async function getBraveSearchKeyElectron(): Promise<string | null> {
  if (window.vault) {
    try {
      const key = await window.vault.getKey('brave-search')
      if (key) return key
    } catch {}
  }
  return null
}

export async function webSearch(query: string, count = 5): Promise<SearchResult[]> {
  if (window.electron?.invoke) {
    return await window.electron.invoke('search:web', query, count) as SearchResult[]
  }

  const apiKey = await getBraveSearchKey()
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
}

async function getBraveSearchKey(): Promise<string | null> {
  if (window.vault) {
    return getBraveSearchKeyElectron()
  }
  return getBraveSearchKeyWeb()
}
