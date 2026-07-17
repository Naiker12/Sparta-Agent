import type { StateCreator } from 'zustand'
import type { ChatState } from './chat.store'

export interface MessagesLifecycleSlice {
  onStreamEnd: (sessionId: string, messageId: string) => void
  deduplicateReasoningFromContent: (sessionId: string, messageId: string) => void
}

export const createMessagesLifecycleSlice: StateCreator<ChatState, [], [], MessagesLifecycleSlice> = (set) => ({
  deduplicateReasoningFromContent: (sessionId, messageId) =>
    set((s) => {
      const sessionMessages = s.messagesBySession[sessionId]
      if (!sessionMessages) return s
      const target = sessionMessages.find((m) => m.id === messageId)
      if (!target || !target.reasoningText) return s
      const rt = target.reasoningText.trim()
      let content = target.content
      if (!rt || !content) return s

      content = content.replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '')
      content = content.replace(/<\/?(?:think|thinking|reasoning)>/gi, '').trim()

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
})
