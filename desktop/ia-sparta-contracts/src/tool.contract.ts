import type { PermissionActionKind } from './permission.contract'

export type JsonSchema = Record<string, unknown>
export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ToolSideEffect = 'filesystem' | 'shell' | 'network' | 'none'

export interface ToolDescriptor {
  id: string
  description: string
  inputSchema: JsonSchema
  risk: ToolRiskLevel
  sideEffects: ToolSideEffect[]
  resources?: {
    reads?: string[]
    writes?: string[]
  }
  permission: PermissionActionKind
  idempotent: boolean
  supportsCancellation: boolean
}

export interface ToolCallContext {
  sessionId: string
  messageId: string
  toolCallId: string
  toolName: string
  toolInput: Record<string, unknown>
  workspaceRoot?: string
  connectedFolder?: string
  parentTaskId?: string
  agentId?: string
}

export type ToolExecutionStatus = 'success' | 'error' | 'denied' | 'cancelled'

export interface ToolExecutionResult {
  status: ToolExecutionStatus
  content: string
  structured?: Record<string, unknown>
  artifacts?: Array<{ id: string; path: string; mimeType?: string }>
  error?: {
    type: string
    message: string
    retryable: boolean
  }
}
