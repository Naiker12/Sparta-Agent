import { ipcMain, BrowserWindow, type IpcMainEvent } from 'electron'
import { sendToPython, isSidecarRunning, isSidecarReady, waitForSidecarReady, startSidecar, sidecarEvents, SidecarEvent } from './sidecar.ipc'
import { isSecurityLoaded } from './security.ipc'
import { storeKey as vaultStoreKey } from '../vault'

interface MCPServerConfig {
  id?: string
  name?: string
  type?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  env_vault_refs?: string[]
  url?: string
  headers?: Record<string, string>
  headers_vault_refs?: string[]
  enabled?: boolean
  timeout?: number
  tools?: { include?: string[]; exclude?: string[] }
}

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
  mcpServers?: MCPServerConfig[]
  semanticMemory?: boolean
  reasoning?: { enabled: boolean; budget: number }
  webSearchEnabled?: boolean
  workspaceRoot?: string
  agentAutonomy?: string
  agentExecuteLocal?: boolean
  securityLoaded?: boolean
  sandboxMode?: string
  openFiles?: string[]
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

    const event = msg.event as string
    const data = msg.data as Record<string, unknown> | undefined

    // ── Vault requests from Python sidecar (MCP secret storage) ───────
    if (event === 'vault:mcp_store') {
      const keyId = (data?.key_id ?? '') as string
      const value = (data?.value ?? '') as string
      if (keyId && value) {
        vaultStoreKey(keyId, value, 'mcp')
      }
      // Send ack back to Python via existing channel
      sendToPython({ id: msg.id ?? '', method: 'keymanager.set', params: { key_id: keyId, value } })
      return
    }

    // ── MCP lifecycle events: global, no messageId needed ──────────────
    if (event === 'mcp:connected' || event === 'mcp:tool_discovered' || event === 'mcp:error') {
      // Broadcast to all windows — MCP state is global, not session-scoped
      const win = (sessionId ? windowBySession.get(sessionId) : undefined)
        ?? BrowserWindow.getFocusedWindow()
        ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('sparta:event', {
          type: event,
          ...(data ?? {}),
        })
      }
      return
    }

    // ── search:progress may arrive without sessionId/messageId ─────────
    // Fallback: use the first active stream from the map.
    if ((!sessionId || !messageId) && event === 'search:progress') {
      for (const [sid, stream] of activeStreams.entries()) {
        if (stream.active) {
          const fallbackId = `${sid}:${stream.messageId}`
          const [s, m] = fallbackId.split(':')
          sendToRenderer({ sessionId: s, messageId: m, type: 'search:progress', ...((data ?? {}) as Record<string, unknown>) })
          return
        }
      }
    }

    // ── Terminal bridge events: no sessionId/messageId needed ──────────
    if (event === 'terminal:agent_output' || event === 'terminal:agent_exit' || event === 'terminal:tool_crash') {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('sparta:event', {
          type: event,
          ...(data ?? {}),
        })
      }
      return
    }

    // ── editor:diff_proposed events: no sessionId/messageId needed ─────
    if (event === 'editor:diff_proposed') {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('sparta:event', {
          type: 'editor:diff_proposed',
          requestId: data?.request_id ?? '',
          filePath: data?.file_path ?? '',
          originalContent: data?.original_content ?? '',
          newContent: data?.new_content ?? '',
          language: data?.language ?? '',
          timestamp: Date.now(),
        })
      }
      return
    }

    // ── file:changed events: no sessionId/messageId needed ─────────────
    if (event === 'file:changed') {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('sparta:event', {
          type: 'file:changed',
          path: data?.path ?? '',
        })
      }
      return
    }

    // ── Plan lifecycle events: no sessionId/messageId needed ────────────
    if (event === 'plan:created' || event === 'plan:step') {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('sparta:event', {
          type: event,
          plan: data?.plan,
          currentStep: data?.current_step ?? data?.currentStep ?? 0,
          planComplete: data?.plan_complete ?? data?.planComplete ?? false,
          ns: data?.ns,
        })
      }
      return
    }

    // ── Workspace connected confirmation: no sessionId/messageId needed ──
    if (event === 'workspace:connected') {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('sparta:event', {
          type: 'workspace:connected',
          root: data?.root ?? '',
        })
      }
      return
    }

    if (!sessionId || !messageId) return

    switch (event) {
      case 'thinking:started':
        sendToRenderer({ sessionId, messageId, type: 'thinking:started' })
        break
      case 'thinking:token':
        sendToRenderer({ sessionId, messageId, type: 'thinking:token', token: data?.token, chunkSeq: data?.chunkSeq ?? getNextSeq(requestId, 'think') })
        break
      case 'thinking:completed':
        sendToRenderer({ sessionId, messageId, type: 'thinking:completed', tokensUsed: data?.tokens_used ?? data?.tokensUsed ?? 0 })
        break
      case 'thinking:status':
        sendToRenderer({ sessionId, messageId, type: 'thinking:status', text: data?.text ?? '' })
        break
      case 'reasoning:token':
        sendToRenderer({ sessionId, messageId, type: 'reasoning:token', token: data?.token ?? '' })
        break
      case 'reasoning:available':
        sendToRenderer({ sessionId, messageId, type: 'reasoning:available', text: data?.text ?? '' })
        break
      case 'stream:token':
        sendToRenderer({ sessionId, messageId, type: 'stream:token', token: data?.token, chunkSeq: data?.chunkSeq ?? getNextSeq(requestId, 'stream') })
        break
      case 'stream:degenerate': {
        sendToRenderer({
          sessionId, messageId,
          type: 'stream:error',
          error: 'La respuesta del modelo se cortó por repetición detectada. Probá con otro modelo o reintentá.',
        })
        clearSeqCounters(requestId)
        const resolveDeg = streamResolvers.get(requestId)
        resolveDeg?.()
        streamResolvers.delete(requestId)
        break
      }
      case 'stream:completed': {
        sendToRenderer({
          sessionId, messageId, type: 'stream:completed',
          usage: data?.usage,
          suggestions: data?.suggestions,
        })
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
      case 'terminal:agent_spawn':
        sendToRenderer({ sessionId, messageId, type: 'terminal:agent_spawn', procId: data?.procId, command: data?.command, label: data?.label })
        break
      case 'search:progress':
        sendToRenderer({
          sessionId,
          messageId,
          type: 'search:progress',
          stage: data?.stage,
          query: data?.query,
          url: data?.url,
          title: data?.title,
          index: data?.index,
          total: data?.total,
        })
        break
      case 'tool:called':
        sendToRenderer({ sessionId, messageId, type: 'tool:called', name: data?.name, toolName: data?.name, toolCallId: data?.tool_call_id, tool_call_id: data?.tool_call_id, id: data?.tool_call_id, input: data?.input })
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
      case 'stream:notice':
        sendToRenderer({ sessionId, messageId, type: 'stream:notice', message: data?.message ?? '' })
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

    // Prevent concurrent streams for the same sessionId
    const existing = activeStreams.get(sessionId)
    if (existing?.active) {
      return { ok: false, error: 'Concurrent stream not allowed for same session' }
    }

    if (!isSidecarRunning()) {
      console.log('[chat:send] Sidecar not running — attempting restart...')
      startSidecar()
    }

    // Wait for the sidecar to finish its cold start (imports + model init).
    const ready = await waitForSidecarReady(30_000)
    if (!ready) {
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
        api_url: req.apiUrl,
        is_local: req.isLocal,
        mode: req.mode ?? 'chat',
        skills: req.skills ?? [],
        mcp_servers: req.mcpServers ?? [],
        semantic_memory: req.semanticMemory ?? false,
        reasoning: req.reasoning ?? { enabled: false, budget: 8000 },
        web_search_enabled: req.webSearchEnabled ?? true,
        workspace_root: req.workspaceRoot ?? '',
        agent_autonomy: req.agentAutonomy ?? 'ask_risky',
        agent_execute_local: req.agentExecuteLocal ?? false,
        security_loaded: isSecurityLoaded(),
        sandbox_mode: req.sandboxMode ?? 'none',
        open_files: req.openFiles ?? [],
      },
    }

    sendToPython(sidecarReq)

    // Wait until stream_end or abort
    const timeout = 300_000
    const startTime = Date.now()

    let timedOut = false
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
    timedOut = Date.now() - startTime >= timeout

    activeStreams.delete(sessionId)
    if (timedOut) {
      return { ok: false, error: 'Timeout' }
    }
    return { ok: true }
  })

  ipcMain.handle('chat:abort', (_event, sessionId: string) => {
    const state = activeStreams.get(sessionId)
    if (state) {
      activeStreams.set(sessionId, { ...state, active: false })
    }
  })

  // ── Agent task execution (moved from frontend agent-runtime.ts) ───
  ipcMain.handle('agent:execute-task', async (_event, req: {
    taskId: string
    agentId: string
    taskDescription: string
    systemPrompt: string
    allowedTools: string[]
    model: string
    provider: string
    vendor?: string
    providerKey?: string
    apiUrl?: string
    workspaceRoot?: string
    agentAutonomy: string
    maxTurns?: number
  }) => {
    if (!isSidecarRunning()) {
      return { ok: false, error: 'Sidecar no iniciado' }
    }
    const ready = await waitForSidecarReady(15_000)
    if (!ready) {
      return { ok: false, error: 'Sidecar no listo' }
    }

    const win = BrowserWindow.fromWebContents(_event.sender)
    const requestId = `agent:${req.taskId}`

    // Listen for step events from sidecar and forward to renderer
    const onMessage = (msg: Record<string, unknown>) => {
      if (msg.id !== requestId) return
      const event = msg.event as string
      if (event === 'agent:step' || event === 'agent:completed') {
        if (win && !win.isDestroyed()) {
          win.webContents.send('agent:task-event', { event, data: msg.data })
        }
      }
    }

    // Register listeners BEFORE sending to avoid race condition
    const result = await new Promise<{ ok: boolean; result?: string; error?: string }>((resolve) => {
      sidecarEvents.on(SidecarEvent.MESSAGE, onMessage)

      const timeout = setTimeout(() => {
        sidecarEvents.removeListener(SidecarEvent.MESSAGE, onMessage)
        resolve({ ok: false, error: 'Timeout esperando resultado del agente' })
      }, 120_000)

      const onDone = (msg: Record<string, unknown>) => {
        if (msg.id !== requestId || msg.event !== 'agent:completed') return
        clearTimeout(timeout)
        sidecarEvents.removeListener(SidecarEvent.MESSAGE, onMessage)
        sidecarEvents.removeListener(SidecarEvent.MESSAGE, onDone)
        const data = msg.data as Record<string, unknown> | undefined
        resolve({ ok: true, result: (data?.result as string) ?? '' })
      }
      sidecarEvents.on(SidecarEvent.MESSAGE, onDone)

      // Send AFTER listeners are registered
      sendToPython({
        id: requestId,
        method: 'agent.task',
        params: {
          task_id: req.taskId,
          agent_id: req.agentId,
          task_description: req.taskDescription,
          system_prompt: req.systemPrompt,
          allowed_tools: req.allowedTools,
          model: req.model,
          provider: req.provider,
          vendor: req.vendor ?? req.provider,
          provider_key: req.providerKey,
          api_url: req.apiUrl,
          workspace_root: req.workspaceRoot ?? '',
          agent_autonomy: req.agentAutonomy,
          max_turns: req.maxTurns ?? 10,
        },
      })
    })

    return result
  })

  // ── MCP connection test ────────────────────────────────────────────
  const mcpTestResolvers = new Map<string, (result: unknown) => void>()
  sidecarEvents.on(SidecarEvent.MESSAGE, (msg: Record<string, unknown>) => {
    if (msg.event === 'mcp.test.result') {
      const testId = (msg.id as string) ?? ''
      const resolve = mcpTestResolvers.get(testId)
      if (resolve) {
        resolve(msg.data ?? { ok: false, error: 'Sin datos' })
        mcpTestResolvers.delete(testId)
      }
    }
  })

  ipcMain.handle('mcp:test', async (_event, config: Record<string, unknown>) => {
    if (!isSidecarRunning()) {
      return { ok: false, error: 'Sidecar no iniciado' }
    }
    const testId = `mcp_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    sendToPython({ id: testId, method: 'mcp.test', params: { config } })

    return new Promise((resolve) => {
      mcpTestResolvers.set(testId, resolve)
      setTimeout(() => {
        if (mcpTestResolvers.has(testId)) {
          mcpTestResolvers.delete(testId)
          resolve({ ok: false, error: 'Timeout — el servidor MCP no respondió en 15s' })
        }
      }, 16_000)
    })
  })

  ipcMain.handle('editor:diff_respond', (_event, payload: { requestId: string; approved: boolean }) => {
    sendToPython({
      method: 'permission.respond',
      params: {
        request_id: payload.requestId,
        approved: payload.approved,
        remember: 'once',
      },
    })
    return { ok: true }
  })

  ipcMain.handle('sidecar:status', () => {
    return { running: isSidecarRunning(), ready: isSidecarReady() }
  })

  // ── Memory bridge: delegate vector operations to the Python sidecar ─
  const memoryResolvers = new Map<string, (result: unknown) => void>()
  sidecarEvents.on(SidecarEvent.MESSAGE, (msg: Record<string, unknown>) => {
    const event = msg.event as string
    if (event === 'memory.index:response' || event === 'memory.search:response' || event === 'memory.embed:response') {
      const resolver = memoryResolvers.get((msg.id as string) ?? '')
      if (resolver) {
        resolver(msg.data ?? { ok: false, error: 'Sin datos' })
        memoryResolvers.delete((msg.id as string) ?? '')
      }
    }
  })

  async function callMemoryMethod(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!isSidecarRunning()) {
      return { ok: false, error: 'Sidecar no iniciado' }
    }
    const ready = await waitForSidecarReady(10_000)
    if (!ready) {
      return { ok: false, error: 'Sidecar no listo' }
    }
    const requestId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    sendToPython({ id: requestId, method, params })
    return new Promise((resolve) => {
      memoryResolvers.set(requestId, resolve)
      setTimeout(() => {
        if (memoryResolvers.has(requestId)) {
          memoryResolvers.delete(requestId)
          resolve({ ok: false, error: 'Timeout esperando respuesta del sidecar' })
        }
      }, 15_000)
    })
  }

  ipcMain.handle('memory:index', async (_event, entry: Record<string, unknown>) => {
    return callMemoryMethod('memory.index', { entry })
  })

  ipcMain.handle('memory:search', async (_event, { query, k }: { query: string; k?: number }) => {
    return callMemoryMethod('memory.search', { query, k: k ?? 5 })
  })

  ipcMain.handle('memory:embed', async (_event, { texts }: { texts: string[] }) => {
    return callMemoryMethod('memory.embed', { texts })
  })

  ipcMain.handle('memory:delete', async (_event, entryId: string) => {
    return callMemoryMethod('memory.delete', { entry_id: entryId })
  })

  ipcMain.handle('memory:count', async () => {
    return callMemoryMethod('memory.count', {})
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
