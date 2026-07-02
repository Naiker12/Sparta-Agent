import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../chat.store'
import { useSessionStore } from '../session.store'

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
    useChatStore.setState(useChatStore.getInitialState?.() ?? { messagesBySession: {} } as never)
    useSessionStore.setState(useSessionStore.getInitialState?.() ?? { sessions: [], activeSessionId: null } as never)
  })

  it('deleteSession removes session, messages and cleans streaming state', () => {
    const sid = useSessionStore.getState().createSession('Test')
    const msg = createMessage(sid)
    useChatStore.getState().addMessage(msg)
    useChatStore.getState().startStreaming(sid)
    useSessionStore.getState().switchSession(sid)

    useSessionStore.getState().deleteSession(sid)
    useChatStore.getState().deleteSessionMessages(sid)

    const sessionState = useSessionStore.getState()
    const chatState = useChatStore.getState()
    expect(sessionState.sessions.find((s) => s.id === sid)).toBeUndefined()
    expect(chatState.messagesBySession[sid]).toBeUndefined()
    expect(chatState.streamingBySession[sid]).toBeUndefined()
    expect(sessionState.activeSessionId).toBeNull()
    expect(chatState.isStreaming).toBe(false)
  })

  it('transiciona thinkingStatus: starting → streaming → completed sin quedarse pegado', () => {
    const sid = useSessionStore.getState().createSession('Test')
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
    const sid = useSessionStore.getState().createSession('Test')
    const msg = createMessage(sid)
    useChatStore.getState().addMessage(msg)
    const beforeCount = useSessionStore.getState().sessions.find((s) => s.id === sid)!.messageCount

    useChatStore.getState().deleteMessage(sid, msg.id)

    const chatState = useChatStore.getState()
    const sessionState = useSessionStore.getState()
    expect(chatState.messagesBySession[sid].find((m) => m.id === msg.id)).toBeUndefined()
    expect(sessionState.sessions.find((s) => s.id === sid)!.messageCount).toBe(beforeCount - 1)
  })
})
