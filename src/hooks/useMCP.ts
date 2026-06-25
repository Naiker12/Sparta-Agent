import { useMCPStore } from '@/stores/mcp.store'
import type { MCPServerConfig } from '@/types'

export function useMCP() {
  const store = useMCPStore()

  return {
    servers: store.servers,
    connectedServers: store.servers.filter((s) => s.connected),
    addServer: (config: MCPServerConfig) => store.addServer(config),
    removeServer: store.removeServer,
    toggleServer: store.toggleServer,
  }
}
