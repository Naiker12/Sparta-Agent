import { describe, expect, it } from 'vitest'
import { evaluatePermission } from '../permission-policy'

describe('main-process permission policy', () => {
  it('gives an explicit deny rule precedence over a matching allow rule', () => {
    expect(evaluatePermission({
      action: 'file_write', target: 'C:/repo/.env', workspaceRoot: 'C:/repo', preset: 'permissive',
      rules: [
        { action: 'file_write', target: 'C:/repo/*', effect: 'allow' },
        { action: 'file_write', target: 'C:/repo/.env', effect: 'deny' },
      ],
    })).toBe('deny')
  })

  it('allows a workspace-contained read but prompts for a write by default', () => {
    const base = { target: 'C:/repo/src/app.ts', workspaceRoot: 'C:/repo', preset: 'default' as const, rules: [] }
    expect(evaluatePermission({ ...base, action: 'file_read' })).toBe('allow')
    expect(evaluatePermission({ ...base, action: 'file_write' })).toBe('prompt')
  })
})
