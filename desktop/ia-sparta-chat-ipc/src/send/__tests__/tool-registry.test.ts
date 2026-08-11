import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearToolRegistry,
  dispatchToolCall,
  listToolDescriptors,
  registerTool,
  type RegisteredTool,
} from '../tool-registry'

const context = {
  sessionId: 'session-1',
  messageId: 'message-1',
  toolCallId: 'tool-1',
  toolName: 'echo',
  toolInput: { text: 'hola' },
}

describe('tool registry', () => {
  beforeEach(() => clearToolRegistry())

  it('despacha una herramienta registrada y expone su descriptor', async () => {
    registerTool({
      id: 'echo',
      description: 'Devuelve el texto recibido.',
      inputSchema: { type: 'object' },
      risk: 'low',
      sideEffects: ['none'],
      permission: 'file_read',
      idempotent: true,
      supportsCancellation: false,
      execute: async (call) => String(call.toolInput.text),
    })

    await expect(dispatchToolCall(context)).resolves.toBe('hola')
    expect(listToolDescriptors()).toEqual([
      expect.objectContaining({ id: 'echo', description: 'Devuelve el texto recibido.' }),
    ])
  })

  it('rechaza registros duplicados para impedir que schema y handler diverjan', () => {
    const tool: RegisteredTool = {
      id: 'echo', description: 'Echo', inputSchema: { type: 'object' }, risk: 'low',
      sideEffects: ['none'], permission: 'file_read', idempotent: true,
      supportsCancellation: false, execute: async () => 'ok',
    }

    registerTool(tool)
    expect(() => registerTool(tool)).toThrow('already registered')
  })

  it('devuelve el error compatible para una herramienta no registrada', async () => {
    await expect(dispatchToolCall({ ...context, toolName: 'unknown' })).resolves.toBe(
      "Error: La herramienta 'unknown' no está registrada o implementada en el sistema.",
    )
  })
})
