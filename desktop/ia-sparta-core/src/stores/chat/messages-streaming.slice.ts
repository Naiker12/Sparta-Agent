import type { StateCreator } from 'zustand'
import type { ChatState } from './chat.store'
import type { MessagePart } from '../../types'

export interface MessagesStreamingSlice {
  appendContent: (sessionId: string, messageId: string, delta: string, chunkSeq?: number) => void
  appendThinking: (sessionId: string, messageId: string, delta: string, chunkSeq?: number) => void
}

export const createMessagesStreamingSlice: StateCreator<ChatState, [], [], MessagesStreamingSlice> = (set) => ({
  appendContent: (sessionId, messageId, delta, chunkSeq) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      if (!delta) return s
      const target = sessionMessages.find((m) => m.id === messageId)
      if (!target) {
        console.warn('[chat.store] appendContent: mensaje no encontrado', messageId.slice(0, 8), 'en sesión', sessionId.slice(0, 8))
        return s
      }
      if (!target.isStreaming) {
        console.warn('[chat.store] appendContent ignorado: mensaje ya no está stremeando', messageId.slice(0, 8))
        return s
      }
      if (chunkSeq !== undefined && target.lastChunkSeq !== undefined && chunkSeq <= target.lastChunkSeq) {
        console.warn(`[chat.store] Duplicate content chunk #${chunkSeq} <= lastChunkSeq #${target.lastChunkSeq} for message ${messageId.slice(0, 8)}`)
        return s
      }
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) =>
            msg.id === messageId
              ? { ...msg, content: msg.content + delta, isStreaming: true, lastChunkSeq: chunkSeq ?? msg.lastChunkSeq }
              : msg
          ),
        },
      }
    }),

  appendThinking: (sessionId, messageId, delta, chunkSeq) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      const target = sessionMessages.find((m) => m.id === messageId)
      if (!target) {
        console.warn('[chat.store] appendThinking: mensaje no encontrado', messageId.slice(0, 8), 'en sesión', sessionId.slice(0, 8))
        return s
      }
      if (!target.isStreaming) {
        console.warn('[chat.store] appendThinking ignorado: mensaje ya no está stremeando', messageId.slice(0, 8))
        return s
      }
      if (chunkSeq !== undefined && target.lastThinkChunkSeq !== undefined && chunkSeq <= target.lastThinkChunkSeq) {
        console.warn(`[chat.store] Duplicate thinking chunk #${chunkSeq} <= lastThinkChunkSeq #${target.lastThinkChunkSeq} for message ${messageId.slice(0, 8)}`)
        return s
      }
      const newText = (target.reasoningText ?? '') + delta
      const parts = target.parts ?? []
      const lastPart = parts.length > 0 ? parts[parts.length - 1] : null

      if (lastPart && lastPart.kind === 'reasoning' && !lastPart.completedAt) {
        const updatedParts = [...parts]
        updatedParts[updatedParts.length - 1] = {
          ...lastPart,
          text: (lastPart as Extract<MessagePart, { kind: 'reasoning' }>).text + delta,
        } as MessagePart
        return {
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: sessionMessages.map((msg) =>
              msg.id === messageId
                ? {
                    ...msg,
                    reasoningText: newText,
                    parts: updatedParts,
                    thinkingStatus: (msg.thinkingStatus === 'idle' || msg.thinkingStatus === 'starting' || msg.thinkingStatus === undefined) ? 'streaming' : msg.thinkingStatus,
                    isStreaming: true,
                    lastThinkChunkSeq: chunkSeq ?? msg.lastThinkChunkSeq,
                  }
                : msg
            ),
          },
        }
      }

      const now = Date.now()
      const reasoningPart: MessagePart = {
        kind: 'reasoning',
        id: `reasoning-${now}`,
        text: delta,
        startedAt: now,
      }
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: sessionMessages.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  reasoningText: newText,
                  parts: [...parts, reasoningPart],
                  thinkingStatus: (msg.thinkingStatus === 'idle' || msg.thinkingStatus === 'starting' || msg.thinkingStatus === undefined) ? 'streaming' : msg.thinkingStatus,
                  isStreaming: true,
                  lastThinkChunkSeq: chunkSeq ?? msg.lastThinkChunkSeq,
                }
              : msg
          ),
        },
      }
    }),
})
