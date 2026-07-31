/**
 * ia-sparta-chat-ipc — Chat IPC
 *
 * Fachada pública.
 */
export * from './shared'
export * from './on-message.channel'
export * from './send.channel'
export * from './agent-task.channel'
export * from './audio.channel'
export * from './editor-diff.channel'
export * from './mcp-test.channel'
export * from './mcp-oauth.channel'
export * from './memory.channel'
export * from './sidecar-status.channel'
export * from './mcp/channels/mcp-call-tool.channel'
export * from './mcp/channels/mcp-sync.channel'
export * from './mcp/core/McpProcessManager'
export * from './mcp/core/mcp-path-fix'
export * from './mcp/core/McpToolSchemaAdapter'
export * from './mcp/core/McpPermissionsMiddleware'