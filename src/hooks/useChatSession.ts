import { useEffect, useCallback, useRef } from 'react'
import { useChatStore } from '@/stores/chat.store'
import { useProviderStore } from '@/stores/provider.store'
import { useMemoryStore } from '@/stores/memory.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useEventBus } from '@/stores/event-bus.store'
import { extractMemory } from '@/services/memory/extractor'
import { writeExtractedMemory } from '@/services/memory/graph-writer'
import { buildMemoryContext, indexInChroma, ensureVectorReady, tryAutoConfigure } from '@/services/memory'
import { getProviderKey } from '@/lib/vault-helper'
import { aiGateway } from '@/services/ai/gateway'
import { webSearch } from '@/services/tools/web-search/search-provider'
import { useGatewayStore } from '@/stores/gateway.store'
import { useUsageStore } from '@/stores/usage.store'
import type { ToolCall, Provider, ProviderVendor } from '@/types'

interface StreamChunk {
  sessionId: string
  messageId: string
  chunkSeq?: number
  type: 'thinking_token' | 'content_token' | 'tool_call' | 'done' | 'error'
  delta?: string
  toolCall?: ToolCall
  error?: string
  vendor?: ProviderVendor
  httpStatus?: number
  latency?: number
  providerId?: string
}

function getActiveProvider(providers: Provider[], activeModel: string): Provider | null {
  return providers.find((p) => p.defaultModel === activeModel) ?? providers[0] ?? null
}

