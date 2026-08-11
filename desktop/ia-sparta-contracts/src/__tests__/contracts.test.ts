import { describe, expect, it } from 'vitest'
import {
  TASK_STATUSES,
  type PermissionRequestPayload,
  type ToolDescriptor,
} from '../index'

describe('ia-sparta-contracts', () => {
  it('expone los estados de ciclo de vida de una tarea en orden estable', () => {
    expect(TASK_STATUSES).toEqual([
      'CREATED',
      'PLANNING',
      'READY',
      'RUNNING',
      'WAITING_TOOL',
      'WAITING_PERMISSION',
      'WAITING_USER',
      'VERIFYING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ])
  })

  it('permite describir una herramienta y una aprobación sin dependencias de renderer', () => {
    const tool: ToolDescriptor = {
      id: 'write_file',
      description: 'Escribe contenido en un archivo.',
      inputSchema: { type: 'object' },
      risk: 'high',
      sideEffects: ['filesystem'],
      permission: 'file_write',
      idempotent: false,
      supportsCancellation: false,
    }
    const request: PermissionRequestPayload = {
      requestId: 'permission-1',
      action: 'file_write',
      target: 'C:/workspace/README.md',
      risk: 'high',
      preview: 'write_file C:/workspace/README.md',
    }

    expect(tool.permission).toBe(request.action)
  })
})
