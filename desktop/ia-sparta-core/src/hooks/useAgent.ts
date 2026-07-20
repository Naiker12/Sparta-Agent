import { useCallback, useEffect } from 'react'
import { useAgentStore } from '../stores/agent.store'
import { useProviderStore } from '../stores/provider.store'
import { useMCPStore } from '../stores/mcp.store'
import { useSettingsStore } from '../stores/settings.store'
import { useEventBus } from '../stores/event-bus.store'
import { runAgentTask, buildToolDefinitions } from 'ia-sparta-core'
import { buildWebSearchTool, executeWebSearch } from 'ia-sparta-core'
import { getProviderKey, IS_ELECTRON } from 'ia-sparta-platform'
import { aiGateway } from 'ia-sparta-core'
import { useProjectStore } from '../stores/project.store'
import type { AgentStatus, Agent, Task, AgentType, Provider, TaskStep, SubagentRun, SubagentStep, SubagentRunStatus } from '../types'

const AGENT_NAMESPACE_MAP: Partial<Record<AgentType, string>> = {
  research: 'delegate_research',
  coding: 'delegate_code',
}

export function useAgent() {
  const store = useAgentStore()

  // Listen for server-side agent task events (Electron mode)
  useEffect(() => {
    if (!IS_ELECTRON || !window.agent?.onTaskEvent) return
    const unsub = window.agent.onTaskEvent(({ event, data }) => {
      const d = data as Record<string, unknown>
      const taskId = d.task_id as string
      const agentId = d.agent_id as string
      if (!taskId || !agentId) return

      if (event === 'agent:step') {
        const step: TaskStep = {
          id: d.step_id as string,
          name: `Ejecutar ${d.tool_name}`,
          status: (d.status as TaskStep['status']) ?? 'running',
          tool: d.tool_name as string,
          durationMs: d.duration_ms as number | undefined,
          error: d.error as string | undefined,
        }
        const current = store.tasks[agentId]?.find((t) => t.id === taskId)
        const steps = current?.steps ?? []
        // Replace or append step
        const idx = steps.findIndex((s) => s.id === step.id)
        const updated = idx >= 0 ? [...steps.slice(0, idx), step, ...steps.slice(idx + 1)] : [...steps, step]
        store.updateTask(agentId, taskId, { steps: updated })
      } else if (event === 'agent:completed') {
        store.updateAgentStatus(agentId, 'completed')
        store.updateTask(agentId, taskId, { status: 'completed', completedAt: Date.now() })
        useEventBus.getState().dispatch({ type: 'agent:completed', agentId, result: d.result as string, timestamp: Date.now() })
      }
    })
    return unsub
  }, [store])

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

    if (webSearchEnabled) {
      allowedTools = [...allowedTools, 'web_search']
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

    const defaultSystem = systemPrompt ?? (
      `Eres el agente "${agent.name}" (${agent.type}).\n` +
      `Completas tareas usando herramientas MCP.\n` +
      `Cuando necesites información, usa las herramientas disponibles.\n` +
      `Si la tarea requiere investigación paralela, delega subagentes.\n` +
      `IMPORTANTE: Responde SIEMPRE en español.`
    )

    // Electron mode: delegate LLM loop to Python server
    if (IS_ELECTRON && window.agent?.executeTask) {
      try {
        const resolvedKey = provider ? await getProviderKey(provider) : undefined
        const result = await window.agent.executeTask({
          taskId: task.id,
          agentId,
          taskDescription,
          systemPrompt: defaultSystem,
          allowedTools,
          model: agent.model,
          provider: provider?.vendor ?? 'openai',
          vendor: provider?.vendor,
          providerKey: resolvedKey,
          workspaceRoot: useProjectStore.getState().getActiveProject()?.rootPath ?? '',
          agentAutonomy: useSettingsStore.getState().agentAutonomy,
        })
        if (!result.ok) {
          store.updateAgentStatus(agentId, 'error')
          store.updateTask(agentId, task.id, { status: 'error' })
          throw new Error(result.error ?? 'Agent task failed')
        }
        return result.result ?? ''
      } catch (err) {
        store.updateAgentStatus(agentId, 'error')
        store.updateTask(agentId, task.id, { status: 'error' })
        throw err
      }
    }

    // Web mode fallback: run LLM loop on frontend (legacy agent-runtime.ts)
    const toolDefs = buildToolDefinitions(
      allMcpTools.filter((t) => allowedTools.includes(t.name)),
    )
    if (webSearchEnabled) {
      toolDefs.push(buildWebSearchTool() as unknown as Record<string, unknown>)
    }

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

  const subagentRunsForAgent = (agentId: string): SubagentRun[] => {
    return store.subagentRuns[agentId] ?? []
  }

  return {
    agents: store.agents,
    activeAgent: store.agents.find((a) => a.id === store.activeAgentId) || null,
    tasks: store.tasks,
    activeTasks,
    subagentRuns: store.subagentRuns,
    subagentRunsForAgent,
    setActiveAgent: store.setActiveAgent,
    updateStatus: (id: string, status: AgentStatus) => store.updateAgentStatus(id, status),
    executeTask,
    createAgent,
    registerAgent: store.registerAgent,
    addTask: store.addTask,
    updateTask: store.updateTask,
    startSubagentRun: store.startSubagentRun,
    updateSubagentStep: store.updateSubagentStep,
    updateSubagentRun: store.updateSubagentRun,
    completeSubagentRun: store.completeSubagentRun,
  }
}
