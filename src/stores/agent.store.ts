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

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
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
