import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createMessagesSlice, type MessagesSlice } from './chat.messages.slice'
import { createStreamingSlice, type StreamingSlice } from './chat.streaming.slice'

export type ChatState = MessagesSlice & StreamingSlice

export const useChatStore = create<ChatState>()(
  persist(
    (...a) => ({
      ...createMessagesSlice(...a),
      ...createStreamingSlice(...a),
    }),
    {
      name: 'sparta-chat',
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version < 2) {
          return {
            messagesBySession:
              state.messagesBySession && typeof state.messagesBySession === 'object'
                ? Object.fromEntries(
                    Object.entries(state.messagesBySession as Record<string, unknown>).map(([sid, msgs]) => [
                      sid,
                      Array.isArray(msgs)
                        ? msgs.map((m: Record<string, unknown>) => ({
                            ...m,
                            isStreaming: false,
                            lastChunkSeq: (m as { lastChunkSeq?: number }).lastChunkSeq,
                            lastThinkChunkSeq: (m as { lastThinkChunkSeq?: number }).lastThinkChunkSeq,
                          }))
                        : [],
                    ])
                  )
                : {},
          }
        }
        if (version < 3) {
          return {
            messagesBySession:
              state.messagesBySession && typeof state.messagesBySession === 'object'
                ? Object.fromEntries(
                    Object.entries(state.messagesBySession as Record<string, unknown>).map(([sid, msgs]) => [
                      sid,
                      Array.isArray(msgs)
                        ? msgs.map((m: Record<string, unknown>) => ({
                            ...m,
                            reasoningContent: (m as { reasoningContent?: string }).reasoningContent,
                            reasoningDetails: (m as { reasoningDetails?: unknown[] }).reasoningDetails,
                            codexReasoningItems: (m as { codexReasoningItems?: unknown[] }).codexReasoningItems,
                          }))
                        : [],
                    ])
                  )
                : {},
          }
        }
        return persisted
      },
      partialize: (state) => ({
        messagesBySession: state.messagesBySession,
      }),
    }
  )
)
