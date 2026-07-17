import type { EventHandlerCtx } from './types'

// Lazy import to avoid circular deps at module load time
function getMCPStore() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useMCPStore } = require('ia-sparta-core') as typeof import('ia-sparta-core')
  return useMCPStore.getState()
}

export function handleMCPEvent(type: string, event: Record<string, unknown>) {
  const store = getMCPStore()
  const serverId = (event.serverId ?? '') as string

  if (type === 'mcp:connected') {
    store.setConnected(serverId, true)
    console.debug('[MCP] connected:', serverId, 'tools:', event.toolCount)
  } else if (type === 'mcp:tool_discovered') {
    const tools = (event.tools ?? []) as Array<{ name: string; description: string; inputSchema: unknown }>
    store.setServerTools(serverId, tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      serverId,
    })))
    console.debug('[MCP] tools discovered:', serverId, tools.map((t) => t.name))
  } else if (type === 'mcp:error') {
    store.setConnected(serverId, false)
    console.warn('[MCP] connection error:', serverId, event.error)
  }
}

export function handleMCPServerAdded(ctx: EventHandlerCtx) {
  const store = getMCPStore()
  const serverId = (ctx.event.serverId ?? '') as string
  const config = ctx.event.config as Record<string, unknown> | undefined
  if (serverId && config) {
    store.addServer(config as unknown as Parameters<typeof store.addServer>[0])
    console.debug('[MCP] server added via tool:', serverId)
  }
}

export function handleMCPServerRemoved(ctx: EventHandlerCtx) {
  const store = getMCPStore()
  const serverId = (ctx.event.serverId ?? '') as string
  if (serverId) {
    store.removeServer(serverId)
    console.debug('[MCP] server removed via tool:', serverId)
  }
}