export function useChatSession() {
  const sessions = useChatStore((s) => s.sessions)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const messagesBySession = useChatStore((s) => s.messagesBySession)
  const messages = activeSessionId ? (messagesBySession[activeSessionId] ?? []) : []
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingBySession = useChatStore((s) => s.streamingBySession)
  const providers = useProviderStore((s) => s.providers)
  const activeIdRef = useRef(activeSessionId)
  activeIdRef.current = activeSessionId

  const createSession = useChatStore((s) => s.createSession)
  const switchSession = useChatStore((s) => s.switchSession)
  const deleteSession = useChatStore((s) => s.deleteSession)
  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const setStreaming = useChatStore((s) => s.setStreaming)
  const appendThinking = useChatStore((s) => s.appendThinking)
  const appendContent = useChatStore((s) => s.appendContent)
  const addToolCall = useChatStore((s) => s.addToolCall)
  const startStreaming = useChatStore((s) => s.startStreaming)
  const stopStreamingFn = useChatStore((s) => s.stopStreaming)

  const lastUserMessageRef = useRef<Map<string, { text: string; userMessageId: string }>>(new Map())

  const sendMessage = useCallback(async (text: string) => {
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
    startStreaming(sid)

    try {
      const freshProviders = useProviderStore.getState().providers
      const session = useChatStore.getState().sessions.find((s) => s.id === sid)
      const activeModel = session?.model || ''
      const provider = getActiveProvider(freshProviders, activeModel)
      if (!provider) {
        stopStreamingFn(sid)
        updateMessage(assistantId, {
          isStreaming: false,
          content: freshProviders.length === 0
            ? 'No hay proveedores configurados. Ve a Configuración > Modelos para agregar uno.'
            : `No se encontró un proveedor activo. Revisa la configuración en Ajustes.`,
        })
        return
      }
      if (!window.sparta?.sendMessage) {
        stopStreamingFn(sid)
        updateMessage(assistantId, {
          isStreaming: false,
          content: 'Error de conexión: esta función requiere la aplicación de escritorio.',
        })
        return
      }
      if (provider.kind === 'cloud' && !provider.apiKey) {
        stopStreamingFn(sid)
        updateMessage(assistantId, {
          isStreaming: false,
          content: `El proveedor "${provider.label}" no tiene API key configurada. Edítalo en Ajustes.`,
        })
        return
      }
      const allMessages = useChatStore.getState().messagesBySession[sid] ?? []
      const msgs = allMessages.map((m) => ({ role: m.role, content: m.content }))
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
      if (webSearchEnabled) {
        try {
          useEventBus.getState().dispatch({
            type: 'tool:called',
            toolName: 'web_search',
            input: { query: text },
            timestamp: Date.now(),
          })
          const results = await webSearch(text, 5)
          if (results.length > 0) {
            webSearchContext =
              'Información obtenida de búsqueda web:\n' +
              results.map((r, i) =>
                `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`
              ).join('\n\n')
            useEventBus.getState().dispatch({
              type: 'tool:result',
              toolName: 'web_search',
              output: webSearchContext,
              durationMs: 0,
              timestamp: Date.now(),
            })
          } else {
            useEventBus.getState().dispatch({
              type: 'tool:result',
              toolName: 'web_search',
              output: 'No se encontraron resultados.',
              durationMs: 0,
              timestamp: Date.now(),
            })
          }
        } catch (err) {
          useEventBus.getState().dispatch({
            type: 'tool:error',
            toolName: 'web_search',
            error: err instanceof Error ? err.message : String(err),
            timestamp: Date.now(),
          })
        }
        if (webSearchContext) {
          system = system
            ? `${system}\n\n${webSearchContext}`
            : webSearchContext
        }
      }

      await window.sparta.sendMessage({
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
      }).catch(() => {
        stopStreamingFn(sid)
        updateMessage(assistantId, {
          isStreaming: false,
          content: 'Error: no se pudo conectar con el proveedor.',
        })
      })
    } catch {
      stopStreamingFn(sid)
      updateMessage(assistantId, {
        isStreaming: false,
        content: 'Error inesperado al enviar el mensaje.',
      })
    }

    return { sessionId: sid, assistantId, userMessageId }
  }, [createSession, addMessage, startStreaming, stopStreamingFn, updateMessage, providers])

  useEffect(() => {
    if (!window.sparta) return
    const unsub = window.sparta.onEvent((event) => {
      const chunk = event as StreamChunk
      switch (chunk.type) {
        case 'thinking_token': {
          appendThinking(chunk.sessionId, chunk.messageId, chunk.delta ?? '', chunk.chunkSeq)
          const store = useChatStore.getState()
          const msg = store.messagesBySession[chunk.sessionId]?.find((m) => m.id === chunk.messageId)
          if (msg && !msg.reasoningStartedAt) {
            store.updateMessage(chunk.messageId, { reasoningStartedAt: Date.now() })
          }
          break
        }
        case 'content_token': {
          appendContent(chunk.sessionId, chunk.messageId, chunk.delta ?? '', chunk.chunkSeq)
          const store = useChatStore.getState()
          const msg = store.messagesBySession[chunk.sessionId]?.find((m) => m.id === chunk.messageId)
          if (msg && msg.reasoningText && !msg.reasoningCompletedAt) {
            store.updateMessage(chunk.messageId, { reasoningCompletedAt: Date.now() })
          }
          break
        }
        case 'tool_call':
          if (chunk.toolCall) {
            addToolCall(chunk.sessionId, chunk.messageId, chunk.toolCall)
          }
          break
        case 'done': {
          updateMessage(chunk.messageId, { isStreaming: false })
          stopStreamingFn(chunk.sessionId)

          if (chunk.vendor && chunk.httpStatus && chunk.providerId) {
            useGatewayStore.getState().addEntry({
              vendor: chunk.vendor,
              providerId: chunk.providerId,
              status: chunk.httpStatus,
              ok: chunk.httpStatus >= 200 && chunk.httpStatus < 300,
              latency: chunk.latency ?? 0,
              timestamp: Date.now(),
            })
          }

          const msg = useChatStore.getState().messagesBySession[chunk.sessionId]
            ?.find((m) => m.id === chunk.messageId)
          const outputLen = msg?.content?.length ?? 0
          const inputLen = lastUserMessageRef.current.get(chunk.sessionId)?.text?.length ?? 0
          if (chunk.providerId && outputLen > 0) {
            useUsageStore.getState().recordTurn(chunk.sessionId, chunk.providerId, Math.ceil(inputLen / 4), Math.ceil(outputLen / 4))
          }

          const pair = lastUserMessageRef.current.get(chunk.sessionId)
          if (pair) {
            const userText = pair.text
            const assistantText = useChatStore.getState().messagesBySession[chunk.sessionId]
              ?.find((m) => m.id === chunk.messageId)?.content ?? ''
            if (userText && assistantText) {
              console.debug('[memory] Starting extraction chain for message:', chunk.messageId.slice(0, 8))
              const providers = useProviderStore.getState().providers
              const session = useChatStore.getState().sessions.find((s) => s.id === chunk.sessionId)
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
                    sessionId: chunk.sessionId,
                    messageId: chunk.messageId,
                    timestamp: Date.now(),
                  })
                  return
                }
                const store = useMemoryStore.getState()
                const beforeCount = store.entries.length
                console.debug('[memory] Calling writeExtractedMemory...')
                writeExtractedMemory(extracted, chunk.sessionId, chunk.messageId, {
                  getEntries: () => store.entries,
                  getRelations: () => store.relations,
                  addEntry: (entry) => {
                    store.addEntry(
                      entry.content, entry.source, entry.category,
                      entry.projectId, entry.sourceSessionId, entry.sourceMessageId
                    )
                  },
                  updateEntry: (id, partial) => store.updateEntry(id, partial),
                  deleteEntry: (id) => store.deleteEntry(id),
                  addRelation: (rel) => store.addRelation(rel),
                  updateRelation: (fromId, toId, partial) => store.updateRelation(fromId, toId, partial),
                })
                console.debug('[memory] Calling rebuildGraph...')
                store.rebuildGraph()
                const afterCount = store.entries.length
                console.debug(`[memory] Done: ${afterCount - beforeCount} new entries, total: ${afterCount}`)

                const enabled = useSettingsStore.getState().semanticMemoryEnabled
                if (enabled) {
                  console.debug('[memory] Indexing in ChromaDB...')
                  const newEntries = store.entries.slice(beforeCount)
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
        case 'error':
          updateMessage(chunk.messageId, {
            isStreaming: false,
            content: chunk.error ? `Error: ${chunk.error}` : 'Error durante la generación',
          })
          stopStreamingFn(chunk.sessionId)

          if (chunk.vendor && chunk.providerId) {
            useGatewayStore.getState().addEntry({
              vendor: chunk.vendor,
              providerId: chunk.providerId,
              status: chunk.httpStatus ?? 0,
              ok: false,
              latency: chunk.latency ?? 0,
              timestamp: Date.now(),
              error: chunk.error ?? 'Error desconocido',
            })
          }

          break
      }
    })
    return unsub
  }, [appendThinking, appendContent, addToolCall, updateMessage, stopStreamingFn])

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
    stopStreaming: (sessionId?: string) => stopStreamingFn(sessionId),
  }
}
