import type { StateCreator } from 'zustand'
import type { ChatState } from './chat.store'

export interface StreamState {
  isStreaming: boolean
  abortController: AbortController
  tokensUsed: number
  startedAt: number
}

export interface StreamingSlice {
  isStreaming: boolean
  abortController: AbortController | null
  streamingBySession: Record<string, StreamState>
  pendingInjections: string[]
  startStreaming: (sessionId: string) => AbortController
  stopStreaming: (sessionId?: string) => void
  injectWhileStreaming: (text: string) => void
  consumePendingInjections: () => string[]
  cleanupStaleStreams: () => void
  getStreamState: (sessionId: string) => StreamState | undefined
}

export const createStreamingSlice: StateCreator<ChatState, [], [], StreamingSlice> = (set, get) => ({
  isStreaming: false,
  abortController: null,
  streamingBySession: {},
  pendingInjections: [],

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
        set((state) => ({
          streamingBySession: rest,
          isStreaming: hasAnyStreaming,
          abortController: hasAnyStreaming ? Object.values(rest)[0]?.abortController ?? null : null,
          // Closing the transport alone left the last assistant message in
          // `thinkingStatus: streaming` until a late sidecar event arrived.
          // End it synchronously so pressing Stop always stops the visual
          // reasoning state as well.
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: (state.messagesBySession[sessionId] ?? []).map((message) =>
              message.isStreaming
                ? {
                    ...message,
                    isStreaming: false,
                    thinkingStatus: message.thinkingStatus === 'starting' || message.thinkingStatus === 'streaming'
                      ? 'completed'
                      : message.thinkingStatus,
                    reasoningCompletedAt: Date.now(),
                  }
                : message,
            ),
          },
        }))
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
})
