import { useChatStore, useUsageStore, useEventBus, usePlanStore, useProviderStore, getVendorLabel } from 'ia-sparta-core'
import { extractMemory } from '../extractor'
import { queueContent, _cancelFlush, _flushBoth } from '../raf-buffer'
import type { EventHandlerCtx } from './types'
import type { MapStore } from '../useStreamEvents'

export function handleStreamToken(ctx: EventHandlerCtx) {
  const token = (ctx.event.token as string) ?? ''
  queueContent(ctx.sid, ctx.mid, token)
}

export function handleStreamCompleted(
  ctx: EventHandlerCtx,
  providerBySession: MapStore<string, string>,
  lastUserMessage: MapStore<string, { text: string; userMessageId: string }>,
) {
  _cancelFlush()
  _flushBoth()
  usePlanStore.getState().clear()

  const store = useChatStore.getState()
  const currentMsg = store.messagesBySession[ctx.sid]?.find((m) => m.id === ctx.mid)
  if (currentMsg?.thinkingStatus === 'streaming' || (currentMsg?.reasoningText && currentMsg?.thinkingStatus !== 'completed')) {
    console.debug('[safety-net] cerrando thinking en stream:completed')
    store.onThinkingEnd(ctx.sid, ctx.mid, currentMsg?.thinkingTokensUsed ?? 0)
  }

  const suggestions = ctx.event.suggestions as string[] | undefined
  if (suggestions && suggestions.length > 0) {
    store.updateMessage(ctx.mid, { suggestions })
  }

  store.deduplicateReasoningFromContent(ctx.sid, ctx.mid)
  store.onStreamEnd(ctx.sid, ctx.mid)
  store.stopStreaming(ctx.sid)

  const pid = providerBySession.get(ctx.sid)
  const pair = lastUserMessage.get(ctx.sid)
  if (pid && pair?.text) {
    const outputLen = store.messagesBySession[ctx.sid]?.find((m) => m.id === ctx.mid)?.content?.length ?? 0
    if (outputLen > 0) {
      const provider = useProviderStore.getState().providers.find((item) => item.id === pid)
      const providerLabel = provider ? (provider.label || getVendorLabel(provider.vendor)) : undefined
      useUsageStore.getState().recordTurn(ctx.sid, pid, Math.ceil(pair.text.length / 4), Math.ceil(outputLen / 4), providerLabel)
    }
  }

  if (pair?.text && currentMsg?.content) {
    extractMemory(pair.text, currentMsg.content, ctx.sid, ctx.mid)
      .catch((err) => console.error('[memory:extractor] Background extraction failed:', err))
  }

  providerBySession.delete(ctx.sid)

  const pending = store.consumePendingInjections()
  if (pending.length > 0) {
    const text = pending.join('\n')
    console.debug('[useStreamEvents] Enviando mensaje encolado:', text.slice(0, 40))
    useEventBus.getState().dispatch({
      type: 'chat:send_queued',
      text,
      sessionId: ctx.sid,
      timestamp: Date.now(),
    })
  }
}

export function handleStreamAborted(
  ctx: EventHandlerCtx,
  providerBySession: MapStore<string, string>,
  lastUserMessage: MapStore<string, { text: string; userMessageId: string }>,
) {
  _cancelFlush()
  _flushBoth()

  const store = useChatStore.getState()
  const abortedMsg = store.messagesBySession[ctx.sid]?.find((m) => m.id === ctx.mid)
  if (abortedMsg?.thinkingStatus === 'streaming' || (abortedMsg?.reasoningText && abortedMsg?.thinkingStatus !== 'completed')) {
    console.debug('[safety-net] cerrando thinking en stream:aborted')
    store.onThinkingEnd(ctx.sid, ctx.mid, abortedMsg?.thinkingTokensUsed ?? 0)
  }

  store.onStreamEnd(ctx.sid, ctx.mid)
  store.stopStreaming(ctx.sid)
  providerBySession.delete(ctx.sid)
  lastUserMessage.delete(ctx.sid)
}

export function handleStreamCancelled(
  ctx: EventHandlerCtx,
  providerBySession: MapStore<string, string>,
  lastUserMessage: MapStore<string, { text: string; userMessageId: string }>,
) {
  _cancelFlush()
  _flushBoth()

  const store = useChatStore.getState()
  const msg = store.messagesBySession[ctx.sid]?.find((m) => m.id === ctx.mid)
  if (msg?.thinkingStatus === 'streaming' || (msg?.reasoningText && msg?.thinkingStatus !== 'completed')) {
    console.debug('[safety-net] cerrando thinking en stream:cancelled')
    store.onThinkingEnd(ctx.sid, ctx.mid, msg?.thinkingTokensUsed ?? 0)
  }

  store.onStreamEnd(ctx.sid, ctx.mid)
  store.stopStreaming(ctx.sid)
  providerBySession.delete(ctx.sid)
  lastUserMessage.delete(ctx.sid)
}

export function handleStreamNotice(ctx: EventHandlerCtx) {
  const noticeMsg = (ctx.event.message as string) ?? ''
  useChatStore.getState().setThinkingStatusText(ctx.sid, ctx.mid, noticeMsg)
  console.debug('[useStreamEvents] stream:notice:', noticeMsg)
}

export function handleStreamError(
  ctx: EventHandlerCtx,
  providerBySession: MapStore<string, string>,
  lastUserMessage: MapStore<string, { text: string; userMessageId: string }>,
) {
  _cancelFlush()
  _flushBoth()

  const store = useChatStore.getState()
  store.onStreamEnd(ctx.sid, ctx.mid)
  store.stopStreaming(ctx.sid)

  const errorMsg = (ctx.event.error as string) ?? 'Error durante la generación'
  store.updateMessage(ctx.mid, (msg) => ({
    content: msg.content ? `${msg.content}\n\n> **Error:** ${errorMsg}` : `Error: ${errorMsg}`,
    isStreaming: false,
  }))

  useEventBus.getState().dispatch({
    type: 'stream:error',
    sessionId: ctx.sid, messageId: ctx.mid, error: errorMsg, timestamp: Date.now(),
  })

  providerBySession.delete(ctx.sid)
  lastUserMessage.delete(ctx.sid)
}
