import { useEffect, useState } from 'react'
import { useChatStore } from '@/stores/chat.store'
import { useUsageStore } from '@/stores/usage.store'
import { useEventBus } from '@/stores/event-bus.store'
import { useAgentStore } from '@/stores/agent.store'
import { messagingAdapter } from '@/lib/messaging-adapter'
import { extractMemory } from '@/services'
import type { SpartaEvent } from '@/types'

const SUBAGENT_TOOL_MAP: Record<string, { name: string; type: 'research' | 'coding' | 'automation' | 'project'; description: string }> = {
  research_topic: {
    name: 'Investigador Delegado',
    type: 'research',
    description: 'Búsqueda de información y consolidación en vivo.',
  },
  execute_code_task: {
    name: 'Programador Delegado',
    type: 'coding',
    description: 'Análisis y generación de código en tiempo real.',
  },
  recall_memories: {
    name: 'Asistente de Memoria',
    type: 'automation',
    description: 'Recuperación de conocimientos de la memoria semántica.',
  },
}

const _providerBySession = new Map<string, string>()
const lastUserMessageRef = new Map<string, { text: string; userMessageId: string }>()

// ── Singleton listener ──────────────────────────────────────────────
// Only ONE WebSocket handler is ever registered, no matter how many
// components call useStreamEvents(). This prevents token duplication.
let _singletonUnsub: (() => void) | null = null
let _refCount = 0

function _attachSingleton() {
  _refCount++
  if (_singletonUnsub) return          // already attached
  _singletonUnsub = messagingAdapter.onEvent(_handleEvent)
  console.debug('[useStreamEvents] Singleton listener attached')
}

function _detachSingleton() {
  _refCount = Math.max(0, _refCount - 1)
  if (_refCount === 0 && _singletonUnsub) {
    _singletonUnsub()
    _singletonUnsub = null
    console.debug('[useStreamEvents] Singleton listener detached')
  }
}

// ── Buffering ───────────────────────────────────────────────────────
const tokenBuf: { sid: string; mid: string; tokens: string[] } = { sid: '', mid: '', tokens: [] }
let tokenTimer: ReturnType<typeof setTimeout> | null = null

const thinkBuf: { sid: string; mid: string; tokens: string[] } = { sid: '', mid: '', tokens: [] }
let thinkTimer: ReturnType<typeof setTimeout> | null = null

function flushTokenBuffer() {
  const { sid, mid, tokens } = tokenBuf
  if (tokens.length === 0) return
  useChatStore.getState().appendContent(sid, mid, tokens.join(''))
  tokenBuf.tokens = []
}

function flushThinkBuffer() {
  const { sid, mid, tokens } = thinkBuf
  if (tokens.length === 0) return
  useChatStore.getState().appendThinking(sid, mid, tokens.join(''))
  thinkBuf.tokens = []
}

// ── MCP lifecycle handler ───────────────────────────────────────────
function _handleMCPEvent(type: string, event: Record<string, unknown>) {
  // Import lazily to avoid circular deps at module load time
  const { useMCPStore } = require('@/stores/mcp.store') as typeof import('@/stores/mcp.store')
  const store = useMCPStore.getState()
  const serverId = (event.serverId ?? '') as string

  if (type === 'mcp:connected') {
    store.setConnected(serverId, true)
    console.debug('[MCP] connected:', serverId, 'tools:', event.toolCount)
  } else if (type === 'mcp:tool_discovered') {
    const tools = (event.tools ?? []) as Array<{ name: string; description: string; inputSchema: unknown }>
    // Reset tools list then repopulate with discovered tools
    store.setServerTools(serverId, tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      serverId,
    })))
    console.debug('[MCP] tools discovered:', serverId, tools.map((t) => t.name))
  } else if (type === 'mcp:error') {
    store.setConnected(serverId, false)
    console.warn('[MCP] connection error:', serverId, event.error)
  }
}

