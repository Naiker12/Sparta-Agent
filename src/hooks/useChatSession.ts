import { useEffect, useCallback, useRef } from 'react'
import { useChatStore } from '@/stores/chat.store'
import { useProviderStore } from '@/stores/provider.store'
import { useMemoryStore } from '@/stores/memory.store'
import { extractMemory } from '@/services/memory/extractor'
import { writeExtractedMemory } from '@/services/memory/graph-writer'
import type { ToolCall, Provider } from '@/types'

interface StreamChunk {
  sessionId: string
  messageId: string
  type: 'thinking_token' | 'content_token' | 'tool_call' | 'done' | 'error'
  delta?: string
  toolCall?: ToolCall
  error?: string
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
  const stopStreamingFn = useChatStore((s) => s.stopStreaming)

  const lastUserMessageRef = useRef<Map<string, { text: string; userMessageId: string }>>(new Map())

  const sendMessage = useCallback((text: string) => {
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
    setStreaming(true)

    const session = useChatStore.getState().sessions.find((s) => s.id === sid)
    const activeModel = session?.model || ''
    const provider = getActiveProvider(providers, activeModel)
    if (!provider) {
      setStreaming(false)
      updateMessage(assistantId, {
        isStreaming: false,
        content: providers.length === 0
          ? 'No hay proveedores configurados. Ve a Configuración > Modelos para agregar uno.'
          : `No se encontró un proveedor activo. Revisa la configuración en Ajustes.`,
      })
      return
    }
    if (!window.sparta?.sendMessage) {
      setStreaming(false)
      updateMessage(assistantId, {
        isStreaming: false,
        content: 'Error de conexión: esta función requiere la aplicación de escritorio.',
      })
      return
    }
    if (provider.kind === 'cloud' && !provider.apiKey) {
      setStreaming(false)
      updateMessage(assistantId, {
        isStreaming: false,
        content: `El proveedor "${provider.label}" no tiene API key configurada. Edítalo en Ajustes.`,
      })
      return
    }
    const allMessages = useChatStore.getState().messagesBySession[sid] ?? []
    const msgs = allMessages.map((m) => ({ role: m.role, content: m.content }))
    const apiUrl = provider.serverUrl || undefined
    window.sparta.sendMessage({
      sessionId: sid,
      messageId: assistantId,
      model: provider.defaultModel ?? '',
      messages: msgs,
      providerKey: provider.apiKey,
      apiUrl,
      isLocal: provider.kind === 'local',
      system: undefined,
    }).catch(() => {
      setStreaming(false)
      updateMessage(assistantId, {
        isStreaming: false,
        content: 'Error: no se pudo conectar con el proveedor.',
      })
    })

    return { sessionId: sid, assistantId, userMessageId }
  }, [createSession, addMessage, setStreaming, updateMessage, providers])

  useEffect(() => {
    if (!window.sparta) return
    const unsub = window.sparta.onEvent((event) => {
      const chunk = event as StreamChunk
      const currentId = activeIdRef.current
      if (chunk.sessionId !== currentId) return
      switch (chunk.type) {
        case 'thinking_token':
          appendThinking(chunk.sessionId, chunk.messageId, chunk.delta ?? '')
          break
        case 'content_token':
          appendContent(chunk.sessionId, chunk.messageId, chunk.delta ?? '')
          break
        case 'tool_call':
          if (chunk.toolCall) {
            addToolCall(chunk.sessionId, chunk.messageId, chunk.toolCall)
          }
          break
        case 'done': {
          updateMessage(chunk.messageId, { isStreaming: false })
          setStreaming(false)
          const pair = lastUserMessageRef.current.get(chunk.sessionId)
          if (pair) {
            const userText = pair.text
            const assistantText = useChatStore.getState().messagesBySession[chunk.sessionId]
              ?.find((m) => m.id === chunk.messageId)?.content ?? ''
            if (userText && assistantText) {
              extractMemory(userText, assistantText, async (prompt) => {
                const res = await fetch('/api/extract-memory', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ prompt }),
                })
                return res.text()
              }).then((extracted) => {
                if (extracted.entities.length === 0 && extracted.facts.length === 0) return
                writeExtractedMemory(extracted, chunk.sessionId, chunk.messageId, {
                  getEntries: () => useMemoryStore.getState().entries,
                  getRelations: () => useMemoryStore.getState().relations,
                  addEntry: (entry) => {
                    useMemoryStore.getState().addEntry(
                      entry.content, entry.source, entry.category,
                      entry.projectId, entry.sourceSessionId, entry.sourceMessageId
                    )
                  },
                  updateEntry: (id, partial) => useMemoryStore.getState().updateEntry(id, partial),
                  deleteEntry: (id) => useMemoryStore.getState().deleteEntry(id),
                  addRelation: (rel) => useMemoryStore.getState().addRelation(rel),
                  updateRelation: (fromId, toId, partial) => useMemoryStore.getState().updateRelation(fromId, toId, partial),
                })
                useMemoryStore.getState().rebuildGraph()
              }).catch(() => {})
            }
          }
          break
        }
        case 'error':
          updateMessage(chunk.messageId, {
            isStreaming: false,
            content: chunk.error ? `Error: ${chunk.error}` : 'Error durante la generación',
          })
          setStreaming(false)
          break
      }
    })
    return unsub
  }, [appendThinking, appendContent, addToolCall, updateMessage, setStreaming])

  return {
    sessions,
    activeSessionId,
    messages,
    isStreaming,
    createSession,
    switchSession,
    deleteSession,
    addMessage,
    updateMessage,
    setStreaming,
    sendMessage,
    stopStreaming: stopStreamingFn,
  }
}
