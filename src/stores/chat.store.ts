import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Message, Session, ToolCall, ThinkingStatus } from '@/types'

export interface StreamState {
  isStreaming: boolean
  abortController: AbortController
  tokensUsed: number
  startedAt: number
}

interface ChatState {
  sessions: Session[]
  activeSessionId: string | null
  messagesBySession: Record<string, Message[]>
  isStreaming: boolean
  abortController: AbortController | null
  streamingBySession: Record<string, StreamState>
  pendingInjections: string[]

  createSession: (title?: string, model?: string, providerId?: string) => string
  switchSession: (id: string) => void
  deleteSession: (id: string) => void
  pinSession: (id: string) => void
  archiveSession: (id: string) => void
  renameSession: (id: string, newTitle: string) => void
  updateSessionModel: (id: string, model: string) => void
  deleteMessage: (sessionId: string, messageId: string) => void
  addMessage: (message: Message) => void
  updateMessage: (id: string, updater: Partial<Message> | ((msg: Message) => Partial<Message>)) => void
  appendContent: (sessionId: string, messageId: string, delta: string, chunkSeq?: number) => void
  appendThinking: (sessionId: string, messageId: string, delta: string, chunkSeq?: number) => void
  addToolCall: (sessionId: string, messageId: string, toolCall: ToolCall) => void
  updateToolCallStatus: (sessionId: string, messageId: string, toolCallId: string, status: ToolCall['status'], result?: string, toolName?: string) => void
  setStreaming: (value: boolean) => void
  startStreaming: (sessionId: string) => AbortController
  stopStreaming: (sessionId?: string) => void
  injectWhileStreaming: (text: string) => void
  consumePendingInjections: () => string[]
  getActiveMessages: () => Message[]
  cleanupStaleSessions: () => void
  getStreamState: (sessionId: string) => StreamState | undefined

  // Thinking lifecycle
  onThinkingStart: (sessionId: string, messageId: string) => void
  onThinkingEnd: (sessionId: string, messageId: string, tokensUsed: number) => void
  onStreamEnd: (sessionId: string, messageId: string) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
  sessions: [],
  activeSessionId: null,
  messagesBySession: {},
  isStreaming: false,
  abortController: null,
  streamingBySession: {},
  pendingInjections: [],

  createSession: (title, model, providerId) => {
    const id = crypto.randomUUID()
    const session: Session = {
      id,
      title: title || 'Nueva conversación',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: model || '',
      providerId,
      messageCount: 0,
    }
    set((s) => ({
      sessions: [session, ...s.sessions],
      activeSessionId: id,
      messagesBySession: { ...s.messagesBySession, [id]: [] },
    }))
    return id
  },

  switchSession: (id) => set({ activeSessionId: id }),

  deleteSession: (id) =>
    set((s) => {
      const { [id]: _p, ...rest } = s.messagesBySession
      void _p
      const { [id]: _stream, ...restStreaming } = s.streamingBySession
      void _stream
      const wasActive = s.activeSessionId === id
      const hasAnyStreaming = Object.values(restStreaming).some((st) => st.isStreaming)
      return {
        sessions: s.sessions.filter((sess) => sess.id !== id),
        activeSessionId: wasActive ? null : s.activeSessionId,
        messagesBySession: rest,
        streamingBySession: restStreaming,
        isStreaming: hasAnyStreaming,
        abortController: hasAnyStreaming ? Object.values(restStreaming)[0]?.abortController ?? null : null,
      }
    }),

