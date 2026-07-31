import type { MCPTool } from 'ia-sparta-core'
import rawToolsCatalog from './mcp-reference-tools.json'

export const REFERENCE_TOOLS_CATALOG: Record<string, MCPTool[]> = Object.entries(
  rawToolsCatalog as Record<string, Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }>>
).reduce((acc, [serverId, tools]) => {
  acc[serverId] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema ?? {},
    serverId,
  }))
  return acc
}, {} as Record<string, MCPTool[]>)
