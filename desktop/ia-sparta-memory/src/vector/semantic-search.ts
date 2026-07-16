import type { MemoryEntry } from '@/types'
import { searchByQuery } from './chroma-client'

export interface SemanticSearchResult {
  entry: MemoryEntry
  distance: number
}

export async function semanticSearch(
  query: string,
  k = 5,
  minScore = 0.5,
): Promise<SemanticSearchResult[]> {
  const results = await searchByQuery(query, k)

  return results
    .filter((r) => {
      const distance = r.distance ?? 1
      return distance <= 1 - minScore
    })
    .map((r) => ({
      entry: {
        id: r.id,
        content: r.metadata.content as string ?? r.content,
        source: (r.metadata.source as 'manual' | 'auto') ?? 'auto',
        category: (r.metadata.category as string) || undefined,
        projectId: (r.metadata.projectId as string) || undefined,
        sourceSessionId: (r.metadata.sourceSessionId as string) || undefined,
        sourceMessageId: (r.metadata.sourceMessageId as string) || undefined,
        createdAt: (r.metadata.createdAt as number) ?? Date.now(),
      },
      distance: r.distance ?? 1,
    }))
}

export async function buildMemoryContext(
  query: string,
  k = 5,
): Promise<string> {
  const results = await semanticSearch(query, k)
  if (results.length === 0) return ''

  const blocks = results.map((r, i) => {
    const meta = [
      r.entry.category ? `[${r.entry.category}]` : '',
      r.entry.projectId ? `proyecto: ${r.entry.projectId}` : '',
    ].filter(Boolean).join(' ')
    const relevance = r.distance < 0.3 ? '(muy relevante)' : r.distance < 0.6 ? '(relevante)' : '(algo relevante)'
    return `#${i + 1} ${relevance} ${meta}\n${r.entry.content}`
  })

  return `<memoria_relevante>\n${blocks.join('\n\n')}\n</memoria_relevante>`
}
