export const TASK_STATUSES = [
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
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

export interface TaskStep {
  id: string
  title: string
  description?: string
  status: TaskStatus
  weight?: number
}

export interface Task {
  id: string
  status: TaskStatus
  title: string
  steps: TaskStep[]
  createdAt: number
  updatedAt: number
}
