export type MCPServerType = 'stdio' | 'http'

export interface MCPServerConfig {
  id: string
  name: string
  type: MCPServerType
  command?: string
  args?: string[]
  url?: string
  enabled: boolean
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
