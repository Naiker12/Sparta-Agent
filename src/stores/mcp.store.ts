import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MCPServer, MCPServerConfig, MCPTool } from '@/types'

interface MCPState {
  servers: MCPServer[]
  addServer: (config: MCPServerConfig) => void
  removeServer: (id: string) => void
  setConnected: (id: string, connected: boolean) => void
  addTool: (serverId: string, tool: MCPTool) => void
  removeTool: (serverId: string, toolName: string) => void
  toggleServer: (id: string) => void
}

export const useMCPStore = create<MCPState>()(
  persist(
    (set) => ({
  servers: [],

  addServer: (config) =>
    set((s) => {
      const exists = s.servers.some((sv) => sv.id === config.id)
      if (exists) {
        return {
          servers: s.servers.map((sv) =>
            sv.id === config.id
              ? { ...sv, name: config.name, type: config.type, config }
              : sv
          ),
        }
      }
      return {
        servers: [
          ...s.servers,
          { id: config.id, name: config.name, type: config.type, connected: false, tools: [], config },
        ],
      }
    }),

  removeServer: (id) =>
    set((s) => ({ servers: s.servers.filter((sv) => sv.id !== id) })),

  setConnected: (id, connected) =>
    set((s) => ({
      servers: s.servers.map((sv) => (sv.id === id ? { ...sv, connected } : sv)),
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
        sv.id === id ? { ...sv, config: { ...sv.config, enabled: !sv.config.enabled } } : sv
      ),
    })),
    }),
    {
      name: 'sparta-mcp',
      version: 1,
    }
  )
)
