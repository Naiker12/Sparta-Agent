import { lazy, Suspense, forwardRef } from 'react'
import type { MemoryEntry, MemoryGraphNode } from '@/types'

export interface MemoryGraphHandle {
  resetCamera: () => void
}

interface MemoryGraphProps {
  onNodeSelect: (entry: MemoryEntry | null, graphNode: MemoryGraphNode | null) => void
  selectedNodeId: string | null
}

const MemoryGraphScene = lazy(() =>
  import('./MemoryGraphScene').then((m) => ({ default: m.MemoryGraphScene }))
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
      Cargando grafo 3D...
    </div>
  )
}

export const MemoryGraph = forwardRef<MemoryGraphHandle, MemoryGraphProps>(
  function MemoryGraph(props, ref) {
    return (
      <Suspense fallback={<Skeleton />}>
        <MemoryGraphScene {...props} ref={ref} />
      </Suspense>
    )
  }
)
