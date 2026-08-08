/**
 * chart-generator.ts
 * Validador y generador de HTML autónomo con Canvas 2D nativo para la herramienta generate_chart.
 *
 * v2: soporta múltiples temas visuales (elegidos al azar si no se pide uno
 * explícito, para que no todas las gráficas se vean idénticas) y más tipos
 * de gráfico: bar, horizontal_bar, line, area, pie, doughnut, radar, scatter.
 */

import type { GenerateChartInput, ChartVisualTheme } from '../../../../ia-sparta-core/src/services/tools/generate-chart'
import { saveChartHtml } from './chart-storage'

// ── Catálogo de temas visuales ──────────────────────────────────────
interface ThemeDef {
  bg: string
  cardBg: string
  text: string
  textMuted: string
  border: string
  radius: string
  fontFamily: string
  palette: string[]
  borders: string[]
  gridColor: string
}

const THEMES: Record<Exclude<ChartVisualTheme, 'random'>, ThemeDef> = {
  'sparta-dark': {
    bg: '#090d16', cardBg: '#111827', text: '#f3f4f6', textMuted: '#9ca3af',
    border: '#1f2937', radius: '12px',
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    palette: ['rgba(99,102,241,0.85)', 'rgba(59,130,246,0.85)', 'rgba(16,185,129,0.85)', 'rgba(245,158,11,0.85)', 'rgba(236,72,153,0.85)', 'rgba(168,85,247,0.85)', 'rgba(14,165,233,0.85)', 'rgba(239,68,68,0.85)'],
    borders: ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#a855f7', '#0ea5e9', '#ef4444'],
    gridColor: 'rgba(55,65,81,0.45)',
  },
  aurora: {
    bg: '#0b1024', cardBg: '#141a35', text: '#eef2ff', textMuted: '#a5b4fc',
    border: '#2a3363', radius: '20px',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    palette: ['rgba(56,189,248,0.85)', 'rgba(129,140,248,0.85)', 'rgba(232,121,249,0.85)', 'rgba(52,211,153,0.85)', 'rgba(250,204,21,0.85)', 'rgba(248,113,113,0.85)', 'rgba(45,212,191,0.85)', 'rgba(192,132,252,0.85)'],
    borders: ['#38bdf8', '#818cf8', '#e879f9', '#34d399', '#facc15', '#f87171', '#2dd4bf', '#c084fc'],
    gridColor: 'rgba(129,140,248,0.18)',
  },
  sunset: {
    bg: '#1a0f0a', cardBg: '#2a1710', text: '#fff7ed', textMuted: '#fdba74',
    border: '#7c2d12', radius: '10px',
    fontFamily: "Georgia, 'Times New Roman', serif",
    palette: ['rgba(251,146,60,0.88)', 'rgba(248,113,113,0.88)', 'rgba(250,204,21,0.88)', 'rgba(236,72,153,0.88)', 'rgba(217,70,239,0.88)', 'rgba(244,63,94,0.88)', 'rgba(251,191,36,0.88)', 'rgba(190,24,93,0.88)'],
    borders: ['#fb923c', '#f87171', '#facc15', '#ec4899', '#d946ef', '#f43f5e', '#fbbf24', '#be185d'],
    gridColor: 'rgba(251,146,60,0.15)',
  },
  ocean: {
    bg: '#04141c', cardBg: '#0a2230', text: '#e0f7fa', textMuted: '#7dd3fc',
    border: '#0e3a4d', radius: '14px',
    fontFamily: "'Trebuchet MS', system-ui, sans-serif",
    palette: ['rgba(34,211,238,0.85)', 'rgba(45,212,191,0.85)', 'rgba(59,130,246,0.85)', 'rgba(163,230,53,0.85)', 'rgba(56,189,248,0.85)', 'rgba(94,234,212,0.85)', 'rgba(125,211,252,0.85)', 'rgba(74,222,128,0.85)'],
    borders: ['#22d3ee', '#2dd4bf', '#3b82f6', '#a3e635', '#38bdf8', '#5eead4', '#7dd3fc', '#4ade80'],
    gridColor: 'rgba(34,211,238,0.15)',
  },
  'mono-light': {
    bg: '#f5f5f4', cardBg: '#ffffff', text: '#1c1917', textMuted: '#78716c',
    border: '#e7e5e4', radius: '8px',
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    palette: ['rgba(28,25,23,0.85)', 'rgba(87,83,78,0.75)', 'rgba(120,113,108,0.65)', 'rgba(168,162,158,0.6)', 'rgba(214,211,209,0.7)', 'rgba(41,37,36,0.8)', 'rgba(68,64,60,0.7)', 'rgba(120,113,108,0.85)'],
    borders: ['#1c1917', '#57534e', '#78716c', '#a8a29e', '#d6d3d1', '#292524', '#44403c', '#78716c'],
    gridColor: 'rgba(120,113,108,0.2)',
  },
}

