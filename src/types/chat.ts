export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  sessionId: string
  agentId?: string
  thinking?: string
  toolCalls?: ToolCall[]
  pipelineSteps?: PipelineStep[]
}

export interface ToolCall {
  id: string
  toolName: string
  input: unknown
  output?: string
  status: 'running' | 'completed' | 'error'
  durationMs?: number
  error?: string
}

export interface PipelineStep {
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  timestamp: number
}

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  model: string
  messageCount: number
  agentId?: string
  pinned?: boolean
  archived?: boolean
}
