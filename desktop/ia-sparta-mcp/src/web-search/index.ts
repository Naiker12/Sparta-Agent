export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export function buildWebSearchTool(): ToolDefinition {
  return {
    name: 'web_search',
    description: 'Busca información actual en internet. Usar cuando la pregunta requiera datos recientes o que no estén en el conocimiento del modelo.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Términos de búsqueda' },
        count: { type: 'number', description: 'Cantidad de resultados (máx 10)' },
      },
      required: ['query'],
    },
  }
}

async function duckduckgoSearch(query: string): Promise<string> {
  const resp = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (compatible; SpartaAgent/1.0)',
    },
    body: `q=${encodeURIComponent(query)}`,
  })
  if (!resp.ok) throw new Error(`DuckDuckGo error HTTP ${resp.status}`)
  const html = await resp.text()

  if (html.toLowerCase().includes('captcha') || html.toLowerCase().includes('challenge')) {
    throw new Error('DuckDuckGo returned a CAPTCHA challenge')
  }

  const results: SearchResult[] = []
  const linkPattern = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g
  const snippetPattern = /<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/g

  const urls: string[] = []
  const titles: string[] = []
  let m: RegExpExecArray | null
  while ((m = linkPattern.exec(html)) !== null) {
    urls.push(resolveDdgUrl(m[1]))
    titles.push(m[2].replace(/<[^>]+>/g, '').trim())
  }
  while ((m = snippetPattern.exec(html)) !== null) {
    const snip = m[1].replace(/<[^>]+>/g, '').trim()
    if (results.length < titles.length) {
      results.push({
        title: titles[results.length],
        url: urls[results.length],
        snippet: snip,
      })
    }
  }

  return results
    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
    .join('\n\n')
}

function resolveDdgUrl(url: string): string {
  if (url.includes('duckduckgo.com/l/') && url.includes('uddg=')) {
    try {
      const parsed = new URL(url)
      const uddg = parsed.searchParams.get('uddg')
      if (uddg) return decodeURIComponent(uddg)
    } catch { /* not a valid URL, return as-is */ }
  }
  return url
}

export async function executeWebSearch(query: string, count = 5): Promise<string> {
  const results = await duckduckgoSearch(query)
  if (!results) return 'No se encontraron resultados en la búsqueda web.'
  const limited = results.split('\n\n').slice(0, count).join('\n\n')
  return ['Información obtenida de búsqueda web:', limited].join('\n')
}
