import { useChatStore } from 'ia-sparta-core'
import type { EventHandlerCtx } from './types'

export function handleSearchProgress(ctx: EventHandlerCtx) {
  const store = useChatStore.getState()
  const progressEvent = ctx.event as {
    stage: 'searching' | 'visiting' | 'reading' | 'done'
    url?: string; title?: string; index?: number; total?: number; query?: string
    tool_call_id?: string
  }
  const requestedToolCallId = progressEvent.tool_call_id ?? undefined
  // Progress from a LangChain tool can carry the provider's tool-call id,
  // while on_tool_start exposes the tracing run id. Prefer an exact match,
  // then attach it to the latest running web tool in this message. This keeps
  // the timeline live across both event formats.
  const message = store.messagesBySession[ctx.sid]?.find((item) => item.id === ctx.mid)
  const tcId = message?.toolCalls?.some((tc) => tc.id === requestedToolCallId)
    ? requestedToolCallId
    : [...(message?.toolCalls ?? [])].reverse().find(
        (tc) => tc.status === 'running' && (tc.toolName === 'web_search' || tc.toolName === 'web_search_tool' || tc.toolName === 'web_fetch' || tc.toolName === 'web_fetch_tool'),
      )?.id

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
