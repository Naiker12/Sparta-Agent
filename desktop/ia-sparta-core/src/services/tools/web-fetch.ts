export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export function buildWebFetchTool(): ToolDefinition {
  return {
    name: 'web_fetch',
    description: 'Obtiene el contenido de una URL y lo convierte a texto plano. Usar cuando se necesite leer el contenido completo de una página web específica.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL completa a obtener (incluir http:// o https://)' },
      },
      required: ['url'],
    },
  }
}

const STEALTH_HEADERS: Record<string, string>[] = [
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Dnt': '1',
    'Cache-Control': 'max-age=0',
  },
  {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Dnt': '1',
    'Cache-Control': 'max-age=0',
  },
  {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9,es;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Linux"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Dnt': '1',
  },
]

function pickHeaders(): Record<string, string> {
  return STEALTH_HEADERS[Math.floor(Math.random() * STEALTH_HEADERS.length)]
}

function htmlToText(html: string): string {
  let text = html
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
  text = text.replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
  text = text.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')

  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<\/div>/gi, '\n')
  text = text.replace(/<\/li>/gi, '\n')
  text = text.replace(/<\/h[1-6]>/gi, '\n\n')
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n')

  text = text.replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
  text = text.replace(/<[^>]+>/g, '')

  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#x27;/g, "'")
  text = text.replace(/&#39;/g, "'")
  text = text.replace(/&nbsp;/g, ' ')

  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/^[ \t]+/gm, '')

  return text.trim()
}

export async function executeWebFetch(url: string): Promise<string> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `Error: la URL debe comenzar con http:// o https://. URL recibida: "${url}"`
  }

  try {
    new URL(url)
  } catch {
    return `Error: URL inválida: "${url}"`
  }

  const headers = pickHeaders()
  const signal = AbortSignal.timeout(20_000)

  try {
    const resp = await fetch(url, { headers, signal, redirect: 'follow' })

    if (resp.status === 403 || resp.status === 401) {
      const body = await resp.text().catch(() => '')
      if (body.toLowerCase().includes('captcha') || body.toLowerCase().includes('challenge')) {
        return `Error: El sitio bloqueó el acceso con CAPTCHA o challenge de seguridad (HTTP ${resp.status}).`
      }
      return `Error: Acceso denegado (HTTP ${resp.status}). El sitio puede requerir autenticación.`
    }

    if (resp.status === 429) {
      return 'Error: El sitio respondió con rate limiting (HTTP 429). Espera unos segundos e intenta de nuevo.'
    }

    if (!resp.ok) {
      return `Error HTTP ${resp.status} al obtener ${url}`
    }

    const contentType = resp.headers.get('content-type') || ''
    const isHtml = contentType.includes('text/html') || contentType.includes('text/plain') || !contentType.includes('application/')
    const body = await resp.text()

    if (!body) {
      return `La página ${url} no contiene contenido visible.`
    }

    if (isHtml) {
      const text = htmlToText(body)
      const maxLen = 15000
      const truncated = text.length > maxLen ? text.slice(0, maxLen) + `\n\n... [truncado: ${text.length - maxLen} caracteres restantes]` : text
      return truncated || `La página ${url} no contiene texto visible después de extraer el contenido.`
    }

    const maxLen = 10000
    const truncated = body.length > maxLen ? body.slice(0, maxLen) + `\n\n... [truncado: ${body.length - maxLen} caracteres restantes]` : body
    return truncated
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/aborted/i.test(message) || /timeout/i.test(message)) {
      return `Error: La página ${url} tardó demasiado en responder (timeout de 20s).`
    }
    if (/fetch/i.test(message) || /network/i.test(message) || /enotfound/i.test(message) || /econnrefused/i.test(message)) {
      return `Error: No se pudo conectar con ${url}. Verifica que la URL sea correcta y el sitio esté accesible.`
    }
    return `Error al obtener ${url}: ${message}`
  }
}
