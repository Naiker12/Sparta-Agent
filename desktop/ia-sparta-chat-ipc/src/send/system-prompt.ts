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

  const summaryDirective = `[REGLA OBLIGATORIA DE RESUMEN DE ACCIONES]
Cada vez que ejecutes una herramienta (Notion, Google Drive, OneDrive, Gmail, Filesystem, Terminal, etc.):
- NUNCA respondas con frases vagas como "Ya lo hice" o "Ya te agregué eso".
- ES OBLIGATORIO entregar al usuario un resumen estructurado y transparente en Markdown que describa:
  1. El recurso objetivo (título de página en Notion, archivo en OneDrive, correo en Gmail, etc.).
  2. La acción exacta realizada (bloques añadidos, archivo creado, correo enviado).
  3. Un desglose en viñetas del contenido o cambio aplicado.`

  const realTimeWebDirective = `[BÚSQUEDA Y DATOS EN TIEMPO REAL]
Cuando el usuario solicite información reciente, partidos en vivo, noticias, fechas, cotizaciones o datos de internet:
1. Usá SIEMPRE la herramienta 'web_search' para consultar la web en tiempo real.
2. Si un sitio específico contiene los detalles (ej. FotMob, ESPN, MDN, GitHub), usá 'web_fetch' para extraer el contenido directo.
3. Presentá SIEMPRE los resultados de forma premium: con tablas Markdown estructuradas, fechas traducidas y horarios ajustados a la zona horaria del usuario (ej. UTC-5 Colombia).`

  return [
    req.system || 'Sos Sparta Agent, un asistente de ingeniería de software de alto rendimiento.',
    workspaceContext,
    skillContext,
    mcpContext,
    summaryDirective,
    realTimeWebDirective,
  ].filter(Boolean).join('\n\n')
}
