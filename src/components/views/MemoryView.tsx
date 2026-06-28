import { useState, useRef } from 'react'
import { Brain, ChevronLeft, Network, List } from 'lucide-react'
import { useMemoryStore } from '@/stores/memory.store'
import { useUIStore } from '@/stores/ui.store'
import { Button } from '@/components/ui/button'
import { computeGraphLayout, computeRelations } from '@/lib/graph-layout'
import { MemoryGraph, type MemoryGraphHandle } from '@/components/memory/MemoryGraph'
import { MemoryGraphControls } from '@/components/memory/MemoryGraphControls'
import { MemoryListView } from '@/components/memory/MemoryListView'
import { MemoryNodePanel } from '@/components/memory/MemoryNodePanel'
import type { MemoryEntry, MemoryGraphNode } from '@/types'

export function MemoryView() {
  const { entries } = useMemoryStore()
  const { goBack } = useUIStore()
  const [graphView, setGraphView] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<MemoryEntry | null>(null)
  const [selectedGraphNode, setSelectedGraphNode] = useState<MemoryGraphNode | null>(null)
  const graphRef = useRef<MemoryGraphHandle>(null)

  const nodes = graphView
    ? (entries.length > 0 ? computeGraphLayout(entries) : [])
    : []
  const relations = graphView ? computeRelations(entries, []) : []

  function handleNodeSelect(entry: MemoryEntry | null, graphNode: MemoryGraphNode | null) {
    if (entry && graphNode) {
      setSelectedEntry(entry)
      setSelectedGraphNode(graphNode)
    } else {
      setSelectedEntry(null)
      setSelectedGraphNode(null)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            style={{
              gap: 4,
              color: 'var(--text-secondary)',
            }}
          >
            <ChevronLeft className="w-4 h-4" />
            Volver
          </Button>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Brain size={16} style={{ color: 'var(--accent)' }} />
              Memoria
            </span>
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
            {entries.length} recuerdos
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGraphView((v) => !v)}
            style={{ gap: 4 }}
          >
            {graphView ? <List className="w-4 h-4" /> : <Network className="w-4 h-4" />}
            {graphView ? 'Vista lista' : 'Vista gráfico'}
          </Button>
        </div>
      </div>

      <MemoryGraphControls
        onZoomIn={() => graphRef.current?.resetCamera()}
        onZoomOut={() => graphRef.current?.resetCamera()}
        onReset={() => graphRef.current?.resetCamera()}
        onToggleView={() => setGraphView((v) => !v)}
        isGraphView={graphView}
        nodeCount={nodes.length}
        edgeCount={relations.length}
      />

      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        {entries.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: 40,
          }}>
            <Brain size={32} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
            <p style={{
              fontSize: 13, color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)', textAlign: 'center', lineHeight: 1.6,
            }}>
              Aún no hay recuerdos.
              <br />
              Empieza a chatear con los proveedores de IA
              y el sistema extraerá automáticamente entidades,
              hechos y relaciones en este grafo.
            </p>
          </div>
        ) : graphView ? (
          <MemoryGraph
            ref={graphRef}
            onNodeSelect={handleNodeSelect}
            selectedNodeId={selectedEntry?.id || null}
            relations={relations}
          />
        ) : (
          <MemoryListView />
        )}

        {graphView && selectedEntry && selectedGraphNode && (
          <MemoryNodePanel
            entry={selectedEntry}
            graphNode={selectedGraphNode}
            onClose={() => {
              setSelectedEntry(null)
              setSelectedGraphNode(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
