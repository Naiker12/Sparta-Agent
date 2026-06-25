import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Message, Session } from '@/types'

interface ChatState {
  sessions: Session[]
  activeSessionId: string | null
  messagesBySession: Record<string, Message[]>
  isStreaming: boolean

  createSession: (title?: string) => string
  switchSession: (id: string) => void
  deleteSession: (id: string) => void
  deleteMessage: (sessionId: string, messageId: string) => void
  addMessage: (message: Message) => void
  updateMessage: (id: string, partial: Partial<Message>) => void
  setStreaming: (value: boolean) => void
  getActiveMessages: () => Message[]
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
  sessions: [],
  activeSessionId: null,
  messagesBySession: {},
  isStreaming: false,

  createSession: (title) => {
    const id = crypto.randomUUID()
    const session: Session = {
      id,
      title: title || `Sesión ${new Date().toLocaleDateString()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'claude-sonnet-4-6',
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
      const { [id]: _, ...rest } = s.messagesBySession
      return {
        sessions: s.sessions.filter((sess) => sess.id !== id),
        activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
        messagesBySession: rest,
      }
    }),

  addMessage: (message) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[message.sessionId] || []
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [message.sessionId]: [...sessionMessages, message],
        },
        sessions: s.sessions.map((sess) =>
          sess.id === message.sessionId
            ? { ...sess, messageCount: sess.messageCount + 1, updatedAt: Date.now() }
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

  deleteMessage: (sessionId, messageId) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId] || []
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

  setStreaming: (value) => set({ isStreaming: value }),

  getActiveMessages: () => {
    const { activeSessionId, messagesBySession } = get()
    if (!activeSessionId) return []
    return messagesBySession[activeSessionId] || []
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
