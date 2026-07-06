/**
 * extractor.ts
 *
 * Extracción de memoria DETERMINISTA — sin llamada extra al LLM.
 *
 * Algoritmo:
 * 1. Tokeniza el par (userText, assistantText)
 * 2. Extrae entidades por heurística: tokens capitalizados, palabras técnicas
 *    conocidas, patrones comunes (versiones, comandos, URLs, nombres propios)
 * 3. Detecta hechos a partir de patrones lingüísticos simples
 * 4. Guarda en el store con deduplicación (graph-writer)
 *
 * Ventajas vs extractor LLM:
 * - Cero tokens extra gastados
 * - Funciona en Electron sin permisos de red adicionales
 * - Funciona offline
 * - Latencia ~0ms (síncrono)
 */

import { useSettingsStore } from '@/stores/settings.store'
import { useMemoryStore } from '@/stores/memory.store'
import { writeExtractedMemory } from './graph-writer'
import type { ExtractedMemory, MemoryEntry, MemoryRelation } from '@/types'

// ── Categorías técnicas conocidas ─────────────────────────────────────────────

const TECH_KEYWORDS: Record<string, string> = {
  // lenguajes
  javascript: 'technology', typescript: 'technology', python: 'technology',
  rust: 'technology', go: 'technology', java: 'technology', kotlin: 'technology',
  swift: 'technology', php: 'technology', ruby: 'technology', 'c++': 'technology',
  'c#': 'technology', dart: 'technology', scala: 'technology', elixir: 'technology',
  // frameworks / libs
  react: 'technology', vue: 'technology', angular: 'technology', svelte: 'technology',
  nextjs: 'technology', 'next.js': 'technology', nuxt: 'technology',
  vite: 'technology', webpack: 'technology', esbuild: 'technology',
  express: 'technology', fastapi: 'technology', django: 'technology',
  flask: 'technology', laravel: 'technology', rails: 'technology',
  tailwind: 'technology', tailwindcss: 'technology', shadcn: 'technology',
  prisma: 'technology', drizzle: 'technology', 'framer-motion': 'technology',
  zustand: 'technology', redux: 'technology', tanstack: 'technology',
  langchain: 'technology', langgraph: 'technology',
  // bases de datos
  postgresql: 'technology', postgres: 'technology', mysql: 'technology',
  sqlite: 'technology', mongodb: 'technology', redis: 'technology',
  supabase: 'technology', firebase: 'technology', chroma: 'technology',
  // herramientas / infra
  docker: 'technology', kubernetes: 'technology', git: 'technology',
  github: 'technology', gitlab: 'technology', npm: 'technology',
  pnpm: 'technology', yarn: 'technology', bun: 'technology',
  electron: 'technology', vscode: 'technology', linux: 'technology',
  windows: 'technology', macos: 'technology',
  // AI / modelos
  openai: 'technology', anthropic: 'technology', claude: 'technology',
  gpt: 'technology', llama: 'technology', mistral: 'technology',
  ollama: 'technology', groq: 'technology', gemini: 'technology',
}

// ── Tokenización ──────────────────────────────────────────────────────────────

function sentences(text: string): string[] {
  return text.split(/[.!?\n]+/).map((s) => s.trim()).filter((s) => s.length > 10)
}

function words(text: string): string[] {
  return text.split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9+#.\-_]/g, ''))
}

// ── Extracción de entidades ───────────────────────────────────────────────────

interface RawEntity { name: string; category: string }

function extractEntities(text: string): RawEntity[] {
  const found = new Map<string, string>()

  const ws = words(text)
  for (const w of ws) {
    if (!w) continue
    const lower = w.toLowerCase()

    // Coincidencia con keywords técnicos
    if (TECH_KEYWORDS[lower]) {
      found.set(lower, TECH_KEYWORDS[lower])
      continue
    }

    // Palabra capitalizada de ≥4 chars que no es inicio de oración (posible nombre propio)
    if (w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase() && w.length >= 4) {
      if (!found.has(lower)) {
        found.set(w, 'concept')
      }
    }

    // Versiones: Node.js v18, Python 3.11, etc.
    if (/^v?\d+\.\d+(\.\d+)?$/.test(w)) {
      const idx = ws.indexOf(w)
      if (idx > 0) {
        const prev = ws[idx - 1].replace(/[^a-zA-Z0-9]/g, '')
        if (prev.length > 1) {
          found.set(`${prev} ${w}`, 'technology')
        }
      }
    }
  }

  return Array.from(found.entries()).map(([name, category]) => ({ name, category }))
}

// ── Extracción de hechos ──────────────────────────────────────────────────────

