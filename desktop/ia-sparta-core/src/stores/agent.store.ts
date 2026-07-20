import { create } from 'zustand'
import type { Agent, Task, AgentStatus, SubagentRun, SubagentStep, SubagentRunStatus } from '../types'

const BUILT_IN_AGENTS: Agent[] = [
  {
    id: 'builtin-research',
    name: 'Investigador',
    type: 'research',
    status: 'idle',
    model: '',
    createdAt: Date.now(),
    tools: [],
    description: 'Búsqueda web + lectura de páginas + síntesis de información',
  },
  {
    id: 'builtin-code',
    name: 'Código',
    type: 'coding',
    status: 'idle',
    model: '',
    createdAt: Date.now(),
    tools: [],
    description: 'Leer/escribir archivos, generar y aplicar cambios en código',
  },
  {
    id: 'builtin-memory',
    name: 'Memoria',
    type: 'project',
    status: 'idle',
    model: '',
    createdAt: Date.now(),
    tools: [],
    description: 'Consulta de base de conocimiento y contexto del proyecto',
  },
  {
    id: 'builtin-review',
    name: 'Revisor',
    type: 'research',
    status: 'idle',
    model: '',
    createdAt: Date.now(),
    tools: [],
    description: 'Revisión de código y planes, control de calidad',
  },
]

interface AgentState {
  agents: Agent[]
  activeAgentId: string | null
  tasks: Record<string, Task[]>
  /** Track running/completed subagent runs keyed by agent id */
  subagentRuns: Record<string, SubagentRun[]>

  registerAgent: (agent: Agent) => void
  setActiveAgent: (id: string | null) => void
  updateAgentStatus: (id: string, status: AgentStatus) => void
  addTask: (agentId: string, task: Task) => void
  updateTask: (agentId: string, taskId: string, partial: Partial<Task>) => void

  /** Subagent run management */
  startSubagentRun: (agentId: string, run: SubagentRun) => void
  updateSubagentStep: (agentId: string, runName: string, step: SubagentStep) => void
  updateSubagentRun: (agentId: string, runName: string, partial: Partial<SubagentRun>) => void
  completeSubagentRun: (agentId: string, runName: string, status: SubagentRunStatus, durationMs?: number) => void
}

function seedBuiltInAgents(set: (fn: (s: AgentState) => Partial<AgentState>) => void): Agent[] {
  const agents: Agent[] = []
  for (const a of BUILT_IN_AGENTS) {
    agents.push({ ...a, createdAt: Date.now() })
  }
  return agents
}

export const useAgentStore = create<AgentState>((set) => {
  const builtInAgents = seedBuiltInAgents(set)

  return {
    agents: builtInAgents,
    activeAgentId: null,
    tasks: {},
    subagentRuns: {},

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

    startSubagentRun: (agentId, run) =>
      set((s) => ({
        subagentRuns: {
          ...s.subagentRuns,
          [agentId]: [...(s.subagentRuns[agentId] || []), run],
        },
      })),

    updateSubagentStep: (agentId, runName, step) =>
      set((s) => ({
        subagentRuns: {
          ...s.subagentRuns,
          [agentId]: (s.subagentRuns[agentId] || []).map((r) =>
            r.name === runName
              ? {
                  ...r,
                  currentStep: step.label,
                  steps: [...r.steps, step],
                }
              : r
          ),
        },
      })),

    updateSubagentRun: (agentId, runName, partial) =>
      set((s) => ({
        subagentRuns: {
          ...s.subagentRuns,
          [agentId]: (s.subagentRuns[agentId] || []).map((r) =>
            r.name === runName ? { ...r, ...partial } : r
          ),
        },
      })),

    completeSubagentRun: (agentId, runName, status, durationMs) =>
      set((s) => ({
        subagentRuns: {
          ...s.subagentRuns,
          [agentId]: (s.subagentRuns[agentId] || []).map((r) =>
            r.name === runName
              ? {
                  ...r,
                  status,
                  completedAt: Date.now(),
                  durationMs: durationMs ?? (Date.now() - r.startedAt),
                }
              : r
          ),
        },
      })),
  }
})