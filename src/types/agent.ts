export type AgentType =
  | 'coding'
  | 'research'
  | 'automation'
  | 'project'
  | 'mcp'

export type AgentStatus = 'idle' | 'running' | 'thinking' | 'error' | 'completed'

export interface Agent {
  id: string
  name: string
  type: AgentType
  status: AgentStatus
  model: string
  createdAt: number
  tools: string[]
  description: string
}

export interface Task {
  id: string
  agentId: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'error'
  steps: TaskStep[]
  createdAt: number
  completedAt?: number
}

export interface TaskStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  tool?: string
  durationMs?: number
  error?: string
}
