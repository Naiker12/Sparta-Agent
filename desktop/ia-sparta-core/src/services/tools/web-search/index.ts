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

const SEARCH_HEADERS: Record<string, string>[] = [
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://html.duckduckgo.com',
    'Referer': 'https://html.duckduckgo.com/',
    'Dnt': '1',
    'Cache-Control': 'max-age=0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  },
  {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://html.duckduckgo.com',
    'Referer': 'https://html.duckduckgo.com/',
    'Dnt': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
  },
  {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9,es;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://html.duckduckgo.com',
    'Referer': 'https://html.duckduckgo.com/',
    'Dnt': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Upgrade-Insecure-Requests': '1',
  },
]

function pickHeaders(): Record<string, string> {
  return SEARCH_HEADERS[Math.floor(Math.random() * SEARCH_HEADERS.length)]
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

function isCaptchaBlocked(html: string): boolean {
  const lower = html.toLowerCase()
  return lower.includes('captcha') || lower.includes('challenge') || lower.includes('verify you are human')
}

async function duckduckgoSearch(query: string): Promise<string> {
  const headers = pickHeaders()
  const signal = AbortSignal.timeout(20_000)
  const resp = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers,
    body: `q=${encodeURIComponent(query)}`,
    signal,
  })
  if (!resp.ok) throw new Error(`DuckDuckGo error HTTP ${resp.status}`)
  const html = await resp.text()

  if (isCaptchaBlocked(html)) {
    throw new Error('CAPTCHA')
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

  if (results.length === 0 && !html.includes('result__a')) {
    throw new Error('NoResults')
  }

  return results
    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
    .join('\n\n')
}

async function fallbackSearch(query: string): Promise<string> {
  const signal = AbortSignal.timeout(15_000)
  const resp = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal,
  })
  if (!resp.ok) throw new Error(`DuckDuckGo Lite error HTTP ${resp.status}`)
  const html = await resp.text()

  if (isCaptchaBlocked(html)) {
    return ''
  }

  const results: SearchResult[] = []
  const linkPattern = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>(.*?)<\/a>/g
  const snippetPattern = /<td[^>]*class="result-snippet"[^>]*>(.*?)<\/td>/g

  const linkMatches: string[] = []
  const titleMatches: string[] = []
  let lm: RegExpExecArray | null
  while ((lm = linkPattern.exec(html)) !== null) {
    if (!lm[1].includes('duckduckgo.com')) {
      linkMatches.push(lm[1])
      titleMatches.push(lm[2].replace(/<[^>]+>/g, '').trim())
    }
  }

  let si = 0
  let sm: RegExpExecArray | null
  while ((sm = snippetPattern.exec(html)) !== null) {
    const snip = sm[1].replace(/<[^>]+>/g, '').trim()
    if (si < linkMatches.length) {
      results.push({
        title: titleMatches[si] || `Resultado ${si + 1}`,
        url: linkMatches[si],
        snippet: snip,
      })
      si++
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
    } catch {
      // Fall through if URL parsing fails
    }
  }
  return url
}

async function wikipediaSearch(query: string): Promise<string> {
  const signal = AbortSignal.timeout(10_000)
  const url = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`
  const resp = await fetch(url, { signal })
  if (!resp.ok) return ''
  const data = await resp.json()
  const searchResults = data?.query?.search || []
  if (searchResults.length === 0) return ''

  return searchResults
    .slice(0, 5)
    .map((r: { title: string; pageid: number; snippet: string }, i: number) => {
      const cleanSnippet = r.snippet.replace(/<[^>]+>/g, '').trim()
      return `${i + 1}. ${r.title}\n   URL: https://es.wikipedia.org/wiki?curid=${r.pageid}\n   ${cleanSnippet}`
    })
    .join('\n\n')
}

export async function executeWebSearch(query: string, count = 5): Promise<string> {
  const engines = [duckduckgoSearch, fallbackSearch, wikipediaSearch]

  for (const engine of engines) {
    try {
      const results = await engine(query)
      if (results) {
        const limited = results.split('\n\n').slice(0, count).join('\n\n')
        return ['Información obtenida de búsqueda web:', limited].join('\n')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message === 'CAPTCHA' || message === 'NoResults') {
        continue
      }
      if (/aborted/i.test(message) || /timeout/i.test(message)) {
        continue
      }
      throw err
    }
  }

  return 'No se encontraron resultados en la búsqueda web. Puede que el servicio de búsqueda esté temporalmente bloqueado.'
}
