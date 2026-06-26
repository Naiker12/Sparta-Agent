import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Message, Session, ToolCall } from '@/types'

interface ChatState {
  sessions: Session[]
  activeSessionId: string | null
  messagesBySession: Record<string, Message[]>
  isStreaming: boolean
  abortController: AbortController | null

  createSession: (title?: string, model?: string, providerId?: string) => string
  switchSession: (id: string) => void
  deleteSession: (id: string) => void
  pinSession: (id: string) => void
  archiveSession: (id: string) => void
  renameSession: (id: string, newTitle: string) => void
  deleteMessage: (sessionId: string, messageId: string) => void
  addMessage: (message: Message) => void
  updateMessage: (id: string, partial: Partial<Message>) => void
  appendContent: (sessionId: string, messageId: string, delta: string) => void
  appendThinking: (sessionId: string, messageId: string, delta: string) => void
  addToolCall: (sessionId: string, messageId: string, toolCall: ToolCall) => void
  updateToolCallStatus: (sessionId: string, messageId: string, toolCallId: string, status: ToolCall['status']) => void
  setStreaming: (value: boolean) => void
  startStreaming: () => AbortController
  stopStreaming: () => void
  getActiveMessages: () => Message[]
  cleanupStaleSessions: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
  sessions: [],
  activeSessionId: null,
  messagesBySession: {},
  isStreaming: false,
  abortController: null,

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
      return {
        sessions: s.sessions.filter((sess) => sess.id !== id),
        activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
        messagesBySession: rest,
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

  updateMessage: (id, partial) =>
    set((s) => {
      const updated = { ...s.messagesBySession }
      for (const sessionId in updated) {
        updated[sessionId] = updated[sessionId].map((msg) =>
          msg.id === id ? { ...msg, ...partial } : msg
        )
      }
      return { messagesBySession: updated }
    }),

  appendContent: (sessionId, messageId, delta) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) =>
            msg.id === messageId
              ? { ...msg, content: msg.content + delta, isStreaming: true }
              : msg
          ),
        },
      }
    }),

  appendThinking: (sessionId, messageId, delta) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) =>
            msg.id === messageId
              ? { ...msg, reasoningText: (msg.reasoningText ?? '') + delta, isStreaming: true }
              : msg
          ),
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
              ? { ...msg, toolCalls: [...(msg.toolCalls ?? []), toolCall] }
              : msg
          ),
        },
      }
    }),

  updateToolCallStatus: (sessionId, messageId, toolCallId, status) =>
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
                  toolCalls: (msg.toolCalls ?? []).map((tc) =>
                    tc.id === toolCallId ? { ...tc, status } : tc
                  ),
                }
              : msg
          ),
        },
      }
    }),

  setStreaming: (value) => set({ isStreaming: value }),

  startStreaming: () => {
    const controller = new AbortController()
    set({ isStreaming: true, abortController: controller })
    return controller
  },

  stopStreaming: () => {
    const { abortController } = get()
    abortController?.abort()
    set({ isStreaming: false, abortController: null })
  },

  getActiveMessages: () => {
    const { activeSessionId, messagesBySession } = get()
    if (!activeSessionId) return []
    return messagesBySession[activeSessionId] || []
  },

  cleanupStaleSessions: () => {
    set((s) => ({
      isStreaming: false,
      abortController: null,
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
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        messagesBySession: state.messagesBySession,
      }),
    }
  )
)
