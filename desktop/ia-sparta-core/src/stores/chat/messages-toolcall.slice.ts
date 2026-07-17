import type { StateCreator } from 'zustand'
import type { ChatState } from './chat.store'
import type { ToolCall, SearchProgressItem, MessagePart } from '../../types'

export interface MessagesToolCallSlice {
  addToolCall: (sessionId: string, messageId: string, toolCall: ToolCall) => void
  updateToolCallStatus: (sessionId: string, messageId: string, toolCallId: string, status: ToolCall['status'], result?: string, toolName?: string) => void
  closeStaleToolCalls: (sessionId: string, messageId: string) => void
  updateSearchProgress: (sessionId: string, messageId: string, updater: (items: SearchProgressItem[]) => SearchProgressItem[], toolCallId?: string) => void
}

export const createMessagesToolCallSlice: StateCreator<ChatState, [], [], MessagesToolCallSlice> = (set) => ({
  addToolCall: (sessionId, messageId, toolCall) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) => {
            if (msg.id !== messageId) return msg
            if ((msg.toolCalls ?? []).some((tc) => tc.id === toolCall.id)) return msg

            const now = Date.now()
            const parts = msg.parts ?? []
            const updatedParts = [...parts]
            const lastPart = updatedParts.length > 0 ? updatedParts[updatedParts.length - 1] : null
            if (lastPart && lastPart.kind === 'reasoning' && !lastPart.completedAt) {
              updatedParts[updatedParts.length - 1] = {
                ...lastPart,
                completedAt: now,
                text: lastPart.text,
              } as MessagePart
            }

            updatedParts.push({
              kind: 'tool',
              id: `tool-${now}`,
              toolCallId: toolCall.id,
              startedAt: now,
            } as MessagePart)

            return { ...msg, toolCalls: [...(msg.toolCalls ?? []), toolCall], parts: updatedParts }
          }),
        },
      }
    }),

  updateToolCallStatus: (sessionId, messageId, toolCallId, status, result, toolName) =>
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

  closeStaleToolCalls: (sessionId, messageId) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      const staleError = 'Interrumpido: el stream terminó sin resultado'
      let changed = false
      const updated = sessionMessages.map((msg) => {
        if (msg.id !== messageId) return msg
        const updatedToolCalls = (msg.toolCalls ?? []).map((tc) => {
          if (tc.status !== 'running') return tc
          changed = true
          return { ...tc, status: 'error' as const, error: staleError, completedAt: Date.now() }
        })
        return { ...msg, toolCalls: updatedToolCalls }
      })
      if (!changed) return s
      return { messagesBySession: { ...s.messagesBySession, [sessionId]: updated } }
    }),

  updateSearchProgress: (sessionId, messageId, updater, toolCallId) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) =>
            msg.id === messageId
              ? toolCallId
                ? {
                    ...msg,
                    toolCalls: (msg.toolCalls ?? []).map((tc) =>
                      tc.id === toolCallId
                        ? { ...tc, searchProgress: updater(tc.searchProgress ?? []) }
                        : tc
                    ),
                  }
                : { ...msg, searchProgress: updater(msg.searchProgress ?? []) }
              : msg
          ),
        },
      }
    }),
})
