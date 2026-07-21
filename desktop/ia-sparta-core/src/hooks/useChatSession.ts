import { useCallback, useEffect, useRef } from 'react'
import { useChatStore } from '../stores/chat.store'
import { useSessionStore } from '../stores/session.store'
import { useSessionTabsStore } from '../stores/session-tabs.store'
import { useProviderStore } from '../stores/provider.store'
import { useSettingsStore } from '../stores/settings.store'
import { useEventBus } from '../stores/event-bus.store'
import { useSecurityStore } from '../stores/security.store'
import { useMCPStore } from '../stores/mcp.store'
import { useSkillStore } from '../stores/skill.store'
import { useProjectStore } from '../stores/project.store'
import { useFolderStore } from '../stores/folder.store'
import { useModelPerformanceStore } from '../stores/model-performance.store'
import { getProviderKey, messagingAdapter, IS_WEB } from 'ia-sparta-platform'
import { useSessionLifecycle } from './useSessionLifecycle'
import { useSessionMemory } from './useSessionMemory'
import { useStreamEvents } from 'ia-sparta-stream-events'
import type { Provider } from '../types'

function getActiveProvider(providers: Provider[], activeModel: string): Provider | null {
  return providers.find((p) => p.defaultModel === activeModel || p.models?.includes(activeModel)) ?? providers[0] ?? null
}

function resolveWorkspaceRoot(): string | undefined {
  const projectStore = useProjectStore.getState()
  const activeProject = projectStore.getActiveProject()
  if (activeProject?.rootPath) {
    return activeProject.rootPath
  }

  // If the active project has no root path, look for any project that does and
  // activate it automatically. This covers the case where the user opened a
  // folder in the editor but the chat session was created before that.
  const projectWithRoot = projectStore.projects.find((p) => p.rootPath)
  if (projectWithRoot?.rootPath) {
    projectStore.setActiveProject(projectWithRoot.id)
    return projectWithRoot.rootPath
  }

  // Fallback: no workspace root available without a connected project.
  return undefined
}

async function runAssistantTurn(
  sid: string,
  assistantId: string,
  text: string,
  msgs: Array<{ role: string; content: string }>,
  buildMemorySystemPrompt: (text: string, providers: Provider[]) => Promise<string | undefined>,
) {
  const turnStartedAt = Date.now()
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

    const settingsState = useSettingsStore.getState()
    const { semanticMemoryEnabled, webSearchEnabled, reasoningEnabled, reasoningBudget, reasoningEffort, agentAutonomy, agentExecuteLocal, sandboxMode } = settingsState
    // Use per-session mode if set, otherwise fall back to global default
    const sessionMode = session?.sessionMode ?? settingsState.sessionMode
    const securityLoaded = useSecurityStore.getState().loaded
    const skills = useSkillStore.getState().activeSkillIds ?? []
    const mcpServers = useMCPStore.getState().servers.map((s) => ({
      ...s.config,
      tools: s.tools ?? [],
    }))
    const workspaceRoot = resolveWorkspaceRoot()
    const connectedFolder = useFolderStore.getState().connectedPath || undefined

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
      reasoning: { enabled: reasoningEnabled ?? false, budget: reasoningBudget ?? 8000, effort: reasoningEffort ?? 'medium' },
      webSearchEnabled,
      workspaceRoot,
      connectedFolder,
      agentAutonomy,
      agentExecuteLocal,
      securityLoaded,
      sandboxMode,
    })
    const resolved = sendResult instanceof Promise ? await sendResult : null
    if (resolved?.ok) {
      useModelPerformanceStore.getState().recordLatency(activeModel, Date.now() - turnStartedAt)
    }
    if (resolved && !resolved.ok) {
      store.stopStreaming(sid)
      const SEND_ERROR_MESSAGES: Record<string, string> = {
        'Sidecar not ready': 'El asistente de Python no respondió a tiempo. Probá de nuevo o reiniciá la app.',
        'Concurrent stream not allowed for same session': 'Ya hay una respuesta en curso en esta sesión. Esperá a que termine antes de enviar otro mensaje.',
        'Timeout': 'La solicitud tardó demasiado y se canceló. Probá de nuevo.',
      }
      const friendly = resolved.error ? (SEND_ERROR_MESSAGES[resolved.error] ?? resolved.error) : undefined
      store.updateMessage(assistantId, {
        isStreaming: false,
        content: `Error: ${friendly || 'no se pudo enviar el mensaje al sidecar.'}`,
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

export function useChatSession(sessionId?: string) {
  const { sessions, activeSessionId, createSession, switchSession, deleteSession } = useSessionLifecycle()
  const { buildMemorySystemPrompt } = useSessionMemory()
  const { adapterReady, setProviderForSession, setLastUserMessage } = useStreamEvents()

  const resolvedSessionId = sessionId ?? activeSessionId

  const messagesBySession = useChatStore((s) => s.messagesBySession)
  const messages = resolvedSessionId ? (messagesBySession[resolvedSessionId] ?? []) : []
  const isStreaming = useChatStore((s) => resolvedSessionId ? (s.streamingBySession[resolvedSessionId]?.isStreaming ?? false) : s.isStreaming)
  const streamingBySession = useChatStore((s) => s.streamingBySession)
  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const stopStreamingFn = useChatStore((s) => s.stopStreaming)

  const activeIdRef = useRef(resolvedSessionId)
  activeIdRef.current = resolvedSessionId

  const sendMessage = useCallback(
    async (text: string) => {
      const existingSid = activeIdRef.current
      const streamState = existingSid ? useChatStore.getState().getStreamState(existingSid) : undefined
      if (streamState?.isStreaming) {
        console.warn('[useChatSession] sendMessage ignorado: sesión ya está stremeando', existingSid)
        return { sessionId: existingSid!, assistantId: '', userMessageId: '' }
      }
      // Clear auto-suggested skills from previous turn
      useSkillStore.getState().setSuggestedSkillIds([])
      const sid = activeIdRef.current ?? createSession()
      if (!activeIdRef.current) {
        useSessionTabsStore.getState().openTab(sid)
      }
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
        .map((m) => {
          const base: { role: string; content: string; reasoning_content?: string } = { role: m.role, content: m.content }
          if (m.role === 'assistant') {
            if (m.reasoningContent) base.reasoning_content = m.reasoningContent
            else if (m.reasoningText) base.reasoning_content = m.reasoningText
          }
          return base
        })

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
        .map((m) => {
          const base: { role: string; content: string; reasoning_content?: string } = { role: m.role, content: m.content }
          if (m.role === 'assistant') {
            if (m.reasoningContent) base.reasoning_content = m.reasoningContent
            else if (m.reasoningText) base.reasoning_content = m.reasoningText
          }
          return base
        })
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
