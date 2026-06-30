import { ipcMain, BrowserWindow, type IpcMainEvent } from 'electron'
import { sendToPython, isSidecarRunning, isSidecarReady, waitForSidecarReady, sidecarEvents, SidecarEvent } from './sidecar.ipc'

interface ChatRequest {
  sessionId: string
  messageId: string
  model: string
  messages: { role: string; content: string }[]
  providerKey?: string
  apiUrl?: string
  isLocal?: boolean
  system?: string
  vendor?: string
  providerId?: string
  mode?: string
  skills?: string[]
  mcpServers?: unknown[]
  semanticMemory?: boolean
  reasoning?: { enabled: boolean; budget: number }
  webSearchEnabled?: boolean
}

const activeStreams = new Map<string, { active: boolean; messageId: string }>()
const chunkSeqCounters = new Map<string, { streamSeq: number; thinkSeq: number }>()
const windowBySession = new Map<string, BrowserWindow>()
const sessionReady = new Map<string, boolean>()
const eventBuffer = new Map<string, Record<string, unknown>[]>()

function getNextSeq(requestId: string, kind: 'stream' | 'think'): number {
  const entry = chunkSeqCounters.get(requestId) ?? { streamSeq: 0, thinkSeq: 0 }
  if (kind === 'stream') entry.streamSeq++
  else entry.thinkSeq++
  chunkSeqCounters.set(requestId, entry)
  return kind === 'stream' ? entry.streamSeq : entry.thinkSeq
}

function clearSeqCounters(requestId: string): void {
  chunkSeqCounters.delete(requestId)
}

function sendToRenderer(event: Record<string, unknown>): void {
  const sessionId = event.sessionId as string | undefined

  // Buffer events for sessions that haven't signaled chat:ready yet
  if (sessionId && !sessionReady.get(sessionId)) {
    const buf = eventBuffer.get(sessionId) ?? []
    buf.push(event)
    eventBuffer.set(sessionId, buf)
    return
  }

  let win: BrowserWindow | undefined

  if (sessionId) {
    win = windowBySession.get(sessionId)
  }

  if (!win || win.isDestroyed()) {
    win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  }

  if (!win || win.isDestroyed()) {
    console.warn('[chat.ipc] No available window to send event:', event.type)
    return
  }

  win.webContents.send('sparta:event', event)
}