// ── Central event handler (single instance) ─────────────────────────
function _handleEvent(rawEvent: SpartaEvent) {
  const event = rawEvent as unknown as Record<string, unknown>
  const { type, sessionId, messageId } = event as { type: string; sessionId: string; messageId: string }
  const sid = sessionId ?? ''
  const mid = messageId ?? ''

  // ── MCP lifecycle events (no sessionId/messageId) ───────────────────
  if (type === 'mcp:connected' || type === 'mcp:tool_discovered' || type === 'mcp:error') {
    _handleMCPEvent(type, event)
    return
  }

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
      if (thinkBuf.sid !== sid || thinkBuf.mid !== mid) {
        flushThinkBuffer()
        thinkBuf.sid = sid
        thinkBuf.mid = mid
      }
      thinkBuf.tokens.push(thinkToken)
      if (thinkTimer) clearTimeout(thinkTimer)
      thinkTimer = setTimeout(() => {
        thinkTimer = null
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
      if (thinkBuf.sid !== sid || thinkBuf.mid !== mid) {
        flushThinkBuffer()
        thinkBuf.sid = sid
        thinkBuf.mid = mid
      }
      thinkBuf.tokens.push(reasonToken)
      if (thinkTimer) clearTimeout(thinkTimer)
      thinkTimer = setTimeout(() => {
        thinkTimer = null
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
        url?: string; title?: string; index?: number; total?: number; query?: string
      }
      if (progressEvent.stage === 'searching' && progressEvent.query) {
        store.updateMessage(mid, { searchQuery: progressEvent.query })
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
      if (tokenBuf.sid !== sid || tokenBuf.mid !== mid) {
        flushTokenBuffer()
        tokenBuf.sid = sid
        tokenBuf.mid = mid
      }
      tokenBuf.tokens.push(token)
      if (tokenTimer) clearTimeout(tokenTimer)
      tokenTimer = setTimeout(() => {
        tokenTimer = null
        flushTokenBuffer()
      }, 16)
      break
    }
    case 'stream:completed': {
      flushTokenBuffer()
      flushThinkBuffer()
      // Leer el mensaje DESPUÉS del flush para tener el contenido completo
      const currentMsg = store.messagesBySession[sid]?.find((m) => m.id === mid)
      if (currentMsg?.thinkingStatus === 'streaming' || (currentMsg?.reasoningText && currentMsg?.thinkingStatus !== 'completed')) {
        console.debug('[safety-net] cerrando thinking en stream:completed')
        store.onThinkingEnd(sid, mid, currentMsg?.thinkingTokensUsed ?? 0)
      }
      store.deduplicateReasoningFromContent(sid, mid)
      store.onStreamEnd(sid, mid)
      store.stopStreaming(sid)
      const pid = _providerBySession.get(sid)
      const pair = lastUserMessageRef.get(sid)
      if (pid && pair?.text) {
        const outputLen = store.messagesBySession[sid]?.find((m) => m.id === mid)?.content?.length ?? 0
        if (outputLen > 0) {
          useUsageStore.getState().recordTurn(sid, pid, Math.ceil(pair.text.length / 4), Math.ceil(outputLen / 4))
        }
      }
      // Extracción automática de memoria en segundo plano
      if (pair?.text && currentMsg?.content) {
        extractMemory(pair.text, currentMsg.content, sid, mid)
          .catch((err) => console.error('[memory:extractor] Background extraction failed:', err))
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
      store.stopStreaming(sid)
      break
    }
    case 'stream:error': {
      flushTokenBuffer()
      flushThinkBuffer()
      store.onStreamEnd(sid, mid)
      store.stopStreaming(sid)
      const errorMsg = (event as { error?: string }).error ?? 'Error durante la generación'
      store.updateMessage(mid, { content: `Error: ${errorMsg}`, isStreaming: false })
      useEventBus.getState().dispatch({
        type: 'stream:error',
        sessionId: sid, messageId: mid, error: errorMsg, timestamp: Date.now(),
      })
      break
    }
    case 'tool:called': {
      const evt = event as Record<string, unknown>
      const name = (evt.name ?? evt.toolName ?? '') as string
      const toolInput = evt.input
      const id = (evt.toolCallId ?? evt.tool_call_id ?? evt.id ?? '') as string

      if (name && id) {
        store.addToolCall(sid, mid, {
          id,
          toolName: name,
          input: toolInput,
          status: 'running',
        })

        // Conectar con useAgentStore si es un subagente delegado
        const subagentMeta = SUBAGENT_TOOL_MAP[name]
        if (subagentMeta) {
          const agentStore = useAgentStore.getState()
          const existing = agentStore.agents.find((a) => a.id === id)
          if (!existing) {
            agentStore.registerAgent({
              id,
              name: subagentMeta.name,
              type: subagentMeta.type,
              status: 'running',
              model: 'Subagente',
              createdAt: Date.now(),
              tools: name === 'research_topic' ? ['web_search'] : [],
              description: subagentMeta.description,
            })
          } else {
            agentStore.updateAgentStatus(id, 'running')
          }

          let taskDesc = 'Ejecutando tarea paralela'
          if (toolInput && typeof toolInput === 'object') {
            const inputObj = toolInput as Record<string, unknown>
            if (inputObj.topic) taskDesc = `Investigar: ${inputObj.topic}`
            else if (inputObj.task) taskDesc = `Desarrollar: ${inputObj.task}`
            else if (inputObj.query) taskDesc = `Buscar: ${inputObj.query}`
          }

          agentStore.addTask(id, {
            id,
            agentId: id,
            description: taskDesc,
            status: 'running',
            createdAt: Date.now(),
            steps: [
              {
                id: `${id}-step1`,
                name: name === 'research_topic' ? 'Buscando información' : 'Ejecutando análisis',
                status: 'running',
              }
            ]
          })
        }
      }
      break
    }
    case 'tool:result': {
      const evt = event as Record<string, unknown>
      const tcId = (evt.toolCallId ?? evt.tool_call_id ?? evt.id ?? '') as string
      const resultOutput = (evt.output ?? '') as string
      const tcName = evt.toolName as string | undefined

      store.updateToolCallStatus(sid, mid, tcId, 'completed', resultOutput, tcName)
      if (tcName === 'web_search') {
        store.updateSearchProgress(sid, mid, (items) =>
          items.map((i) => ({ ...i, status: 'visited' as const }))
        )
      }

      // Si es un subagente delegado, marcar como completado
      if (tcName && SUBAGENT_TOOL_MAP[tcName] && tcId) {
        const agentStore = useAgentStore.getState()
        agentStore.updateAgentStatus(tcId, 'completed')
        agentStore.updateTask(tcId, tcId, {
          status: 'completed',
          completedAt: Date.now(),
          steps: [
            {
              id: `${tcId}-step1`,
              name: 'Tarea completada exitosamente',
              status: 'completed',
            }
          ]
        })
      }
      break
    }
    case 'tool:error': {
      const evtErr = event as Record<string, unknown>
      const tcIdErr = (evtErr.toolCallId ?? evtErr.tool_call_id ?? evtErr.id ?? '') as string
      const errorMsg = (evtErr.error ?? 'Error al ejecutar una herramienta') as string
      const tcNameErr = evtErr.toolName as string | undefined

      store.updateToolCallStatus(sid, mid, tcIdErr, 'error', errorMsg, tcNameErr)
      useEventBus.getState().dispatch({
        type: 'tool:error', toolName: tcNameErr ?? '', error: errorMsg, timestamp: Date.now(),
      })

      // Si es un subagente delegado, marcar como error
      if (tcNameErr && SUBAGENT_TOOL_MAP[tcNameErr] && tcIdErr) {
        const agentStore = useAgentStore.getState()
        agentStore.updateAgentStatus(tcIdErr, 'error')
        agentStore.updateTask(tcIdErr, tcIdErr, {
          status: 'error',
          steps: [
            {
              id: `${tcIdErr}-step1`,
              name: 'Error en la ejecución',
              status: 'error',
              error: errorMsg,
            }
          ]
        })
      }
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
}

// ── Hook público ────────────────────────────────────────────────────
export function useStreamEvents() {
  const [adapterReady, setAdapterReady] = useState(messagingAdapter.isReady())

  useEffect(() => {
    if (adapterReady) return
    return messagingAdapter.onReady?.(() => setAdapterReady(true)) ?? (() => {})
  }, [adapterReady])

  useEffect(() => {
    if (!adapterReady) return
    _attachSingleton()
    return () => { _detachSingleton() }
  }, [adapterReady])

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
