import { webSearch, type SearchResult } from './search-provider'

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
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

export async function executeWebSearch(query: string, count = 5): Promise<string> {
  const results = await webSearch(query, count)
  if (results.length === 0) return 'No se encontraron resultados.'

  return results
    .map((r: SearchResult, i: number) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
    .join('\n\n')
}
