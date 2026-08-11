import { describe, expect, it } from 'vitest'
import { PendingApprovalStore } from '../pending-approval'

describe('pending approvals', () => {
  it('resolves only the matching approval request', async () => {
    const pending = new PendingApprovalStore()
    const waiting = pending.waitFor('request-1')
    expect(pending.respond('request-2', 'allow_once')).toBe(false)
    expect(pending.respond('request-1', 'allow_once')).toBe(true)
    await expect(waiting).resolves.toBe('allow_once')
  })
})
