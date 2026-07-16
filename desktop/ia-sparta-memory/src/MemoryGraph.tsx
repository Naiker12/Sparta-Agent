import { lazy, Suspense, forwardRef } from 'react'
import type { MemoryEntry, MemoryGraphNode, MemoryRelation } from 'ia-sparta-core'

export interface MemoryGraphHandle {
  resetCamera: () => void
  zoomIn: () => void
  zoomOut: () => void
  focusNode: (id: string) => void
  getZoomLevel: () => number
}

interface MemoryGraphProps {
  onNodeSelect: (entry: MemoryEntry | null, graphNode: MemoryGraphNode | null) => void
  onNodeHover?: (entry: MemoryEntry | null, x: number, y: number) => void
  onZoomChange?: (level: number) => void
  selectedNodeId: string | null
  relations: MemoryRelation[]
}

const MemoryGraphD3 = lazy(() =>
  import('./MemoryGraphD3').then((m) => ({ default: m.MemoryGraphD3 }))
)

function Skeleton() {
  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-elevated)',
        color: 'var(--text-muted)',
        fontSize: 12,
        fontFamily: 'var(--font-ui)',
      }}
    >
      Cargando grafo...
    </div>
  )
}

export const MemoryGraph = forwardRef<MemoryGraphHandle, MemoryGraphProps>(
  function MemoryGraph(props, ref) {
    return (
      <Suspense fallback={<Skeleton />}>
        <MemoryGraphD3 {...props} ref={ref} />
      </Suspense>
    )
  }
)
