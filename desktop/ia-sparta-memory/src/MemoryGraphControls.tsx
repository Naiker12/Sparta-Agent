import { useState } from 'react'
import { ZoomIn, ZoomOut, RotateCw, List, Share2, Trash2 } from 'lucide-react'

interface MemoryGraphControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onToggleView: () => void
  onClearAll?: () => void
  isGraphView: boolean
  nodeCount: number
  edgeCount: number
  zoomLevel?: number
}

const LEGEND_ITEMS = [
  { label: 'Entidad / Usuario', color: '#3b82f6' },
  { label: 'Hecho', color: '#10b981' },
  { label: 'Pref.', color: '#ec4899' },
  { label: 'Proyecto', color: '#8b5cf6' },
  { label: 'Código', color: '#06b6d4' },
]

export function MemoryGraphControls({
  onZoomIn, onZoomOut, onReset, onToggleView, onClearAll,
  isGraphView, nodeCount, edgeCount, zoomLevel,
}: MemoryGraphControlsProps) {
  const [hoverClear, setHoverClear] = useState(false)
  const [hoverBtn, setHoverBtn] = useState<string | null>(null)

  return (
    <div
      className="flex items-center justify-between shrink-0 px-4 py-2"
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-base)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* Metrics & Legend Section */}
      <div className="flex items-center gap-3">
        {isGraphView && (
          <>
            <span
              className="text-[11px] font-mono px-2 py-0.5 rounded-full"
              style={{
                color: 'var(--text-secondary)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {nodeCount} nodos · {edgeCount} aristas
            </span>

            <div className="w-px h-4" style={{ background: 'var(--border-subtle)', margin: '0 2px' }} />

            <div className="flex gap-2.5 items-center flex-wrap">
              {LEGEND_ITEMS.map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div
                    className="size-[8px] rounded-full shrink-0"
                    style={{
                      background: color,
                      boxShadow: `0 0 7px ${color}aa`,
                    }}
                  />
                  <span className="text-[10.5px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Control Buttons & Actions */}
      <div className="flex items-center gap-2">
        {isGraphView && (
          <div
            className="flex items-center gap-1 p-1 rounded-full"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-normal)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          >
            <button
              onClick={onZoomIn}
              title="Acercar"
              onMouseEnter={() => setHoverBtn('zoomIn')}
              onMouseLeave={() => setHoverBtn(null)}
              style={{
                width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: hoverBtn === 'zoomIn' ? 'var(--bg-hover)' : 'transparent',
                color: 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              <ZoomIn size={13} strokeWidth={1.75} />
            </button>

            {zoomLevel != null && (
              <span
                className="text-[9.5px] font-mono text-center px-1.5 py-0.5 rounded-md"
                style={{
                  color: 'var(--accent)',
                  fontWeight: 600,
                  background: 'rgba(99, 102, 241, 0.12)',
                  minWidth: 34,
                }}
              >
                {zoomLevel}%
              </span>
            )}

            <button
              onClick={onZoomOut}
              title="Alejar"
              onMouseEnter={() => setHoverBtn('zoomOut')}
              onMouseLeave={() => setHoverBtn(null)}
              style={{
                width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: hoverBtn === 'zoomOut' ? 'var(--bg-hover)' : 'transparent',
                color: 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              <ZoomOut size={13} strokeWidth={1.75} />
            </button>

            <button
              onClick={onReset}
              title="Resetear vista"
              onMouseEnter={() => setHoverBtn('reset')}
              onMouseLeave={() => setHoverBtn(null)}
              style={{
                width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: hoverBtn === 'reset' ? 'var(--bg-hover)' : 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              <RotateCw size={12} strokeWidth={1.75} />
            </button>
          </div>
        )}

        {/* Clear All Memory Action Button */}
        {onClearAll && nodeCount > 0 && (
          <button
            onClick={onClearAll}
            onMouseEnter={() => setHoverClear(true)}
            onMouseLeave={() => setHoverClear(false)}
            title="Vaciar todos los recuerdos de la memoria"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 14,
              fontSize: 10.5,
              fontWeight: 600,
              color: '#ef4444',
              background: hoverClear ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${hoverClear ? 'rgba(239, 68, 68, 0.5)' : 'rgba(239, 68, 68, 0.25)'}`,
              boxShadow: hoverClear ? '0 0 12px rgba(239, 68, 68, 0.25)' : '0 2px 6px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Trash2 size={12} strokeWidth={2} />
            Vaciar Memoria
          </button>
        )}

        {/* View Switch Button (Graph vs List) */}
        <button
          onClick={onToggleView}
          onMouseEnter={() => setHoverBtn('toggleView')}
          onMouseLeave={() => setHoverBtn(null)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 16,
            fontSize: 10.5,
            fontWeight: 600,
            color: 'var(--text-primary)',
            background: hoverBtn === 'toggleView' ? 'var(--bg-hover)' : 'var(--bg-elevated)',
            border: '1px solid var(--border-normal)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
            cursor: 'pointer',
            transition: 'all 0.12s ease',
          }}
        >
          {isGraphView ? <List size={13} strokeWidth={1.75} /> : <Share2 size={13} strokeWidth={1.75} />}
          <span>{isGraphView ? 'Vista gráfico' : 'Vista lista'}</span>
        </button>
      </div>
    </div>
  )
}
