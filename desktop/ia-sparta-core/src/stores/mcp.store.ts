import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MCPServer, MCPServerConfig, MCPTool } from '../types'

async function clearVaultSecrets(serverId: string): Promise<void> {
  if (typeof window === 'undefined' || !window.vault?.isAvailable) return
  try {
    const keys = await window.vault.listKeys()
    const serverPrefix = `mcp:${serverId}:`
    for (const key of keys) {
      if (key.startsWith(serverPrefix)) {
        await window.vault.deleteKey(key)
      }
    }
  } catch {
    // Vault not available — skip cleanup
  }
}

export const DEFAULT_MCP_SERVERS: MCPServer[] = [
  {
    id: 'filesystem',
    name: 'Filesystem (Auto-Configured)',
    type: 'stdio',
    connected: true,
    tools: [
      { serverId: 'filesystem', name: 'read_file', description: 'Leer el contenido de un archivo', inputSchema: {} },
      { serverId: 'filesystem', name: 'write_file', description: 'Escribir o crear un archivo', inputSchema: {} },
      { serverId: 'filesystem', name: 'list_directory', description: 'Listar archivos de directorio', inputSchema: {} },
      { serverId: 'filesystem', name: 'directory_tree', description: 'Estructura en árbol del directorio', inputSchema: {} },
      { serverId: 'filesystem', name: 'search_files', description: 'Buscar archivos por nombre o patrón', inputSchema: {} },
    ],
    config: { id: 'filesystem', name: 'Filesystem (Auto-Configured)', type: 'stdio', enabled: true, auth_type: 'none' },
  },
  {
    id: 'fetch',
    name: 'Fetch',
    type: 'stdio',
    connected: true,
    tools: [
      { serverId: 'fetch', name: 'fetch', description: 'Obtener contenido web con conversión a markdown', inputSchema: {} },
      { serverId: 'fetch', name: 'read_url', description: 'Leer URL directa', inputSchema: {} },
    ],
    config: { id: 'fetch', name: 'Fetch', type: 'stdio', enabled: true, auth_type: 'none' },
  },
  {
    id: 'chrome-devtools',
    name: 'Chrome DevTools MCP',
    type: 'stdio',
    connected: true,
    tools: Array(9).fill(null).map((_, i) => ({ serverId: 'chrome-devtools', name: `devtools_tool_${i + 1}`, description: 'Inspección de pestaña de Chrome', inputSchema: {} })),
    config: { id: 'chrome-devtools', name: 'Chrome DevTools MCP', type: 'stdio', enabled: true, auth_type: 'none' },
  },
  {
    id: 'gmail',
    name: 'Gmail',
    type: 'http',
    connected: true,
    tools: Array(11).fill(null).map((_, i) => ({ serverId: 'gmail', name: `gmail_tool_${i + 1}`, description: 'Herramienta de correo electrónico Gmail', inputSchema: {} })),
    config: { id: 'gmail', name: 'Gmail', type: 'http', enabled: true, auth_type: 'oauth2' },
  },
]

interface MCPState {
  servers: MCPServer[]
  addServer: (config: MCPServerConfig) => void
  removeServer: (id: string) => void
  setConnected: (id: string, connected: boolean) => void
  setConnectionError: (id: string, error?: string) => void
  setServerTools: (serverId: string, tools: MCPTool[]) => void
  addTool: (serverId: string, tool: MCPTool) => void
  removeTool: (serverId: string, toolName: string) => void
  toggleServer: (id: string) => void
}

export const useMCPStore = create<MCPState>()(
  persist(
    (set) => ({
      servers: DEFAULT_MCP_SERVERS,

      addServer: (config) =>
        set((s) => {
          const exists = s.servers.some((sv) => sv.id === config.id)
          if (exists) {
            return {
              servers: s.servers.map((sv) =>
                sv.id === config.id
                  ? { ...sv, name: config.name, type: config.type, config, connected: true }
                  : sv
              ),
            }
          }
          return {
            servers: [
              ...s.servers,
              { id: config.id, name: config.name, type: config.type, connected: true, tools: [], config },
            ],
          }
        }),

      removeServer: (id) => {
        clearVaultSecrets(id)
        set((s) => ({ servers: s.servers.filter((sv) => sv.id !== id) }))
      },

      setConnected: (id, connected) =>
        set((s) => ({
          servers: s.servers.map((sv) => (sv.id === id ? { ...sv, connected, lastError: connected ? undefined : sv.lastError } : sv)),
        })),

      setConnectionError: (id, error) =>
        set((s) => ({
          servers: s.servers.map((sv) => (sv.id === id ? { ...sv, connected: false, lastError: error } : sv)),
        })),

      setServerTools: (serverId, tools) =>
        set((s) => ({
          servers: s.servers.map((sv) =>
            sv.id === serverId ? { ...sv, tools } : sv
          ),
        })),

      addTool: (serverId, tool) =>
        set((s) => ({
          servers: s.servers.map((sv) =>
            sv.id === serverId ? { ...sv, tools: [...sv.tools, tool] } : sv
          ),
        })),

      removeTool: (serverId, toolName) =>
        set((s) => ({
          servers: s.servers.map((sv) =>
            sv.id === serverId
              ? { ...sv, tools: sv.tools.filter((t) => t.name !== toolName) }
              : sv
          ),
        })),

      toggleServer: (id) =>
        set((s) => ({
          servers: s.servers.map((sv) =>
            sv.id === id ? { ...sv, connected: !sv.connected, config: { ...sv.config, enabled: !sv.config.enabled } } : sv
          ),
        })),
    }),
    {
      name: 'sparta-mcp',
      version: 1,
      merge: (persistedState: any, currentState) => {
        if (!persistedState || !persistedState.servers || persistedState.servers.length === 0) {
          return currentState
        }
        const mergedServers = [...persistedState.servers]
        for (const defServer of DEFAULT_MCP_SERVERS) {
          const exists = mergedServers.some((s: MCPServer) => s.id === defServer.id || s.name.toLowerCase() === defServer.name.toLowerCase())
          if (!exists) {
            mergedServers.push(defServer)
          }
        }
        return {
          ...currentState,
          ...persistedState,
          servers: mergedServers,
        }
      },
    }
  )
)
