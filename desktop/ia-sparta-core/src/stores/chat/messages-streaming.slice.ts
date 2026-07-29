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
      const parts = target.parts ?? []
      let updatedParts = parts.slice()
      const lastPart = parts.length > 0 ? parts[parts.length - 1] : null

      if (lastPart && lastPart.kind === 'reasoning' && !lastPart.completedAt) {
        const lp = updatedParts[updatedParts.length - 1] as MessagePart & { completedAt?: number }
        lp.completedAt = Date.now()
      }

      const textLastPart = updatedParts.length > 0 ? updatedParts[updatedParts.length - 1] : null
      if (textLastPart && textLastPart.kind === 'text') {
        const tp = updatedParts[updatedParts.length - 1] as MessagePart & { content?: string }
        tp.content = (tp.content ?? '') + delta
      } else {
        updatedParts.push({
          kind: 'text',
          id: `text-${Date.now()}`,
          content: delta,
          startedAt: Date.now(),
        })
      }

      const updated = sessionMessages.map((msg) =>
        msg.id === messageId
          ? { ...msg, content: msg.content + delta, parts: updatedParts, isStreaming: true, lastChunkSeq: chunkSeq ?? msg.lastChunkSeq }
          : msg
      )
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: updated,
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
      let updatedParts = parts.slice()

      if (lastPart && lastPart.kind === 'reasoning' && !lastPart.completedAt) {
        const lp = updatedParts[updatedParts.length - 1] as MessagePart & { text?: string }
        lp.text = (lp.text ?? '') + delta
      } else {
        const now = Date.now()
        updatedParts.push({
          kind: 'reasoning',
          id: `reasoning-${now}`,
          text: delta,
          origin: target.reasoningOrigin ?? 'native',
          startedAt: now,
        })
      }

      const updated = sessionMessages.map((msg) =>
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
      )
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: updated,
        },
      }
    }),
})
