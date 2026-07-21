import { useChatStore, useEventBus, useSkillStore } from 'ia-sparta-core'
import type { EventHandlerCtx } from './types'

export function handleSkillActivated(ctx: EventHandlerCtx) {
  const store = useChatStore.getState()
  const skillId = (ctx.event.skillId as string) ?? ''
  const skillName = (ctx.event.skillName as string) ?? ''
  const skillIcon = (ctx.event.skillIcon as string) ?? '\ud83d\udce6'
  const skillCategory = (ctx.event.skillCategory as string) ?? ''
  console.debug('[skill:activated]', skillId, skillName)
  store.updateMessage(ctx.mid, (msg) => ({
    pipelineSteps: [
      ...(msg.pipelineSteps ?? []),
      { id: `skill-${skillId}-${Date.now()}`, name: `${skillIcon} ${skillName}`, status: 'running' as const, timestamp: Date.now(), meta: skillCategory },
    ],
  }))
  useEventBus.getState().dispatch({
    type: 'skill:activated' as const, skillId, skillName, skillIcon, skillCategory, sessionId: ctx.sid, messageId: ctx.mid, timestamp: Date.now(),
  })
}

export function handleSkillCompleted(ctx: EventHandlerCtx) {
  const store = useChatStore.getState()
  const compId = (ctx.event.skillId as string) ?? ''
  store.updateMessage(ctx.mid, (msg) => ({
    pipelineSteps: (msg.pipelineSteps ?? []).map((step) =>
      step.id?.startsWith(`skill-${compId}`)
        ? { ...step, status: 'completed' as const, durationMs: Date.now() - step.timestamp }
        : step
    ),
  }))
}

export function handleSkillAutoSuggested(ctx: EventHandlerCtx) {
  const skillIds = (ctx.event.skillIds as string[]) ?? []
  if (skillIds.length > 0) {
    useSkillStore.getState().setSuggestedSkillIds(skillIds)
    console.debug('[skill:auto-suggested]', skillIds)
  }
}
