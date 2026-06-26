export type MessageRole = 'user' | 'assistant' | 'system'

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

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  sessionId: string
  agentId?: string
  thinking?: string
  reasoningText?: string
  isStreaming?: boolean
  toolCalls?: ToolCall[]
  pipelineSteps?: PipelineStep[]
}

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  model: string
  providerId?: string
  messageCount: number
  agentId?: string
  pinned?: boolean
  archived?: boolean
}

export interface ChatRequest {
  model: string
  messages: { role: MessageRole; content: string }[]
  system?: string
  stream?: boolean
  maxTokens?: number
  temperature?: number
}

export interface ChatStreamChunk {
  type: 'thinking_token' | 'content_token' | 'tool_call' | 'done' | 'error'
  delta?: string
  toolCall?: Partial<ToolCall>
  error?: string
}
