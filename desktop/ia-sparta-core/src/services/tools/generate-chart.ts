/**
 * generate-chart.ts
 * Definición del esquema JSON para la herramienta generate_chart.
 */

export interface ChartSeries {
  name: string
  data: number[]
}

export interface GenerateChartInput {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'radar'
  title: string
  labels: string[]
  series: ChartSeries[]
  x_label?: string
  y_label?: string
}

export function buildGenerateChartTool() {
  return {
    name: 'generate_chart',
    description:
      'Genera una gráfica de datos profesional (barras, líneas, pastel, área, dispersión, radar) a partir de datos numéricos reales que ya tenés en la conversación o que acabás de leer/calcular. NO la uses para ilustraciones, diagramas de flujo ni arte — solo para visualizar datos.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['bar', 'line', 'pie', 'doughnut', 'area', 'scatter', 'radar'],
          description: 'Tipo de gráfica a visualizar',
        },
        title: {
          type: 'string',
          description: 'Título descriptivo de la gráfica',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Etiquetas para las categorías / eje X (ej: ["Ene", "Feb", "Mar"])',
        },
        series: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nombre de la serie de datos' },
              data: {
                type: 'array',
                items: { type: 'number' },
                description: 'Valores numéricos para esta serie',
              },
            },
            required: ['name', 'data'],
          },
          description: 'Series de datos numéricos',
        },
        x_label: {
          type: 'string',
          description: 'Etiqueta explicativa para el eje X (opcional)',
        },
        y_label: {
          type: 'string',
          description: 'Etiqueta explicativa para el eje Y (opcional)',
        },
      },
      required: ['type', 'title', 'labels', 'series'],
    },
  }
}
