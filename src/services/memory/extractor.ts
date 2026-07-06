import { useProviderStore } from '@/stores/provider.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useSessionStore } from '@/stores/session.store'
import { useMemoryStore } from '@/stores/memory.store'
import { createProvider } from '@/services/ai'
import { writeExtractedMemory } from './graph-writer'
import type { ExtractedMemory, MemoryEntry, MemoryRelation } from '@/types'

const SYSTEM_PROMPT = `Eres un extractor de conocimiento experto. Tu tarea es analizar el último intercambio de mensajes en un chat y extraer entidades importantes, hechos clave y las relaciones entre ellos.

Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:
{
  "entities": [
    { "name": "Nombre de la entidad (ej: Node.js, Juan, Frontend)", "category": "technology | person | concept" }
  ],
  "facts": [
    { "content": "Un hecho concreto y conciso (ej: Juan trabaja usando Node.js)", "aboutEntity": "Nombre de la entidad a la que se refiere este hecho" }
  ],
  "relations": [
    { "from": "Entidad origen", "to": "Entidad destino", "type": "uses | works_at | created_by | is_a", "weight": 0.8 }
  ]
}

Responde ÚNICAMENTE con el JSON crudo. No incluyas marcas de bloque de código de markdown (como \`\`\`json) ni texto explicativo. Si no hay información relevante, devuelve {"entities":[], "facts":[], "relations":[]}.`

export async function extractMemory(
  userText: string,
  assistantText: string,
  sessionId: string,
  messageId: string
): Promise<void> {
  try {
    const providers = useProviderStore.getState().providers
    const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
    const settingsModel = useSettingsStore.getState().activeModel
    const activeModel = session?.model || settingsModel

    // Encontrar el proveedor para el modelo activo
    const provider = providers.find((p) => p.defaultModel === activeModel || p.models?.includes(activeModel)) ?? providers[0]
    if (!provider) {
      console.warn('[memory:extractor] No active provider found for memory extraction.')
      return
    }

    const ai = createProvider(provider)
    const chunks = ai.streamChat({
      model: activeModel,
      messages: [
        { role: 'user', content: `Mensajes a analizar:\nUsuario: ${userText}\nAsistente: ${assistantText}` }
      ],
      system: SYSTEM_PROMPT,
      temperature: 0.1,
    })

    let text = ''
    for await (const chunk of chunks) {
      if (chunk.type === 'content_token') {
        text += chunk.delta
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error)
      }
    }

    // Limpiar posibles bloques de código de markdown que el modelo haya puesto
    const cleanedText = text.replace(/```json\s*|```/g, '').trim()
    if (!cleanedText) return

    const extracted = JSON.parse(cleanedText) as ExtractedMemory
    if (!extracted.entities && !extracted.facts && !extracted.relations) {
      console.debug('[memory:extractor] LLM returned invalid or empty memory structure.')
      return
    }

    // Asegurar estructura
    extracted.entities = extracted.entities || []
    extracted.facts = extracted.facts || []
    extracted.relations = extracted.relations || []

    const addedEntries: MemoryEntry[] = []

    const store = useMemoryStore.getState()
    const deps = {
      getEntries: () => store.entries,
      getRelations: () => store.relations,
      addEntry: (entry: MemoryEntry) => {
        addedEntries.push(entry)
        useMemoryStore.setState((s) => ({ entries: [...s.entries, entry] }))
      },
      updateEntry: (id: string, partial: Partial<MemoryEntry>) => {
        store.updateEntry(id, partial)
      },
      deleteEntry: (id: string) => {
        store.deleteEntry(id)
      },
      addRelation: (rel: MemoryRelation) => {
        store.addRelation(rel)
      },
      updateRelation: (fromId: string, toId: string, partial: Partial<MemoryRelation>) => {
        store.updateRelation(fromId, toId, partial)
      },
    }

    // Escribir en el almacén local del grafo
    writeExtractedMemory(extracted, sessionId, messageId, deps)

    // Reconstruir el grafo en el frontend
    if (addedEntries.length > 0) {
      store.rebuildGraph()
      console.debug(`[memory:extractor] Graph updated with ${addedEntries.length} new entries.`)
    }

    // Indexar en ChromaDB de forma asíncrona si está activo
    if (addedEntries.length > 0) {
      import('./index').then(({ isVectorEnabled, indexInChroma }) => {
        if (isVectorEnabled()) {
          Promise.all(addedEntries.map(entry => indexInChroma(entry)))
            .then(() => console.debug('[memory:extractor] Indexed new entries in ChromaDB'))
            .catch((err) => console.error('[memory:extractor] ChromaDB indexing failed:', err))
        }
      }).catch(() => {})
    }

  } catch (err) {
    console.error('[memory:extractor] Failed to extract memory:', err)
  }
}
