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

interface SpartaImportMetaEnv {
  VITE_SIDECAR_HOST?: string
  VITE_SIDECAR_WS_PORT?: string
  VITE_SPARTA_WS_TOKEN?: string
}

const viteEnv = import.meta.env as unknown as SpartaImportMetaEnv

function getWsBaseUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = viteEnv.VITE_SIDECAR_HOST ?? 'localhost'
  const port = viteEnv.VITE_SIDECAR_WS_PORT ?? '8765'
  return `${protocol}//${host}:${port}`
}

interface TokenSources {
  SPARTA_WS_TOKEN?: string
}

function getWsToken(): string {
  // In web mode the token is provided by whoever starts the sidecar. It can
  // be injected by the page host as a global or baked into the build for
  // local development. Electron uses node-pty IPC, so this path is normally
  // only active in the web build.
  const fromGlobal = (window as unknown as TokenSources).SPARTA_WS_TOKEN
  if (typeof fromGlobal === 'string' && fromGlobal) return fromGlobal
  const fromEnv = viteEnv.VITE_SPARTA_WS_TOKEN
  if (typeof fromEnv === 'string' && fromEnv) return fromEnv
  return ''
}

async function resolveWsToken(): Promise<string> {
  const fromElectron = window.sparta?.getTerminalToken
  if (typeof fromElectron === 'function') {
    try {
      const token = await fromElectron()
      if (typeof token === 'string' && token) return token
    } catch { /* fall through */ }
  }
  return getWsToken()
}

async function connectTerminal(sessionId: string): Promise<SessionState> {
  const token = await resolveWsToken()
  if (!token) {
    throw new Error('No SPARTA_WS_TOKEN configured for terminal WebSocket')
  }

  const url = `${getWsBaseUrl()}/ws/terminal/${sessionId}`
  const ws = new WebSocket(url)
  const state: SessionState = { ws, onData: new Set(), onExit: new Set(), dataBuffer: [], exitCode: null, flushed: false }

  return new Promise((resolve, reject) => {
    let authenticated = false
    let authTimeout: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (authTimeout) {
        clearTimeout(authTimeout)
        authTimeout = null
      }
    }

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }))
      authTimeout = setTimeout(() => {
        ws.close()
        reject(new Error('Terminal authentication timed out'))
      }, 6000)
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'ready' && !authenticated) {
          authenticated = true
          cleanup()
          sessions.set(sessionId, state)
          resolve(state)
          return
        }
        if (!authenticated) {
          // Any non-ready frame before auth succeeds is treated as a failure.
          cleanup()
          ws.close()
          reject(new Error('Terminal authentication failed'))
          return
        }
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
      cleanup()
      reject(new Error(`WebSocket connection failed for ${sessionId}`))
    }

    ws.onclose = () => {
      cleanup()
      sessions.delete(sessionId)
      if (!authenticated) {
        reject(new Error(`Terminal connection closed for ${sessionId} before authentication`))
      }
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
