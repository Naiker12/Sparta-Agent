/**
 * local-search.ts
 * Búsqueda de recuerdos sobre el store de Zustand sin depender de ChromaDB ni embeddings.
 * Usa TF-IDF simplificado + tokenización básica para encontrar recuerdos relevantes.
 */

import type { MemoryEntry } from '../../types'

// ── Tokenización ──────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'a', 'en', 'y', 'o', 'que', 'es', 'son',
  'con', 'por', 'para', 'como', 'se', 'su', 'sus', 'me', 'te',
  'le', 'nos', 'lo', 'mi', 'tu', 'no', 'si', 'pero', 'más',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'of', 'in', 'to', 'and', 'or', 'for', 'with', 'on', 'at',
  'by', 'it', 'its', 'this', 'that', 'from', 'as', 'not',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-záéíóúñüa-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
}

// ── TF (term frequency normalizada) ──────────────────────────────────────────

function termFreq(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1)
  const max = Math.max(...freq.values(), 1)
  for (const [k, v] of freq) freq.set(k, v / max)
  return freq
}

// ── Similitud entre query y entrada ─────────────────────────────────────────

function scorEntry(queryTokens: string[], entryContent: string): number {
  if (queryTokens.length === 0) return 0
  const entryTokens = tokenize(entryContent)
  const entryFreq = termFreq(entryTokens)

  let score = 0
  let matches = 0

  for (const qt of queryTokens) {
    // Coincidencia exacta
    if (entryFreq.has(qt)) {
      score += 1 + entryFreq.get(qt)!
      matches++
      continue
    }
    // Coincidencia parcial (prefijo o substring)
    for (const et of entryTokens) {
      if (et.startsWith(qt) || qt.startsWith(et)) {
        score += 0.5
        matches++
        break
      }
    }
  }

  // Normalizar por longitud de query para no favorecer queries largas
  return matches > 0 ? score / queryTokens.length : 0
}

// ── API pública ───────────────────────────────────────────────────────────────

export interface LocalSearchResult {
  entry: MemoryEntry
  score: number
}

/**
 * Busca los recuerdos más relevantes para una query usando solo el store local.
 * No requiere ChromaDB ni embeddings. Funciona completamente offline.
 */
export function localSearch(
  query: string,
  entries: MemoryEntry[],
  k = 6,
  minScore = 0.15,
): LocalSearchResult[] {
  if (entries.length === 0 || !query.trim()) return []

  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return []

  const scored = entries
    .map((entry) => ({ entry, score: scorEntry(queryTokens, entry.content) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)

  return scored
}

/**
 * Construye el bloque de contexto de memoria para inyectar en el system prompt.
 * Usa búsqueda local, sin depender de ChromaDB.
 */
export function buildLocalMemoryContext(
  query: string,
  entries: MemoryEntry[],
  k = 6,
): string {
  const results = localSearch(query, entries, k)
  if (results.length === 0) return ''

  const blocks = results.map((r, i) => {
    const meta = r.entry.category ? `[${r.entry.category}]` : ''
    const relevance = r.score > 0.7 ? '(alta relevancia)' : r.score > 0.35 ? '(relevante)' : ''
    return `#${i + 1} ${relevance} ${meta}\n${r.entry.content}`.trim()
  })

  return `<memoria_relevante>\n${blocks.join('\n\n')}\n</memoria_relevante>`
}