  pinSession: (id) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, pinned: !sess.pinned } : sess
      ),
    })),

  archiveSession: (id) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, archived: !sess.archived } : sess
      ),
    })),

  renameSession: (id, newTitle) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, title: newTitle } : sess
      ),
    })),

  updateSessionModel: (id, model) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, model } : sess
      ),
    })),

  deleteMessage: (sessionId, messageId) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      const filtered = sessionMessages.filter((m) => m.id !== messageId)
      if (filtered.length === sessionMessages.length) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: filtered,
        },
        sessions: s.sessions.map((sess) =>
          sess.id === sessionId
            ? { ...sess, messageCount: Math.max(0, sess.messageCount - 1), updatedAt: Date.now() }
            : sess
        ),
      }
    }),

  addMessage: (message) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[message.sessionId] || []
      const isFirstMessage = sessionMessages.length === 0
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [message.sessionId]: [...sessionMessages, message],
        },
        sessions: s.sessions.map((sess) =>
          sess.id === message.sessionId
            ? {
                ...sess,
                title: isFirstMessage && message.role === 'user' && sess.title === 'Nueva conversación'
                  ? message.content.slice(0, 45).trimEnd() + (message.content.length > 45 ? ' …' : '')
                  : sess.title,
                messageCount: sess.messageCount + 1,
                updatedAt: Date.now(),
              }
            : sess
        ),
      }
    }),

  updateMessage: (id, updater) =>
    set((s) => {
      const updated = { ...s.messagesBySession }
      for (const sessionId in updated) {
        updated[sessionId] = updated[sessionId].map((msg) =>
          msg.id === id
            ? { ...msg, ...(typeof updater === 'function' ? updater(msg) : updater) }
            : msg
        )
      }
      return { messagesBySession: updated }
    }),

  appendContent: (sessionId, messageId, delta, chunkSeq) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      if (!delta) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) => {
            if (msg.id !== messageId) return msg
            if (chunkSeq !== undefined && msg.lastChunkSeq !== undefined && chunkSeq <= msg.lastChunkSeq) {
              console.warn(`[chat.store] Duplicate content chunk #${chunkSeq} <= lastChunkSeq #${msg.lastChunkSeq} for message ${messageId.slice(0,8)}`)
              return msg
            }
            return { ...msg, content: msg.content + delta, isStreaming: true, lastChunkSeq: chunkSeq ?? msg.lastChunkSeq }
          }),
        },
      }
    }),

  appendThinking: (sessionId, messageId, delta, chunkSeq) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) => {
            if (msg.id !== messageId) return msg
            if (chunkSeq !== undefined && msg.lastThinkChunkSeq !== undefined && chunkSeq <= msg.lastThinkChunkSeq) {
              console.warn(`[chat.store] Duplicate thinking chunk #${chunkSeq} <= lastThinkChunkSeq #${msg.lastThinkChunkSeq} for message ${messageId.slice(0,8)}`)
              return msg
            }
            return {
              ...msg,
              reasoningText: (msg.reasoningText ?? '') + delta,
              thinkingStatus: (msg.thinkingStatus === 'idle' || msg.thinkingStatus === 'starting' || msg.thinkingStatus === undefined) ? 'streaming' : msg.thinkingStatus,
              isStreaming: true,
              lastThinkChunkSeq: chunkSeq ?? msg.lastThinkChunkSeq,
            }
          }),
        },
      }
    }),

  addToolCall: (sessionId, messageId, toolCall) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  toolCalls: (msg.toolCalls ?? []).some((tc) => tc.id === toolCall.id)
                    ? msg.toolCalls
                    : [...(msg.toolCalls ?? []), toolCall],
                }
              : msg
          ),
        },
      }
    }),

  updateToolCallStatus: (sessionId: string, messageId: string, toolCallId: string, status: ToolCall['status'], result?: string, toolName?: string) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  toolCalls: (msg.toolCalls ?? []).map((tc) => {
                    const matchById = tc.id === toolCallId
                    const matchByName = toolName && tc.toolName === toolName
                    if (matchById || matchByName) {
                      return {
                        ...tc,
                        status,
                        output: result ?? tc.output,
                        error: status === 'error' ? (result ?? tc.error) : tc.error,
                        completedAt: Date.now(),
                      }
                    }
                    return tc
                  }),
                }
              : msg
          ),
        },
      }
    }),

  setStreaming: (value) => set({ isStreaming: value }),

  startStreaming: (sessionId: string) => {
    const controller = new AbortController()
    const streamState: StreamState = { isStreaming: true, abortController: controller, tokensUsed: 0, startedAt: Date.now() }
    set((s) => ({
      isStreaming: true,
      abortController: controller,
      pendingInjections: [],
      streamingBySession: { ...s.streamingBySession, [sessionId]: streamState },
    }))
    return controller
  },

  stopStreaming: (sessionId?: string) => {
    const { abortController, streamingBySession } = get()
    if (sessionId) {
      const entry = streamingBySession[sessionId]
      if (entry) {
        entry.abortController.abort()
        const { [sessionId]: _, ...rest } = streamingBySession
        void _
        const hasAnyStreaming = Object.values(rest).some((s) => s.isStreaming)
        set({
          streamingBySession: rest,
          isStreaming: hasAnyStreaming,
          abortController: hasAnyStreaming ? Object.values(rest)[0]?.abortController ?? null : null,
        })
      }
    } else {
      abortController?.abort()
      set({ isStreaming: false, abortController: null, streamingBySession: {} })
    }
  },

  getStreamState: (sessionId: string) => {
    return get().streamingBySession[sessionId]
  },

  injectWhileStreaming: (text: string) => {
    set((s) => ({
      pendingInjections: [...s.pendingInjections, text],
    }))
  },

  consumePendingInjections: () => {
    const { pendingInjections } = get()
    if (pendingInjections.length === 0) return []
    set({ pendingInjections: [] })
    return pendingInjections
  },

  getActiveMessages: () => {
    const { activeSessionId, messagesBySession } = get()
    if (!activeSessionId) return []
    return messagesBySession[activeSessionId] || []
  },

  onThinkingStart: (sessionId, messageId) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) {
        console.warn('[ThinkingFix] Sesión no encontrada para thinking:started', sessionId)
        return s
      }
      const target = sessionMessages.find((m) => m.id === messageId)
      if (!target) {
        console.warn('[ThinkingFix] Mensaje no encontrado para thinking:started', messageId, 'IDs disponibles:', sessionMessages.map((m) => m.id))
        return s
      }
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) =>
            msg.id === messageId ? { ...msg, thinkingStatus: 'starting' as ThinkingStatus } : msg
          ),
        },
      }
    }),

  onThinkingEnd: (sessionId, messageId, tokensUsed) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) =>
            msg.id === messageId ? { ...msg, thinkingStatus: 'completed' as ThinkingStatus, thinkingTokensUsed: tokensUsed } : msg
          ),
        },
      }
    }),

  onStreamEnd: (sessionId, messageId) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) =>
            msg.id === messageId ? { ...msg, isStreaming: false } : msg
          ),
        },
      }
    }),

  cleanupStaleSessions: () => {
    set((s) => ({
      isStreaming: false,
      abortController: null,
      streamingBySession: {},
      messagesBySession: Object.fromEntries(
        Object.entries(s.messagesBySession).map(([sessionId, msgs]) => [
          sessionId,
          msgs.map((msg) => ({ ...msg, isStreaming: false })),
        ])
      ),
    }))
  },
}),
    {
      name: 'sparta-chat',
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version < 1) {
          return {
            sessions: Array.isArray(state.sessions) ? state.sessions : [],
            activeSessionId: typeof state.activeSessionId === 'string' ? state.activeSessionId : null,
            messagesBySession: state.messagesBySession && typeof state.messagesBySession === 'object'
              ? Object.fromEntries(
                  Object.entries(state.messagesBySession as Record<string, unknown>).map(([sid, msgs]) => [
                    sid,
                    Array.isArray(msgs) ? msgs.map((m: Record<string, unknown>) => ({
                      ...m,
                      isStreaming: false,
                      lastChunkSeq: (m as { lastChunkSeq?: number }).lastChunkSeq,
                      lastThinkChunkSeq: (m as { lastThinkChunkSeq?: number }).lastThinkChunkSeq,
                    })) : [],
                  ])
                )
              : {},
          }
        }
        return persisted
      },
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        messagesBySession: state.messagesBySession,
      }),
    }
  )
)
