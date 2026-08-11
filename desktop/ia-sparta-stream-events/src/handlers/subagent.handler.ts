import { useChatStore } from 'ia-sparta-core'
import type { MessagePart, SubagentExecutionStep } from 'ia-sparta-core'
import type { EventHandlerCtx } from './types'

type SubagentPart = Extract<MessagePart, { kind: 'subagent' }>

function updateSubagentPart(ctx: EventHandlerCtx, subagentName: string, update: (part: SubagentPart) => SubagentPart) {
  useChatStore.getState().updateMessage(ctx.mid, (message) => {
    const parts = message.parts ?? []
    const partIndex = parts.findIndex((part) => part.kind === 'subagent' && part.id === `subagent:${subagentName}`)
    if (partIndex < 0) return {}
    const nextParts = [...parts]
    nextParts[partIndex] = update(nextParts[partIndex] as SubagentPart)
    return { parts: nextParts }
  })
}

export function handleSubagentStarted(ctx: EventHandlerCtx) {
  const subagentName = String(ctx.event.subagentName ?? 'subagent')
  const taskSummary = String(ctx.event.taskSummary ?? 'Ejecutando tarea delegada')
  const startedAt = Number(ctx.event.timestamp) || Date.now()

  useChatStore.getState().updateMessage(ctx.mid, (message) => {
    const parts = message.parts ?? []
    if (parts.some((part) => part.kind === 'subagent' && part.id === `subagent:${subagentName}`)) return {}
    return {
      parts: [...parts, {
        kind: 'subagent',
        id: `subagent:${subagentName}`,
        subagentName,
        taskSummary,
        startedAt,
        steps: [{ id: 'preparing', label: 'Preparando entorno', status: 'running' }],
      }],
    }
  })
}

export function handleSubagentStep(ctx: EventHandlerCtx) {
  const subagentName = String(ctx.event.subagentName ?? 'subagent')
  const step: SubagentExecutionStep = {
    id: String(ctx.event.stepId ?? `step-${Date.now()}`),
    label: String(ctx.event.stepLabel ?? 'Ejecutando tarea'),
    status: ctx.event.status === 'completed' || ctx.event.status === 'error' ? ctx.event.status : 'running',
  }

  updateSubagentPart(ctx, subagentName, (part) => {
    const nextSteps = (part.steps ?? []).map((item) => item.status === 'running' ? { ...item, status: 'completed' as const } : item)
    const existingIndex = nextSteps.findIndex((item) => item.id === step.id)
    if (existingIndex >= 0) nextSteps[existingIndex] = step
    else nextSteps.push(step)
    return { ...part, steps: nextSteps }
  })
}

export function handleSubagentCompleted(ctx: EventHandlerCtx) {
  const subagentName = String(ctx.event.subagentName ?? 'subagent')
  const completedAt = Number(ctx.event.timestamp) || Date.now()
  const durationMs = Number(ctx.event.durationMs) || 0
  const success = ctx.event.success !== false

  updateSubagentPart(ctx, subagentName, (part) => ({
    ...part,
    completedAt,
    durationMs,
    success,
    steps: (part.steps ?? []).map((step) => step.status === 'running'
      ? { ...step, status: success ? 'completed' as const : 'error' as const }
      : step),
  }))
}
