export type EventType =
  | 'agent:started'
  | 'agent:completed'
  | 'agent:error'
  | 'thinking:started'
  | 'thinking:token'
  | 'thinking:completed'
  | 'tool:called'
  | 'tool:result'
  | 'tool:error'
  | 'mcp:connected'
  | 'mcp:tool_discovered'
  | 'mcp:disconnected'
  | 'stream:token'
  | 'stream:completed'
  | 'stream:error'
  | 'pipeline:step'
  | 'chat:message'
  | 'session:created'
  | 'session:switched'
  | 'project:created'
  | 'project:switched'
  | 'project:deleted'
  | 'skill:created'
  | 'skill:updated'
  | 'skill:deleted'
  | 'skill:invoked'
  | 'channel:created'
  | 'channel:message'
  | 'channel:deleted'
  | 'memory:added'
  | 'memory:updated'
  | 'memory:deleted'
  | 'message:deleted'
  | 'message:edited'
  | 'message:shared'

export interface BaseEvent {
  type: EventType
  timestamp: number
  requestId?: string
  agentId?: string
}

export interface AgentStartedEvent extends BaseEvent {
  type: 'agent:started'
  agentType: string
}

export interface AgentCompletedEvent extends BaseEvent {
  type: 'agent:completed'
  result: string
}

export interface AgentErrorEvent extends BaseEvent {
  type: 'agent:error'
  error: string
}

export interface ThinkingStartedEvent extends BaseEvent {
  type: 'thinking:started'
}

export interface ThinkingTokenEvent extends BaseEvent {
  type: 'thinking:token'
  token: string
}

export interface ThinkingCompletedEvent extends BaseEvent {
  type: 'thinking:completed'
  summary: string
}

export interface ToolCalledEvent extends BaseEvent {
  type: 'tool:called'
  toolName: string
  input: unknown
}

export interface ToolResultEvent extends BaseEvent {
  type: 'tool:result'
  toolName: string
  output: string
  durationMs: number
}

export interface ToolErrorEvent extends BaseEvent {
  type: 'tool:error'
  toolName: string
  error: string
}

export interface MCPConnectedEvent extends BaseEvent {
  type: 'mcp:connected'
  serverId: string
}

export interface MCPToolDiscoveredEvent extends BaseEvent {
  type: 'mcp:tool_discovered'
  serverId: string
  tools: string[]
}

export interface MCPDisconnectedEvent extends BaseEvent {
  type: 'mcp:disconnected'
  serverId: string
}

export interface StreamTokenEvent extends BaseEvent {
  type: 'stream:token'
  token: string
}

export interface StreamCompletedEvent extends BaseEvent {
  type: 'stream:completed'
  usage?: { inputTokens: number; outputTokens: number }
}

export interface StreamErrorEvent extends BaseEvent {
  type: 'stream:error'
  error: string
}

export interface PipelineStepEvent extends BaseEvent {
  type: 'pipeline:step'
  stepName: string
  status: 'running' | 'completed' | 'error'
}

export interface ChatMessageEvent extends BaseEvent {
  type: 'chat:message'
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface SessionCreatedEvent extends BaseEvent {
  type: 'session:created'
  sessionId: string
}

export interface SessionSwitchedEvent extends BaseEvent {
  type: 'session:switched'
  sessionId: string
}

export interface ProjectCreatedEvent extends BaseEvent {
  type: 'project:created'
  projectId: string
}

export interface ProjectSwitchedEvent extends BaseEvent {
  type: 'project:switched'
  projectId: string
}

export interface ProjectDeletedEvent extends BaseEvent {
  type: 'project:deleted'
  projectId: string
}

export interface SkillCreatedEvent extends BaseEvent {
  type: 'skill:created'
  skillId: string
}

export interface SkillUpdatedEvent extends BaseEvent {
  type: 'skill:updated'
  skillId: string
}

export interface SkillDeletedEvent extends BaseEvent {
  type: 'skill:deleted'
  skillId: string
}

export interface SkillInvokedEvent extends BaseEvent {
  type: 'skill:invoked'
  skillId: string
}

export interface ChannelCreatedEvent extends BaseEvent {
  type: 'channel:created'
  channelId: string
}

export interface ChannelMessageEvent extends BaseEvent {
  type: 'channel:message'
  channelId: string
  content: string
}

export interface ChannelDeletedEvent extends BaseEvent {
  type: 'channel:deleted'
  channelId: string
}

export interface MemoryAddedEvent extends BaseEvent {
  type: 'memory:added'
  memoryId: string
}

export interface MemoryUpdatedEvent extends BaseEvent {
  type: 'memory:updated'
  memoryId: string
}

export interface MemoryDeletedEvent extends BaseEvent {
  type: 'memory:deleted'
  memoryId: string
}

export interface MessageDeletedEvent extends BaseEvent {
  type: 'message:deleted'
  sessionId: string
  messageId: string
}

export interface MessageEditedEvent extends BaseEvent {
  type: 'message:edited'
  sessionId: string
  messageId: string
}

export interface MessageSharedEvent extends BaseEvent {
  type: 'message:shared'
  sessionId: string
  messageId: string
}

export type SpartaEvent =
  | AgentStartedEvent
  | AgentCompletedEvent
  | AgentErrorEvent
  | ThinkingStartedEvent
  | ThinkingTokenEvent
  | ThinkingCompletedEvent
  | ToolCalledEvent
  | ToolResultEvent
  | ToolErrorEvent
  | MCPConnectedEvent
  | MCPToolDiscoveredEvent
  | MCPDisconnectedEvent
  | StreamTokenEvent
  | StreamCompletedEvent
  | StreamErrorEvent
  | PipelineStepEvent
  | ChatMessageEvent
  | SessionCreatedEvent
  | SessionSwitchedEvent
  | ProjectCreatedEvent
  | ProjectSwitchedEvent
  | ProjectDeletedEvent
  | SkillCreatedEvent
  | SkillUpdatedEvent
  | SkillDeletedEvent
  | SkillInvokedEvent
  | ChannelCreatedEvent
  | ChannelMessageEvent
  | ChannelDeletedEvent
  | MemoryAddedEvent
  | MemoryUpdatedEvent
  | MemoryDeletedEvent
  | MessageDeletedEvent
  | MessageEditedEvent
  | MessageSharedEvent
