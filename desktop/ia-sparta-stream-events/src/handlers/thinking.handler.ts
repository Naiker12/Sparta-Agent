import { useChatStore } from 'ia-sparta-core'
import { queueThinking, _cancelFlush, _flushBoth } from '../raf-buffer'
import type { EventHandlerCtx } from './types'

export function handleThinkingStarted(ctx: EventHandlerCtx) {
  const store = useChatStore.getState()
  store.onThinkingStart(ctx.sid, ctx.mid)
  store.updateMessage(ctx.mid, { reasoningStartedAt: Date.now() })
}

export function handleThinkingToken(ctx: EventHandlerCtx) {
  const token = (ctx.event.token as string) ?? ''
  const store = useChatStore.getState()
  const currentMsg = store.messagesBySession[ctx.sid]?.find((m) => m.id === ctx.mid)
  if (currentMsg?.thinkingStatus === 'completed') {
    console.warn('[useStreamEvents] thinking:token ignorado, thinking ya completó')
    return
  }
  queueThinking(ctx.sid, ctx.mid, token)
}

export function handleThinkingCompleted(ctx: EventHandlerCtx) {
  _cancelFlush()
  _flushBoth()
  const tokensUsed = (ctx.event.tokensUsed as number) ?? 0
  const store = useChatStore.getState()
  store.onThinkingEnd(ctx.sid, ctx.mid, tokensUsed)
  store.updateMessage(ctx.mid, { reasoningCompletedAt: Date.now() })
}

export function handleThinkingStatus(ctx: EventHandlerCtx) {
  const statusText = ctx.event.text as string | undefined
  if (statusText) {
    useChatStore.getState().setThinkingStatusText(ctx.sid, ctx.mid, statusText)
  }
}

export function handleReasoningToken(ctx: EventHandlerCtx) {
  const token = (ctx.event.token as string) ?? ''
  const store = useChatStore.getState()
  const currentMsg = store.messagesBySession[ctx.sid]?.find((m) => m.id === ctx.mid)
  if (currentMsg?.thinkingStatus === 'completed') return
  queueThinking(ctx.sid, ctx.mid, token)
}

export function handleReasoningAvailable(ctx: EventHandlerCtx) {
  const reasoningText = (ctx.event.text as string) ?? ''
  console.debug('[useStreamEvents] reasoning:available', ctx.sid, ctx.mid)
  useChatStore.getState().onReasoningAvailable(ctx.sid, ctx.mid, reasoningText)
}
