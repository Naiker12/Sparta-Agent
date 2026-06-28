import { useEffect, useCallback, useRef, useState } from 'react'
import { useChatStore } from '@/stores/chat.store'
import { useProviderStore } from '@/stores/provider.store'
import { useMemoryStore } from '@/stores/memory.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useEventBus } from '@/stores/event-bus.store'
import { useMCPStore } from '@/stores/mcp.store'
import { useSkillStore } from '@/stores/skill.store'
import { extractMemory } from '@/services/memory/extractor'
import { writeExtractedMemory } from '@/services/memory/graph-writer'
import { buildMemoryContext, indexInChroma, ensureVectorReady, tryAutoConfigure } from '@/services/memory'
import { getProviderKey } from '@/lib/vault-helper'
import { aiGateway } from '@/services/ai/gateway'
import { webSearch } from '@/services/tools/web-search/search-provider'
import { shouldSearch } from '@/services/tools/web-search/search-heuristic'
import { useUsageStore } from '@/stores/usage.store'
import { messagingAdapter } from '@/lib/messaging-adapter'
import { IS_WEB } from '@/lib/env-adapter'
import type { ToolCall, Provider, SpartaEvent } from '@/types'

function getActiveProvider(providers: Provider[], activeModel: string): Provider | null {
  return providers.find((p) => p.defaultModel === activeModel) ?? providers[0] ?? null
}

