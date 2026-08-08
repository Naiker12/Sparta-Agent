/**
 * delegate-tools.ts
 * Esquemas e implementación funcional para herramientas de subagentes delegados.
 */

export function buildDelegateResearchTool() {
  return {
    name: 'delegate_research',
    description:
      'Delega una tarea de investigación profunda en un subagente paralelo especializado para buscar en la web, leer múltiples fuentes y sintetizar hallazgos.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Tema o pregunta detallada a investigar' },
      },
      required: ['topic'],
    },
  }
}

export function buildDelegateCodeTool() {
  return {
    name: 'delegate_code',
    description:
      'Delega una tarea de programación o refactorización compleja en un subagente paralelizable especializado.',
    input_schema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Descripción de la tarea de código a ejecutar' },
      },
      required: ['task'],
    },
  }
}
