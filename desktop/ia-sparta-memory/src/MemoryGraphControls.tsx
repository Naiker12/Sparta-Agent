import { ZoomIn, ZoomOut, RotateCw, List, Share2 } from 'lucide-react'
import { Button } from 'ia-sparta-design-system'

interface MemoryGraphControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onToggleView: () => void
  isGraphView: boolean
  nodeCount: number
  edgeCount: number
  zoomLevel?: number
}

const LEGEND_ITEMS = [
  { label: 'Entidad', color: '#7c9ef8' },
  { label: 'Hecho', color: '#6bd49a' },
  { label: 'Pref.', color: '#f87c9e' },
  { label: 'Proyecto', color: '#c47cf8' },
  { label: 'Código', color: '#7cf8f0' },
]

export function MemoryGraphControls({
  onZoomIn, onZoomOut, onReset, onToggleView,
  isGraphView, nodeCount, edgeCount, zoomLevel,
}: MemoryGraphControlsProps) {
  return (
    <div
      className="flex items-center justify-between shrink-0 px-4 py-2"
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-base)',
      }}
    >
      <div className="flex items-center gap-3">
        {isGraphView && (
          <>
            <span className="text-[10.5px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {nodeCount} nodos · {edgeCount} aristas
            </span>
            <div className="w-px h-4" style={{ background: 'var(--border-subtle)', margin: '0 4px' }} />
            <div className="flex gap-2 items-center flex-wrap">
              {LEGEND_ITEMS.map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="size-[7px] rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-[9.5px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        {isGraphView && (
          <>
            <Button variant="ghost" size="icon-xs" onClick={onZoomIn} title="Acercar">
              <ZoomIn size={13} strokeWidth={1.5} />
            </Button>
            {zoomLevel != null && (
              <span className="text-[9px] font-mono text-center min-w-[28px]" style={{ color: 'var(--text-muted)' }}>
                {zoomLevel}%
              </span>
            )}
            <Button variant="ghost" size="icon-xs" onClick={onZoomOut} title="Alejar">
              <ZoomOut size={13} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={onReset} title="Resetear vista">
              <RotateCw size={13} strokeWidth={1.5} />
            </Button>
            <div className="w-px h-4" style={{ background: 'var(--border-subtle)', margin: '0 4px' }} />
          </>
        )}
        <Button variant="ghost" size="icon-xs" onClick={onToggleView} title={isGraphView ? 'Vista lista' : 'Vista gráfico'}>
          {isGraphView ? <List size={13} strokeWidth={1.5} /> : <Share2 size={13} strokeWidth={1.5} />}
        </Button>
        <span className="text-[10.5px] ml-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          {isGraphView ? 'Vista gráfico' : 'Vista lista'}
        </span>
      </div>
    </div>
  )
}
