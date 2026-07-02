import { useCallback, useEffect, useRef } from 'react'
import { useChatStore } from '@/stores/chat.store'
import { useSessionStore } from '@/stores/session.store'
import { useProviderStore } from '@/stores/provider.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useEventBus } from '@/stores/event-bus.store'
import { useMCPStore } from '@/stores/mcp.store'
import { useSkillStore } from '@/stores/skill.store'
import { useProjectStore } from '@/stores/project.store'
import { getProviderKey } from '@/lib/vault-helper'
import { messagingAdapter } from '@/lib/messaging-adapter'
import { IS_WEB } from '@/lib/env-adapter'
import { useSessionLifecycle } from './useSessionLifecycle'
import { useSessionMemory } from './useSessionMemory'
import { useStreamEvents } from './useStreamEvents'
import type { Provider } from '@/types'

function getActiveProvider(providers: Provider[], activeModel: string): Provider | null {
  return providers.find((p) => p.defaultModel === activeModel || p.models?.includes(activeModel)) ?? providers[0] ?? null
}

async function runAssistantTurn(
  sid: string,
  assistantId: string,
  text: string,
  msgs: Array<{ role: string; content: string }>,
  buildMemorySystemPrompt: (text: string, providers: Provider[]) => Promise<string | undefined>,
) {
  const store = useChatStore.getState()
  const sessionStore = useSessionStore.getState()
  store.startStreaming(sid)

  try {
    const freshProviders = useProviderStore.getState().providers
    const session = sessionStore.sessions.find((s) => s.id === sid)
    const settingsModel = useSettingsStore.getState().activeModel
    const activeModel = session?.model || settingsModel
    if (session && !session.model && activeModel) {
      sessionStore.updateSessionModel(sid, activeModel)
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
    const system = await buildMemorySystemPrompt(text, freshProviders)

    const { semanticMemoryEnabled, webSearchEnabled, sessionMode, reasoningEnabled, reasoningBudget } = useSettingsStore.getState()
    const skills = useSkillStore.getState().activeSkillIds ?? []
    const mcpServers = useMCPStore.getState().servers.map((s: { id: string; name: string; tools?: unknown[] }) => ({
      id: s.id,
      name: s.name,
      tools: s.tools ?? [],
    }))
    const activeProject = useProjectStore.getState().getActiveProject()
    const workspaceRoot = activeProject?.rootPath

    const sendResult = messagingAdapter.sendMessage({
      sessionId: sid,
      messageId: assistantId,
      model: activeModel || provider.defaultModel || '',
      messages: msgs,
      providerKey,
      apiUrl,
      isLocal: provider.kind === 'local',
      system,
      vendor: provider.vendor,
      providerId: provider.id,
      mode: sessionMode ?? 'chat',
      skills,
      mcpServers,
      semanticMemory: semanticMemoryEnabled,
      reasoning: { enabled: reasoningEnabled ?? false, budget: reasoningBudget ?? 8000 },
      webSearchEnabled,
      workspaceRoot,
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
  const { sessions, activeSessionId, createSession, switchSession, deleteSession } = useSessionLifecycle()
  const { buildMemorySystemPrompt } = useSessionMemory()
  const { adapterReady, setProviderForSession, setLastUserMessage } = useStreamEvents()

  const messagesBySession = useChatStore((s) => s.messagesBySession)
  const messages = activeSessionId ? (messagesBySession[activeSessionId] ?? []) : []
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingBySession = useChatStore((s) => s.streamingBySession)
  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const stopStreamingFn = useChatStore((s) => s.stopStreaming)

  const activeIdRef = useRef(activeSessionId)
  activeIdRef.current = activeSessionId

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
      setLastUserMessage(sid, text, userMessageId)

      const allMessages = useChatStore.getState().messagesBySession[sid] ?? []
      const msgs = allMessages
        .filter((m) => m.id !== assistantId)
        .map((m) => ({ role: m.role, content: m.content }))

      // Signal main process that renderer is ready to receive events for this session (Electron only)
      if (typeof window !== 'undefined' && window.electron?.send) {
        window.electron.send('chat:ready', { sessionId: sid })
      }

      const freshProviders = useProviderStore.getState().providers
      const provider = getActiveProvider(freshProviders, useSettingsStore.getState().activeModel)
      if (provider) {
        setProviderForSession(sid, provider.id)
      }

      await runAssistantTurn(sid, assistantId, text, msgs, buildMemorySystemPrompt)

      return { sessionId: sid, assistantId, userMessageId }
    },
    [createSession, addMessage, setLastUserMessage, setProviderForSession, buildMemorySystemPrompt]
  )

  const regenerateMessage = useCallback(
    async (sid: string, assistantMessageId: string) => {
      const store = useChatStore.getState()
      const streamState = store.getStreamState(sid)
      if (streamState?.isStreaming) {
        console.warn('[useChatSession] regenerateMessage ignorado: sesión ya está stremeando', sid)
        return
      }
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
      setLastUserMessage(sid, prevUser.content, prevUser.id)

      const msgs = sessionMessages
        .slice(0, idx)
        .map((m) => ({ role: m.role, content: m.content }))
      await runAssistantTurn(sid, assistantId, prevUser.content, msgs, buildMemorySystemPrompt)

      return { sessionId: sid, assistantId }
    },
    [setLastUserMessage, buildMemorySystemPrompt]
  )

  useEffect(() => {
    const unsub = useEventBus.getState().subscribe((event) => {
      if (event.type === 'chat:send_queued' && 'text' in event && typeof event.text === 'string') {
        sendMessage(event.text)
      }
    })
    return unsub
  }, [sendMessage])

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
    sendMessage,
    regenerateMessage,
    stopStreaming: (sessionId?: string) => stopStreamingFn(sessionId),
    adapterReady,
  }
}
