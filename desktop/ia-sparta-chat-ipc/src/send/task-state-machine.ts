import type { TaskStatus } from 'ia-sparta-contracts'

const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  CREATED: ['PLANNING'],
  PLANNING: ['READY'],
  READY: ['RUNNING'],
  RUNNING: ['WAITING_TOOL', 'WAITING_PERMISSION', 'WAITING_USER', 'VERIFYING', 'FAILED', 'CANCELLED'],
  WAITING_TOOL: ['RUNNING'],
  WAITING_PERMISSION: ['RUNNING', 'CANCELLED'],
  WAITING_USER: ['RUNNING', 'CANCELLED'],
  VERIFYING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: ['PLANNING'],
  CANCELLED: [],
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to)
}
