import type { SessionMode } from './settings'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface ToolCall {
  id: string
  toolName: string
  input: unknown
  output?: string
  status: 'running' | 'completed' | 'error'
  durationMs?: number
  error?: string
  startedAt?: number
  /** Query string for web_search tool calls (moved from Message level to fix multi-search bug) */
  searchQuery?: string
  /** Progress items scoped to this specific tool call (moved from Message level) */
  searchProgress?: SearchProgressItem[]
}

export interface PipelineStep {
  id?: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  timestamp: number
  meta?: string
  durationMs?: number
}

export interface SearchProgressItem {
  id: string
  url: string
  title: string
  status: 'pending' | 'reading' | 'visited'
}

export type ThinkingStatus = 'idle' | 'starting' | 'streaming' | 'completed' | 'collapsed'

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

export interface ReasoningDetail {
  type?: string
  text?: string
  signature?: string
}

/**
 * A single "part" in the message timeline.
 * Parts are rendered in order to create a unified timeline of reasoning + tool calls.
 * This replaces the old approach of rendering SearchProgressBlock + ToolCalls + ThinkingBlock
 * as three separate disconnected blocks.
 */
export type MessagePart =
  | { kind: 'reasoning'; id: string; text: string; startedAt: number; completedAt?: number }
  | { kind: 'tool'; id: string; toolCallId: string; startedAt: number }

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  sessionId: string
  agentId?: string
  reasoningText?: string
  thinkingStatus?: ThinkingStatus
  thinkingStatusText?: string
  thinkingTokensUsed?: number
  reasoningContent?: string
  reasoningDetails?: ReasoningDetail[]
  codexReasoningItems?: unknown[]
  isStreaming?: boolean
  lastChunkSeq?: number
  lastThinkChunkSeq?: number
  reasoningStartedAt?: number
  reasoningCompletedAt?: number
  toolCalls?: ToolCall[]
  pipelineSteps?: PipelineStep[]
  /** Ordered list of parts for unified timeline rendering */
  parts?: MessagePart[]
  /** @deprecated Moved to ToolCall.searchProgress — kept for backward compat during migration */
  searchProgress?: SearchProgressItem[]
  /** @deprecated Moved to ToolCall.searchQuery — kept for backward compat during migration */
  searchQuery?: string
  suggestions?: string[]
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
  reasoningTokens?: number
  sessionMode?: SessionMode
}

export interface ChatRequest {
  model: string
  messages: { role: MessageRole; content: string; reasoning_content?: string; reasoning?: string }[]
  system?: string
  stream?: boolean
  maxTokens?: number
  temperature?: number
  thinkingEnabled?: boolean
  thinkingBudget?: number
  reasoningEffort?: ReasoningEffort
}

export interface ChatStreamChunk {
  type: 'thinking_token' | 'content_token' | 'tool_call' | 'done' | 'error'
  delta?: string
  toolCall?: Partial<ToolCall>
  error?: string
}