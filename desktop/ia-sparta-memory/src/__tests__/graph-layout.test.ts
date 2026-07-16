import { describe, expect, it } from 'vitest'
import { computeRelations } from '../graph-layout'
import type { MemoryEntry, MemoryRelation } from 'ia-sparta-core'

function turn(id: string): MemoryEntry {
  return {
    id,
    content: `Usuario:\nPregunta ${id}\n\nRespuesta:\nRespuesta ${id}`,
    source: 'auto',
    category: 'conversation_turn',
    createdAt: Date.now(),
    sourceSessionId: 'session-1',
    sourceMessageId: `message-${id}`,
  }
}

describe('computeRelations', () => {
  it('does not fully connect conversation turn nodes by category', () => {
    const explicit: MemoryRelation = {
      fromId: 'a',
      toId: 'b',
      type: 'same_session',
      weight: 0.95,
      entityType: 'next_turn',
    }

    const relations = computeRelations([turn('a'), turn('b'), turn('c')], [explicit])

    expect(relations).toEqual([explicit])
  })
})
