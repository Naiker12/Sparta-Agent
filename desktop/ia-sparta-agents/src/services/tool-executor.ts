import type { ToolCall, MCPTool } from '@/types'
import { useEventBus } from '@/stores/event-bus.store'

export interface ToolResult {
  toolCallId: string
  toolName: string
  output: string
  durationMs: number
  error?: string
}

type ToolRunner = (name: string, args: unknown) => Promise<unknown>

export async function executeTool(
  toolCall: ToolCall,
  runner: ToolRunner,
): Promise<ToolResult> {
  const start = performance.now()

  useEventBus.getState().dispatch({
    type: 'tool:called',
    toolName: toolCall.toolName,
    input: toolCall.input,
    timestamp: Date.now(),
  })

  try {
    const output = await runner(toolCall.toolName, toolCall.input)
    const durationMs = Math.round(performance.now() - start)

    useEventBus.getState().dispatch({
      type: 'tool:result',
      toolName: toolCall.toolName,
      output: typeof output === 'string' ? output : JSON.stringify(output),
      durationMs,
      timestamp: Date.now(),
    })

    return {
      toolCallId: toolCall.id,
      toolName: toolCall.toolName,
      output: typeof output === 'string' ? output : JSON.stringify(output, null, 2),
      durationMs,
    }
  } catch (err) {
    const durationMs = Math.round(performance.now() - start)
    const error = err instanceof Error ? err.message : String(err)

    useEventBus.getState().dispatch({
      type: 'tool:error',
      toolName: toolCall.toolName,
      error,
      timestamp: Date.now(),
    })

    return {
      toolCallId: toolCall.id,
      toolName: toolCall.toolName,
      output: '',
      durationMs,
      error,
    }
  }
}

export function areToolCallsIndependent(calls: ToolCall[]): boolean {
  return calls.length >= 2
}

export async function executeToolsParallel(
  toolCalls: ToolCall[],
  runner: ToolRunner,
): Promise<ToolResult[]> {
  return Promise.all(toolCalls.map((tc) => executeTool(tc, runner)))
}

export function buildToolDefinitions(mcpTools: MCPTool[]): unknown[] {
  return mcpTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }))
}
