import { isSidecarRunning, sendToPython, sidecarEvents, SidecarEvent, waitForSidecarReady } from 'ia-sparta-ipc-bridge'
import { sendToRenderer } from '../shared'

function formatCodeStep(data: Record<string, unknown>): string {
  const toolName = String(data.tool_name ?? 'Ejecutando tarea')
  const args = data.tool_input && typeof data.tool_input === 'object' ? data.tool_input as Record<string, unknown> : data
  const target = typeof args.path === 'string' ? args.path : typeof args.file_path === 'string' ? args.file_path : ''

  if (toolName === 'write_file') return target ? `Escribiendo ${target}` : 'Escribiendo archivo'
  if (toolName === 'edit_file') return target ? `Editando ${target}` : 'Editando archivo'
  if (toolName === 'read_file') return target ? `Leyendo ${target}` : 'Leyendo archivo'
  if (toolName === 'delete_file') return target ? `Eliminando ${target}` : 'Eliminando archivo'
  if (toolName === 'run_command') return 'Ejecutando comando'
  if (toolName === 'list_directory') return 'Revisando estructura del proyecto'
  return toolName.replace(/_/g, ' ')
}

export async function runCodeSubagent(input: { sessionId: string; messageId: string; taskId: string; task: string; workspaceRoot?: string; model?: string; vendor?: string }): Promise<string> {
  if (!isSidecarRunning() || !(await waitForSidecarReady(15_000))) {
    throw new Error('El runtime de subagentes no está disponible.')
  }
  const requestId = `subagent:${input.taskId}`
  const startedAt = Date.now()
  sendToRenderer({ sessionId: input.sessionId, messageId: input.messageId, type: 'subagent:started', subagentName: 'code', taskSummary: input.task, timestamp: startedAt })
  return new Promise((resolve, reject) => {
    const cleanup = () => sidecarEvents.removeListener(SidecarEvent.MESSAGE, onMessage)
    const timer = setTimeout(() => { cleanup(); reject(new Error('Timeout esperando al subagente de código.')) }, 240_000)
    const onMessage = (msg: Record<string, unknown>) => {
      if (msg.id !== requestId) return
      const event = msg.event as string
      const data = (msg.data ?? {}) as Record<string, unknown>
      if (event === 'agent:step') {
        sendToRenderer({ sessionId: input.sessionId, messageId: input.messageId, type: 'subagent:step', subagentName: 'code', stepId: data.step_id ?? input.taskId, stepLabel: formatCodeStep(data), status: data.status ?? 'running', timestamp: Date.now() })
      }
      if (event === 'agent:completed' || event === 'agent:error') {
        clearTimeout(timer); cleanup()
        const success = event === 'agent:completed'
        sendToRenderer({ sessionId: input.sessionId, messageId: input.messageId, type: 'subagent:completed', subagentName: 'code', durationMs: Date.now() - startedAt, success, timestamp: Date.now() })
        if (success) resolve(String(data.result ?? 'Subagente de código completado.'))
        else reject(new Error(String(data.error ?? 'El subagente de código falló.')))
      }
    }
    sidecarEvents.on(SidecarEvent.MESSAGE, onMessage)
    sendToPython({ id: requestId, method: 'agent.task', params: { task_id: input.taskId, agent_id: 'delegate-code', task_description: input.task, system_prompt: 'Eres un subagente de programación. Completa la tarea y reporta el resultado en español.', allowed_tools: ['read_file', 'write_file', 'edit_file', 'delete_file', 'run_command'], model: input.model ?? '', provider: input.vendor ?? 'openai', vendor: input.vendor ?? 'openai', workspace_root: input.workspaceRoot ?? '', agent_autonomy: 'supervised', max_turns: 10 } })
  })
}
