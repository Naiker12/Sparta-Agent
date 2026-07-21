export const TOOL_STATUS_LABELS: Record<string, (args: Record<string, unknown>) => string | undefined> = {
  web_search_tool: (a) => {
    const query = a.query ?? a.q
    return query ? `Buscando "${String(query)}" en la web...` : 'Buscando en la web...'
  },
  web_fetch_tool: (a) => {
    const url = a.url ?? a.link
    if (!url) return 'Leyendo página web...'
    try {
      return `Leyendo ${new URL(String(url)).hostname}...`
    } catch {
      return `Leyendo ${String(url).slice(0, 40)}...`
    }
  },
  list_directory_tool: (a) => {
    const p = a.path ?? a.directory ?? '.'
    return p === '.' ? 'Explorando el proyecto...' : `Explorando ${p}...`
  },
  glob_search_tool: (a) => {
    const pattern = a.pattern ?? a.glob ?? '*'
    return `Buscando archivos "${pattern}"...`
  },
  grep_search_tool: (a) => {
    const query = a.query ?? a.q ?? a.pattern
    return query ? `Buscando "${String(query)}" en el código...` : 'Buscando en el código...'
  },
  read_file_tool: (a) => {
    const p = a.path ?? a.file_path ?? a.file
    return p ? `Leyendo ${p}...` : 'Leyendo archivo...'
  },
  write_file_tool: (a) => {
    const p = a.path ?? a.file_path ?? a.file
    return p ? `Escribiendo ${p}...` : 'Escribiendo archivo...'
  },
  patch_file_tool: (a) => {
    const p = a.path ?? a.file_path ?? a.file
    return p ? `Editando ${p}...` : 'Editando archivo...'
  },
  get_diagnostics_tool: (a) => {
    const p = a.path ?? a.file_path ?? '.'
    return p === '.' ? 'Revisando errores...' : `Revisando errores en ${p}...`
  },
  create_plan_tool: () => 'Planificando pasos...',
  delegate_research: (a) => {
    const topic = a.topic ?? a.query ?? a.task
    return topic ? `Investigando: ${String(topic).slice(0, 40)}...` : 'Investigando...'
  },
  delegate_code: (a) => {
    const task = a.task ?? a.query
    return task ? `Desarrollando: ${String(task).slice(0, 40)}...` : 'Desarrollando tarea de código...'
  },
  delegate_memory: (a) => {
    const query = a.query ?? a.topic
    return query ? `Recordando: ${String(query).slice(0, 40)}...` : 'Consultando memoria...'
  },
}

export function labelForToolCall(name: string, args?: Record<string, unknown>): string {
  const label = TOOL_STATUS_LABELS[name]?.(args ?? {})
  if (label) return label

  // Generic fallback: turn snake_case into a readable verb.
  const readable = name
    .replace(/_tool$/g, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
  return `${readable}...`
}

export function thinkingLabel(status: 'idle' | 'starting' | 'streaming' | 'completed' | 'collapsed', durationMs: number | null): string {
  if (status === 'streaming' || status === 'starting') return 'Pensando'
  if (durationMs === null) return 'Pensó'
  const s = Math.max(1, Math.round(durationMs / 1000))
  return `Pensó durante ${s}s`
}
