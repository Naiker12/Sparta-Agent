import { useCallback } from 'react'
import { useSettingsStore } from '@/stores/settings.store'
import { useEventBus } from '@/stores/event-bus.store'
import { buildMemoryContext, ensureVectorReady, tryAutoConfigure } from '@/services/memory'
import type { Provider } from '@/types'

export function useSessionMemory() {
  const dispatch = useEventBus((s) => s.dispatch)

  const buildMemorySystemPrompt = useCallback(async (
    text: string,
    providers: Provider[]
  ): Promise<string | undefined> => {
    const { semanticMemoryEnabled } = useSettingsStore.getState()
    if (!semanticMemoryEnabled) return undefined

    if (!tryAutoConfigure(providers)) {
      dispatch({
        type: 'memory:semantic_search',
        query: text,
        resultsCount: 0,
        injectedContext: '',
        timestamp: Date.now(),
      })
    }

    const ready = await ensureVectorReady()
    if (!ready) {
      dispatch({
        type: 'memory:unavailable',
        query: text,
        timestamp: Date.now(),
      })
      return undefined
    }

    const context = await buildMemoryContext(text, 5)
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

    return undefined
  }, [dispatch])

  return { buildMemorySystemPrompt }
}
