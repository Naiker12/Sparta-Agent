/**
 * generate-chart.ts
 * Definición del esquema JSON para la herramienta generate_chart.
 */

export interface ChartSeries {
  name: string
  data?: number[]
  /** Solo para 'scatter': pares [x, y]. Si se usa, ignora 'data'. */
  points?: Array<{ x: number; y: number }>
}

export type ChartVisualTheme =
  | 'sparta-dark'
  | 'aurora'
  | 'sunset'
  | 'ocean'
  | 'mono-light'
  | 'random'

export interface GenerateChartInput {
  type: 'bar' | 'horizontal_bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'radar' | 'scatter'
  title: string
  labels: string[]
  series: ChartSeries[]
  x_label?: string
  y_label?: string
  /**
   * Tema visual. Si se omite o se pasa 'random', el sistema elige un
   * tema distinto en cada generación para que las gráficas no se vean
   * siempre iguales.
   */
  theme?: ChartVisualTheme
}

export function buildGenerateChartTool() {
  return {
    name: 'generate_chart',
    description:
      'Genera una gráfica de datos profesional a partir de datos numéricos reales disponibles en la conversación o recién calculados. Soporta barras verticales, barras horizontales, líneas, área, pastel, dona, radar y dispersión (scatter). NO la uses para ilustraciones, diagramas de flujo ni arte — solo para visualizar datos. Si el usuario no dio datos reales, preguntá antes de inventar cifras de ejemplo.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['bar', 'horizontal_bar', 'line', 'pie', 'doughnut', 'area', 'radar', 'scatter'],
          description:
            'Tipo de gráfica. Usá "radar" para comparar varias dimensiones de una o pocas entidades, "scatter" para correlación entre dos variables numéricas, "horizontal_bar" cuando las etiquetas son largas.',
        },
        title: {
          type: 'string',
          description: 'Título descriptivo de la gráfica',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Etiquetas para las categorías / eje X (ej: ["Ene", "Feb", "Mar"]). Para "radar" son los ejes/dimensiones. Para "scatter" pueden dejarse vacías.',
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
                description: 'Valores numéricos para esta serie (no usar para "scatter")',
              },
              points: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                  },
                  required: ['x', 'y'],
                },
                description: 'Solo para "scatter": lista de puntos {x, y}',
              },
            },
            required: ['name'],
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
        theme: {
          type: 'string',
          enum: ['sparta-dark', 'aurora', 'sunset', 'ocean', 'mono-light', 'random'],
          description:
            'Tema visual de la gráfica. Si no se especifica, se elige uno distinto automáticamente en cada gráfica generada para variar el diseño.',
        },
      },
      required: ['type', 'title', 'labels', 'series'],
    },
  }
}
