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
    msg.isStreaming = true
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

  it('thinking intercalado crea reasoning parts separados (think → text → think)', () => {
    const sid = useSessionStore.getState().createSession('Test')
    const msg = createMessage(sid, 'assistant', '')
    msg.isStreaming = true
    useChatStore.getState().addMessage(msg)
    const mid = msg.id

    const getMsg = () => useChatStore.getState().messagesBySession[sid].find((m) => m.id === mid)!
    const getReasoningPart = (i: number) => getMsg().parts![i] as Extract<import('@/types').MessagePart, { kind: 'reasoning' }>

    // ── Primer ciclo de thinking ──
    useChatStore.getState().onThinkingStart(sid, mid)
    useChatStore.getState().appendThinking(sid, mid, 'analizo el request', 1)
    useChatStore.getState().appendThinking(sid, mid, ', veo que falta algo', 2)

    expect(getMsg().parts).toHaveLength(1)
    expect(getReasoningPart(0).kind).toBe('reasoning')
    expect(getReasoningPart(0).completedAt).toBeUndefined()
    expect(getReasoningPart(0).text).toBe('analizo el request, veo que falta algo')

    // ── thinking:completed cierra el primer reasoning part ──
    useChatStore.getState().onThinkingEnd(sid, mid, 10)

    expect(getMsg().thinkingStatus).toBe('completed')
    expect(getMsg().parts).toHaveLength(1)
    expect(getReasoningPart(0).completedAt).toBeDefined()

    // ── Segundo ciclo de thinking (simula modelo que piensa de nuevo a mitad de respuesta) ──
    useChatStore.getState().onThinkingStart(sid, mid)
    useChatStore.getState().appendThinking(sid, mid, 'ahora busco archivos', 3)
    useChatStore.getState().appendThinking(sid, mid, ' relevantes', 4)

    expect(getMsg().parts).toHaveLength(2)
    // Primer part sigue cerrado
    expect(getReasoningPart(0).completedAt).toBeDefined()
    // Segundo part está abierto
    expect(getReasoningPart(1).kind).toBe('reasoning')
    expect(getReasoningPart(1).completedAt).toBeUndefined()
    expect(getReasoningPart(1).text).toBe('ahora busco archivos relevantes')
    // reasoningText acumula todo
    expect(getMsg().reasoningText).toBe('analizo el request, veo que falta algoahora busco archivos relevantes')

    // ── thinking:completed cierra el segundo reasoning part ──
    useChatStore.getState().onThinkingEnd(sid, mid, 25)

    expect(getMsg().thinkingStatus).toBe('completed')
    expect(getMsg().parts).toHaveLength(2)
    expect(getReasoningPart(0).completedAt).toBeDefined()
    expect(getReasoningPart(1).completedAt).toBeDefined()
    expect(getMsg().thinkingTokensUsed).toBe(25)
  })

  it('onThinkingEnd cierra el reasoning part abierto con completedAt', () => {
    const sid = useSessionStore.getState().createSession('Test')
    const msg = createMessage(sid, 'assistant', '')
    msg.isStreaming = true
    useChatStore.getState().addMessage(msg)
    const mid = msg.id

    useChatStore.getState().onThinkingStart(sid, mid)
    useChatStore.getState().appendThinking(sid, mid, 'pensando', 1)

    const getPart = () => useChatStore.getState().messagesBySession[sid].find((m) => m.id === mid)!.parts![0] as Extract<import('@/types').MessagePart, { kind: 'reasoning' }>
    expect(getPart().completedAt).toBeUndefined()

    useChatStore.getState().onThinkingEnd(sid, mid, 5)

    expect(getPart().completedAt).toBeDefined()
    const afterState = useChatStore.getState().messagesBySession[sid].find((m) => m.id === mid)
    expect(afterState?.thinkingStatus).toBe('completed')
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
