export type MCPServerType = 'stdio' | 'http'

export interface MCPToolFilter {
  /** Whitelist — if present, only these tools are exposed. Takes precedence over exclude. */
  include?: string[]
  /** Blacklist — ignored if include is set. */
  exclude?: string[]
}

export interface MCPServerConfig {
  id: string
  name: string
  type: MCPServerType
  // ── stdio ──────────────────────────────
  command?: string
  args?: string[]
  /** Environment variables injected into the stdio process */
  env?: Record<string, string>
  // ── http ───────────────────────────────
  url?: string
  /** HTTP headers (e.g. Authorization) */
  headers?: Record<string, string>
  // ── shared ─────────────────────────────
  enabled: boolean
  /** Tool call timeout in seconds (default: 30) */
  timeout?: number
  /** Optional tool include/exclude filter */
  tools?: MCPToolFilter
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: unknown
  serverId: string
}

export interface MCPServer {
  id: string
  name: string
  type: MCPServerType
  connected: boolean
  tools: MCPTool[]
  config: MCPServerConfig
}
