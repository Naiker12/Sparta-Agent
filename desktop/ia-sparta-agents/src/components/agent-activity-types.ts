import { FileSearch, FilePen, FileX, Terminal, Globe } from 'lucide-react'

export interface ActivityEntry {
  id: string
  toolName: string
  label: string
  input?: unknown
  status: 'running' | 'completed' | 'error'
  startedAt: number
  completedAt?: number
  durationMs?: number
  error?: string
  filePath?: string
  linesAdded?: number
  linesRemoved?: number
  turnIndex: number
}

export const TOOL_ICONS: Record<string, typeof FileSearch> = {
  read_file_tool: FileSearch,
  read_files_tool: FileSearch,
  write_file_tool: FilePen,
  patch_file_tool: FilePen,
  delete_file_tool: FileX,
  search_files_tool: FileSearch,
  terminal_execute_tool: Terminal,
  terminal_execute_background_tool: Terminal,
  web_search_tool: Globe,
  web_search: Globe,
  web_fetch_tool: Globe,
}

export function labelForTool(name: string, input: unknown): { label: string; filePath?: string } {
  const inp = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const rawPath = String(inp.path ?? '')
  const fileName = rawPath.split(/[\\/]/).pop() ?? ''
  switch (name) {
    case 'read_file_tool':
      return { label: `Leyó ${fileName}`, filePath: rawPath || undefined }
    case 'read_files_tool': {
      const paths = inp.paths as string[] | undefined
      return { label: `Leyó ${paths?.length ?? 0} archivos` }
    }
    case 'write_file_tool':
      return { label: `Escribió ${fileName}`, filePath: rawPath || undefined }
    case 'patch_file_tool':
      return { label: `Editó ${fileName}`, filePath: rawPath || undefined }
    case 'delete_file_tool':
      return { label: `Eliminó ${fileName}`, filePath: rawPath || undefined }
    case 'search_files_tool':
      return { label: `Buscó ${String(inp.pattern ?? inp.query ?? '')}` }
    case 'terminal_execute_tool':
      return { label: `Terminal: ${String(inp.command ?? '').slice(0, 40)}` }
    case 'terminal_execute_background_tool':
      return { label: `Terminal (bg): ${String(inp.command ?? '').slice(0, 40)}` }
    case 'web_search_tool':
    case 'web_search':
      return { label: `Buscó web: ${String(inp.query ?? '')}` }
    case 'web_fetch_tool':
      return { label: `Fetch: ${String(inp.url ?? '').slice(0, 50)}` }
    default:
      return { label: name }
  }
}

export function computeDiffStats(original: string, updated: string): { added: number; removed: number } {
  const origLines = original.split('\n')
  const newLines = updated.split('\n')
  let removed = 0
  let added = 0
  const maxLen = Math.max(origLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i]
    const n = newLines[i]
    if (o !== undefined && n === undefined) {
      removed++
    } else if (o === undefined && n !== undefined) {
      added++
    } else if (o !== n) {
      removed++
      added++
    }
  }
  return { added, removed }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const remain = (s % 60).toFixed(0)
  return `${m}m ${remain}s`
}
