import { describe, it, expect } from 'vitest'

function memoryMigrate(persisted: Record<string, unknown>, version: number): Record<string, unknown> {
  if (version < 1) {
    return {
      entries: Array.isArray(persisted.entries) ? persisted.entries : [],
      relations: Array.isArray(persisted.relations) ? persisted.relations : [],
      graphNodes: [],
    }
  }
  return persisted
}

function providerMigrate(persisted: Record<string, unknown>, version: number): Record<string, unknown> {
  if (version < 1) {
    const providers = Array.isArray(persisted.providers) ? persisted.providers : []
    return {
      providers: providers.map((p: Record<string, unknown>) => ({
        ...p,
        hasVaultKey: (p as { hasVaultKey?: boolean }).hasVaultKey ?? false,
        usage: (p as { usage?: unknown }).usage ?? null,
      })),
    }
  }
  return persisted
}

function chatMigrate(persisted: Record<string, unknown>, version: number): Record<string, unknown> {
  if (version < 1) {
    return {
      sessions: Array.isArray(persisted.sessions) ? persisted.sessions : [],
      activeSessionId: typeof persisted.activeSessionId === 'string' ? persisted.activeSessionId : null,
      messagesBySession: persisted.messagesBySession && typeof persisted.messagesBySession === 'object'
        ? Object.fromEntries(
            Object.entries(persisted.messagesBySession as Record<string, unknown>).map(([sid, msgs]) => [
              sid,
              Array.isArray(msgs) ? msgs.map((m: Record<string, unknown>) => ({
                ...m,
                isStreaming: false,
                lastChunkSeq: (m as { lastChunkSeq?: number }).lastChunkSeq,
                lastThinkChunkSeq: (m as { lastThinkChunkSeq?: number }).lastThinkChunkSeq,
              })) : [],
            ])
          )
        : {},
    }
  }
  return persisted
}

describe('memory.store migrate', () => {
  it('migrate from v0: agrega graphNodes vacío cuando no existe', () => {
    const old = { entries: [{ id: '1', content: 'test', source: 'auto', createdAt: 100 }], relations: [] }
    const result = memoryMigrate(old, 0)
    expect(result).toHaveProperty('entries')
    expect((result.entries as unknown[]).length).toBe(1)
    expect(result).toHaveProperty('graphNodes')
    expect((result.graphNodes as unknown[]).length).toBe(0)
  })

  it('migrate from v0: maneja entries no-array', () => {
    const old = { entries: null, relations: undefined }
    const result = memoryMigrate(old, 0)
    expect((result.entries as unknown[]).length).toBe(0)
    expect((result.relations as unknown[]).length).toBe(0)
  })

  it('v1: pasa datos sin cambios', () => {
    const old = { entries: [], relations: [], graphNodes: [] }
    const result = memoryMigrate(old, 1)
    expect(result).toEqual(old)
  })
})

describe('provider.store migrate', () => {
  it('migrate from v0: agrega hasVaultKey=false cuando falta', () => {
    const old = { providers: [{ id: '1', vendor: 'openai', label: 'OpenAI' }] }
    const result = providerMigrate(old, 0)
    const providers = result.providers as Array<Record<string, unknown>>
    expect(providers[0]).toHaveProperty('hasVaultKey', false)
    expect(providers[0]).toHaveProperty('usage', null)
  })

  it('v1: pasa datos sin cambios', () => {
    const old = { providers: [{ id: '1', vendor: 'openai', label: 'OpenAI', hasVaultKey: true, usage: null }] }
    const result = providerMigrate(old, 1)
    expect(result).toEqual(old)
  })
})

describe('chat.store migrate', () => {
  it('migrate from v0: añade isStreaming=false a mensajes', () => {
    const old = {
      sessions: [{ id: 's1', title: 'Test', createdAt: 100, updatedAt: 100, model: '', messageCount: 1 }],
      activeSessionId: 's1',
      messagesBySession: {
        s1: [{ id: 'm1', role: 'user', content: 'hola', timestamp: 100, sessionId: 's1' }],
      },
    }
    const result = chatMigrate(old, 0)
    const msgs = (result.messagesBySession as Record<string, unknown[]>).s1
    expect((msgs[0] as Record<string, unknown>).isStreaming).toBe(false)
  })

  it('migrate from v0: sesión sin mensajes', () => {
    const old = { sessions: [], activeSessionId: null, messagesBySession: {} }
    const result = chatMigrate(old, 0)
    expect(result).toHaveProperty('sessions')
    expect(result).toHaveProperty('messagesBySession')
  })

  it('v1: pasa datos sin cambios', () => {
    const old = {
      sessions: [],
      activeSessionId: null,
      messagesBySession: {},
    }
    const result = chatMigrate(old, 1)
    expect(result).toEqual(old)
  })
})
