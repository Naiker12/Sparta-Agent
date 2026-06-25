import { create } from 'zustand'
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

const defaultServers: MCPServer[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    type: 'stdio',
    connected: true,
    tools: [
      { name: 'read_file', description: 'Read file contents', inputSchema: {}, serverId: 'filesystem' },
      { name: 'write_file', description: 'Write file contents', inputSchema: {}, serverId: 'filesystem' },
      { name: 'list_directory', description: 'List directory contents', inputSchema: {}, serverId: 'filesystem' },
    ],
    config: { id: 'filesystem', name: 'Filesystem', type: 'stdio', enabled: true },
  },
  {
    id: 'git',
    name: 'Git',
    type: 'stdio',
    connected: true,
    tools: [
      { name: 'git_status', description: 'Check git status', inputSchema: {}, serverId: 'git' },
      { name: 'git_diff', description: 'Show git diff', inputSchema: {}, serverId: 'git' },
      { name: 'git_commit', description: 'Create git commit', inputSchema: {}, serverId: 'git' },
    ],
    config: { id: 'git', name: 'Git', type: 'stdio', enabled: true },
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    type: 'stdio',
    connected: false,
    tools: [],
    config: { id: 'sqlite', name: 'SQLite', type: 'stdio', enabled: false },
  },
]

export const useMCPStore = create<MCPState>((set) => ({
  servers: defaultServers,

  addServer: (config) =>
    set((s) => ({
      servers: [
        ...s.servers,
        { id: config.id, name: config.name, type: config.type, connected: false, tools: [], config },
      ],
    })),

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
}))
