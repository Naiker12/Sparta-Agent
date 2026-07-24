export type QueuedMessagePolicy = 'queue_after_turn' | 'steer_immediately' | 'buffer_until_idle'
export type SecurityPreset = 'default' | 'strict' | 'permissive' | 'custom'
export type ArtifactReviewPolicy = 'always_ask' | 'auto_approve_safe' | 'never_ask'

export type PermissionActionKind =
  | 'file_read'
  | 'file_write'
  | 'network_url'
  | 'terminal_command'
  | 'unsandboxed_command'
  | 'mcp_tool'

export interface PermissionRule {
  id: string
  kind: PermissionActionKind
  target: string
  effect: 'allow' | 'deny'
  createdAt: number
}
