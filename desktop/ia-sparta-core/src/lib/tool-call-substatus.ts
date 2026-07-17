import type { ToolCallSubstatus } from '../types'

/**
 * Infers a client-side substatus for a running tool call based on tool type
 * and elapsed time. The backend only sends `tool:called` / `tool:result` /
 * `tool:error` — there are no intermediate events. This function provides
 * a best-effort guess for the UI.
 */
export function inferToolSubstatus(
  toolName: string,
  startedAt: number,
  searchProgressCount?: number,
): ToolCallSubstatus {
  const elapsed = Date.now() - startedAt

  // Web search: connecting → waiting (searching) → reading
  if (toolName === 'web_search' || toolName === 'web_search_tool') {
    if (searchProgressCount && searchProgressCount > 0) return 'reading'
    if (elapsed < 1500) return 'connecting'
    return 'waiting'
  }

  // Web fetch: connecting → reading
  if (toolName === 'web_fetch' || toolName === 'web_fetch_tool') {
    if (elapsed < 2000) return 'connecting'
    return 'reading'
  }

  // File read: reading
  if (toolName === 'read_file_tool' || toolName === 'read_files_tool') {
    return 'reading'
  }

  // File write/patch/delete: writing
  if (toolName === 'write_file_tool' || toolName === 'patch_file_tool' || toolName === 'delete_file_tool') {
    return 'writing'
  }

  // Terminal: executing
  if (toolName === 'terminal_execute_tool' || toolName === 'terminal_execute_background_tool') {
    return 'executing'
  }

  // Default: executing
  return 'executing'
}

/**
 * Returns a human-readable Spanish label for a tool substatus.
 */
export function substatusLabel(substatus: ToolCallSubstatus): string {
  switch (substatus) {
    case 'connecting': return 'Conectando…'
    case 'executing': return 'Ejecutando…'
    case 'waiting': return 'Esperando respuesta…'
    case 'reading': return 'Leyendo…'
    case 'writing': return 'Escribiendo…'
  }
}
