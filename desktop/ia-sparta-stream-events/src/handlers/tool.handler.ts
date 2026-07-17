import { useChatStore, useAgentStore, useEventBus, labelForToolCall } from 'ia-sparta-core'
import { inferToolSubstatus } from 'ia-sparta-core'
import type { EventHandlerCtx } from './types'

export const SUBAGENT_TOOL_MAP: Record<string, { name: string; type: 'research' | 'coding' | 'automation' | 'project'; description: string }> = {
  delegate_research: {
    name: 'Investigador Delegado',
    type: 'research',
    description: 'Búsqueda de información y consolidación en vivo.',
  },
  delegate_code: {
    name: 'Programador Delegado',
    type: 'coding',
    description: 'Análisis y generación de código en tiempo real.',
  },
  delegate_memory: {
    name: 'Asistente de Memoria',
    type: 'automation',
    description: 'Recuperación de conocimientos de la memoria semántica.',
  },
}

export function handleToolCalled(ctx: EventHandlerCtx) {
  const store = useChatStore.getState()
  const name = (ctx.event.name ?? ctx.event.toolName ?? '') as string
  const toolInput = ctx.event.input
  const id = (ctx.event.toolCallId ?? ctx.event.tool_call_id ?? ctx.event.id ?? '') as string

  if (!name || !id) return

  const now = Date.now()
  store.addToolCall(ctx.sid, ctx.mid, {
    id,
    toolName: name,
    input: toolInput,
    status: 'running',
    substatus: inferToolSubstatus(name, now),
    startedAt: now,
  })

  const inputObj = toolInput && typeof toolInput === 'object' ? (toolInput as Record<string, unknown>) : {}
  store.setThinkingStatusText(ctx.sid, ctx.mid, labelForToolCall(name, inputObj))

  const subagentMeta = SUBAGENT_TOOL_MAP[name]
  if (subagentMeta) {
    const agentStore = useAgentStore.getState()
    const existing = agentStore.agents.find((a) => a.id === id)
    if (!existing) {
      agentStore.registerAgent({
        id,
        name: subagentMeta.name,
        type: subagentMeta.type,
        status: 'running',
        model: 'Subagente',
        createdAt: Date.now(),
        tools: name === 'delegate_research' ? ['web_search', 'web_fetch'] : [],
        description: subagentMeta.description,
      })
    } else {
      agentStore.updateAgentStatus(id, 'running')
    }

    let taskDesc = 'Ejecutando tarea paralela'
    if (toolInput && typeof toolInput === 'object') {
      const inp = toolInput as Record<string, unknown>
      if (inp.topic) taskDesc = `Investigar: ${inp.topic}`
      else if (inp.task) taskDesc = `Desarrollar: ${inp.task}`
      else if (inp.query) taskDesc = `Buscar: ${inp.query}`
    }

    agentStore.addTask(id, {
      id,
      agentId: id,
      description: taskDesc,
      status: 'running',
      createdAt: Date.now(),
      steps: [
        { id: `${id}-step1`, name: name === 'delegate_research' ? 'Investigando en profundidad' : 'Ejecutando análisis', status: 'running' },
      ],
    })
  }
}

export function handleToolResult(ctx: EventHandlerCtx) {
  const store = useChatStore.getState()
  const tcId = (ctx.event.toolCallId ?? ctx.event.tool_call_id ?? ctx.event.id ?? '') as string
  const resultOutput = (ctx.event.output ?? '') as string
  const tcName = ctx.event.toolName as string | undefined

  store.updateToolCallStatus(ctx.sid, ctx.mid, tcId, 'completed', resultOutput, tcName)

  if (tcName === 'web_search' || tcName === 'web_search_tool') {
    store.updateSearchProgress(ctx.sid, ctx.mid, (items) =>
      items.map((i) => ({ ...i, status: 'visited' as const }))
    )
  }

  if (tcName && SUBAGENT_TOOL_MAP[tcName] && tcId) {
    const agentStore = useAgentStore.getState()
    agentStore.updateAgentStatus(tcId, 'completed')
    agentStore.updateTask(tcId, tcId, {
      status: 'completed',
      completedAt: Date.now(),
      steps: [{ id: `${tcId}-step1`, name: 'Tarea completada exitosamente', status: 'completed' }],
    })
  }
}

export function handleToolError(ctx: EventHandlerCtx) {
  const store = useChatStore.getState()
  const tcId = (ctx.event.toolCallId ?? ctx.event.tool_call_id ?? ctx.event.id ?? '') as string
  const errorMsg = (ctx.event.error ?? 'Error al ejecutar una herramienta') as string
  const tcName = ctx.event.toolName as string | undefined

  store.updateToolCallStatus(ctx.sid, ctx.mid, tcId, 'error', errorMsg, tcName)
  useEventBus.getState().dispatch({
    type: 'tool:error', toolName: tcName ?? '', error: errorMsg, timestamp: Date.now(),
  })

  if (tcName && SUBAGENT_TOOL_MAP[tcName] && tcId) {
    const agentStore = useAgentStore.getState()
    agentStore.updateAgentStatus(tcId, 'error')
    agentStore.updateTask(tcId, tcId, {
      status: 'error',
      steps: [{ id: `${tcId}-step1`, name: 'Error en la ejecución', status: 'error', error: errorMsg }],
    })
  }
}
