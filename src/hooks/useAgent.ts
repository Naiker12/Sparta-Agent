import { useCallback } from 'react'
import { useAgentStore } from '@/stores/agent.store'
import { useProviderStore } from '@/stores/provider.store'
import { useMCPStore } from '@/stores/mcp.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useEventBus } from '@/stores/event-bus.store'
import { runAgentTask, buildToolDefinitions } from '@/services/agents'
import { buildWebSearchTool, executeWebSearch } from '@/services/tools/web-search'
import { getProviderKey } from '@/lib/vault-helper'
import { aiGateway } from '@/services/ai/gateway'
import type { AgentStatus, Agent, Task, AgentType, Provider } from '@/types'

const AGENT_NAMESPACE_MAP: Partial<Record<AgentType, string>> = {
  research: 'delegate_research',
  coding: 'delegate_code',
}

export function useAgent() {
  const store = useAgentStore()

  const executeTask = useCallback(async (
    agentId: string,
    taskDescription: string,
    systemPrompt?: string,
  ): Promise<string> => {
    const agent = store.agents.find((a) => a.id === agentId)
    if (!agent) throw new Error(`Agent ${agentId} not found`)

    const provider = useProviderStore.getState().getByVendor(
      agent.type === 'coding' ? 'anthropic' : 'openai',
    )

    const mcpServers = useMCPStore.getState().servers.filter((s) => s.connected)
    const allMcpTools = mcpServers.flatMap((s) => s.tools)
    const webSearchEnabled = useSettingsStore.getState().webSearchEnabled

    let allowedTools = agent.tools.length > 0
      ? agent.tools
      : allMcpTools.map((t) => t.name)
    let toolDefs = buildToolDefinitions(
      allMcpTools.filter((t) => allowedTools.includes(t.name)),
    )

    if (webSearchEnabled) {
      allowedTools = [...allowedTools, 'web_search']
      toolDefs = [...toolDefs, buildWebSearchTool() as unknown as Record<string, unknown>]
    }

    const task: Task = {
      id: crypto.randomUUID(),
      agentId,
      description: taskDescription,
      status: 'running',
      steps: [],
      createdAt: Date.now(),
    }

    store.addTask(agentId, task)
    store.updateAgentStatus(agentId, 'running')

    useEventBus.getState().dispatch({
      type: 'agent:started',
      agentId,
      agentType: agent.type,
      timestamp: Date.now(),
    })

    const model = provider?.defaultModel ?? agent.model ?? 'gpt-4'
    const defaultSystem = systemPrompt ?? (
      `Eres el agente "${agent.name}" (${agent.type}).\n` +
      `Completas tareas usando herramientas MCP.\n` +
      `Cuando necesites información, usa las herramientas disponibles.\n` +
      `Si la tarea requiere investigación paralela, delega subagentes.\n` +
      `IMPORTANTE: Responde SIEMPRE en español.`
    )

    const toolRunner = async (name: string, args: unknown): Promise<unknown> => {
      if (name === 'web_search') {
        const query = typeof args === 'object' && args !== null && 'query' in args
          ? String((args as Record<string, unknown>).query)
          : String(args)
        const rawCount = typeof args === 'object' && args !== null && 'count' in args
          ? (args as Record<string, unknown>).count
          : 5
        const count = typeof rawCount === 'number' ? rawCount : 5
        return await executeWebSearch(query, count)
      }
      const server = mcpServers.find((s) =>
        s.tools.some((t) => t.name === name),
      )
      if (!server) throw new Error(`Tool ${name} no encontrada en ningún servidor MCP`)
      return null
    }

    const llmCall = async (prompt: string): Promise<string> => {
      if (!provider) return 'Error: No hay proveedor configurado.'

      const resolvedKey = await getProviderKey(provider)
      if (!resolvedKey) return 'Error: No hay API key configurada para el proveedor.'

      const providerWithKey: Provider = { ...provider, apiKey: resolvedKey, hasVaultKey: false }

      try {
        const stream = await aiGateway.sendMessage(
          providerWithKey,
          [{ role: 'user', content: prompt }],
          { stream: true },
        )
        const parts: string[] = []
        for await (const chunk of stream) {
          if (chunk.type === 'content_token' && chunk.delta) parts.push(chunk.delta)
        }
        return parts.join('') || 'Sin respuesta'
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    }

    try {
      const result = await runAgentTask(
        task.id,
        agentId,
        taskDescription,
        defaultSystem,
        model,
        allowedTools,
        toolDefs,
        toolRunner,
        llmCall,
      )
      return result
    } catch (err) {
      store.updateAgentStatus(agentId, 'error')
      store.updateTask(agentId, task.id, { status: 'error' })
      throw err
    }
  }, [store])

  const createAgent = useCallback((data: {
    name: string
    type: Agent['type']
    model: string
    description: string
    tools?: string[]
  }) => {
    const namespace = AGENT_NAMESPACE_MAP[data.type]
    const agent: Agent = {
      id: crypto.randomUUID(),
      name: data.name,
      type: data.type,
      status: 'idle',
      model: data.model,
      createdAt: Date.now(),
      tools: data.tools ?? [],
      description: data.description,
      namespace,
    }
    store.registerAgent(agent)
    return agent.id
  }, [store])

  const activeTasks = store.activeAgentId
    ? (store.tasks[store.activeAgentId] ?? [])
    : Object.values(store.tasks).flat()

  return {
    agents: store.agents,
    activeAgent: store.agents.find((a) => a.id === store.activeAgentId) || null,
    tasks: store.tasks,
    activeTasks,
    setActiveAgent: store.setActiveAgent,
    updateStatus: (id: string, status: AgentStatus) => store.updateAgentStatus(id, status),
    executeTask,
    createAgent,
    registerAgent: store.registerAgent,
    addTask: store.addTask,
    updateTask: store.updateTask,
  }
}
