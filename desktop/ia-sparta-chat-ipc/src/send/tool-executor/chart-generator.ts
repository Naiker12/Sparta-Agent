/**
 * chart-generator.ts
 * Validador y generador de HTML autónomo con Canvas 2D nativo para la herramienta generate_chart.
 */

import type { GenerateChartInput } from '../../../../ia-sparta-core/src/services/tools/generate-chart'
import { saveChartHtml } from './chart-storage'

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

  // Determine Canvas 2D type mapping & dataset config
  const isPieOrDoughnut = chartInput.type === 'pie' || chartInput.type === 'doughnut'
  const canvasType = chartInput.type === 'area' ? 'line' : chartInput.type

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
    (function() {
      const type = ${JSON.stringify(canvasType)};
      const isPieOrDoughnut = (type === 'pie' || type === 'doughnut');
      const labels = ${JSON.stringify(chartInput.labels)};
      const datasets = ${JSON.stringify(datasets)};
      const xLabel = ${JSON.stringify(chartInput.x_label || '')};
      const yLabel = ${JSON.stringify(chartInput.y_label || '')};

      function fmtNum(n) {
        if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
        return n.toLocaleString();
      }

      function render() {
        const canvas = document.getElementById('spartaChart');
        if (!canvas) return;
        const parent = canvas.parentNode;
        canvas.width = parent.clientWidth || 800;
        canvas.height = parent.clientHeight || 400;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // ── Pie / Doughnut ──
        if (isPieOrDoughnut) {
          const ds = datasets[0] || { data: [], backgroundColor: [], borderColor: [] };
          const dsData = (ds.data || []).map(Number);
          const total = dsData.reduce((a, b) => a + b, 0) || 1;
          const colors = Array.isArray(ds.backgroundColor) ? ds.backgroundColor : ${JSON.stringify(SPARTA_COLORS)};
          const borders = Array.isArray(ds.borderColor) ? ds.borderColor : ${JSON.stringify(SPARTA_BORDERS)};

          const cx = w * 0.4;
          const cy = h * 0.5;
          const outerR = Math.min(cx - 30, cy - 30, 180);
          const innerR = type === 'doughnut' ? outerR * 0.55 : 0;

          let startAngle = -Math.PI / 2;
          dsData.forEach((val, i) => {
            const sliceAngle = (val / total) * Math.PI * 2;
            const midAngle = startAngle + sliceAngle / 2;

            // Slice
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(startAngle) * innerR, cy + Math.sin(startAngle) * innerR);
            ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
            ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = colors[i % colors.length] || 'rgba(99,102,241,0.85)';
            ctx.fill();
            ctx.strokeStyle = borders[i % borders.length] || '#6366f1';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Percentage label on slice (only if slice is large enough)
            const pct = ((val / total) * 100).toFixed(1);
            if (sliceAngle > 0.25) {
              const labelR = innerR + (outerR - innerR) * 0.65;
              const lx = cx + Math.cos(midAngle) * labelR;
              const ly = cy + Math.sin(midAngle) * labelR;
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 13px system-ui';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(pct + '%', lx, ly);
            }

            startAngle += sliceAngle;
          });

          // Legend (right side)
          const legendX = w * 0.7;
          let legendY = Math.max(30, cy - labels.length * 12);
          labels.forEach((lbl, i) => {
            const val = dsData[i] || 0;
            ctx.fillStyle = colors[i % colors.length] || '#6366f1';
            ctx.fillRect(legendX, legendY, 12, 12);
            ctx.fillStyle = '#f3f4f6';
            ctx.font = '12px system-ui';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(lbl + ' (' + fmtNum(val) + ')', legendX + 18, legendY + 6);
            legendY += 24;
          });

          return; // done for pie/doughnut
        }

        // ── Bar / Line / Area ──
        const padLeft = 65;
        const padRight = 30;
        const padTop = 30;
        const padBottom = 55;
        const chartW = w - padLeft - padRight;
        const chartH = h - padTop - padBottom;

        let maxVal = 0;
        datasets.forEach(ds => {
          (ds.data || []).forEach(v => { if (Number(v) > maxVal) maxVal = Number(v); });
        });
        if (maxVal === 0) maxVal = 100;
        maxVal = Math.ceil(maxVal * 1.18);

        // Y Grid & Ticks
        ctx.strokeStyle = 'rgba(55, 65, 81, 0.45)';
        ctx.lineWidth = 1;
        const steps = 5;
        for (let i = 0; i <= steps; i++) {
          const y = padTop + chartH - (chartH / steps) * i;
          const val = Math.round((maxVal / steps) * i);
          ctx.beginPath();
          ctx.moveTo(padLeft, y);
          ctx.lineTo(w - padRight, y);
          ctx.stroke();

          ctx.fillStyle = '#9ca3af';
          ctx.font = '12px system-ui';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(fmtNum(val), padLeft - 12, y);
        }

        // X Axis Labels
        const count = labels.length;
        const stepX = chartW / Math.max(count, 1);
        labels.forEach((lbl, i) => {
          const x = padLeft + stepX * i + stepX / 2;
          ctx.fillStyle = '#9ca3af';
          ctx.font = '13px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(lbl, x, padTop + chartH + 10);
        });

        // Axis Titles
        if (yLabel) {
          ctx.save();
          ctx.translate(18, padTop + chartH / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = '#9ca3af';
          ctx.font = '12px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(yLabel, 0, 0);
          ctx.restore();
        }
        if (xLabel) {
          ctx.fillStyle = '#9ca3af';
          ctx.font = '12px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(xLabel, padLeft + chartW / 2, h - 8);
        }

        // Datasets (bar / line / area)
        datasets.forEach((ds, dsIdx) => {
          const dsData = ds.data || [];
          const color = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[0] : (ds.backgroundColor || 'rgba(99, 102, 241, 0.85)');
          const border = Array.isArray(ds.borderColor) ? ds.borderColor[0] : (ds.borderColor || '#6366f1');

          if (type === 'bar') {
            const barW = Math.min((stepX / datasets.length) * 0.62, 58);
            dsData.forEach((val, i) => {
              const numVal = Number(val) || 0;
              const barH = (numVal / maxVal) * chartH;
              const x = padLeft + stepX * i + (stepX / datasets.length) * dsIdx + (stepX / datasets.length - barW) / 2;
              const y = padTop + chartH - barH;

              ctx.fillStyle = color;
              ctx.fillRect(x, y, barW, barH);
              ctx.strokeStyle = border;
              ctx.lineWidth = 1.5;
              ctx.strokeRect(x, y, barW, barH);

              // Value Label
              ctx.fillStyle = '#f3f4f6';
              ctx.font = 'bold 12px system-ui';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(fmtNum(numVal), x + barW / 2, y - 6);
            });
          } else {
            // Line / Area
            if (ds.fill) {
              ctx.beginPath();
              dsData.forEach((val, i) => {
                const numVal = Number(val) || 0;
                const x = padLeft + stepX * i + stepX / 2;
                const y = padTop + chartH - (numVal / maxVal) * chartH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              });
              // Close area back to baseline
              const lastX = padLeft + stepX * (dsData.length - 1) + stepX / 2;
              const firstX = padLeft + stepX / 2;
              ctx.lineTo(lastX, padTop + chartH);
              ctx.lineTo(firstX, padTop + chartH);
              ctx.closePath();
              const areaColor = color.replace(/[\d.]+\)$/, '0.2)');
              ctx.fillStyle = areaColor;
              ctx.fill();
            }

            ctx.beginPath();
            dsData.forEach((val, i) => {
              const numVal = Number(val) || 0;
              const x = padLeft + stepX * i + stepX / 2;
              const y = padTop + chartH - (numVal / maxVal) * chartH;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.strokeStyle = border;
            ctx.lineWidth = 3;
            ctx.stroke();

            dsData.forEach((val, i) => {
              const numVal = Number(val) || 0;
              const x = padLeft + stepX * i + stepX / 2;
              const y = padTop + chartH - (numVal / maxVal) * chartH;
              ctx.beginPath();
              ctx.arc(x, y, 5, 0, Math.PI * 2);
              ctx.fillStyle = border;
              ctx.fill();
              ctx.fillStyle = '#f3f4f6';
              ctx.font = 'bold 12px system-ui';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(fmtNum(numVal), x, y - 10);
            });
          }
        });
      }

      // ResizeObserver for responsive canvas inside the iframe
      const container = document.querySelector('.canvas-container');
      if (container && typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => { requestAnimationFrame(render); }).observe(container);
      }
      window.addEventListener('resize', render);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
      } else {
        render();
      }
      setTimeout(render, 100);
      setTimeout(render, 300);
    })();
  </script>
</body>
</html>`

  const filePath = await saveChartHtml(chartInput.title, htmlContent)

  return {
    output: `Gráfica interactiva "${chartInput.title}" generada con éxito.`,
    filePath,
    title: chartInput.title,
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
