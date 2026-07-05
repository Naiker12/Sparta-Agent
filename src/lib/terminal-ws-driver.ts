type DataCallback = (data: string) => void
type ExitCallback = (code: number) => void
type AgentSpawnCallback = (payload: { procId: string; command: string }) => void
type AgentOutputCallback = (payload: { procId: string; chunk: string }) => void
type AgentExitCallback = (payload: { procId: string; code: number }) => void

interface SessionState {
  ws: WebSocket
  onData: Set<DataCallback>
  onExit: Set<ExitCallback>
  dataBuffer: string[]
  exitCode: number | null
  flushed: boolean
}

interface TerminalCreateResult {
  success: boolean
  shell?: string
  error?: string
}

interface TerminalWriteResult {
  success: boolean
  error?: string
  needsConfirmation?: boolean
}

const sessions = new Map<string, SessionState>()
const agentSpawnCbs = new Set<AgentSpawnCallback>()
const agentOutputCbs = new Set<AgentOutputCallback>()
const agentExitCbs = new Set<AgentExitCallback>()

function getWsBaseUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = (import.meta as any).env?.VITE_SIDECAR_HOST ?? 'localhost'
  const port = (import.meta as any).env?.VITE_SIDECAR_WS_PORT ?? '8765'
  return `${protocol}//${host}:${port}`
}

function connectTerminal(sessionId: string): Promise<SessionState> {
  return new Promise((resolve, reject) => {
    const url = `${getWsBaseUrl()}/ws/terminal/${sessionId}`
    const ws = new WebSocket(url)
    const state: SessionState = { ws, onData: new Set(), onExit: new Set(), dataBuffer: [], exitCode: null, flushed: false }

    ws.onopen = () => {
      sessions.set(sessionId, state)
      resolve(state)
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'output') {
          if (state.flushed) {
            state.onData.forEach((cb) => cb(msg.data))
          } else {
            if (state.onData.size > 0) {
              state.flushed = true
              state.onData.forEach((cb) => cb(msg.data))
              for (const buffered of state.dataBuffer) {
                state.onData.forEach((cb) => cb(buffered))
              }
              state.dataBuffer = []
            } else {
              state.dataBuffer.push(msg.data)
            }
          }
        } else if (msg.type === 'exit') {
          state.exitCode = msg.code
          state.onExit.forEach((cb) => cb(msg.code))
        }
      } catch { }
    }

    ws.onerror = () => {
      if (!sessions.has(sessionId)) {
        reject(new Error(`WebSocket connection failed for ${sessionId}`))
      }
    }

    ws.onclose = () => {
      sessions.delete(sessionId)
    }
  })
}

function flushBuffer(state: SessionState): void {
  if (state.flushed) return
  state.flushed = true
  for (const buffered of state.dataBuffer) {
    state.onData.forEach((cb) => cb(buffered))
  }
  state.dataBuffer = []
  if (state.exitCode !== null) {
    state.onExit.forEach((cb) => cb(state.exitCode!))
  }
}

function sendMsg(sessionId: string, msg: Record<string, unknown>) {
  const state = sessions.get(sessionId)
  if (state && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(msg))
  }
}

export function initWebTerminalDriver(): void {
  if (window.terminal) return

  const activeTerminals = new Set<string>()

  window.terminal = {
    async create({ terminalId, cols, rows }): Promise<TerminalCreateResult> {
      try {
        await connectTerminal(terminalId)
        activeTerminals.add(terminalId)
        sendMsg(terminalId, { type: 'resize', cols, rows })
        return { success: true, shell: 'web-shell' }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },

    write(terminalId: string, data: string): void {
      sendMsg(terminalId, { type: 'input', data })
    },

    resize(terminalId: string, cols: number, rows: number): void {
      sendMsg(terminalId, { type: 'resize', cols, rows })
    },

    async destroy(terminalId: string): Promise<{ success: boolean }> {
      const state = sessions.get(terminalId)
      if (state) {
        state.ws.close()
        sessions.delete(terminalId)
        activeTerminals.delete(terminalId)
      }
      return { success: true }
    },

    onData(terminalId: string, callback: DataCallback): () => void {
      const state = sessions.get(terminalId)
      if (state) {
        state.onData.add(callback)
        flushBuffer(state)
        return () => state.onData.delete(callback)
      }
      const wait = setInterval(() => {
        const s = sessions.get(terminalId)
        if (s) {
          s.onData.add(callback)
          flushBuffer(s)
          clearInterval(wait)
        }
      }, 50)
      return () => { clearInterval(wait); sessions.get(terminalId)?.onData.delete(callback) }
    },

    onExit(terminalId: string, callback: ExitCallback): () => void {
      const state = sessions.get(terminalId)
      if (state) {
        state.onExit.add(callback)
        if (state.exitCode !== null) callback(state.exitCode)
        return () => state.onExit.delete(callback)
      }
      const wait = setInterval(() => {
        const s = sessions.get(terminalId)
        if (s) {
          s.onExit.add(callback)
          if (s.exitCode !== null) callback(s.exitCode)
          clearInterval(wait)
        }
      }, 50)
      return () => { clearInterval(wait); sessions.get(terminalId)?.onExit.delete(callback) }
    },

    async agentWrite(_terminalId: string, command: string): Promise<TerminalWriteResult> {
      const targetId = activeTerminals.values().next().value
      if (targetId) {
        sendMsg(targetId, { type: 'input', data: command + '\n' })
        return { success: true }
      }
      return { success: false, error: 'No active terminal session' }
    },

    async agentWriteForce(terminalId: string, command: string): Promise<TerminalWriteResult> {
      return window.terminal!.agentWrite(terminalId, command)
    },

    async listSessions(): Promise<string[]> {
      return Array.from(activeTerminals)
    },

    async agentSpawn(procId: string, command: string, _cwd?: string): Promise<{ success: boolean; error?: string }> {
      const sessionId = `bg-${procId}`
      try {
        const state = await connectTerminal(sessionId)
        state.onData.add((chunk) => {
          agentOutputCbs.forEach((cb) => cb({ procId, chunk }))
        })
        state.onExit.add((code) => {
          agentExitCbs.forEach((cb) => cb({ procId, code }))
          sessions.delete(sessionId)
        })
        flushBuffer(state)
        agentSpawnCbs.forEach((cb) => cb({ procId, command }))
        sendMsg(sessionId, { type: 'input', data: command + '\n' })
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },

    async agentKill(procId: string): Promise<{ success: boolean }> {
      const sessionId = `bg-${procId}`
      const state = sessions.get(sessionId)
      if (state) {
        state.ws.close()
        sessions.delete(sessionId)
      }
      return { success: true }
    },

    onAgentSpawn(callback: AgentSpawnCallback): () => void {
      agentSpawnCbs.add(callback)
      return () => agentSpawnCbs.delete(callback)
    },

    onAgentOutput(callback: AgentOutputCallback): () => void {
      agentOutputCbs.add(callback)
      return () => agentOutputCbs.delete(callback)
    },

    onAgentExit(callback: AgentExitCallback): () => void {
      agentExitCbs.add(callback)
      return () => agentExitCbs.delete(callback)
    },
  }
}