async function runAssistantTurn(
  sid: string,
  assistantId: string,
  text: string,
  msgs: Array<{ role: string; content: string }>
) {
  const store = useChatStore.getState()
  store.startStreaming(sid)

  try {
    const freshProviders = useProviderStore.getState().providers
    const session = store.sessions.find((s) => s.id === sid)
    const settingsModel = useSettingsStore.getState().activeModel
    const activeModel = session?.model || settingsModel
    if (session && !session.model && activeModel) {
      store.updateSessionModel(sid, activeModel)
    }
    const provider = getActiveProvider(freshProviders, activeModel)
    if (!provider) {
      store.stopStreaming(sid)
      store.updateMessage(assistantId, {
        isStreaming: false,
        content:
          freshProviders.length === 0
            ? 'No hay proveedores configurados. Ve a Configuración > Modelos para agregar uno.'
            : `No se encontró un proveedor activo. Revisa la configuración en Ajustes.`,
      })
      return
    }
    if (!messagingAdapter.isReady()) {
      store.stopStreaming(sid)
      store.updateMessage(assistantId, {
        isStreaming: false,
        content: IS_WEB
          ? 'Error de conexión: el sidecar web no está disponible. Asegúrate de que el servidor Python esté corriendo.'
          : 'Error de conexión: esta función requiere la aplicación de escritorio.',
      })
      return
    }
    if (provider.kind === 'cloud' && !provider.apiKey && !provider.hasVaultKey) {
      store.stopStreaming(sid)
      store.updateMessage(assistantId, {
        isStreaming: false,
        content: `El proveedor "${provider.label}" no tiene API key configurada. Edítalo en Ajustes.`,
      })
      return
    }

    const apiUrl = provider.serverUrl || undefined
    const providerKey = await getProviderKey(provider)
    const { semanticMemoryEnabled, webSearchEnabled } = useSettingsStore.getState()

    let system: string | undefined
    if (semanticMemoryEnabled) {
      if (!tryAutoConfigure(freshProviders)) {
        useEventBus.getState().dispatch({
          type: 'memory:semantic_search',
          query: text,
          resultsCount: 0,
          injectedContext: '',
          timestamp: Date.now(),
        })
      }
      const ready = await ensureVectorReady()
      if (ready) {
        const context = await buildMemoryContext(text, 5)
        if (context) {
          system = context
          useEventBus.getState().dispatch({
            type: 'memory:semantic_search',
            query: text,
            resultsCount: context.split('\n\n').length,
            injectedContext: context,
            timestamp: Date.now(),
          })
        }
      }
    }

    let webSearchContext: string | undefined
    if (webSearchEnabled && shouldSearch(text)) {
      const searchToolCallId = crypto.randomUUID()
      const searchStartedAt = Date.now()

      store.addToolCall(sid, assistantId, {
        id: searchToolCallId,
        toolName: 'web_search',
        input: { query: text },
        status: 'running',
      })

      try {
        const results = await webSearch(text, 5)
        const durationMs = Date.now() - searchStartedAt

        if (results.length > 0) {
          webSearchContext =
            'Información obtenida de búsqueda web:\n' +
            results.map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`).join('\n\n')
        } else {
          webSearchContext = 'No se encontraron resultados en la búsqueda web.'
        }

        store.updateToolCallStatus(sid, assistantId, searchToolCallId, 'completed', webSearchContext)

        useEventBus.getState().dispatch({
          type: 'tool:result',
          toolName: 'web_search',
          output: webSearchContext,
          durationMs,
          timestamp: Date.now(),
        })
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        store.updateToolCallStatus(sid, assistantId, searchToolCallId, 'error', error)

        if (error.includes('API key') || error.includes('configurada') || error.includes('No hay')) {
          store.stopStreaming(sid)
          store.updateMessage(assistantId, {
            isStreaming: false,
            content:
              '⚠️ La búsqueda web está activada pero no hay API key configurada.\n\nVe a **Ajustes → Búsqueda** y agrega tu Brave Search API key, o desactiva la búsqueda web.',
          })
          return
        }

        webSearchContext = undefined
      }

      if (webSearchContext) {
        system = system ? `${system}\n\n${webSearchContext}` : webSearchContext
      }
    }

    const skills = useSkillStore.getState().activeSkillIds ?? []
    const mcpServers = useMCPStore.getState().servers.map((s: { id: string; name: string; tools?: unknown[] }) => ({
      id: s.id,
      name: s.name,
      tools: s.tools ?? [],
    }))
    const mode = useSettingsStore.getState().sessionMode ?? 'chat'
    const reasoningEnabled = useSettingsStore.getState().reasoningEnabled ?? false
    const reasoningBudget = useSettingsStore.getState().reasoningBudget ?? 8000

    const sendResult = messagingAdapter.sendMessage({
      sessionId: sid,
      messageId: assistantId,
      model: provider.defaultModel ?? '',
      messages: msgs,
      providerKey,
      apiUrl,
      isLocal: provider.kind === 'local',
      system,
      vendor: provider.vendor,
      providerId: provider.id,
      mode,
      skills,
      mcpServers,
      semanticMemory: semanticMemoryEnabled,
      reasoning: { enabled: reasoningEnabled, budget: reasoningBudget },
    })
    const resolved = sendResult instanceof Promise ? await sendResult : null
    if (resolved && !resolved.ok) {
      store.stopStreaming(sid)
      store.updateMessage(assistantId, {
        isStreaming: false,
        content: `Error: ${resolved.error || 'no se pudo enviar el mensaje al sidecar.'}`,
      })
    }
  } catch {
    const store = useChatStore.getState()
    store.stopStreaming(sid)
    store.updateMessage(assistantId, {
      isStreaming: false,
      content: 'Error inesperado al enviar el mensaje.',
    })
  }
}

export function useChatSession() {
  const sessions = useChatStore((s) => s.sessions)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const messagesBySession = useChatStore((s) => s.messagesBySession)
  const messages = activeSessionId ? (messagesBySession[activeSessionId] ?? []) : []
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingBySession = useChatStore((s) => s.streamingBySession)
  const activeIdRef = useRef(activeSessionId)
  activeIdRef.current = activeSessionId

  const createSession = useChatStore((s) => s.createSession)
  const switchSession = useChatStore((s) => s.switchSession)
  const deleteSession = useChatStore((s) => s.deleteSession)
  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const setStreaming = useChatStore((s) => s.setStreaming)
  const appendContent = useChatStore((s) => s.appendContent)
  const addToolCall = useChatStore((s) => s.addToolCall)
  const updateToolCallStatus = useChatStore((s) => s.updateToolCallStatus)
  const stopStreamingFn = useChatStore((s) => s.stopStreaming)

  const lastUserMessageRef = useRef<Map<string, { text: string; userMessageId: string }>>(new Map())
  const [adapterReady, setAdapterReady] = useState(messagingAdapter.isReady())

  const sendMessage = useCallback(
    async (text: string) => {
      const sid = activeIdRef.current ?? createSession()
      const userMessageId = crypto.randomUUID()
      addMessage({
        id: userMessageId,
        role: 'user',
        content: text,
        timestamp: Date.now(),
        sessionId: sid,
      })
      const assistantId = crypto.randomUUID()
      addMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        sessionId: sid,
        isStreaming: true,
      })
      lastUserMessageRef.current.set(sid, { text, userMessageId })

      const allMessages = useChatStore.getState().messagesBySession[sid] ?? []
      const msgs = allMessages.map((m) => ({ role: m.role, content: m.content }))
      await runAssistantTurn(sid, assistantId, text, msgs)

      return { sessionId: sid, assistantId, userMessageId }
    },
    [createSession, addMessage]
  )

  const regenerateMessage = useCallback(
    async (sid: string, assistantMessageId: string) => {
      const store = useChatStore.getState()
      const sessionMessages = store.messagesBySession[sid] ?? []
      const idx = sessionMessages.findIndex((m) => m.id === assistantMessageId)
      const prevUser = sessionMessages.slice(0, idx).reverse().find((m) => m.role === 'user')
      if (!prevUser) return

      store.deleteMessage(sid, assistantMessageId)
      const assistantId = crypto.randomUUID()
      store.addMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        sessionId: sid,
        isStreaming: true,
      })
      lastUserMessageRef.current.set(sid, { text: prevUser.content, userMessageId: prevUser.id })

      const msgs = sessionMessages
        .slice(0, idx)
        .map((m) => ({ role: m.role, content: m.content }))
      await runAssistantTurn(sid, assistantId, prevUser.content, msgs)

      return { sessionId: sid, assistantId }
    },
    []
  )

  useEffect(() => {
    if (adapterReady) return
    return messagingAdapter.onReady?.(() => setAdapterReady(true)) ?? (() => {})
  }, [adapterReady])

  useEffect(() => {
    if (!adapterReady) return
    const unsub = messagingAdapter.onEvent((rawEvent: SpartaEvent) => {
      const event = rawEvent as unknown as Record<string, unknown>
      const { type, sessionId, messageId } = event as { type: string; sessionId: string; messageId: string }
      const sid = sessionId ?? ''
      const mid = messageId ?? ''

      if (!sid || !mid) {
        if (type && !type.startsWith('sidecar') && !type.startsWith('terminal')) {
          console.debug('[useChatSession] Event sin sessionId/messageId, ignorando:', type)
        }
        return
      }

      const store = useChatStore.getState()

      switch (type) {
        case 'thinking:started': {
          console.debug('[useChatSession] thinking:started', sid, mid)
          store.onThinkingStart(sid, mid)
          store.updateMessage(mid, { reasoningStartedAt: Date.now() })
          break
        }
        case 'thinking:token': {
          const thinkToken = (event as { token: string }).token ?? ''
          console.debug('[useChatSession] thinking:token', thinkToken.slice(0, 40))
          store.appendThinking(sid, mid, thinkToken, (event as { chunkSeq?: number }).chunkSeq)
          break
        }
        case 'thinking:completed': {
          console.debug('[useChatSession] thinking:completed', sid, mid)
          const tokensUsed = (event as { tokensUsed: number }).tokensUsed ?? 0
          store.onThinkingEnd(sid, mid, tokensUsed)
          store.updateMessage(mid, { reasoningCompletedAt: Date.now() })
          break
        }
        case 'stream:token': {
          appendContent(sid, mid, (event as { token: string }).token ?? '', (event as { chunkSeq?: number }).chunkSeq)
          break
        }
        case 'stream:completed': {
          const currentMsg = store.messagesBySession[sid]?.find((m) => m.id === mid)
          if (currentMsg?.thinkingStatus === 'streaming' || (currentMsg?.reasoningText && currentMsg?.thinkingStatus !== 'completed')) {
            console.debug('[safety-net] cerrando thinking en stream:completed')
            store.onThinkingEnd(sid, mid, currentMsg?.thinkingTokensUsed ?? 0)
          }
          store.onStreamEnd(sid, mid)
          stopStreamingFn(sid)
          const providerId = (event as { providerId?: string }).providerId
          if (providerId) {
            const outputLen = store.messagesBySession[sid]?.find((m) => m.id === mid)?.content?.length ?? 0
            const inputLen = lastUserMessageRef.current.get(sid)?.text?.length ?? 0
            if (outputLen > 0) {
              useUsageStore.getState().recordTurn(sid, providerId, Math.ceil(inputLen / 4), Math.ceil(outputLen / 4))
            }
          }

          const pair = lastUserMessageRef.current.get(sid)
          if (pair) {
            const userText = pair.text
            const assistantText = store.messagesBySession[sid]?.find((m) => m.id === mid)?.content ?? ''
            if (userText && assistantText) {
              console.debug('[memory] Starting extraction chain for message:', mid.slice(0, 8))
              const providers = useProviderStore.getState().providers
              const session = useChatStore.getState().sessions.find((s) => s.id === sid)
              const extractionProvider = session?.model
                ? providers.find((p) => p.defaultModel === session.model) ?? providers[0] ?? null
                : providers[0] ?? null
              extractMemory(userText, assistantText, async (prompt) => {
                if (!extractionProvider) {
                  console.warn('[memory] No provider available for extraction')
                  return ''
                }
                const parts: string[] = []
                try {
                  const stream = await aiGateway.sendMessage(extractionProvider, [{ role: 'user', content: prompt }], { stream: true })
                  for await (const chunk of stream) {
                    if (chunk.type === 'content_token' && chunk.delta) parts.push(chunk.delta)
                  }
                  const text = parts.join('')
                  console.debug('[memory] Extraction LLM responded, length:', text.length)
                  return text
                } catch (err) {
                  console.error('[memory] Extraction LLM call failed:', (err as Error).message)
                  return ''
                }
              }).then(async (extracted) => {
                console.debug(`[memory] Extracted: ${extracted.entities.length} entities, ${extracted.facts.length} facts, ${extracted.relations.length} relations`)
                if (extracted.entities.length === 0 && extracted.facts.length === 0) {
                  useEventBus.getState().dispatch({
                    type: 'memory:extraction_empty',
                    sessionId: sid,
                    messageId: mid,
                    timestamp: Date.now(),
                  })
                  return
                }
                const mStore = useMemoryStore.getState()
                const beforeCount = mStore.entries.length
                console.debug('[memory] Calling writeExtractedMemory...')
                writeExtractedMemory(extracted, sid, mid, {
                  getEntries: () => mStore.entries,
                  getRelations: () => mStore.relations,
                  addEntry: (entry) => {
                    mStore.addEntry(
                      entry.content, entry.source, entry.category,
                      entry.projectId, entry.sourceSessionId, entry.sourceMessageId
                    )
                  },
                  updateEntry: (id, partial) => mStore.updateEntry(id, partial),
                  deleteEntry: (id) => mStore.deleteEntry(id),
                  addRelation: (rel) => mStore.addRelation(rel),
                  updateRelation: (fromId, toId, partial) => mStore.updateRelation(fromId, toId, partial),
                })
                console.debug('[memory] Calling rebuildGraph...')
                mStore.rebuildGraph()
                const afterCount = mStore.entries.length
                console.debug(`[memory] Done: ${afterCount - beforeCount} new entries, total: ${afterCount}`)
                const enabled = useSettingsStore.getState().semanticMemoryEnabled
                if (enabled) {
                  console.debug('[memory] Indexing in ChromaDB...')
                  const newEntries = mStore.entries.slice(beforeCount)
                  for (const entry of newEntries) {
                    await indexInChroma(entry)
                  }
                  console.debug('[memory] ChromaDB indexing complete')
                }
              })
            }
          }
          break
        }
        case 'stream:aborted': {
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
          store.onStreamEnd(sid, mid)
          stopStreamingFn(sid)
          const errorMsg = (event as { error?: string }).error ?? 'Error durante la generación'
          store.updateMessage(mid, { content: `Error: ${errorMsg}`, isStreaming: false })
          useEventBus.getState().dispatch({
            type: 'stream:error',
            sessionId: sid,
            messageId: mid,
            error: errorMsg,
            timestamp: Date.now(),
          })
          break
        }
        case 'tool:called': {
          const toolCall = (event as { toolCall?: ToolCall }).toolCall
          if (toolCall) addToolCall(sid, mid, toolCall)
          break
        }
        case 'tool:result': {
          const tcId = (event as { toolCallId?: string }).toolCallId ?? ''
          const resultOutput = (event as { output?: string }).output ?? ''
          const tcName = (event as { toolName?: string }).toolName
          updateToolCallStatus(sid, mid, tcId, 'completed', resultOutput, tcName)
          break
        }
        case 'tool:error': {
          const tcIdErr = (event as { toolCallId?: string }).toolCallId ?? ''
          const errorMsg = (event as { error?: string }).error ?? 'Error al ejecutar una herramienta'
          const tcNameErr = (event as { toolName?: string }).toolName
          updateToolCallStatus(sid, mid, tcIdErr, 'error', errorMsg, tcNameErr)
          useEventBus.getState().dispatch({
            type: 'tool:error',
            toolName: tcNameErr ?? '',
            error: errorMsg,
            timestamp: Date.now(),
          })
          break
        }
        case 'sidecar:log': {
          const { level, text } = event as { level?: string; text?: string }
          if (level === 'stderr' && text) {
            console.warn('[sidecar stderr]', text)
          }
          break
        }
        case 'terminal:agent_command': {
          const { command } = event as { command: string }
          if (window.terminal) {
            window.terminal.agentWrite('default', command)
          }
          break
        }
      }
    })
    return () => {
      unsub()
    }
  }, [adapterReady, appendContent, addToolCall, updateMessage, updateToolCallStatus, stopStreamingFn])

  return {
    sessions,
    activeSessionId,
    messages,
    isStreaming,
    streamingBySession,
    createSession,
    switchSession,
    deleteSession,
    addMessage,
    updateMessage,
    setStreaming,
    sendMessage,
    regenerateMessage,
    stopStreaming: (sessionId?: string) => stopStreamingFn(sessionId),
  }
}
