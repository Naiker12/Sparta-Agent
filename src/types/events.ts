export type EventType =
  | 'agent:started'
  | 'agent:completed'
  | 'agent:error'
  | 'thinking:started'
  | 'thinking:token'
  | 'thinking:completed'
  | 'thinking:status'
  | 'reasoning:token'
  | 'reasoning:available'
  | 'search:progress'
  | 'tool:called'
  | 'tool:result'
  | 'tool:error'
  | 'mcp:connected'
  | 'mcp:tool_discovered'
  | 'mcp:disconnected'
  | 'stream:token'
  | 'stream:completed'
  | 'stream:aborted'
  | 'stream:error'
  | 'stream:notice'
  | 'pipeline:step'
  | 'chat:message'
  | 'chat:send_queued'
  | 'session:created'
  | 'session:switched'
  | 'project:created'
  | 'project:switched'
  | 'project:deleted'
  | 'project:rootPathSet'
  | 'skill:created'
  | 'skill:updated'
  | 'skill:deleted'
  | 'skill:invoked'
  | 'skill:activated'
  | 'skill:completed'
  | 'channel:created'
  | 'channel:message'
  | 'channel:deleted'
  | 'memory:added'
  | 'memory:updated'
  | 'memory:deleted'
  | 'memory:semantic_search'
  | 'memory:indexed'
  | 'memory:extraction_empty'
  | 'memory:unavailable'
  | 'message:deleted'
  | 'message:edited'
  | 'message:shared'
  | 'terminal:agent_command'
  | 'terminal:agent_spawn'
  | 'plan:created'
  | 'plan:step'
  | 'file:changed'
  | 'editor:diff_proposed'
  | 'editor:diff_responded'
  | 'editor:open_file'
  | 'terminal:tool_crash'

export interface BaseEvent {
  type: EventType
  timestamp: number
  requestId?: string
  agentId?: string
  ns?: string
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
  sessionId: string
  messageId: string
}

export interface ThinkingTokenEvent extends BaseEvent {
  type: 'thinking:token'
  sessionId: string
  messageId: string
  token: string
}

export interface ThinkingCompletedEvent extends BaseEvent {
  type: 'thinking:completed'
  sessionId: string
  messageId: string
  tokensUsed: number
}

export interface ThinkingStatusEvent extends BaseEvent {
  type: 'thinking:status'
  sessionId: string
  messageId: string
  text?: string
}

export interface ReasoningTokenEvent extends BaseEvent {
  type: 'reasoning:token'
  sessionId: string
  messageId: string
  token: string
}

export interface ReasoningAvailableEvent extends BaseEvent {
  type: 'reasoning:available'
  sessionId: string
  messageId: string
  text: string
  verbose?: boolean
}

export interface SearchProgressEvent extends BaseEvent {
  type: 'search:progress'
  sessionId: string
  messageId: string
  stage: 'searching' | 'visiting' | 'done'
  query?: string
  url?: string
  title?: string
  index?: number
  total?: number
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
  sessionId: string
  messageId: string
  chunkSeq?: number
}

export interface StreamCompletedEvent extends BaseEvent {
  type: 'stream:completed'
  sessionId: string
  messageId: string
  usage?: { inputTokens: number; outputTokens: number }
}

export interface StreamAbortedEvent extends BaseEvent {
  type: 'stream:aborted'
  sessionId: string
  messageId: string
}

export interface StreamErrorEvent extends BaseEvent {
  type: 'stream:error'
  sessionId: string
  messageId: string
  error: string
}

export interface StreamNoticeEvent extends BaseEvent {
  type: 'stream:notice'
  sessionId: string
  messageId: string
  message: string
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

export interface ChatSendQueuedEvent extends BaseEvent {
  type: 'chat:send_queued'
  text: string
  sessionId?: string
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

export interface ProjectRootPathSetEvent extends BaseEvent {
  type: 'project:rootPathSet'
  projectId: string
  rootPath: string
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

export interface SkillActivatedEvent extends BaseEvent {
  type: 'skill:activated'
  skillId: string
  skillName: string
  skillIcon: string
  skillCategory: string
  sessionId: string
  messageId: string
}

export interface SkillCompletedEvent extends BaseEvent {
  type: 'skill:completed'
  skillId: string
  sessionId: string
  messageId: string
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

export interface MemorySemanticSearchEvent extends BaseEvent {
  type: 'memory:semantic_search'
  query: string
  resultsCount: number
  injectedContext: string
}

export interface MemoryIndexedEvent extends BaseEvent {
  type: 'memory:indexed'
  memoryId: string
  indexedCount: number
}

export interface MemoryUnavailableEvent extends BaseEvent {
  type: 'memory:unavailable'
  query: string
}

export interface MemoryExtractionEmptyEvent extends BaseEvent {
  type: 'memory:extraction_empty'
  sessionId: string
  messageId: string
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

export interface FileChangedEvent extends BaseEvent {
  type: 'file:changed'
  path: string
}

export interface PlanCreatedEvent extends BaseEvent {
  type: 'plan:created'
  plan: string[]
  currentStep: number
  planComplete: boolean
}

export interface DiffProposedEvent extends BaseEvent {
  type: 'editor:diff_proposed'
  requestId: string
  filePath: string
  originalContent: string
  newContent: string
  language: string
}

export interface EditorOpenFileEvent extends BaseEvent {
  type: 'editor:open_file'
  filePath: string
}

export interface TerminalToolCrashEvent extends BaseEvent {
  type: 'terminal:tool_crash'
  error: string
}

export interface PlanStepEvent extends BaseEvent {
  type: 'plan:step'
  plan: string[]
  currentStep: number
  planComplete: boolean
}

export type SpartaEvent =
  | AgentStartedEvent
  | AgentCompletedEvent
  | AgentErrorEvent
  | ThinkingStartedEvent
  | ThinkingTokenEvent
  | ThinkingCompletedEvent
  | ThinkingStatusEvent
  | ReasoningTokenEvent
  | ReasoningAvailableEvent
  | SearchProgressEvent
  | ToolCalledEvent
  | StreamAbortedEvent
  | ToolResultEvent
  | ToolErrorEvent
  | MCPConnectedEvent
  | MCPToolDiscoveredEvent
  | MCPDisconnectedEvent
  | StreamTokenEvent
  | StreamCompletedEvent
  | StreamErrorEvent
  | StreamNoticeEvent
  | PipelineStepEvent
  | ChatMessageEvent
  | ChatSendQueuedEvent
  | SessionCreatedEvent
  | SessionSwitchedEvent
  | ProjectCreatedEvent
  | ProjectSwitchedEvent
  | ProjectDeletedEvent
  | ProjectRootPathSetEvent
  | SkillCreatedEvent
  | SkillUpdatedEvent
  | SkillDeletedEvent
  | SkillInvokedEvent
  | SkillActivatedEvent
  | SkillCompletedEvent
  | ChannelCreatedEvent
  | ChannelMessageEvent
  | ChannelDeletedEvent
  | MemoryAddedEvent
  | MemoryUpdatedEvent
  | MemoryDeletedEvent
  | MemorySemanticSearchEvent
  | MemoryIndexedEvent
  | MemoryExtractionEmptyEvent
  | MemoryUnavailableEvent
  | MessageDeletedEvent
  | MessageEditedEvent
  | MessageSharedEvent
  | PlanCreatedEvent
  | PlanStepEvent
  | FileChangedEvent
  | DiffProposedEvent
  | EditorOpenFileEvent
  | TerminalToolCrashEvent
