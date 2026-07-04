type Writer = (chunk: string) => void

const writers = new Map<string, Writer>()
const backlog = new Map<string, string>()
const seededCommands = new Set<string>()

const MAX_BACKLOG = 256_000

export function registerAgentTerminalWriter(procId: string, write: Writer): () => void {
  writers.set(procId, write)
  const history = backlog.get(procId)
  if (history) write(history)
  return () => {
    if (writers.get(procId) === write) writers.delete(procId)
  }
}

export function writeAgentTerminalChunk(procId: string, chunk: string): void {
  if (!procId || !chunk) return
  const next = (backlog.get(procId) ?? '') + chunk
  backlog.set(procId, next.length > MAX_BACKLOG ? next.slice(-MAX_BACKLOG) : next)
  writers.get(procId)?.(chunk)
}

export function seedAgentTerminalCommand(procId: string, command: string): void {
  const trimmed = command.trim()
  if (!procId || !trimmed || seededCommands.has(procId)) return
  seededCommands.add(procId)
  writeAgentTerminalChunk(procId, `\x1b[36m[agente]\x1b[0m ${trimmed}\r\n`)
}

export function clearAgentTerminal(procId: string): void {
  writers.delete(procId)
  backlog.delete(procId)
  seededCommands.delete(procId)
}
