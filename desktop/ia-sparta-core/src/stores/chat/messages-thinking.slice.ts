import type { StateCreator } from 'zustand'
import type { ChatState } from './chat.store'
import type { ThinkingStatus, MessagePart, ReasoningOrigin } from '../../types'

export interface MessagesThinkingSlice {
  onThinkingStart: (sessionId: string, messageId: string, origin?: ReasoningOrigin) => void
  onThinkingEnd: (sessionId: string, messageId: string, tokensUsed: number) => void
  setThinkingStatusText: (sessionId: string, messageId: string, text: string) => void
  onReasoningAvailable: (sessionId: string, messageId: string, text: string) => void
  closeReasoningPart: (sessionId: string, messageId: string) => void
}

export const createMessagesThinkingSlice: StateCreator<ChatState, [], [], MessagesThinkingSlice> = (set) => ({
  onThinkingStart: (sessionId, messageId, origin = 'native') =>
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
            msg.id === messageId ? { ...msg, thinkingStatus: 'starting' as ThinkingStatus, reasoningOrigin: origin } : msg
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
          [sessionId]: sessionMessages.map((msg) => {
            if (msg.id !== messageId) return msg
            const parts = msg.parts ?? []
            let updatedParts = parts
            const lastPart = parts.length > 0 ? parts[parts.length - 1] : null
            if (lastPart && lastPart.kind === 'reasoning' && !lastPart.completedAt) {
              updatedParts = [...parts]
              updatedParts[updatedParts.length - 1] = {
                ...lastPart,
                completedAt: Date.now(),
              } as MessagePart
            }
            return { ...msg, thinkingStatus: 'completed' as ThinkingStatus, thinkingTokensUsed: tokensUsed, parts: updatedParts }
          }),
        },
      }
    }),

  setThinkingStatusText: (sessionId, messageId, text) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) =>
            msg.id === messageId ? { ...msg, thinkingStatusText: text } : msg
          ),
        },
      }
    }),

  onReasoningAvailable: (sessionId, messageId, text) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      const target = sessionMessages.find((m) => m.id === messageId)
      if (!target) return s
      if (target.reasoningText && target.reasoningText.length >= text.length) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) =>
            msg.id === messageId
              ? { ...msg, reasoningText: text, thinkingStatus: 'completed' as ThinkingStatus }
              : msg
          ),
        },
      }
    }),

  closeReasoningPart: (sessionId, messageId) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) => {
            if (msg.id !== messageId) return msg
            const parts = msg.parts ?? []
            if (parts.length === 0) {
              const text = msg.reasoningText ?? ''
              if (!text) return msg
              return {
                ...msg,
                parts: [{ kind: 'reasoning', id: `reasoning-${Date.now()}`, text, origin: msg.reasoningOrigin ?? 'native', startedAt: msg.reasoningStartedAt ?? Date.now(), completedAt: Date.now() } as MessagePart],
              }
            }
            const lastPart = parts[parts.length - 1]
            if (lastPart.kind === 'reasoning' && !lastPart.completedAt) {
              const updated = [...parts]
              updated[updated.length - 1] = {
                ...lastPart,
                completedAt: Date.now(),
                text: msg.reasoningText ?? lastPart.text,
              }
              return { ...msg, parts: updated }
            }
            return msg
          }),
        },
      }
    }),
})
