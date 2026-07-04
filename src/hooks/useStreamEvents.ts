import { useEffect, useState } from 'react'
import { useChatStore } from '@/stores/chat.store'
import { useUsageStore } from '@/stores/usage.store'
import { useEventBus } from '@/stores/event-bus.store'
import { messagingAdapter } from '@/lib/messaging-adapter'
import type { SpartaEvent, ToolCall } from '@/types'

const _providerBySession = new Map<string, string>()
const lastUserMessageRef = new Map<string, { text: string; userMessageId: string }>()
export function useStreamEvents() {
  const appendContent = useChatStore((s) => s.appendContent)
  const addToolCall = useChatStore((s) => s.addToolCall)
  const updateToolCallStatus = useChatStore((s) => s.updateToolCallStatus)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const stopStreamingFn = useChatStore((s) => s.stopStreaming)
  const [adapterReady, setAdapterReady] = useState(messagingAdapter.isReady())

  useEffect(() => {
    if (adapterReady) return
    return messagingAdapter.onReady?.(() => setAdapterReady(true)) ?? (() => {})
  }, [adapterReady])

  useEffect(() => {
    if (!adapterReady) return

    const tokenBufferRef: { sid: string; mid: string; tokens: string[] } = {
      sid: '', mid: '', tokens: [],
    }
    let flushTimerRef: ReturnType<typeof setTimeout> | null = null

    const thinkBufferRef: { sid: string; mid: string; tokens: string[] } = {
      sid: '', mid: '', tokens: [],
    }
    let thinkFlushTimerRef: ReturnType<typeof setTimeout> | null = null

    function flushTokenBuffer() {
      const { sid, mid, tokens } = tokenBufferRef
      if (tokens.length === 0) return
      appendContent(sid, mid, tokens.join(''))
      tokenBufferRef.tokens = []
    }

    function flushThinkBuffer() {
      const { sid, mid, tokens } = thinkBufferRef
      if (tokens.length === 0) return
      const store = useChatStore.getState()
      store.appendThinking(sid, mid, tokens.join(''))
      thinkBufferRef.tokens = []
    }

    const unsub = messagingAdapter.onEvent((rawEvent: SpartaEvent) => {
      const event = rawEvent as unknown as Record<string, unknown>
      const { type, sessionId, messageId } = event as { type: string; sessionId: string; messageId: string }
      const sid = sessionId ?? ''
      const mid = messageId ?? ''

      if (!sid || !mid) {
        if (type && !type.startsWith('sidecar') && !type.startsWith('terminal')) {
          console.debug('[useStreamEvents] Event sin sessionId/messageId, ignorando:', type)
        }
        return
      }

      const store = useChatStore.getState()

      switch (type) {
        case 'thinking:started': {
          console.debug('[useStreamEvents] thinking:started', sid, mid)
          store.onThinkingStart(sid, mid)
          store.updateMessage(mid, { reasoningStartedAt: Date.now() })
          break
        }
        case 'thinking:token': {
          const thinkToken = (event as { token: string }).token ?? ''
          const currentMsg = store.messagesBySession[sid]?.find((m) => m.id === mid)
          if (currentMsg?.thinkingStatus === 'completed') {
            console.warn('[useStreamEvents] thinking:token ignorado, thinking ya completó')
            break
          }
          if (thinkBufferRef.sid !== sid || thinkBufferRef.mid !== mid) {
            flushThinkBuffer()
            thinkBufferRef.sid = sid
            thinkBufferRef.mid = mid
          }
          thinkBufferRef.tokens.push(thinkToken)
          if (thinkFlushTimerRef) clearTimeout(thinkFlushTimerRef)
          thinkFlushTimerRef = setTimeout(() => {
            thinkFlushTimerRef = null
            flushThinkBuffer()
          }, 16)
          break
        }
        case 'thinking:completed': {
          console.debug('[useStreamEvents] thinking:completed', sid, mid)
          flushThinkBuffer()
          const tokensUsed = (event as { tokensUsed: number }).tokensUsed ?? 0
          store.onThinkingEnd(sid, mid, tokensUsed)
          store.updateMessage(mid, { reasoningCompletedAt: Date.now() })
          break
        }
        case 'thinking:status': {
          break
        }
        case 'reasoning:token': {
          const reasonToken = (event as { token: string }).token ?? ''
          const currentMsg = store.messagesBySession[sid]?.find((m) => m.id === mid)
          if (currentMsg?.thinkingStatus === 'completed') break
          if (thinkBufferRef.sid !== sid || thinkBufferRef.mid !== mid) {
            flushThinkBuffer()
            thinkBufferRef.sid = sid
            thinkBufferRef.mid = mid
          }
          thinkBufferRef.tokens.push(reasonToken)
          if (thinkFlushTimerRef) clearTimeout(thinkFlushTimerRef)
          thinkFlushTimerRef = setTimeout(() => {
            thinkFlushTimerRef = null
            flushThinkBuffer()
          }, 16)
          break
        }
        case 'reasoning:available': {
          const reasoningText = (event as { text: string }).text ?? ''
          console.debug('[useStreamEvents] reasoning:available', sid, mid)
          store.onReasoningAvailable(sid, mid, reasoningText)
          break
        }
        case 'search:progress': {
          const progressEvent = event as {
            stage: 'searching' | 'visiting' | 'done'
            url?: string; title?: string; index?: number; total?: number
          }
          store.updateSearchProgress(sid, mid, (items) => {
            if (progressEvent.stage === 'searching') return []
            if (progressEvent.stage === 'visiting' && progressEvent.url) {
              const existing = items.find((i) => i.url === progressEvent.url)
              if (existing) return items
              return [
                ...items,
                { id: crypto.randomUUID(), url: progressEvent.url, title: progressEvent.title || progressEvent.url, status: 'pending' as const },
              ]
            }
            if (progressEvent.stage === 'done') return items.map((i) => ({ ...i, status: 'visited' as const }))
            return items
          })
          break
        }
        case 'stream:token': {
          const token = (event as { token: string }).token ?? ''
          if (tokenBufferRef.sid !== sid || tokenBufferRef.mid !== mid) {
            flushTokenBuffer()
            tokenBufferRef.sid = sid
            tokenBufferRef.mid = mid
          }
          tokenBufferRef.tokens.push(token)
          if (flushTimerRef) clearTimeout(flushTimerRef)
          flushTimerRef = setTimeout(() => {
            flushTimerRef = null
            flushTokenBuffer()
          }, 16)
          break
        }
        case 'stream:completed': {
          flushTokenBuffer()
          flushThinkBuffer()
          const currentMsg = store.messagesBySession[sid]?.find((m) => m.id === mid)
          if (currentMsg?.thinkingStatus === 'streaming' || (currentMsg?.reasoningText && currentMsg?.thinkingStatus !== 'completed')) {
            console.debug('[safety-net] cerrando thinking en stream:completed')
            store.onThinkingEnd(sid, mid, currentMsg?.thinkingTokensUsed ?? 0)
          }
          store.deduplicateReasoningFromContent(sid, mid)
          store.onStreamEnd(sid, mid)
          stopStreamingFn(sid)
          const pid = _providerBySession.get(sid)
          const pair = lastUserMessageRef.get(sid)
          if (pid && pair?.text) {
            const outputLen = store.messagesBySession[sid]?.find((m) => m.id === mid)?.content?.length ?? 0
            if (outputLen > 0) {
              useUsageStore.getState().recordTurn(sid, pid, Math.ceil(pair.text.length / 4), Math.ceil(outputLen / 4))
            }
          }
          _providerBySession.delete(sid)
          const pending = store.consumePendingInjections()
          if (pending.length > 0) {
            const text = pending.join('\n')
            console.debug('[useStreamEvents] Enviando mensaje encolado:', text.slice(0, 40))
            useEventBus.getState().dispatch({
              type: 'chat:send_queued',
              text,
              sessionId: sid,
              timestamp: Date.now(),
            })
          }
          break
        }
        case 'stream:aborted': {
          flushTokenBuffer()
          flushThinkBuffer()
          const abortedMsg = store.messagesBySession[sid]?.find((m) => m.id === mid)
          if (abortedMsg?.thinkingStatus === 'streaming' || (abortedMsg?.reasoningText && abortedMsg?.thinkingStatus !== 'completed')) {
            console.debug('[safety-net] cerrando thinking en stream:aborted')
            store.onThinkingEnd(sid, mid, abortedMsg?.thinkingTokensUsed ?? 0)
          }
          store.onStreamEnd(sid, mid)
          stopStreamingFn(sid)
          break
        }
        case 'stream:error': {
          flushTokenBuffer()
          flushThinkBuffer()
          store.onStreamEnd(sid, mid)
          stopStreamingFn(sid)
          const errorMsg = (event as { error?: string }).error ?? 'Error durante la generación'
          store.updateMessage(mid, { content: `Error: ${errorMsg}`, isStreaming: false })
          useEventBus.getState().dispatch({
            type: 'stream:error',
            sessionId: sid, messageId: mid, error: errorMsg, timestamp: Date.now(),
          })
          break
        }
        case 'tool:called': {
          const toolCall = (event as { toolCall?: ToolCall }).toolCall
          if (toolCall) addToolCall(sid, mid, toolCall)
          break
        }
        case 'tool:result': {
          const evt = event as Record<string, unknown>
          const tcId = (evt.toolCallId ?? evt.tool_call_id ?? evt.id ?? '') as string
          const resultOutput = (evt.output ?? '') as string
          const tcName = evt.toolName as string | undefined
          updateToolCallStatus(sid, mid, tcId, 'completed', resultOutput, tcName)
          if (tcName === 'web_search') {
            store.updateSearchProgress(sid, mid, (items) =>
              items.map((i) => ({ ...i, status: 'visited' as const }))
            )
          }
          break
        }
        case 'tool:error': {
          const evtErr = event as Record<string, unknown>
          const tcIdErr = (evtErr.toolCallId ?? evtErr.tool_call_id ?? evtErr.id ?? '') as string
          const errorMsg = (evtErr.error ?? 'Error al ejecutar una herramienta') as string
          const tcNameErr = evtErr.toolName as string | undefined
          updateToolCallStatus(sid, mid, tcIdErr, 'error', errorMsg, tcNameErr)
          useEventBus.getState().dispatch({
            type: 'tool:error', toolName: tcNameErr ?? '', error: errorMsg, timestamp: Date.now(),
          })
          break
        }
        case 'skill:activated': {
          const skillEvt = event as Record<string, string>
          const skillId = skillEvt.skillId ?? ''
          const skillName = skillEvt.skillName ?? ''
          const skillIcon = skillEvt.skillIcon ?? '\ud83d\udce6'
          const skillCategory = skillEvt.skillCategory ?? ''
          console.debug('[skill:activated]', skillId, skillName)
          store.updateMessage(mid, (msg) => ({
            pipelineSteps: [
              ...(msg.pipelineSteps ?? []),
              { id: `skill-${skillId}-${Date.now()}`, name: `${skillIcon} ${skillName}`, status: 'running' as const, timestamp: Date.now(), meta: skillCategory },
            ],
          }))
          useEventBus.getState().dispatch({
            type: 'skill:activated' as const, skillId, skillName, skillIcon, skillCategory, sessionId: sid, messageId: mid, timestamp: Date.now(),
          })
          break
        }
        case 'skill:completed': {
          const compEvt = event as Record<string, string>
          const compId = compEvt.skillId ?? ''
          store.updateMessage(mid, (msg) => ({
            pipelineSteps: (msg.pipelineSteps ?? []).map((step) =>
              step.id?.startsWith(`skill-${compId}`)
                ? { ...step, status: 'completed' as const, durationMs: Date.now() - step.timestamp }
                : step
            ),
          }))
          break
        }
        case 'sidecar:log': {
          const { level, text } = event as { level?: string; text?: string }
          if (level === 'stderr' && text) console.warn('[sidecar stderr]', text)
          break
        }
        case 'terminal:agent_command': {
          const { command } = event as { command: string }
          if (window.terminal) {
            window.terminal.agentWrite('default', command).then((res) => {
              if (res.needsConfirmation) {
                if (window.confirm(`El agente quiere ejecutar:\n\n${command}\n\n¿Permitir?`)) {
                  window.terminal.agentWriteForce('default', command)
                }
              }
            })
          }
          break
        }
        case 'terminal:agent_spawn': {
          const { procId, command } = event as { procId: string; command: string }
          if (procId && command && window.terminal) {
            void window.terminal.agentSpawn(procId, command)
          }
          break
        }
      }
    })
    return () => { unsub() }
  }, [adapterReady, appendContent, addToolCall, updateMessage, updateToolCallStatus, stopStreamingFn])

  return {
    adapterReady,
    setProviderForSession: (sessionId: string, providerId: string) => {
      _providerBySession.set(sessionId, providerId)
    },
    setLastUserMessage: (sessionId: string, text: string, userMessageId: string) => {
      lastUserMessageRef.set(sessionId, { text, userMessageId })
    },
  }
}
