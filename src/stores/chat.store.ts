import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Message, ToolCall, ThinkingStatus, SearchProgressItem, MessagePart } from '@/types'
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
  closeStaleToolCalls: (sessionId: string, messageId: string) => void
  updateSearchProgress: (sessionId: string, messageId: string, updater: (items: SearchProgressItem[]) => SearchProgressItem[], toolCallId?: string) => void
  startStreaming: (sessionId: string) => AbortController
  stopStreaming: (sessionId?: string) => void
  injectWhileStreaming: (text: string) => void
  consumePendingInjections: () => string[]
  cleanupStaleStreams: () => void
  getStreamState: (sessionId: string) => StreamState | undefined

  // Thinking lifecycle
  onThinkingStart: (sessionId: string, messageId: string) => void
  onThinkingEnd: (sessionId: string, messageId: string, tokensUsed: number) => void
  setThinkingStatusText: (sessionId: string, messageId: string, text: string) => void
  onReasoningAvailable: (sessionId: string, messageId: string, text: string) => void
  onStreamEnd: (sessionId: string, messageId: string) => void
  deduplicateReasoningFromContent: (sessionId: string, messageId: string) => void
  closeReasoningPart: (sessionId: string, messageId: string) => void
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
          const streamEntry = s.streamingBySession[sessionId]
          if (streamEntry) {
            streamEntry.abortController.abort()
          }
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
          // Reject thinking after streaming ended
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

          // If last part is already a reasoning part that's not completed, extend it
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

          // No reasoning part yet — create one
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

      addToolCall: (sessionId, messageId, toolCall) =>
        set((s) => {
          const sessionMessages = s.messagesBySession[sessionId]
          if (!sessionMessages) return s
          return {
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: sessionMessages.map((msg) => {
                if (msg.id !== messageId) return msg

                // Skip if toolCall already exists
                if ((msg.toolCalls ?? []).some((tc) => tc.id === toolCall.id)) return msg

                const now = Date.now()
                const parts = msg.parts ?? []

                // Close any open reasoning part before inserting tool part
                const updatedParts = [...parts]
                const lastPart = updatedParts.length > 0 ? updatedParts[updatedParts.length - 1] : null
                if (lastPart && lastPart.kind === 'reasoning' && !lastPart.completedAt) {
                  updatedParts[updatedParts.length - 1] = {
                    ...lastPart,
                    completedAt: now,
                    text: lastPart.text,
                  } as MessagePart
                }

                // Add tool part
                updatedParts.push({
                  kind: 'tool',
                  id: `tool-${now}`,
                  toolCallId: toolCall.id,
                  startedAt: now,
                } as MessagePart)

                return {
                  ...msg,
                  toolCalls: [...(msg.toolCalls ?? []), toolCall],
                  parts: updatedParts,
                }
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
                    // Scoped write: update searchProgress inside the matching ToolCall
                    ? {
                        ...msg,
                        toolCalls: (msg.toolCalls ?? []).map((tc) =>
                          tc.id === toolCallId
                            ? { ...tc, searchProgress: updater(tc.searchProgress ?? []) }
                            : tc
                        ),
                      }
                    // Legacy unscoped write: update message-level searchProgress (deprecated path)
                    : { ...msg, searchProgress: updater(msg.searchProgress ?? []) }
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
                  // Create initial reasoning part from existing reasoningText
                  const text = msg.reasoningText ?? ''
                  if (!text) return msg
                  return {
                    ...msg,
                    parts: [{ kind: 'reasoning', id: `reasoning-${Date.now()}`, text, startedAt: msg.reasoningStartedAt ?? Date.now(), completedAt: Date.now() } as MessagePart],
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
                  ? {
                      ...msg,
                      reasoningText: text,
                      thinkingStatus: 'completed' as ThinkingStatus,
                    }
                  : msg
              ),
            },
          }
        }),

      deduplicateReasoningFromContent: (sessionId, messageId) =>
        set((s) => {
          const sessionMessages = s.messagesBySession[sessionId]
          if (!sessionMessages) return s
          const target = sessionMessages.find((m) => m.id === messageId)
          if (!target || !target.reasoningText) return s
          const rt = target.reasoningText.trim()
          let content = target.content
          if (!rt || !content) return s

          // Strip inline think/reasoning tags from content first
          content = content.replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '')
          content = content.replace(/<\/?(?:think|thinking|reasoning)>/gi, '').trim()

          // Normalize whitespace for comparison (like Hermes)
          const normalize = (v: string) => v.replace(/\s+/g, ' ').trim()
          const nRt = normalize(rt)
          const nContent = normalize(content)

          if (nContent.startsWith(nRt) || nRt.startsWith(nContent)) {
            const deduped = content.slice(rt.length).trimStart()
            if (deduped.length > 0) {
              return {
                messagesBySession: {
                  ...s.messagesBySession,
                  [sessionId]: sessionMessages.map((msg) =>
                    msg.id === messageId ? { ...msg, content: deduped } : msg
                  ),
                },
              }
            }
            // If dedup leaves empty content but we have reasoning, keep content empty
            return {
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: sessionMessages.map((msg) =>
                  msg.id === messageId ? { ...msg, content: '' } : msg
                ),
              },
            }
          }
          return s
        }),

      onStreamEnd: (sessionId, messageId) =>
        set((s) => {
          const sessionMessages = s.messagesBySession[sessionId]
          if (!sessionMessages) return s
          const staleError = 'Interrumpido: el stream terminó sin resultado'
          const updated = sessionMessages.map((msg) => {
            if (msg.id !== messageId) return msg
            const updatedToolCalls = (msg.toolCalls ?? []).map((tc) => {
              if (tc.status !== 'running') return tc
              return { ...tc, status: 'error' as const, error: staleError, completedAt: Date.now() }
            })
            return { ...msg, isStreaming: false, toolCalls: updatedToolCalls }
          })
          return { messagesBySession: { ...s.messagesBySession, [sessionId]: updated } }
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
      version: 3,
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
