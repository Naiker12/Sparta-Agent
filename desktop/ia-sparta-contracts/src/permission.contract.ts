export type PermissionActionKind =
  | 'file_read'
  | 'file_write'
  | 'network_url'
  | 'terminal_command'
  | 'unsandboxed_command'
  | 'mcp_tool'

export type PermissionDecision = 'allow' | 'deny' | 'prompt'
export type PermissionResponse = 'allow_once' | 'allow_always' | 'deny'
export type PermissionRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface PermissionRequestPayload {
  requestId: string
  action: PermissionActionKind
  target: string
  risk: PermissionRiskLevel
  preview: string
  workspaceRoot?: string
  taskId?: string
  agentId?: string
  reason?: string
}
