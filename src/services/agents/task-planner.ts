import type { TaskStep } from '@/types'

export interface PlannedTask {
  steps: TaskStep[]
  description: string
}

export function planTask(
  description: string,
  availableTools: string[],
): PlannedTask {
  const steps: TaskStep[] = []

  steps.push({
    id: crypto.randomUUID(),
    name: 'Analizar tarea',
    status: 'pending',
  })

  steps.push({
    id: crypto.randomUUID(),
    name: 'Recopilar información',
    status: 'pending',
    tool: availableTools[0],
  })

  steps.push({
    id: crypto.randomUUID(),
    name: 'Ejecutar acciones',
    status: 'pending',
    tool: availableTools.length > 1 ? availableTools[1] : undefined,
  })

  steps.push({
    id: crypto.randomUUID(),
    name: 'Consolidar resultado',
    status: 'pending',
  })

  return { steps, description }
}

export function findStep(steps: TaskStep[], stepId: string): TaskStep | undefined {
  return steps.find((s) => s.id === stepId)
}