export function registerChatIPC(): void {
  // Forward Python stderr lines to the renderer as sidecar logs for visibility.
  sidecarEvents.on(SidecarEvent.STDERR, (text: string) => {
    sendToRenderer({ type: 'sidecar:log', level: 'stderr', text })
  })

  // Handle sidecar crashes: abort all active streams and resolve pending promises
  sidecarEvents.on(SidecarEvent.CRASHED, ({ code, signal, attempt }) => {
    for (const [sessionId, { active, messageId }] of activeStreams.entries()) {
      if (active) {
        sendToRenderer({
          sessionId,
          messageId,
          type: 'stream:error',
          error: `El sidecar de Python se ha detenido (código ${code}, señal ${signal}). Intento ${attempt}.`,
        })
        activeStreams.set(sessionId, { active: false, messageId })
      }
    }
    // Resolve any pending stream promises so the chat:send polling loop exits immediately
    for (const [requestId] of streamResolvers.entries()) {
      const resolve = streamResolvers.get(requestId)
      resolve?.()
      streamResolvers.delete(requestId)
    }
    chunkSeqCounters.clear()
  })

  // Listen for all sidecar messages and route them to active streams
  const onMessage = (msg: Record<string, unknown>) => {
    const requestId = (msg.id as string) ?? ''
    const [sessionId, messageId] = requestId.split(':')
    if (!sessionId || !messageId) return

    const event = msg.event as string
    const data = msg.data as Record<string, unknown> | undefined

    switch (event) {
      case 'thinking:started':
        sendToRenderer({ sessionId, messageId, type: 'thinking:started' })
        break
      case 'thinking:token':
        sendToRenderer({ sessionId, messageId, type: 'thinking:token', token: data?.token, chunkSeq: getNextSeq(requestId, 'think') })
        break
      case 'thinking:completed':
        sendToRenderer({ sessionId, messageId, type: 'thinking:completed', tokensUsed: data?.tokens_used ?? data?.tokensUsed ?? 0 })
        break
      case 'stream:token':
        sendToRenderer({ sessionId, messageId, type: 'stream:token', token: data?.token, chunkSeq: getNextSeq(requestId, 'stream') })
        break
      case 'stream:completed': {
        sendToRenderer({ sessionId, messageId, type: 'stream:completed', usage: data?.usage })
        clearSeqCounters(requestId)
        break
      }
      case 'stream:aborted':
        sendToRenderer({ sessionId, messageId, type: 'stream:aborted' })
        clearSeqCounters(requestId)
        break
      case 'terminal:agent_command':
        sendToRenderer({ sessionId, messageId, type: 'terminal:agent_command', command: data?.command })
        break
      case 'tool:called':
        sendToRenderer({ sessionId, messageId, type: 'tool:called', toolCall: { id: data?.tool_call_id, toolName: data?.name, input: data?.input, status: 'running' } })
        break
      case 'tool:result':
        sendToRenderer({ sessionId, messageId, type: 'tool:result', toolCallId: data?.tool_call_id, toolName: data?.name, output: data?.output, durationMs: data?.duration_ms })
        break
      case 'tool:error':
        sendToRenderer({ sessionId, messageId, type: 'tool:error', toolCallId: data?.tool_call_id, toolName: data?.name, error: data?.error })
        break
      case 'usage':
        sendToRenderer({ sessionId, messageId, type: 'usage', inputTokens: data?.input_tokens, outputTokens: data?.output_tokens })
        break
      case 'error':
        sendToRenderer({ sessionId, messageId, type: 'stream:error', error: data?.message ?? 'Unknown error' })
        clearSeqCounters(requestId)
        break
    }
  }

  sidecarEvents.on(SidecarEvent.MESSAGE, onMessage)

  ipcMain.handle('chat:send', async (_event, req: ChatRequest) => {
    const { sessionId, messageId } = req

    // Store the window that initiated this session so events always reach it
    const win = BrowserWindow.fromWebContents(_event.sender)
    if (win) {
      windowBySession.set(sessionId, win)
    }

    if (!isSidecarRunning()) {
      sendToRenderer({
        sessionId, messageId,
        type: 'error',
        error: 'Python sidecar no está iniciado. Reinicia la aplicación.',
      })
      return { ok: false, error: 'Sidecar not running' }
    }

    // Wait for the sidecar to finish its cold start (imports + model init).
    const ready = await waitForSidecarReady(30_000)
    if (!ready) {
      sendToRenderer({
        sessionId, messageId,
        type: 'error',
        error: 'Python sidecar no respondió a tiempo. Reinicia la aplicación.',
      })
      return { ok: false, error: 'Sidecar not ready' }
    }

    activeStreams.set(sessionId, { active: true, messageId })
    const requestId = `${sessionId}:${messageId}`

    // Build request according to the Python sidecar protocol
    const sidecarReq = {
      id: requestId,
      method: 'chat.stream',
      params: {
        session_id: sessionId,
        messages: req.messages,
        model: req.model,
        provider: req.vendor ?? 'openai',
        vendor: req.vendor ?? 'openai',
        provider_key: req.providerKey,
        mode: req.mode ?? 'chat',
        skills: req.skills ?? [],
        mcp_servers: req.mcpServers ?? [],
        semantic_memory: req.semanticMemory ?? false,
        reasoning: req.reasoning ?? { enabled: false, budget: 8000 },
        web_search_enabled: req.webSearchEnabled ?? true,
      },
    }

    sendToPython(sidecarReq)

    // Wait until stream_end or abort
    const timeout = 300_000
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const streamState = activeStreams.get(sessionId)
      if (!streamState?.active) {
        // Abort requested
        sendToPython({ id: requestId, method: 'chat.abort', params: { request_id: requestId } })
        sendToRenderer({ sessionId, messageId, type: 'done' })
        return { ok: true, aborted: true }
      }

      // Check if stream_end already resolved the promise
      const done = await waitForDone(requestId, 200)
      if (done) break
    }

    activeStreams.delete(sessionId)
    return { ok: true }
  })

  ipcMain.handle('chat:abort', (_event, sessionId: string) => {
    const state = activeStreams.get(sessionId)
    if (state) {
      activeStreams.set(sessionId, { ...state, active: false })
    }
  })

  ipcMain.handle('sidecar:status', () => {
    return { running: isSidecarRunning(), ready: isSidecarReady() }
  })

  // Renderer signals that its event listener is registered; flush buffered events
  ipcMain.on('chat:ready', (_event: IpcMainEvent, { sessionId }: { sessionId: string }) => {
    sessionReady.set(sessionId, true)
    const buf = eventBuffer.get(sessionId)
    if (buf && buf.length > 0) {
      const win = windowBySession.get(sessionId) ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        for (const evt of buf) {
          win.webContents.send('sparta:event', evt)
        }
      }
      eventBuffer.delete(sessionId)
    }
  })
}

// Stream completion signals: event-driven via sidecarEvents
// stream:completed / stream_end events resolve the wait promise for each active request
const streamResolvers = new Map<string, () => void>()

sidecarEvents.on(SidecarEvent.MESSAGE, (msg: Record<string, unknown>) => {
  const event = msg.event as string
  if (event === 'stream:completed' || event === 'stream_end' || event === 'error') {
    const requestId = (msg.id as string) ?? ''
    const resolve = streamResolvers.get(requestId)
    resolve?.()
    streamResolvers.delete(requestId)
  }
})

async function waitForDone(requestId: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const done = () => resolve(true)
    streamResolvers.set(requestId, done)
    setTimeout(() => {
      if (streamResolvers.get(requestId) === done) {
        streamResolvers.delete(requestId)
        resolve(false)
      }
    }, timeoutMs)
  })
}
