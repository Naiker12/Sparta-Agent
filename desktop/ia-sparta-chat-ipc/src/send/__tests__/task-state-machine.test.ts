import { describe, expect, it } from 'vitest'
import { canTransition } from '../task-state-machine'

describe('task state machine', () => {
  it('allows a running task to wait for permission and resume', () => {
    expect(canTransition('RUNNING', 'WAITING_PERMISSION')).toBe(true)
    expect(canTransition('WAITING_PERMISSION', 'RUNNING')).toBe(true)
  })

  it('rejects transitions out of terminal states', () => {
    expect(canTransition('COMPLETED', 'RUNNING')).toBe(false)
  })
})
