import { useAgentStore } from '@/stores/agent.store'
import type { AgentStatus } from '@/types'

export function useAgent() {
  const store = useAgentStore()

  return {
    agents: store.agents,
    activeAgent: store.agents.find((a) => a.id === store.activeAgentId) || null,
    setActiveAgent: store.setActiveAgent,
    updateStatus: (id: string, status: AgentStatus) => store.updateAgentStatus(id, status),
  }
}
