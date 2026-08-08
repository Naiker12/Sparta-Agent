/**
 * chart-generator.ts
 * Validador y generador de HTML autónomo con Chart.js para la herramienta generate_chart.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { GenerateChartInput } from '../../../../ia-sparta-core/src/services/tools/generate-chart'

const SPARTA_COLORS = [
  'rgba(99, 102, 241, 0.85)',   // Indigo primary
  'rgba(59, 130, 246, 0.85)',   // Blue
  'rgba(16, 185, 129, 0.85)',   // Emerald
  'rgba(245, 158, 11, 0.85)',   // Amber
  'rgba(236, 72, 153, 0.85)',   // Pink
  'rgba(168, 85, 247, 0.85)',   // Purple
  'rgba(14, 165, 233, 0.85)',   // Sky
  'rgba(239, 68, 68, 0.85)',    // Red
]

const SPARTA_BORDERS = [
  '#6366f1',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#a855f7',
  '#0ea5e9',
  '#ef4444',
]

export async function executeGenerateChart(
  input: Record<string, unknown>,
  targetDirectory: string,
): Promise<string> {
  const chartInput = input as unknown as GenerateChartInput

  if (!chartInput.type || !chartInput.title || !Array.isArray(chartInput.labels) || !Array.isArray(chartInput.series)) {
    return 'Error: Parámetros inválidos para generate_chart. Se requieren "type", "title", "labels" (array) y "series" (array).'
  }

  if (chartInput.labels.length === 0 || chartInput.series.length === 0) {
    return 'Error: Las etiquetas ("labels") y las series ("series") no pueden estar vacías.'
  }

  for (const s of chartInput.series) {
    if (!s.name || !Array.isArray(s.data)) {
      return `Error: La serie de datos "${s.name || 'desconocida'}" debe contener un array numérico en "data".`
    }
  }

  // Determine Chart.js type mapping & dataset config
  const isPieOrDoughnut = chartInput.type === 'pie' || chartInput.type === 'doughnut'
  const chartJsType = chartInput.type === 'area' ? 'line' : chartInput.type

  const datasets = chartInput.series.map((s, idx) => {
    const color = SPARTA_COLORS[idx % SPARTA_COLORS.length]
    const border = SPARTA_BORDERS[idx % SPARTA_BORDERS.length]

    if (isPieOrDoughnut) {
      return {
        label: s.name,
        data: s.data,
        backgroundColor: SPARTA_COLORS.slice(0, chartInput.labels.length),
        borderColor: SPARTA_BORDERS.slice(0, chartInput.labels.length),
        borderWidth: 1.5,
      }
    }

    return {
      label: s.name,
      data: s.data,
      backgroundColor: color,
      borderColor: border,
      borderWidth: 2,
      fill: chartInput.type === 'area',
      tension: chartInput.type === 'line' || chartInput.type === 'area' ? 0.35 : 0,
      pointBackgroundColor: border,
      pointRadius: 4,
    }
  })

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(chartInput.title)}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --border: #1f2937;
    }
    body {
      margin: 0;
      padding: 24px;
      background-color: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .chart-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      width: 100%;
      max-width: 850px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    h2 {
      margin: 0 0 16px 0;
      font-size: 1.25rem;
      font-weight: 600;
      text-align: center;
      color: var(--text);
    }
    .canvas-container {
      position: relative;
      width: 100%;
      height: 420px;
    }
  </style>
</head>
<body>
  <div class="chart-card">
    <h2>${escapeHtml(chartInput.title)}</h2>
    <div class="canvas-container">
      <canvas id="spartaChart"></canvas>
    </div>
  </div>

  <script>
    const ctx = document.getElementById('spartaChart').getContext('2d');
    new Chart(ctx, {
      type: ${JSON.stringify(chartJsType)},
      data: {
        labels: ${JSON.stringify(chartInput.labels)},
        datasets: ${JSON.stringify(datasets)}
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#9ca3af',
              font: { family: 'system-ui', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: '#1f2937',
            titleColor: '#f3f4f6',
            bodyColor: '#f3f4f6',
            borderColor: '#374151',
            borderWidth: 1
          }
        },
        scales: ${
          isPieOrDoughnut
            ? '{}'
            : JSON.stringify({
                x: {
                  title: { display: !!chartInput.x_label, text: chartInput.x_label || '', color: '#9ca3af' },
                  ticks: { color: '#9ca3af' },
                  grid: { color: 'rgba(55, 65, 81, 0.3)' }
                },
                y: {
                  title: { display: !!chartInput.y_label, text: chartInput.y_label || '', color: '#9ca3af' },
                  ticks: { color: '#9ca3af' },
                  grid: { color: 'rgba(55, 65, 81, 0.3)' }
                }
              })
        }
      }
    });
  </script>
</body>
</html>`

  const sanitizedTitle = chartInput.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
  const fileName = `chart-${sanitizedTitle || 'data'}-${Date.now()}.html`
  const chartsDir = path.join(targetDirectory, '.tmp', 'charts')
  const filePath = path.join(chartsDir, fileName)

  await fs.promises.mkdir(chartsDir, { recursive: true })
  await fs.promises.writeFile(filePath, htmlContent, 'utf-8')

  return `Gráfica profesional generada con éxito. Guardada en vista previa temporal: ${filePath}`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
