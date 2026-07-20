import type { ToolCall, TaskStep, SubagentRun, SubagentStep } from 'ia-sparta-core'
import { useAgentStore } from 'ia-sparta-core'
import { useEventBus } from 'ia-sparta-core'
import { executeTool, executeToolsParallel, areToolCallsIndependent } from './tool-executor'

const MAX_LLM_TURNS = 10

interface ParsedToolUse {
  id: string
  name: string
  input: unknown
}

function parseToolUseBlocks(text: string): ParsedToolUse[] {
  const blocks: ParsedToolUse[] = []
  const regex = /<tool_use>\s*<tool_name>([\w-]+)<\/tool_name>\s*<tool_input>([\s\S]*?)<\/tool_input>\s*<\/tool_use>/g
  let match
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      id: crypto.randomUUID(),
      name: match[1].trim(),
      input: parseInput(match[2].trim()),
    })
  }
  return blocks
}

function parseInput(input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    return input
  }
}

function extractFinalResult(text: string): string {
  const resultMatch = /<result>([\s\S]*?)<\/result>/.exec(text)
  if (resultMatch) return resultMatch[1].trim()

  const thinkMatch = /<thinking>[\s\S]*?<\/thinking>/gs
  const clean = text.replace(thinkMatch, '').trim()
  return clean || text
}

function buildStepId(name: string, index: number): string {
  return `step-${index}-${name.toLowerCase().replace(/\s+/g, '-')}`
}

export async function runAgentTask(
  taskId: string,
  agentId: string,
  taskDescription: string,
  systemPrompt: string,
  allowedTools: string[],
  toolDefinitions: unknown[],
  toolRunner: (name: string, args: unknown) => Promise<unknown>,
  llmCall: (prompt: string) => Promise<string>,
): Promise<string> {
  const messages: { role: string; content: string }[] = [
    { role: 'user', content: taskDescription },
  ]

  let accumulatedResult = ''
  let turnCount = 0

  // Emit subagent:started
  const store = useAgentStore.getState()
  const agent = store.agents.find((a) => a.id === agentId)
  const subagentName = agent?.name ?? 'unknown'
  useEventBus.getState().dispatch({
    type: 'subagent:started' as const,
    subagentName,
    taskSummary: taskDescription.slice(0, 120),
    agentId,
    timestamp: Date.now(),
  })
  const subagentRun: SubagentRun = {
    name: subagentName,
    kind: agent?.type ?? 'research',
    status: 'running',
    taskSummary: taskDescription.slice(0, 120),
    currentStep: 'Iniciando...',
    steps: [],
    startedAt: Date.now(),
  }
  store.startSubagentRun(agentId, subagentRun)

  for (turnCount = 0; turnCount < MAX_LLM_TURNS; turnCount++) {
    // Emit subagent:step per LLM turn
    const step: SubagentStep = {
      id: `turn-${turnCount}`,
      label: `Turno LLM #${turnCount + 1}: pensando...`,
      status: 'running',
    }
    store.updateSubagentStep(agentId, subagentName, step)
    useEventBus.getState().dispatch({
      type: 'subagent:step' as const,
      subagentName,
      stepId: step.id,
      stepLabel: step.label,
      status: 'running',
      agentId,
      timestamp: Date.now(),
    })
    const prompt = buildPrompt(
      systemPrompt,
      messages,
      toolDefinitions,
      allowedTools,
    )

    const response = await llmCall(prompt)
    messages.push({ role: 'assistant', content: response })

    const toolUseBlocks = parseToolUseBlocks(response)

    if (toolUseBlocks.length === 0) {
      accumulatedResult = extractFinalResult(response)
      break
    }

    const toolCalls: ToolCall[] = toolUseBlocks.map((b) => ({
      id: b.id,
      toolName: b.name,
      input: b.input,
      status: 'running' as const,
    }))

    const stepEntries: TaskStep[] = toolCalls.map((tc) => ({
      id: buildStepId(tc.toolName, turnCount),
      name: `Ejecutar ${tc.toolName}`,
      status: 'running' as const,
      tool: tc.toolName,
    }))

    const existingSteps = store.tasks[agentId]?.find((t) => t.id === taskId)?.steps ?? []
    store.updateTask(agentId, taskId, {
      steps: [...existingSteps, ...stepEntries],
    })

    store.updateAgentStatus(agentId, 'thinking')

    let results: { toolCallId: string; toolName: string; output: string; durationMs: number; error?: string }[]

    if (areToolCallsIndependent(toolCalls)) {
      results = await executeToolsParallel(
        toolCalls,
        toolRunner,
      )
    } else {
      results = []
      for (const tc of toolCalls) {
        const r = await executeTool(tc, toolRunner)
        results.push(r)
      }
    }

    const feedMessages = results.map((r) => {
      return {
        role: 'user' as const,
        content: `Resultado de ${r.toolName} (${r.durationMs}ms): ${
          r.error ? `ERROR: ${r.error}` : r.output
        }`,
      }
    })

    for (const fm of feedMessages) {
      messages.push(fm)
    }

    const updatedSteps = (useAgentStore.getState().tasks[agentId]?.find((t) => t.id === taskId)?.steps ?? []).map(
      (s) => {
        const matchingResult = results.find((r) => s.tool === r.toolName)
        if (matchingResult) {
          return {
            ...s,
            status: (matchingResult.error ? 'error' : 'completed') as TaskStep['status'],
            durationMs: matchingResult.durationMs,
            error: matchingResult.error,
          }
        }
        return s
      },
    )

    useAgentStore.getState().updateTask(agentId, taskId, {
      steps: updatedSteps,
    })
  }

  if (turnCount >= MAX_LLM_TURNS) {
    accumulatedResult = 'Límite de turnos alcanzado. Resultado parcial:\n' + accumulatedResult
  }

  const durationMs = Date.now() - subagentRun.startedAt
  useAgentStore.getState().updateAgentStatus(agentId, 'completed')
  useAgentStore.getState().updateTask(agentId, taskId, {
    status: 'completed',
    completedAt: Date.now(),
  })
  useAgentStore.getState().completeSubagentRun(agentId, subagentName, 'completed', durationMs)

  useEventBus.getState().dispatch({
    type: 'agent:completed',
    agentId,
    result: accumulatedResult,
    timestamp: Date.now(),
  })
  useEventBus.getState().dispatch({
    type: 'subagent:completed' as const,
    subagentName,
    durationMs,
    success: true,
    agentId,
    timestamp: Date.now(),
  })

  return accumulatedResult
}

function buildPrompt(
  system: string,
  messages: { role: string; content: string }[],
  toolDefinitions: unknown[],
  allowedTools: string[],
): string {
  let prompt = `${system}\n\n`

  if (toolDefinitions.length > 0) {
    prompt += `## Herramientas disponibles\n`
    prompt += `Puedes usar las siguientes herramientas. Cuando necesites usar una, responde con:\n`
    prompt += `<tool_use>\n<tool_name>nombre-de-la-herramienta</tool_name>\n<tool_input>{json input}</tool_input>\n</tool_use>\n\n`
    for (const def of toolDefinitions) {
      const td = def as { name: string; description: string }
      if (allowedTools.includes(td.name)) {
        prompt += `- ${td.name}: ${td.description}\n`
      }
    }
    prompt += '\n'
  }

  prompt += `## Conversación\n`
  for (const msg of messages) {
    prompt += `\n${msg.role.toUpperCase()}: ${msg.content}`
  }

  prompt += `\n\nASSISTANT: `
  return prompt
}
