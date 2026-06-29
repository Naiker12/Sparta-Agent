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

  it('transiciona thinkingStatus: starting → streaming → completed sin quedarse pegado', () => {
    const sid = useChatStore.getState().createSession('Test')
    const msg = createMessage(sid, 'assistant', '')
    useChatStore.getState().addMessage(msg)
    const mid = msg.id

    useChatStore.getState().onThinkingStart(sid, mid)
    const afterStart = useChatStore.getState().messagesBySession[sid].find((m) => m.id === mid)
    expect(afterStart?.thinkingStatus).toBe('starting')

    useChatStore.getState().appendThinking(sid, mid, 'pensando', 1)
    const afterToken = useChatStore.getState().messagesBySession[sid].find((m) => m.id === mid)
    expect(afterToken?.thinkingStatus).toBe('streaming')
    expect(afterToken?.reasoningText).toBe('pensando')

    useChatStore.getState().appendThinking(sid, mid, ' más', 2)
    const afterToken2 = useChatStore.getState().messagesBySession[sid].find((m) => m.id === mid)
    expect(afterToken2?.thinkingStatus).toBe('streaming')
    expect(afterToken2?.reasoningText).toBe('pensando más')

    useChatStore.getState().onThinkingEnd(sid, mid, 42)
    const afterEnd = useChatStore.getState().messagesBySession[sid].find((m) => m.id === mid)
    expect(afterEnd?.thinkingStatus).toBe('completed')
    expect(afterEnd?.thinkingTokensUsed).toBe(42)
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
