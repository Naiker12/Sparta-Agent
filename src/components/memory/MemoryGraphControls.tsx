import { ZoomIn, ZoomOut, RotateCw, List, Share2 } from 'lucide-react'

interface MemoryGraphControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onToggleView: () => void
  isGraphView: boolean
  nodeCount: number
  edgeCount: number
}

export function MemoryGraphControls({
  onZoomIn, onZoomOut, onReset, onToggleView,
  isGraphView, nodeCount, edgeCount,
}: MemoryGraphControlsProps) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-base)', flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isGraphView && (
          <>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {nodeCount} nodos · {edgeCount} aristas
            </span>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {isGraphView && (
          <>
            <ControlButton onClick={onZoomIn} title="Acercar">
              <ZoomIn size={13} strokeWidth={1.5} />
            </ControlButton>
            <ControlButton onClick={onZoomOut} title="Alejar">
              <ZoomOut size={13} strokeWidth={1.5} />
            </ControlButton>
            <ControlButton onClick={onReset} title="Resetear vista">
              <RotateCw size={13} strokeWidth={1.5} />
            </ControlButton>
            <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 4px' }} />
          </>
        )}
        <ControlButton onClick={onToggleView} title={isGraphView ? 'Vista lista' : 'Vista gráfico'}>
          {isGraphView ? <List size={13} strokeWidth={1.5} /> : <Share2 size={13} strokeWidth={1.5} />}
        </ControlButton>
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginLeft: 4 }}>
          {isGraphView ? 'Vista gráfico' : 'Vista lista'}
        </span>
      </div>
    </div>
  )
}

function ControlButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
        color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}
    >
      {children}
    </button>
  )
}
