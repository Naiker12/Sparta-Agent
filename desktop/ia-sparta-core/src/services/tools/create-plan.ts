/**
 * plan-tool.ts
 * Definición del esquema JSON para la herramienta create_plan.
 */

export interface PlanStepInput {
  title: string
  description?: string
}

export interface CreatePlanInput {
  title: string
  steps: PlanStepInput[]
}

export function buildCreatePlanTool() {
  return {
    name: 'create_plan',
    description:
      'Crea una secuencia estructurada de pasos de planificación transparente para tareas complejas o multi-etapa.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Título general del plan de acción',
        },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título corto del paso del plan' },
              description: { type: 'string', description: 'Explicación del objetivo de este paso' },
            },
            required: ['title'],
          },
          description: 'Lista de pasos del plan',
        },
      },
      required: ['title', 'steps'],
    },
  }
}
