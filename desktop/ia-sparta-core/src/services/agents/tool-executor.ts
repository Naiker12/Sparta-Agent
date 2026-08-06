import type { ToolCall, MCPTool } from '../../types'
import { useEventBus } from '../../stores/event-bus.store'

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

// --- Native tool definitions inlined here to avoid circular dependency ---
// These are the same definitions as in ia-sparta-agents/src/tools/ but
// self-contained so ia-sparta-core doesn't import from ia-sparta-agents.

const NATIVE_FILE_TOOL_NAMES = [
  'read_file', 'write_file', 'edit_file', 'delete_file', 'list_directory',
] as const

type NativeFileToolName = (typeof NATIVE_FILE_TOOL_NAMES)[number]

function getNativeFileToolDefinitions() {
  return [
    { name: 'read_file', description: 'Lee el contenido de un archivo.', input_schema: { type: 'object' as const, properties: { path: { type: 'string', description: 'Ruta absoluta del archivo.' } }, required: ['path'] } },
    { name: 'write_file', description: 'Escribe contenido en un archivo.', input_schema: { type: 'object' as const, properties: { path: { type: 'string', description: 'Ruta absoluta.' }, content: { type: 'string', description: 'Contenido.' } }, required: ['path', 'content'] } },
    { name: 'edit_file', description: 'Edita un archivo reemplazando old_text por new_text.', input_schema: { type: 'object' as const, properties: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } }, required: ['path', 'old_text', 'new_text'] } },
    { name: 'delete_file', description: 'Elimina un archivo o carpeta.', input_schema: { type: 'object' as const, properties: { path: { type: 'string', description: 'Ruta absoluta.' } }, required: ['path'] } },
    { name: 'list_directory', description: 'Lista contenido de un directorio.', input_schema: { type: 'object' as const, properties: { path: { type: 'string', description: 'Ruta absoluta del directorio.' } }, required: ['path'] } },
  ]
}

function getNativeShellToolDefinition() {
  return {
    name: 'run_command',
    description: 'Ejecuta un comando en la terminal del sistema.',
    input_schema: { type: 'object' as const, properties: { command: { type: 'string', description: 'Comando a ejecutar.' }, cwd: { type: 'string', description: 'Directorio de trabajo opcional.' } }, required: ['command'] },
  }
}

export function buildToolDefinitions(mcpTools: MCPTool[]): unknown[] {
  const mcpDefs = mcpTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }))

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

  if ((NATIVE_FILE_TOOL_NAMES as readonly string[]).includes(name)) {
    return await executeNativeFileToolInline(name as NativeFileToolName, argsObj)
  }

  if (name === 'run_command') {
    return await executeNativeShellToolInline(argsObj)
  }

  return null
}

async function executeNativeFileToolInline(
  name: NativeFileToolName,
  args: Record<string, unknown>,
): Promise<string> {
  if (typeof window === 'undefined' || !window.fs) {
    throw new Error('Herramientas de archivo requieren Electron (window.fs).')
  }

  switch (name) {
    case 'read_file': {
      const filePath = String(args.path ?? '')
      if (!filePath) throw new Error('read_file requiere "path".')
      const result = await window.fs.readFile(filePath)
      if (!result || !result.success) throw new Error(result?.error ?? 'Error leyendo archivo.')
      let content = result.content
      if (typeof content !== 'string') {
        content = content ? String(content) : ''
      }
      return content
    }
    case 'write_file': {
      const filePath = String(args.path ?? '')
      const content = String(args.content ?? '')
      if (!filePath) throw new Error('write_file requiere "path".')
      const sep = filePath.includes('/') ? '/' : '\\'
      const parentDir = filePath.substring(0, filePath.lastIndexOf(sep))
      if (parentDir) await window.fs.mkdir(parentDir)
      const result = await window.fs.writeFile(filePath, content)
      if (!result.success) throw new Error(result.error ?? 'Error escribiendo archivo.')
      return `Archivo escrito: ${filePath}`
    }
    case 'edit_file': {
      const filePath = String(args.path ?? '')
      const oldText = String(args.old_text ?? '')
      const newText = String(args.new_text ?? '')
      if (!filePath || !oldText) throw new Error('edit_file requiere "path" y "old_text".')
      const readResult = await window.fs.readFile(filePath)
      if (!readResult.success) throw new Error(readResult.error ?? 'Error leyendo archivo.')
      const current = readResult.content ?? ''
      if (!current.includes(oldText)) throw new Error('old_text no encontrado.')
      const writeResult = await window.fs.writeFile(filePath, current.replace(oldText, newText))
      if (!writeResult.success) throw new Error(writeResult.error ?? 'Error escribiendo.')
      return `Archivo editado: ${filePath}`
    }
    case 'delete_file': {
      const filePath = String(args.path ?? '')
      if (!filePath) throw new Error('delete_file requiere "path".')
      const result = await window.fs.deleteFile(filePath)
      if (!result.success) throw new Error(result.error ?? 'Error eliminando.')
      return `Archivo eliminado: ${filePath}`
    }
    case 'list_directory': {
      const dirPath = String(args.path ?? '')
      if (!dirPath) throw new Error('list_directory requiere "path".')
      const result = await window.fs.readDirLevel(dirPath)
      if (result.error) throw new Error(result.error)
      return result.nodes.map((n) => `[${n.type === 'directory' ? 'DIR' : 'FILE'}] ${n.name}`).join('\n') || '(vacío)'
    }
    default:
      throw new Error(`Herramienta desconocida: ${name}`)
  }
}

async function executeNativeShellToolInline(
  args: Record<string, unknown>,
): Promise<string> {
  if (typeof window === 'undefined' || !window.terminal?.agentSpawn) {
    throw new Error('run_command requiere Electron (window.terminal.agentSpawn).')
  }

  const command = String(args.command ?? '').trim()
  if (!command) throw new Error('run_command requiere "command".')

  const { useFolderStore } = await import('../../stores/folder.store')
  const cwd = args.cwd ? String(args.cwd) : useFolderStore.getState().connectedPath || undefined
  const procId = `agent-cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return new Promise<string>((resolve, reject) => {
    const outputChunks: string[] = []
    let settled = false

    const unsubOutput = window.terminal.onAgentOutput((payload) => {
      if (payload.procId !== procId) return
      outputChunks.push(payload.chunk)
    })

    const unsubExit = window.terminal.onAgentExit((payload) => {
      if (payload.procId !== procId) return
      settled = true
      unsubOutput()
      unsubExit()
      // eslint-disable-next-line no-control-regex
      const clean = outputChunks.join('').replace(/\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/gu, '')
      resolve(
        `Comando ${payload.code === 0 ? 'exitoso' : 'finalizado'} (exit code: ${payload.code})\n\n$ ${command}\n${clean.trim() || '(sin salida)'}`,
      )
    })

    window.terminal.agentSpawn(procId, command, cwd).then((result) => {
      if (!result.success) {
        settled = true
        unsubOutput()
        unsubExit()
        reject(new Error(result.error ?? 'Error ejecutando comando.'))
      }
    }).catch((err) => {
      if (!settled) { settled = true; unsubOutput(); unsubExit(); reject(err) }
    })

    setTimeout(() => {
      if (!settled) {
        settled = true; unsubOutput(); unsubExit()
        window.terminal.agentKill(procId).catch(() => {})
        // eslint-disable-next-line no-control-regex
        const partial = outputChunks.join('').replace(/\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/gu, '')
        resolve(`Timeout (5min)\n\n$ ${command}\n${partial.trim() || '(sin salida)'}`)
      }
    }, 5 * 60 * 1000)
  })
}

