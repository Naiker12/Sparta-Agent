import { ipcMain, BrowserWindow } from 'electron'
import { sendToPython, isSidecarRunning, waitForSidecarReady, startSidecar, isSecurityLoaded } from 'ia-sparta-ipc-bridge'
import {
  type ChatRequest,
  activeStreams,
  windowBySession,
  streamResolvers,
} from './shared'

export function registerChatSendIPC(): void {
  ipcMain.handle('chat:send', async (_event, req: ChatRequest) => {
    if (!isSidecarRunning()) {
      await startSidecar()
    }

    const ready = await waitForSidecarReady(15_000)
    if (!ready) {
      return { ok: false, error: 'Sidecar no listo' }
    }

    const { sessionId, messageId } = req
    const requestId = `${sessionId}:${messageId}`

    activeStreams.set(sessionId, { active: true, messageId })

    const win = BrowserWindow.fromWebContents(_event.sender)
    if (win && !win.isDestroyed()) {
      windowBySession.set(sessionId, win)
    }

    if (!isSecurityLoaded()) {
      req.securityLoaded = false
    }

    const donePromise = new Promise<boolean>((resolve) => {
      const markDone = () => {
        streamResolvers.delete(requestId)
        resolve(true)
      }
      streamResolvers.set(requestId, markDone)
    })

    sendToPython({
      id: requestId,
      method: 'chat.stream',
      params: {
        session_id: sessionId,
        message_id: messageId,
        model: req.model,
        messages: req.messages,
        provider_key: req.providerKey,
        api_url: req.apiUrl,
        is_local: req.isLocal,
        system: req.system,
        vendor: req.vendor,
        provider_id: req.providerId,
        mode: req.mode,
        skills: req.skills,
        mcp_servers: req.mcpServers,
        semantic_memory: req.semanticMemory,
        reasoning: req.reasoning,
        web_search_enabled: req.webSearchEnabled,
        workspace_root: req.workspaceRoot,
        agent_autonomy: req.agentAutonomy,
        agent_execute_local: req.agentExecuteLocal,
        security_loaded: req.securityLoaded,
        sandbox_mode: req.sandboxMode,
        open_files: req.openFiles,
      },
    })

    const timeout = 120_000
    const startTime = Date.now()
    let timedOut = false

    while (!timedOut) {
      await new Promise((r) => setTimeout(r, 500))
      const state = activeStreams.get(sessionId)

      if (!state?.active) {
        streamResolvers.delete(requestId)
        return { ok: true, aborted: true }
      }

      const completed = await Promise.race([
        donePromise,
        new Promise<boolean>((r) => setTimeout(() => r(false), 100)),
      ])
      if (completed) break
    }
    timedOut = Date.now() - startTime >= timeout

    activeStreams.delete(sessionId)
    streamResolvers.delete(requestId)
    if (timedOut) {
      return { ok: false, error: 'Timeout' }
    }
    return { ok: true }
  })

  ipcMain.handle('chat:abort', (_event, sessionId: string) => {
    const state = activeStreams.get(sessionId)
    if (state) {
      activeStreams.set(sessionId, { ...state, active: false })

      // BUGFIX: antes solo se apagaba la bandera local `active`, que el
      // polling de `chat:send` lee, pero el sidecar de Python nunca se
      // enteraba. Por eso el "pensamiento" seguía corriendo en segundo
      // plano y terminaba entregando la respuesta igual, aunque en la UI
      // pareciera pausado. Ahora sí se le avisa a Python que cancele la
      // tarea real (server.py -> _handle_chat_abort espera `request_id`).
      const requestId = `${sessionId}:${state.messageId}`
      sendToPython({
        id: `abort:${requestId}`,
        method: 'chat.abort',
        params: { request_id: requestId, session_id: sessionId },
      })
    }
  })
}
