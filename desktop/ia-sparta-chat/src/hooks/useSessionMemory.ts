import { useCallback } from 'react'
import { useSettingsStore } from 'ia-sparta-core'
import { useMemoryStore } from 'ia-sparta-core'
import { useEventBus } from 'ia-sparta-core'
import { buildMemoryContext, ensureVectorReady, tryAutoConfigure } from 'ia-sparta-core'
import { buildLocalMemoryContext } from 'ia-sparta-core'
import type { Provider } from 'ia-sparta-core'

export function useSessionMemory() {
  const dispatch = useEventBus((s) => s.dispatch)

  const buildMemorySystemPrompt = useCallback(async (
    text: string,
    providers: Provider[]
  ): Promise<string | undefined> => {
    const { memoryEnabled, semanticMemoryEnabled } = useSettingsStore.getState()

    // Si la memoria está completamente desactivada, salir
    if (!memoryEnabled) return undefined

    const entries = useMemoryStore.getState().entries
    if (entries.length === 0) return undefined

    // ── Ruta 1: búsqueda semántica con ChromaDB (requiere flag + servidor) ──
    if (semanticMemoryEnabled) {
      tryAutoConfigure(providers)
      const ready = await ensureVectorReady()

      if (ready) {
        const context = await buildMemoryContext(text, 6)
        if (context) {
          dispatch({
            type: 'memory:semantic_search',
            query: text,
            resultsCount: context.split('\n\n').length,
            injectedContext: context,
            timestamp: Date.now(),
          })
          return context
        }
      } else {
        dispatch({
          type: 'memory:unavailable',
          query: text,
          timestamp: Date.now(),
        })
        // Caer al fallback local en vez de retornar undefined
      }
    }

    // ── Ruta 2: búsqueda local TF-IDF sobre Zustand (siempre disponible) ───
    // Se usa cuando: memoria habilitada + (semántica desactivada O ChromaDB no disponible)
    const context = buildLocalMemoryContext(text, entries, 6)
    if (context) {
      dispatch({
        type: 'memory:semantic_search',
        query: text,
        resultsCount: context.split('\n\n').length - 2, // descontar tags XML
        injectedContext: context,
        timestamp: Date.now(),
      })
      return context
    }

    return undefined
  }, [dispatch])

  return { buildMemorySystemPrompt }
}
