/**
 * system-prompt.ts
 * Construcción del system prompt compuesto (base + workspace + skills + MCP).
 */

import type { ChatRequest } from '../shared'
import { buildSkillContext } from './skill-context'

export function buildSystemPrompt(req: ChatRequest, userText: string): string {
  const folderPath = req.connectedFolder || req.workspaceRoot
  const workspaceContext = folderPath
    ? `[INFORMACIÓN DEL WORKSPACE]\nLa carpeta de trabajo conectada es: "${folderPath}".\nUsá esta ruta absoluta como base para list_directory, read_file, write_file, edit_file, delete_file y run_command a menos que el usuario indique explícitamente otra.`
    : ''

  const skillContext = buildSkillContext(req.skills, userText)

  const mcpContext = `[REGLAS Y HERRAMIENTAS MCP]
Cuando el usuario mencione un conector MCP (ej. @Gmail, @Google Drive, @Filesystem, @Git, @Notion, @Slack):
- NUNCA intentes usar la herramienta 'web_fetch' ni 'fetch' sobre endpoints de servidores MCP como "https://gmail-mcp.googleapis.com/mcp".
- Las herramientas de conectores MCP se ejecutan mediante el canal IPC nativo mcp:call-tool.`

  return [
    req.system || 'Sos Sparta Agent, un asistente de ingeniería de software de alto rendimiento.',
    workspaceContext,
    skillContext,
    mcpContext,
  ].filter(Boolean).join('\n\n')
}