function pickTheme(requested: ChartVisualTheme | undefined): ThemeDef {
  const keys = Object.keys(THEMES) as Array<Exclude<ChartVisualTheme, 'random'>>
  if (requested && requested !== 'random' && THEMES[requested]) return THEMES[requested]
  // Sin tema pedido, o 'random' explícito: elegir uno al azar en cada generación
  const pick = keys[Math.floor(Math.random() * keys.length)]
  return THEMES[pick]
}

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

  const isScatter = chartInput.type === 'scatter'
  if ((!isScatter && chartInput.labels.length === 0) || chartInput.series.length === 0) {
    throw new Error('Las etiquetas ("labels") y las series ("series") no pueden estar vacías.')
  }

  for (const s of chartInput.series) {
    if (!s.name || (!Array.isArray(s.data) && !Array.isArray(s.points))) {
      throw new Error(`La serie de datos "${s.name || 'desconocida'}" debe contener "data" (array numérico) o "points" (para scatter).`)
    }
  }

  const theme = pickTheme(chartInput.theme)
  const isPieOrDoughnut = chartInput.type === 'pie' || chartInput.type === 'doughnut'
  const canvasType = chartInput.type === 'area' ? 'line' : chartInput.type

  const datasets = chartInput.series.map((s, idx) => {
    const color = theme.palette[idx % theme.palette.length]
    const border = theme.borders[idx % theme.borders.length]

    if (isPieOrDoughnut) {
      return {
        label: s.name,
        data: s.data,
        backgroundColor: theme.palette.slice(0, chartInput.labels.length),
        borderColor: theme.borders.slice(0, chartInput.labels.length),
        borderWidth: 1.5,
      }
    }

    if (isScatter) {
      return {
        label: s.name,
        points: s.points || [],
        backgroundColor: color,
        borderColor: border,
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
      --bg: ${theme.bg};
      --card-bg: ${theme.cardBg};
      --text: ${theme.text};
      --text-muted: ${theme.textMuted};
      --border: ${theme.border};
    }
    body {
      margin: 0;
      padding: 24px;
      background-color: var(--bg);
      color: var(--text);
      font-family: ${theme.fontFamily};
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
      border-radius: ${theme.radius};
      padding: 24px;
      width: 100%;
      max-width: 850px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35);
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
      const isRadar = (type === 'radar');
      const isScatter = (type === 'scatter');
      const isHorizontal = (type === 'horizontal_bar');
      const labels = ${JSON.stringify(chartInput.labels)};
      const datasets = ${JSON.stringify(datasets)};
      const xLabel = ${JSON.stringify(chartInput.x_label || '')};
      const yLabel = ${JSON.stringify(chartInput.y_label || '')};
      const gridColor = ${JSON.stringify(theme.gridColor)};
      const textMuted = ${JSON.stringify(theme.textMuted)};
      const textColor = ${JSON.stringify(theme.text)};

      function fmtNum(n) {
        if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\\.0$/, '') + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\\.0$/, '') + 'M';
        if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\\.0$/, '') + 'k';
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
          const colors = Array.isArray(ds.backgroundColor) ? ds.backgroundColor : [];
          const borders = Array.isArray(ds.borderColor) ? ds.borderColor : [];

          const cx = w * 0.4;
          const cy = h * 0.5;
          const outerR = Math.min(cx - 30, cy - 30, 180);
          const innerR = type === 'doughnut' ? outerR * 0.55 : 0;

          let startAngle = -Math.PI / 2;
          dsData.forEach((val, i) => {
            const sliceAngle = (val / total) * Math.PI * 2;
            const midAngle = startAngle + sliceAngle / 2;

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

          const legendX = w * 0.7;
          let legendY = Math.max(30, cy - labels.length * 12);
          labels.forEach((lbl, i) => {
            const val = dsData[i] || 0;
            ctx.fillStyle = colors[i % colors.length] || '#6366f1';
            ctx.fillRect(legendX, legendY, 12, 12);
            ctx.fillStyle = textColor;
            ctx.font = '12px system-ui';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(lbl + ' (' + fmtNum(val) + ')', legendX + 18, legendY + 6);
            legendY += 24;
          });
          return;
        }

        // ── Radar ──
        if (isRadar) {
          const cx = w / 2;
          const cy = h / 2 + 10;
          const radius = Math.min(w, h) / 2 - 60;
          const axisCount = labels.length || 3;
          const angleStep = (Math.PI * 2) / axisCount;

          let maxVal = 0;
          datasets.forEach(ds => (ds.data || []).forEach(v => { if (Number(v) > maxVal) maxVal = Number(v); }));
          if (maxVal === 0) maxVal = 100;

          // Grid rings
          const rings = 4;
          ctx.strokeStyle = gridColor;
          ctx.lineWidth = 1;
          for (let r = 1; r <= rings; r++) {
            ctx.beginPath();
            for (let i = 0; i <= axisCount; i++) {
              const angle = -Math.PI / 2 + i * angleStep;
              const rr = (radius * r) / rings;
              const x = cx + Math.cos(angle) * rr;
              const y = cy + Math.sin(angle) * rr;
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }

          // Axis lines + labels
          labels.forEach((lbl, i) => {
            const angle = -Math.PI / 2 + i * angleStep;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            ctx.strokeStyle = gridColor;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
            ctx.fillStyle = textMuted;
            ctx.font = '12px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const lx = cx + Math.cos(angle) * (radius + 22);
            const ly = cy + Math.sin(angle) * (radius + 22);
            ctx.fillText(lbl, lx, ly);
          });

          // Dataset polygons
          datasets.forEach((ds) => {
            const dsData = ds.data || [];
            ctx.beginPath();
            dsData.forEach((val, i) => {
              const angle = -Math.PI / 2 + i * angleStep;
              const rr = (Number(val) / maxVal) * radius;
              const x = cx + Math.cos(angle) * rr;
              const y = cy + Math.sin(angle) * rr;
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.closePath();
            const fillColor = typeof ds.backgroundColor === 'string' ? ds.backgroundColor.replace(/[\\d.]+\\)$/, '0.25)') : 'rgba(99,102,241,0.25)';
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = ds.borderColor || '#6366f1';
            ctx.lineWidth = 2;
            ctx.stroke();
          });
          return;
        }

        // ── Scatter ──
        if (isScatter) {
          const padLeft = 65, padRight = 30, padTop = 30, padBottom = 55;
          const chartW = w - padLeft - padRight;
          const chartH = h - padTop - padBottom;

          let allPts = [];
          datasets.forEach(ds => (ds.points || []).forEach(p => allPts.push(p)));
          if (allPts.length === 0) return;
          let maxX = Math.max(...allPts.map(p => p.x));
          let minX = Math.min(...allPts.map(p => p.x));
          let maxY = Math.max(...allPts.map(p => p.y));
          let minY = Math.min(...allPts.map(p => p.y));
          if (maxX === minX) maxX = minX + 1;
          if (maxY === minY) maxY = minY + 1;

          ctx.strokeStyle = gridColor;
          ctx.lineWidth = 1;
          const steps = 5;
          for (let i = 0; i <= steps; i++) {
            const y = padTop + chartH - (chartH / steps) * i;
            const val = minY + ((maxY - minY) / steps) * i;
            ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(w - padRight, y); ctx.stroke();
            ctx.fillStyle = textMuted; ctx.font = '11px system-ui';
            ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            ctx.fillText(fmtNum(Math.round(val)), padLeft - 10, y);
          }

          datasets.forEach((ds) => {
            (ds.points || []).forEach(p => {
              const x = padLeft + ((p.x - minX) / (maxX - minX)) * chartW;
              const y = padTop + chartH - ((p.y - minY) / (maxY - minY)) * chartH;
              ctx.beginPath();
              ctx.arc(x, y, 6, 0, Math.PI * 2);
              ctx.fillStyle = ds.backgroundColor || 'rgba(99,102,241,0.85)';
              ctx.fill();
              ctx.strokeStyle = ds.borderColor || '#6366f1';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            });
          });

          if (xLabel) { ctx.fillStyle = textMuted; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(xLabel, padLeft + chartW / 2, h - 8); }
          if (yLabel) {
            ctx.save(); ctx.translate(18, padTop + chartH / 2); ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = textMuted; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(yLabel, 0, 0);
            ctx.restore();
          }
          return;
        }

        // ── Bar / Horizontal Bar / Line / Area ──
        const padLeft = isHorizontal ? 100 : 65;
        const padRight = 30;
        const padTop = 30;
        const padBottom = isHorizontal ? 30 : 55;
        const chartW = w - padLeft - padRight;
        const chartH = h - padTop - padBottom;

        let maxVal = 0;
        datasets.forEach(ds => (ds.data || []).forEach(v => { if (Number(v) > maxVal) maxVal = Number(v); }));
        if (maxVal === 0) maxVal = 100;
        maxVal = Math.ceil(maxVal * 1.18);

        if (isHorizontal) {
          const count = labels.length;
          const stepY = chartH / Math.max(count, 1);
          // Grid (vertical lines)
          ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
          const steps = 5;
          for (let i = 0; i <= steps; i++) {
            const x = padLeft + (chartW / steps) * i;
            const val = Math.round((maxVal / steps) * i);
            ctx.beginPath(); ctx.moveTo(x, padTop); ctx.lineTo(x, padTop + chartH); ctx.stroke();
            ctx.fillStyle = textMuted; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(fmtNum(val), x, padTop + chartH + 6);
          }
          labels.forEach((lbl, i) => {
            const y = padTop + stepY * i + stepY / 2;
            ctx.fillStyle = textMuted; ctx.font = '12px system-ui'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            ctx.fillText(lbl, padLeft - 10, y);
          });
          datasets.forEach((ds, dsIdx) => {
            const dsData = ds.data || [];
            const barH = Math.min((stepY / datasets.length) * 0.62, 40);
            dsData.forEach((val, i) => {
              const numVal = Number(val) || 0;
              const barW = (numVal / maxVal) * chartW;
              const y = padTop + stepY * i + (stepY / datasets.length) * dsIdx + (stepY / datasets.length - barH) / 2;
              ctx.fillStyle = ds.backgroundColor; ctx.fillRect(padLeft, y, barW, barH);
              ctx.strokeStyle = ds.borderColor; ctx.lineWidth = 1.5; ctx.strokeRect(padLeft, y, barW, barH);
              ctx.fillStyle = textColor; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
              ctx.fillText(fmtNum(numVal), padLeft + barW + 6, y + barH / 2);
            });
          });
          return;
        }

        // Y Grid & Ticks (vertical bar / line / area)
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        const steps = 5;
        for (let i = 0; i <= steps; i++) {
          const y = padTop + chartH - (chartH / steps) * i;
          const val = Math.round((maxVal / steps) * i);
          ctx.beginPath();
          ctx.moveTo(padLeft, y);
          ctx.lineTo(w - padRight, y);
          ctx.stroke();
          ctx.fillStyle = textMuted;
          ctx.font = '12px system-ui';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(fmtNum(val), padLeft - 12, y);
        }

        const count = labels.length;
        const stepX = chartW / Math.max(count, 1);
        labels.forEach((lbl, i) => {
          const x = padLeft + stepX * i + stepX / 2;
          ctx.fillStyle = textMuted;
          ctx.font = '13px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(lbl, x, padTop + chartH + 10);
        });

        if (yLabel) {
          ctx.save();
          ctx.translate(18, padTop + chartH / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = textMuted;
          ctx.font = '12px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(yLabel, 0, 0);
          ctx.restore();
        }
        if (xLabel) {
          ctx.fillStyle = textMuted;
          ctx.font = '12px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(xLabel, padLeft + chartW / 2, h - 8);
        }

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

              ctx.fillStyle = textColor;
              ctx.font = 'bold 12px system-ui';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(fmtNum(numVal), x + barW / 2, y - 6);
            });
          } else {
            if (ds.fill) {
              ctx.beginPath();
              dsData.forEach((val, i) => {
                const numVal = Number(val) || 0;
                const x = padLeft + stepX * i + stepX / 2;
                const y = padTop + chartH - (numVal / maxVal) * chartH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              });
              const lastX = padLeft + stepX * (dsData.length - 1) + stepX / 2;
              const firstX = padLeft + stepX / 2;
              ctx.lineTo(lastX, padTop + chartH);
              ctx.lineTo(firstX, padTop + chartH);
              ctx.closePath();
              const areaColor = color.replace(/[\\d.]+\\)$/, '0.2)');
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
              ctx.fillStyle = textColor;
              ctx.font = 'bold 12px system-ui';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(fmtNum(numVal), x, y - 10);
            });
          }
        });
      }

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
    output: `Gráfica interactiva "${chartInput.title}" generada con éxito (tema: ${Object.keys(THEMES).find(k => THEMES[k as keyof typeof THEMES] === theme) || 'aleatorio'}).`,
    filePath,
    title: chartInput.title,
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
