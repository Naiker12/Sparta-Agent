import { useState, useRef, useCallback, useMemo } from 'react'
import { Brain, ChevronLeft } from 'lucide-react'
import { useMemoryStore } from '@/stores/memory.store'
import { useUIStore } from '@/stores/ui.store'
import { Button } from '@/components/ui/button'
import { computeRelations } from '@/lib/graph-layout'
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
  const [hoveredEntry, setHoveredEntry] = useState<MemoryEntry | null>(null)
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 })
  const [zoomLevel, setZoomLevel] = useState(20)
  const graphRef = useRef<MemoryGraphHandle>(null)

  const relations = useMemo(
    () => (graphView ? computeRelations(entries, []) : []),
    [graphView, entries]
  )

  function handleNodeSelect(entry: MemoryEntry | null, graphNode: MemoryGraphNode | null) {
    if (entry && graphNode) {
      setSelectedEntry(entry)
      setSelectedGraphNode(graphNode)
    } else {
      setSelectedEntry(null)
      setSelectedGraphNode(null)
    }
  }

  const handleNodeHover = useCallback((entry: MemoryEntry | null, x: number, y: number) => {
    setHoveredEntry(entry)
    if (entry) setHoveredPos({ x, y })
  }, [])

  const handleZoomChange = useCallback((level: number) => {
    setZoomLevel(level)
  }, [])

  function handleListEntryClick(entry: MemoryEntry) {
    setSelectedEntry(entry)
    setSelectedGraphNode(null)
    setGraphView(true)
    setTimeout(() => {
      graphRef.current?.focusNode(entry.id)
    }, 100)
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

        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          {entries.length} recuerdos
        </span>
      </div>

      <MemoryGraphControls
        onZoomIn={() => graphRef.current?.zoomIn()}
        onZoomOut={() => graphRef.current?.zoomOut()}
        onReset={() => graphRef.current?.resetCamera()}
        onToggleView={() => setGraphView((v) => !v)}
        isGraphView={graphView}
        nodeCount={entries.length}
        edgeCount={relations.length}
        zoomLevel={zoomLevel}
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
            onNodeHover={handleNodeHover}
            onZoomChange={handleZoomChange}
            selectedNodeId={selectedEntry?.id || null}
            relations={relations}
          />
        ) : (
          <MemoryListView onEntryClick={handleListEntryClick} />
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

        {graphView && hoveredEntry && (
          <div style={{
            position: 'absolute',
            left: hoveredPos.x + 12,
            top: hoveredPos.y - 8,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-normal)',
            borderRadius: 'var(--radius-md)',
            padding: '5px 10px',
            fontSize: 11.5,
            fontFamily: 'var(--font-ui)',
            color: 'var(--text-primary)',
            maxWidth: 220,
            pointerEvents: 'none',
            zIndex: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 2, color: 'var(--text-primary)' }}>
              {hoveredEntry.content.split(' ').slice(0, 5).join(' ')}...
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {hoveredEntry.category ?? 'general'} · {hoveredEntry.source === 'auto' ? 'Aprendido' : 'Manual'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
