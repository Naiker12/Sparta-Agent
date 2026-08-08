/**
 * chart-generator.ts
 * Validador y generador de HTML autónomo con Chart.js para la herramienta generate_chart.
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
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

export interface GenerateChartResult {
  output: string
  filePath: string
  title: string
}

async function cleanupOldCharts(chartsDir: string) {
  try {
    const files = await fs.promises.readdir(chartsDir)
    if (files.length <= 50) return
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const p = path.join(chartsDir, file)
        const stat = await fs.promises.stat(p)
        return { path: p, mtime: stat.mtimeMs }
      })
    )
    fileStats.sort((a, b) => a.mtime - b.mtime)
    const toDelete = fileStats.slice(0, fileStats.length - 40)
    for (const f of toDelete) {
      await fs.promises.unlink(f.path).catch(() => {})
    }
  } catch {
    /* ignore cleanup errors */
  }
}

export async function executeGenerateChart(
  input: Record<string, unknown>,
): Promise<GenerateChartResult> {
  const chartInput = input as unknown as GenerateChartInput

  if (!chartInput.type || !chartInput.title || !Array.isArray(chartInput.labels) || !Array.isArray(chartInput.series)) {
    throw new Error('Parámetros inválidos para generate_chart. Se requieren "type", "title", "labels" (array) y "series" (array).')
  }

  if (chartInput.labels.length === 0 || chartInput.series.length === 0) {
    throw new Error('Las etiquetas ("labels") y las series ("series") no pueden estar vacías.')
  }

  for (const s of chartInput.series) {
    if (!s.name || !Array.isArray(s.data)) {
      throw new Error(`La serie de datos "${s.name || 'desconocida'}" debe contener un array numérico en "data".`)
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
  <script>
    ${getChartJsInlineScript()}
  </script>
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
  const baseDir = typeof app?.getPath === 'function' ? app.getPath('userData') : process.cwd()
  const chartsDir = path.join(baseDir, 'sparta', 'charts')
  const filePath = path.join(chartsDir, fileName)

  await fs.promises.mkdir(chartsDir, { recursive: true })
  await fs.promises.writeFile(filePath, htmlContent, 'utf-8')
  cleanupOldCharts(chartsDir).catch(() => {})

  return {
    output: `Gráfica interactiva "${chartInput.title}" generada con éxito.`,
    filePath,
    title: chartInput.title,
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getChartJsInlineScript(): string {
  return `
    window.Chart = window.Chart || function(ctx, config) {
      const canvas = ctx.canvas || ctx;
      const type = config.type;
      const data = config.data;
      const labels = data.labels || [];
      const datasets = data.datasets || [];

      function draw() {
        const rect = canvas.parentNode.getBoundingClientRect();
        canvas.width = rect.width || 800;
        canvas.height = rect.height || 400;
        const c = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const padding = 60;
        const chartW = w - padding * 2;
        const chartH = h - padding * 2;

        c.clearRect(0, 0, w, h);

        let maxVal = 0;
        datasets.forEach(ds => {
          (ds.data || []).forEach(v => { if (v > maxVal) maxVal = v; });
        });
        if (maxVal === 0) maxVal = 100;
        maxVal = Math.ceil(maxVal * 1.15);

        // Grid lines
        c.strokeStyle = 'rgba(55, 65, 81, 0.4)';
        c.lineWidth = 1;
        const steps = 5;
        for (let i = 0; i <= steps; i++) {
          const y = h - padding - (chartH / steps) * i;
          const val = Math.round((maxVal / steps) * i);
          c.beginPath();
          c.moveTo(padding, y);
          c.lineTo(w - padding, y);
          c.stroke();

          c.fillStyle = '#9ca3af';
          c.font = '12px system-ui';
          c.textAlign = 'right';
          c.fillText(val.toString(), padding - 10, y + 4);
        }

        const barCount = labels.length;
        const stepX = chartW / Math.max(barCount, 1);

        // Labels X
        labels.forEach((label, i) => {
          const x = padding + stepX * i + stepX / 2;
          c.fillStyle = '#9ca3af';
          c.font = '13px system-ui';
          c.textAlign = 'center';
          c.fillText(label, x, h - padding + 24);
        });

        // Draw datasets
        datasets.forEach((ds, dsIdx) => {
          const dsData = ds.data || [];
          const color = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[0] : (ds.backgroundColor || '#6366f1');
          const border = Array.isArray(ds.borderColor) ? ds.borderColor[0] : (ds.borderColor || '#818cf8');

          if (type === 'bar') {
            const barW = Math.min((stepX / datasets.length) * 0.65, 60);
            dsData.forEach((val, i) => {
              const barH = (val / maxVal) * chartH;
              const x = padding + stepX * i + (stepX / datasets.length) * dsIdx + (stepX / datasets.length - barW) / 2;
              const y = h - padding - barH;

              c.fillStyle = color;
              c.fillRect(x, y, barW, barH);
              c.strokeStyle = border;
              c.lineWidth = 1.5;
              c.strokeRect(x, y, barW, barH);

              // Value badge above bar
              c.fillStyle = '#f3f4f6';
              c.font = 'bold 12px system-ui';
              c.textAlign = 'center';
              c.fillText(val.toString(), x + barW / 2, y - 8);
            });
          } else {
            // Line / Area
            c.beginPath();
            dsData.forEach((val, i) => {
              const x = padding + stepX * i + stepX / 2;
              const y = h - padding - (val / maxVal) * chartH;
              if (i === 0) c.moveTo(x, y);
              else c.lineTo(x, y);
            });
            c.strokeStyle = border;
            c.lineWidth = 3;
            c.stroke();

            // Points
            dsData.forEach((val, i) => {
              const x = padding + stepX * i + stepX / 2;
              const y = h - padding - (val / maxVal) * chartH;
              c.beginPath();
              c.arc(x, y, 5, 0, Math.PI * 2);
              c.fillStyle = border;
              c.fill();
              c.fillStyle = '#f3f4f6';
              c.font = 'bold 12px system-ui';
              c.textAlign = 'center';
              c.fillText(val.toString(), x, y - 10);
            });
          }
        });
      }

      window.addEventListener('resize', draw);
      setTimeout(draw, 50);
    };
  `
}
