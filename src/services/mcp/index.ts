import type { MCPServerConfig, MCPTool } from '@/interfaces'

interface MCPClient {
  connect(config: MCPServerConfig): Promise<void>
  disconnect(): Promise<void>
  callTool(name: string, args: unknown): Promise<unknown>
  listTools(): Promise<MCPTool[]>
}

class StdioMCPClient implements MCPClient {
  private process: { kill: () => void } | null = null

  async connect(config: MCPServerConfig): Promise<void> {
    // Will be implemented with proper stdio transport
    void config
  }

  async disconnect(): Promise<void> {
    this.process?.kill()
    this.process = null
  }

  async callTool(name: string, args: unknown): Promise<unknown> {
    void name
    void args
    return null
  }

  async listTools(): Promise<MCPTool[]> {
    return []
  }
}

export function createMCPClient(): MCPClient {
  return new StdioMCPClient()
}
