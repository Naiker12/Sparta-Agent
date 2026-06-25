import { create } from 'zustand'
import type { Agent, Task, AgentStatus } from '@/types'

interface AgentState {
  agents: Agent[]
  activeAgentId: string | null
  tasks: Record<string, Task[]>

  registerAgent: (agent: Agent) => void
  setActiveAgent: (id: string | null) => void
  updateAgentStatus: (id: string, status: AgentStatus) => void
  addTask: (agentId: string, task: Task) => void
  updateTask: (agentId: string, taskId: string, partial: Partial<Task>) => void
}

const defaultAgents: Agent[] = [
  {
    id: 'coding-1',
    name: 'Coding Agent',
    type: 'coding',
    status: 'idle',
    model: 'claude-sonnet-4-6',
    createdAt: Date.now(),
    tools: ['filesystem', 'terminal', 'git', 'editor'],
    description: 'Genera, edita y refactoriza código',
  },
  {
    id: 'research-1',
    name: 'Research Agent',
    type: 'research',
    status: 'idle',
    model: 'claude-opus-4',
    createdAt: Date.now(),
    tools: ['websearch', 'webscraper', 'chromadb'],
    description: 'Investigación profunda con RAG',
  },
  {
    id: 'automation-1',
    name: 'Automation Agent',
    type: 'automation',
    status: 'idle',
    model: 'claude-haiku',
    createdAt: Date.now(),
    tools: ['terminal', 'filesystem', 'browser'],
    description: 'Automatización de tareas del sistema',
  },
  {
    id: 'project-1',
    name: 'Project Agent',
    type: 'project',
    status: 'idle',
    model: 'claude-sonnet-4-6',
    createdAt: Date.now(),
    tools: ['git', 'github', 'notion'],
    description: 'Gestión de proyectos y tareas',
  },
  {
    id: 'mcp-1',
    name: 'MCP Agent',
    type: 'mcp',
    status: 'idle',
    model: 'claude-sonnet-4-6',
    createdAt: Date.now(),
    tools: ['mcp-registry'],
    description: 'Orquesta herramientas externas vía MCP',
  },
]

export const useAgentStore = create<AgentState>((set) => ({
  agents: defaultAgents,
  activeAgentId: null,
  tasks: {},

  registerAgent: (agent) =>
    set((s) => ({ agents: [...s.agents, agent] })),

  setActiveAgent: (id) => set({ activeAgentId: id }),

  updateAgentStatus: (id, status) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, status } : a)),
    })),

  addTask: (agentId, task) =>
    set((s) => ({
      tasks: {
        ...s.tasks,
        [agentId]: [...(s.tasks[agentId] || []), task],
      },
    })),

  updateTask: (agentId, taskId, partial) =>
    set((s) => ({
      tasks: {
        ...s.tasks,
        [agentId]: (s.tasks[agentId] || []).map((t) =>
          t.id === taskId ? { ...t, ...partial } : t
        ),
      },
    })),
}))
