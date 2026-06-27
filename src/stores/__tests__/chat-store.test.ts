import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../chat.store'

function createMessage(sessionId: string, role: 'user' | 'assistant' = 'user', content = 'hola'): ReturnType<typeof useChatStore.getState>['messagesBySession'][string][number] {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    sessionId,
  }
}

describe('chat store deletion', () => {
  beforeEach(() => {
    useChatStore.setState(useChatStore.getInitialState?.() ?? { sessions: [], activeSessionId: null, messagesBySession: {} } as never)
  })

  it('deleteSession removes session, messages and cleans streaming state', () => {
    const sid = useChatStore.getState().createSession('Test')
    const msg = createMessage(sid)
    useChatStore.getState().addMessage(msg)
    useChatStore.getState().startStreaming(sid)
    useChatStore.getState().switchSession(sid)

    useChatStore.getState().deleteSession(sid)

    const state = useChatStore.getState()
    expect(state.sessions.find((s) => s.id === sid)).toBeUndefined()
    expect(state.messagesBySession[sid]).toBeUndefined()
    expect(state.streamingBySession[sid]).toBeUndefined()
    expect(state.activeSessionId).toBeNull()
    expect(state.isStreaming).toBe(false)
  })

  it('deleteMessage removes a single message and decrements count', () => {
    const sid = useChatStore.getState().createSession('Test')
    const msg = createMessage(sid)
    useChatStore.getState().addMessage(msg)
    const beforeCount = useChatStore.getState().sessions.find((s) => s.id === sid)!.messageCount

    useChatStore.getState().deleteMessage(sid, msg.id)

    const state = useChatStore.getState()
    expect(state.messagesBySession[sid].find((m) => m.id === msg.id)).toBeUndefined()
    expect(state.sessions.find((s) => s.id === sid)!.messageCount).toBe(beforeCount - 1)
  })
})
