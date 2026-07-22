import { ipcMain, BrowserWindow } from 'electron'
import { sendToPython, isSidecarRunning, waitForSidecarReady, sidecarEvents, SidecarEvent } from 'ia-sparta-ipc-bridge'

export function registerAgentTaskIPC(): void {
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

    const onMessage = (msg: Record<string, unknown>) => {
      if (msg.id !== requestId) return
      const event = msg.event as string
      if (event === 'agent:step' || event === 'agent:completed' || event === 'agent:error') {
        if (win && !win.isDestroyed()) {
          win.webContents.send('agent:task-event', { event, data: msg.data })
        }
      }
    }

    const result = await new Promise<{ ok: boolean; result?: string; error?: string }>((resolve) => {
      sidecarEvents.on(SidecarEvent.MESSAGE, onMessage)

      const cleanup = () => {
        sidecarEvents.removeListener(SidecarEvent.MESSAGE, onMessage)
        sidecarEvents.removeListener(SidecarEvent.MESSAGE, onDone)
      }

      const timeout = setTimeout(() => {
        cleanup()
        resolve({ ok: false, error: 'Timeout esperando resultado del agente' })
      }, 120_000)

      const onDone = (msg: Record<string, unknown>) => {
        if (msg.id !== requestId) return
        const event = msg.event as string
        if (event !== 'agent:completed' && event !== 'agent:error') return
        clearTimeout(timeout)
        cleanup()
        if (event === 'agent:error') {
          const data = msg.data as Record<string, unknown> | undefined
          resolve({ ok: false, error: (data?.error as string) ?? 'Error desconocido del agente' })
        } else {
          const data = msg.data as Record<string, unknown> | undefined
          resolve({ ok: true, result: (data?.result as string) ?? '' })
        }
      }
      sidecarEvents.on(SidecarEvent.MESSAGE, onDone)

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
}
