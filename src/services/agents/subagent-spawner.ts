import type { Agent, Task, TaskStep } from '@/types'
import { useAgentStore } from '@/stores/agent.store'
import { useEventBus } from '@/stores/event-bus.store'
import { runAgentTask } from './agent-runtime'

const MAX_DEPTH = 2
const MAX_TOKENS_PER_TASK = 32000
const TASK_TIMEOUT_MS = 120_000

export interface SpawnOptions {
  parentAgentId: string
  parentSessionId?: string
  depth: number
  allowedTools: string[]
  systemPrompt?: string
  timeout?: number
  tokenBudget?: number
}

export interface SubagentResult {
  agentId: string
  taskId: string
  result: string
  steps: TaskStep[]
  durationMs: number
  error?: string
}

export function canSpawnSubagent(depth: number): boolean {
  return depth < MAX_DEPTH
}

export async function spawnSubagent(
  taskDescription: string,
  options: SpawnOptions,
  model: string,
  llmCall: (prompt: string) => Promise<string>,
  toolDefinitions: unknown[],
  toolRunner: (name: string, args: unknown) => Promise<unknown>,
): Promise<SubagentResult> {
  if (!canSpawnSubagent(options.depth)) {
    return {
      agentId: '',
      taskId: '',
      result: `Error: profundidad máxima de subagentes (${MAX_DEPTH}) excedida.`,
      steps: [],
      durationMs: 0,
      error: `Max depth ${MAX_DEPTH} exceeded`,
    }
  }

  const subAgent: Agent = {
    id: crypto.randomUUID(),
    name: `subagente-${options.depth}`,
    type: 'automation',
    status: 'running',
    model,
    createdAt: Date.now(),
    tools: options.allowedTools,
    description: taskDescription.slice(0, 80),
  }

  const subTask: Task = {
    id: crypto.randomUUID(),
    agentId: subAgent.id,
    description: taskDescription,
    status: 'running',
    steps: [],
    createdAt: Date.now(),
  }

  useAgentStore.getState().registerAgent(subAgent)
  useAgentStore.getState().addTask(subAgent.id, subTask)

  useEventBus.getState().dispatch({
    type: 'agent:started',
    agentId: subAgent.id,
    agentType: 'subagent',
    timestamp: Date.now(),
  })

  const timeout = options.timeout ?? TASK_TIMEOUT_MS
  const tokenBudget = options.tokenBudget ?? MAX_TOKENS_PER_TASK

  const systemPrompt = options.systemPrompt ?? (
    `Eres un subagente especializado. Tu tarea: ${taskDescription}\n` +
    `Debes completarla usando las herramientas disponibles.\n` +
    `Profundidad actual: ${options.depth}. Límite: ${MAX_DEPTH} niveles.\n` +
    `Presupuesto de tokens: ${tokenBudget}. Timeout: ${timeout}ms.\n` +
    `Cuando termines, responde con un resumen claro del resultado.`
  )

  const start = performance.now()
  let result: string
  let error: string | undefined

  try {
    result = await Promise.race([
      runAgentTask(
        subTask.id,
        subAgent.id,
        taskDescription,
        systemPrompt,
        model,
        options.allowedTools,
        toolDefinitions,
        toolRunner,
        llmCall,
        options.depth + 1,
        tokenBudget,
      ),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${timeout}ms excedido`)), timeout),
      ),
    ])
  } catch (err) {
    result = ''
    error = err instanceof Error ? err.message : 'Subagente falló'
  }

  const durationMs = Math.round(performance.now() - start)

  useAgentStore.getState().updateAgentStatus(subAgent.id, error ? 'error' : 'completed')
  useAgentStore.getState().updateTask(subAgent.id, subTask.id, {
    status: error ? 'error' : 'completed',
    completedAt: Date.now(),
  })

  useEventBus.getState().dispatch({
    type: 'agent:completed',
    agentId: subAgent.id,
    result: error ?? result,
    timestamp: Date.now(),
  })

  const finalSteps = useAgentStore.getState().tasks[subAgent.id]?.find(
    (t) => t.id === subTask.id,
  )?.steps ?? []

  return {
    agentId: subAgent.id,
    taskId: subTask.id,
    result: error ? `Error: ${error}` : result,
    steps: finalSteps,
    durationMs,
    error,
  }
}
