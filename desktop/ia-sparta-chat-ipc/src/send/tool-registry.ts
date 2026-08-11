import type { ToolDescriptor } from 'ia-sparta-contracts'
import type { ToolCallContext } from './tool-executor/types'

export interface RegisteredTool extends ToolDescriptor {
  execute: (ctx: ToolCallContext) => Promise<string>
}

const registry = new Map<string, RegisteredTool>()

export function registerTool(tool: RegisteredTool): void {
  if (registry.has(tool.id)) {
    throw new Error(`Tool already registered: ${tool.id}`)
  }
  registry.set(tool.id, tool)
}

export function listToolDescriptors(): ToolDescriptor[] {
  return [...registry.values()].map(({ execute: _execute, ...descriptor }) => descriptor)
}

export function hasRegisteredTool(id: string): boolean {
  return registry.has(id)
}

export async function dispatchToolCall(ctx: ToolCallContext): Promise<string> {
  const tool = registry.get(ctx.toolName)
  if (!tool) {
    return `Error: La herramienta '${ctx.toolName}' no está registrada o implementada en el sistema.`
  }
  return tool.execute(ctx)
}

/** Test-only reset. Runtime registration occurs once during module initialization. */
export function clearToolRegistry(): void {
  registry.clear()
}
