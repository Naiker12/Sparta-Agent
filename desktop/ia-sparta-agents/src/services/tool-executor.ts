import type { ToolCall, MCPTool } from 'ia-sparta-core'
import { useEventBus } from 'ia-sparta-core'
import {
  getNativeFileToolDefinitions,
  isNativeFileTool,
  executeNativeFileTool,
  type NativeFileToolName,
} from '../tools/native-file-tools'
import {
  getNativeShellToolDefinition,
  isNativeShellTool,
  executeNativeShellTool,
} from '../tools/native-shell-tool'

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
  const mcpDefs = mcpTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }))

  // Concatenate native tool definitions (file + shell) with MCP tools.
  // Native tools take priority — if MCP has a tool with the same name, the MCP
  // version is filtered out so the native implementation is used instead.
  const nativeFileDefs = getNativeFileToolDefinitions()
  const nativeShellDef = getNativeShellToolDefinition()
  const nativeDefs = [...nativeFileDefs, nativeShellDef]
  const nativeNames = new Set(nativeDefs.map((d) => d.name))

  const filteredMcp = mcpDefs.filter((d) => !nativeNames.has(d.name))

  return [...nativeDefs, ...filteredMcp]
}

/**
 * Ejecuta una herramienta nativa si el nombre coincide.
 * Devuelve el resultado como string, o null si no es una herramienta nativa.
 */
export async function tryExecuteNativeTool(
  name: string,
  args: unknown,
): Promise<string | null> {
  const argsObj = (typeof args === 'object' && args !== null ? args : {}) as Record<string, unknown>

  if (isNativeFileTool(name)) {
    return await executeNativeFileTool(name as NativeFileToolName, argsObj)
  }

  if (isNativeShellTool(name)) {
    return await executeNativeShellTool(argsObj)
  }

  return null
}

