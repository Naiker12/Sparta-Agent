import { useChatStore } from 'ia-sparta-core'
import type { EventHandlerCtx } from './types'

export function handleSearchProgress(ctx: EventHandlerCtx) {
  const store = useChatStore.getState()
  const progressEvent = ctx.event as {
    stage: 'searching' | 'visiting' | 'reading' | 'done'
    url?: string; title?: string; index?: number; total?: number; query?: string
    tool_call_id?: string
  }
  const tcId = progressEvent.tool_call_id ?? undefined

  if (progressEvent.stage === 'searching' && progressEvent.query) {
    if (tcId) {
      store.updateMessage(ctx.mid, (msg) => ({
        toolCalls: (msg.toolCalls ?? []).map((tc) =>
          tc.id === tcId ? { ...tc, searchQuery: progressEvent.query } : tc
        ),
      }))
    } else {
      store.updateMessage(ctx.mid, { searchQuery: progressEvent.query } as Partial<import('ia-sparta-core').Message>)
    }
  }

  store.updateSearchProgress(ctx.sid, ctx.mid, (items) => {
    if (progressEvent.stage === 'searching') {
      if (items.length > 0) return items
      return []
    }
    if (progressEvent.stage === 'visiting' && progressEvent.url) {
      const existing = items.find((i) => i.url === progressEvent.url)
      if (existing) return items
      return [
        ...items,
        { id: crypto.randomUUID(), url: progressEvent.url, title: progressEvent.title || progressEvent.url, status: 'pending' as const },
      ]
    }
    if (progressEvent.stage === 'reading' && progressEvent.url) {
      const existing = items.find((i) => i.url === progressEvent.url)
      if (existing) {
        return items.map((i) =>
          i.url === progressEvent.url ? { ...i, status: 'reading' as const } : i,
        )
      }
      return [
        ...items,
        { id: crypto.randomUUID(), url: progressEvent.url, title: progressEvent.title || `Leyendo ${progressEvent.url}`, status: 'reading' as const },
      ]
    }
    if (progressEvent.stage === 'done') return items.map((i) => ({ ...i, status: 'visited' as const }))
    return items
  }, tcId)
}
