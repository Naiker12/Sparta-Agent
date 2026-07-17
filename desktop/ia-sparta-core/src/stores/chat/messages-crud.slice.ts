import type { StateCreator } from 'zustand'
import type { ChatState } from './chat.store'
import { useSessionStore } from '../session.store'

export interface MessagesCRUDSlice {
  deleteSessionMessages: (sessionId: string) => void
  deleteMessage: (sessionId: string, messageId: string) => void
  addMessage: (message: import('../../types').Message) => void
  updateMessage: (id: string, updater: Partial<import('../../types').Message> | ((msg: import('../../types').Message) => Partial<import('../../types').Message>)) => void
}

export const createMessagesCRUDSlice: StateCreator<ChatState, [], [], MessagesCRUDSlice> = (set) => ({
  deleteSessionMessages: (sessionId: string) =>
    set((s) => {
      const streamEntry = s.streamingBySession[sessionId]
      if (streamEntry) streamEntry.abortController.abort()
      const { [sessionId]: _p, ...rest } = s.messagesBySession
      void _p
      const { [sessionId]: _stream, ...restStreaming } = s.streamingBySession
      void _stream
      const hasAnyStreaming = Object.values(restStreaming).some((st) => st.isStreaming)
      return {
        messagesBySession: rest,
        streamingBySession: restStreaming,
        isStreaming: hasAnyStreaming,
        abortController: hasAnyStreaming ? Object.values(restStreaming)[0]?.abortController ?? null : null,
      }
    }),

  deleteMessage: (sessionId, messageId) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      const filtered = sessionMessages.filter((m) => m.id !== messageId)
      if (filtered.length === sessionMessages.length) return s
      useSessionStore.getState().updateSessionMeta(sessionId, {
        messageCount: Math.max(0, filtered.length),
        updatedAt: Date.now(),
      })
      return {
        messagesBySession: { ...s.messagesBySession, [sessionId]: filtered },
      }
    }),

  addMessage: (message) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[message.sessionId] || []
      const isFirstMessage = sessionMessages.length === 0
      if (isFirstMessage && message.role === 'user') {
        useSessionStore.getState().updateSessionMeta(message.sessionId, {
          title: message.content.slice(0, 45).trimEnd() + (message.content.length > 45 ? ' …' : ''),
        })
      }
      useSessionStore.getState().updateSessionMeta(message.sessionId, {
        messageCount: sessionMessages.length + 1,
        updatedAt: Date.now(),
      })
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [message.sessionId]: [...sessionMessages, message],
        },
      }
    }),

  updateMessage: (id, updater) =>
    set((s) => {
      const updated = { ...s.messagesBySession }
      for (const sessionId in updated) {
        updated[sessionId] = updated[sessionId].map((msg) =>
          msg.id === id ? { ...msg, ...(typeof updater === 'function' ? updater(msg) : updater) } : msg
        )
      }
      return { messagesBySession: updated }
    }),
})
