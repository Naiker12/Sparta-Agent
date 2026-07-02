import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Message, ToolCall, ThinkingStatus, SearchProgressItem } from '@/types'
import { useSessionStore } from './session.store'

export interface StreamState {
  isStreaming: boolean
  abortController: AbortController
  tokensUsed: number
  startedAt: number
}

interface ChatState {
  messagesBySession: Record<string, Message[]>
  isStreaming: boolean
  abortController: AbortController | null
  streamingBySession: Record<string, StreamState>
  pendingInjections: string[]

  deleteSessionMessages: (sessionId: string) => void
  deleteMessage: (sessionId: string, messageId: string) => void
  addMessage: (message: Message) => void
  updateMessage: (id: string, updater: Partial<Message> | ((msg: Message) => Partial<Message>)) => void
  appendContent: (sessionId: string, messageId: string, delta: string, chunkSeq?: number) => void
  appendThinking: (sessionId: string, messageId: string, delta: string, chunkSeq?: number) => void
  addToolCall: (sessionId: string, messageId: string, toolCall: ToolCall) => void
  updateToolCallStatus: (sessionId: string, messageId: string, toolCallId: string, status: ToolCall['status'], result?: string, toolName?: string) => void
  updateSearchProgress: (sessionId: string, messageId: string, updater: (items: SearchProgressItem[]) => SearchProgressItem[]) => void
  startStreaming: (sessionId: string) => AbortController
  stopStreaming: (sessionId?: string) => void
  injectWhileStreaming: (text: string) => void
  consumePendingInjections: () => string[]
  cleanupStaleStreams: () => void
  getStreamState: (sessionId: string) => StreamState | undefined

  // Thinking lifecycle
  onThinkingStart: (sessionId: string, messageId: string) => void
  onThinkingEnd: (sessionId: string, messageId: string, tokensUsed: number) => void
  onStreamEnd: (sessionId: string, messageId: string) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messagesBySession: {},
      isStreaming: false,
      abortController: null,
      streamingBySession: {},
      pendingInjections: [],

      deleteSessionMessages: (sessionId: string) =>
        set((s) => {
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
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: filtered,
            },
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
          const target = sessionMessages.find((m) => m.id === messageId)
          if (!target) {
            console.warn('[chat.store] appendContent: mensaje no encontrado', messageId.slice(0, 8), 'en sesión', sessionId.slice(0, 8))
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
          if (chunkSeq !== undefined && target.lastThinkChunkSeq !== undefined && chunkSeq <= target.lastThinkChunkSeq) {
            console.warn(`[chat.store] Duplicate thinking chunk #${chunkSeq} <= lastThinkChunkSeq #${target.lastThinkChunkSeq} for message ${messageId.slice(0, 8)}`)
            return s
          }
          return {
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: sessionMessages.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      reasoningText: (msg.reasoningText ?? '') + delta,
                      thinkingStatus: (msg.thinkingStatus === 'idle' || msg.thinkingStatus === 'starting' || msg.thinkingStatus === undefined) ? 'streaming' : msg.thinkingStatus,
                      isStreaming: true,
                      lastThinkChunkSeq: chunkSeq ?? msg.lastThinkChunkSeq,
                    }
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

      updateSearchProgress: (sessionId, messageId, updater) =>
        set((s) => {
          const sessionMessages = s.messagesBySession[sessionId]
          if (!sessionMessages) return s
          return {
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: sessionMessages.map((msg) =>
                msg.id === messageId
                  ? { ...msg, searchProgress: updater(msg.searchProgress ?? []) }
                  : msg
              ),
            },
          }
        }),

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

      cleanupStaleStreams: () => {
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
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version < 2) {
          // Sessions were moved to the dedicated session store in version 2.
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
        return persisted
      },
      partialize: (state) => ({
        messagesBySession: state.messagesBySession,
      }),
    }
  )
)