// Patrones que indican un hecho relevante
const FACT_PATTERNS = [
  /\busando\s+(.{3,40})/i,
  /\busa\s+(.{3,40})/i,
  /\busa\b.*\bpara\b/i,
  /\bpreferencia\b.*\b(es|son)\b/i,
  /\bmi\s+(proyecto|app|aplicaci[oó]n|sistema|trabajo)\b/i,
  /\bel\s+(proyecto|sistema|app)\s+se\s+llama\b/i,
  /\btrabaj[ao]\s+(en|con)\b/i,
  /\bme\s+(llamo|llaman|nombre)\b/i,
  /\bsoy\s+(un|una|el|la)?\s*\w+/i,
  /\bmi\s+(nombre|stack|lenguaje|framework)\b/i,
  /\bpreferimos\b/i,
  /\bqueremos\b.*\bimplementar\b/i,
  /\bla\s+arquitectura\b/i,
  /\bestamos\s+(construyendo|desarrollando|usando)\b/i,
  // inglés
  /\busing\s+(.{3,40})/i,
  /\bbuilt\s+with\b/i,
  /\bbuilt\s+in\b/i,
  /\bprefer\s+(.{3,30})/i,
  /\bmy\s+(project|app|name|stack)\b/i,
  /\bwe\s+(use|prefer|are\s+building)\b/i,
]

function extractFacts(text: string, entities: RawEntity[]): Array<{ content: string; aboutEntity?: string }> {
  const facts: Array<{ content: string; aboutEntity?: string }> = []
  const entityNames = new Set(entities.map((e) => e.name.toLowerCase()))
  void entityNames // used for future filtering

  for (const sent of sentences(text)) {
    if (sent.length < 15 || sent.length > 200) continue

    const matchesPattern = FACT_PATTERNS.some((p) => p.test(sent))
    if (!matchesPattern) continue

    // Buscar entidad relacionada en la oración
    let aboutEntity: string | undefined
    for (const entity of entities) {
      if (sent.toLowerCase().includes(entity.name.toLowerCase())) {
        aboutEntity = entity.name
        break
      }
    }

    // Evitar duplicar si ya hay un fact muy parecido
    const normalized = sent.toLowerCase().slice(0, 80)
    const alreadyHave = facts.some((f) => {
      const d = levenshteinRatio(f.content.toLowerCase().slice(0, 80), normalized)
      return d > 0.8
    })
    if (!alreadyHave) {
      facts.push({ content: sent, aboutEntity })
    }
  }

  return facts
}

// Ratio de similitud Levenshtein simplificado
function levenshteinRatio(a: string, b: string): number {
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  if (longer.length === 0) return 1
  let matches = 0
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++
  }
  return matches / longer.length
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function extractMemory(
  userText: string,
  assistantText: string,
  sessionId: string,
  messageId: string
): Promise<void> {
  // Respetar el flag de memoria
  if (!useSettingsStore.getState().memoryEnabled) return

  // No extraer si el intercambio es muy corto
  const combined = `${userText} ${assistantText}`.trim()
  if (combined.length < 60) return

  try {
    // Analizar ambos textos — el usuario suele proveer más contexto personal
    const allEntities = [
      ...extractEntities(userText),
      ...extractEntities(assistantText),
    ]

    // Deduplicar entidades por nombre (case-insensitive)
    const entityMap = new Map<string, RawEntity>()
    for (const e of allEntities) {
      const key = e.name.toLowerCase()
      if (!entityMap.has(key)) entityMap.set(key, e)
    }
    const entities = Array.from(entityMap.values())

    // Extraer hechos principalmente del texto del usuario (más personal/contextual)
    const facts = extractFacts(userText, entities)

    // Si no hay nada relevante, salir sin tocar el store
    if (entities.length === 0 && facts.length === 0) return

    const extracted: ExtractedMemory = {
      entities,
      facts,
      relations: [],
    }

    console.debug(
      `[memory:extractor] extracted ${entities.length} entities, ${facts.length} facts from turn`
    )

    const store = useMemoryStore.getState()
    const addedEntries: MemoryEntry[] = []

    const deps = {
      getEntries: () => useMemoryStore.getState().entries,
      getRelations: () => useMemoryStore.getState().relations,
      addEntry: (entry: MemoryEntry) => {
        addedEntries.push(entry)
        useMemoryStore.setState((s) => ({ entries: [...s.entries, entry] }))
      },
      updateEntry: (id: string, partial: Partial<MemoryEntry>) => {
        useMemoryStore.getState().updateEntry(id, partial)
      },
      deleteEntry: (id: string) => {
        useMemoryStore.getState().deleteEntry(id)
      },
      addRelation: (rel: MemoryRelation) => {
        useMemoryStore.getState().addRelation(rel)
      },
      updateRelation: (fromId: string, toId: string, partial: Partial<MemoryRelation>) => {
        useMemoryStore.getState().updateRelation(fromId, toId, partial)
      },
    }

    writeExtractedMemory(extracted, sessionId, messageId, deps)

    if (addedEntries.length > 0) {
      store.rebuildGraph()
      console.debug(`[memory:extractor] Store updated: +${addedEntries.length} new entries`)
    }

    // Indexar en ChromaDB si está disponible (no bloquea)
    if (addedEntries.length > 0) {
      import('./index').then(({ isVectorEnabled, indexInChroma }) => {
        if (isVectorEnabled()) {
          void Promise.all(addedEntries.map((entry) => indexInChroma(entry)))
        }
      }).catch(() => {})
    }

  } catch (err) {
    console.error('[memory:extractor] Failed:', err)
  }
}
