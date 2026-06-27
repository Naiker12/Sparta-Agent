import { ipcMain, BrowserWindow } from 'electron'
import { sendToPython, isSidecarRunning, sidecarEvents, SidecarEvent } from './sidecar.ipc'

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
}

const activeStreams = new Map<string, boolean>()

function sendToRenderer(event: Record<string, unknown>): void {
  const win = BrowserWindow.getFocusedWindow()
  win?.webContents.send('sparta:event', event)
}

export function registerChatIPC(): void {
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
        sendToRenderer({ sessionId, messageId, type: 'thinking:token', token: data?.token })
        break
      case 'thinking:completed':
        sendToRenderer({ sessionId, messageId, type: 'thinking:completed', tokensUsed: data?.tokens_used ?? data?.tokensUsed ?? 0 })
        break
      case 'stream:token':
        sendToRenderer({ sessionId, messageId, type: 'stream:token', token: data?.token })
        break
      case 'stream:completed': {
        sendToRenderer({ sessionId, messageId, type: 'stream:completed', usage: data?.usage })
    const resolve = streamResolvers.get(requestId)
    if (resolve) {
      resolve()
      streamResolvers.delete(requestId)
    }
        break
      }
      case 'stream:aborted':
        sendToRenderer({ sessionId, messageId, type: 'stream:aborted' })
        break
      case 'tool:called':
        sendToRenderer({ sessionId, messageId, type: 'tool:called', toolCall: { id: crypto.randomUUID(), toolName: data?.name, input: data?.input, status: 'running' } })
        break
      case 'tool:result':
        sendToRenderer({ sessionId, messageId, type: 'tool:result', toolCallId: '', output: data?.output, durationMs: data?.duration_ms })
        break
      case 'tool:error':
        sendToRenderer({ sessionId, messageId, type: 'tool:error', toolCallId: '' })
        break
      case 'usage':
        sendToRenderer({ sessionId, messageId, type: 'usage', inputTokens: data?.input_tokens, outputTokens: data?.output_tokens })
        break
      case 'error':
        sendToRenderer({ sessionId, messageId, type: 'stream:error', error: data?.message ?? 'Unknown error' })
        break
    }
  }

  sidecarEvents.on(SidecarEvent.MESSAGE, onMessage)

  ipcMain.handle('chat:send', async (_event, req: ChatRequest) => {
    const { sessionId, messageId } = req

    if (!isSidecarRunning()) {
      sendToRenderer({
        sessionId, messageId,
        type: 'error',
        error: 'Python sidecar no está iniciado. Reinicia la aplicación.',
      })
      return { ok: false, error: 'Sidecar not running' }
    }

    activeStreams.set(sessionId, true)
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
      },
    }

    sendToPython(sidecarReq)

    // Wait until stream_end or abort
    const timeout = 300_000
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      if (!activeStreams.get(sessionId)) {
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
    activeStreams.set(sessionId, false)
  })

  ipcMain.handle('sidecar:status', () => {
    return { running: isSidecarRunning() }
  })
}

// Stream completion signals: event-driven via sidecarEvents
// stream_end event resolves the wait promise for each active request
const streamResolvers = new Map<string, () => void>()

sidecarEvents.on(SidecarEvent.MESSAGE, (msg: Record<string, unknown>) => {
  if (msg.event === 'stream_end') {
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
