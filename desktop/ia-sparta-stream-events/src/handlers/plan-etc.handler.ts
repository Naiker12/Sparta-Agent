import { usePlanStore, useEventBus } from 'ia-sparta-core'
import type { EventHandlerCtx } from './types'

export function handlePlanCreated(ctx: EventHandlerCtx) {
  const steps = (ctx.event.plan as string[]) ?? []
  if (steps.length > 0) {
    usePlanStore.getState().setPlan(steps, (ctx.event.currentStep as number) ?? 0, (ctx.event.planComplete as boolean) ?? false)
  }
}

export function handlePlanStep(ctx: EventHandlerCtx) {
  usePlanStore.getState().updateStep((ctx.event.currentStep as number) ?? 0, (ctx.event.planComplete as boolean) ?? false)
}

export function handleFileChanged(ctx: EventHandlerCtx) {
  const path = ctx.event.path as string | undefined
  if (path && typeof window.fs?.readFile === 'function') {
    console.debug('[file:changed] Agent modified:', path)
    useEventBus.getState().dispatch({ type: 'file:changed' as const, path, timestamp: Date.now() })
  }
}

export function handleWorkspaceConnected(ctx: EventHandlerCtx) {
  const root = ctx.event.root as string | undefined
  if (root) {
    import('sonner').then(({ toast }) => {
      toast.success('Workspace conectado', { description: root, duration: 3000 })
    })
  }
}

export function handleSidecarLog(ctx: EventHandlerCtx) {
  const level = ctx.event.level as string | undefined
  const text = ctx.event.text as string | undefined
  if (level === 'stderr' && text) console.warn('[sidecar stderr]', text)
}

export function handleTerminalAgentCommand(ctx: EventHandlerCtx) {
  const command = ctx.event.command as string
  if (window.terminal) {
    window.terminal.agentWrite('default', command).then((res) => {
      if (res.needsConfirmation) {
        if (window.confirm(`El agente quiere ejecutar:\n\n${command}\n\n¿Permitir?`)) {
          window.terminal.agentWriteForce('default', command)
        }
      }
    })
  }
}

export function handleTerminalAgentSpawn(ctx: EventHandlerCtx) {
  const procId = ctx.event.procId as string
  const command = ctx.event.command as string
  if (procId && command && window.terminal) {
    void window.terminal.agentSpawn(procId, command)
  }
}
