/**
 * tool-executor/index.ts
 * Dispatcher central modularizado de ejecución de herramientas.
 */

import { executeWebSearch } from '../../../../ia-sparta-core/src/services/tools/web-search'
import { executeWebFetch } from '../../../../ia-sparta-core/src/services/tools/web-fetch'
import { isMainProcessFileTool, executeMainProcessFileTool, runCommandForAgent } from 'ia-sparta-ipc-bridge'
import { McpProcessManager } from '../../mcp/core/McpProcessManager'
import { sendToRenderer } from '../../shared'
import { ToolCallContext, googleApiBaseUrls } from './types'
import { executeGoogleApiCall } from './rest-api-executor'

export type { ToolCallContext } from './types'

/**
 * Ejecuta una herramienta y retorna su output como string.
 */
import { executeGenerateChart } from './chart-generator'

export async function executeToolCall(ctx: ToolCallContext): Promise<string> {
  const { sessionId, messageId, toolCallId, toolName, toolInput } = ctx

  // ── web_search ──
  if (toolName === 'web_search') {
    const query = typeof toolInput.query === 'string' ? toolInput.query : JSON.stringify(toolInput)

    sendToRenderer({ sessionId, messageId, type: 'search:progress', stage: 'searching', query, tool_call_id: toolCallId })
    sendToRenderer({ sessionId, messageId, type: 'thinking:status', text: `Buscando en la web: "${query}"...` })

    const output = await executeWebSearch(query)

    sendToRenderer({ sessionId, messageId, type: 'search:progress', stage: 'done', tool_call_id: toolCallId })
    return output
  }

  // ── web_fetch ──
  if (toolName === 'web_fetch') {
    const url = typeof toolInput.url === 'string' ? toolInput.url.trim() : ''

    sendToRenderer({ sessionId, messageId, type: 'thinking:status', text: url ? `Obteniendo ${url}...` : 'Obteniendo página web...' })
    sendToRenderer({ sessionId, messageId, type: 'search:progress', stage: 'searching', query: url, tool_call_id: toolCallId })

    const output = await executeWebFetch(url)

    sendToRenderer({ sessionId, messageId, type: 'search:progress', stage: 'done', tool_call_id: toolCallId })
    return output
  }

  // ── MCP tool (serverId__toolName) ──
  if (toolName.includes('__')) {
    const parts = toolName.split('__')
    const serverId = parts[0]
    const realToolName = parts.slice(1).join('_')

    sendToRenderer({ sessionId, messageId, type: 'thinking:status', text: `Ejecutando herramienta MCP ${realToolName} (${serverId})...` })

    // Google API backed services (gmail, google-drive, google-calendar)
    if (googleApiBaseUrls[serverId]) {
      return await executeGoogleApiCall(serverId, realToolName, toolInput)
    }

    // Otherwise, try via McpProcessManager for STDIO/HTTP MCP servers
    try {
      let serverConfig: Record<string, unknown> | undefined
      if (ctx.mcpServers && ctx.mcpServers.length > 0) {
        const match = ctx.mcpServers.find((s: any) => s.id === serverId || s.name === serverId)
        if (match) serverConfig = match as Record<string, unknown>
      }

      const result = await McpProcessManager.getInstance().callTool(serverId, realToolName, toolInput, serverConfig)
      return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    } catch (err) {
      return `Error al ejecutar herramienta MCP "${realToolName}": ${err instanceof Error ? err.message : String(err)}`
    }
  }

  // ── Filesystem tools (list_directory, read_file, write_file, etc.) ──
  if (isMainProcessFileTool(toolName)) {
    sendToRenderer({ sessionId, messageId, type: 'thinking:status', text: `Ejecutando ${toolName}...` })
    try {
      return await executeMainProcessFileTool(
        toolName,
        toolInput as Record<string, unknown>,
        ctx.connectedFolder || ctx.workspaceRoot,
      )
    } catch (err) {
      return `Error ejecutando ${toolName}: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  // ── run_command ──
  if (toolName === 'run_command') {
    const command = typeof toolInput.command === 'string' ? toolInput.command : JSON.stringify(toolInput)
    sendToRenderer({ sessionId, messageId, type: 'thinking:status', text: `Ejecutando comando: ${command}...` })
    try {
      const res = await runCommandForAgent(
        toolCallId,
        command,
        (toolInput.cwd as string) || ctx.connectedFolder || ctx.workspaceRoot,
      )
      return res.output
    } catch (err) {
      return `Error ejecutando comando: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  // ── generate_chart ──
  if (toolName === 'generate_chart') {
    sendToRenderer({ sessionId, messageId, type: 'thinking:status', text: 'Generando gráfica interactiva...' })
    try {
      const res = await executeGenerateChart(toolInput)
      sendToRenderer({
        sessionId,
        messageId,
        type: 'chart:generated',
        toolCallId,
        filePath: res.filePath,
        title: res.title,
      })
      return res.output
    } catch (err) {
      return `Error generando gráfica: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  // ── Fallback ──
  return `Error: La herramienta '${toolName}' no está registrada o implementada en el sistema.`
}
