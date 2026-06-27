import { ipcMain, BrowserWindow } from 'electron'
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
}

const activeStreams = new Map<string, boolean>()
const chunkSeqCounters = new Map<string, { streamSeq: number; thinkSeq: number }>()

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
  const win = BrowserWindow.getFocusedWindow()
  win?.webContents.send('sparta:event', event)
}

export function registerChatIPC(): void {
  // Forward Python stderr lines to the renderer as sidecar logs for visibility.
  sidecarEvents.on(SidecarEvent.STDERR, (text: string) => {
    sendToRenderer({ type: 'sidecar:log', level: 'stderr', text })
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
        clearSeqCounters(requestId)
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
    return { running: isSidecarRunning(), ready: isSidecarReady() }
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
