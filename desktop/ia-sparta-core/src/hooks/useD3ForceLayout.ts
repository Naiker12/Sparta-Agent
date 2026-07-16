import { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import type { MemoryEntry, MemoryRelation } from '../types'
import { getGraphNodeColor } from '../lib/graph-colors'

export interface D3Node extends d3.SimulationNodeDatum {
  id: string
  entry: MemoryEntry
  radius: number
  color: string
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node
  target: string | D3Node
  type: string
}

interface UseD3ForceLayoutOptions {
  entries: MemoryEntry[]
  relations: MemoryRelation[]
  width: number
  height: number
  onTick: () => void
}

export function useD3ForceLayout({
  entries,
  relations,
  width,
  height,
  onTick,
}: UseD3ForceLayoutOptions) {
  const nodesRef = useRef<D3Node[]>([])
  const linksRef = useRef<D3Link[]>([])
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null)
  const onTickRef = useRef(onTick)
  onTickRef.current = onTick

  const buildNodes = useCallback((newEntries: MemoryEntry[]): D3Node[] => {
    const existing = new Map(nodesRef.current.map((n) => [n.id, n]))
    return newEntries.map((entry) => {
      const prev = existing.get(entry.id)
      return {
        id: entry.id,
        entry,
        radius: Math.max(6, Math.min(18, 6 + entry.content.length / 80)),
        color: getGraphNodeColor(entry.source, entry.category),
        x: prev?.x ?? width / 2 + (Math.random() - 0.5) * 100,
        y: prev?.y ?? height / 2 + (Math.random() - 0.5) * 100,
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
      } as D3Node
    })
  }, [width, height])

  const buildLinks = useCallback((rels: MemoryRelation[], nodes: D3Node[]): D3Link[] => {
    const nodeIds = new Set(nodes.map((n) => n.id))
    return rels
      .filter((r) => nodeIds.has(r.fromId) && nodeIds.has(r.toId))
      .map((r) => ({
        source: r.fromId,
        target: r.toId,
        type: r.type,
      }))
  }, [])

  useEffect(() => {
    if (width === 0 || height === 0) return

    const nodes = buildNodes(entries)
    const links = buildLinks(relations, nodes)
    nodesRef.current = nodes
    linksRef.current = links

    simulationRef.current?.stop()

    const simulation = d3
      .forceSimulation<D3Node>(nodes)
      .force(
        'link',
        d3
          .forceLink<D3Node, D3Link>(links)
          .id((d) => d.id)
          .distance(80)
          .strength(0.3),
      )
      .force('charge', d3.forceManyBody<D3Node>().strength(-180).distanceMax(400))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.08))
      .force('collision', d3.forceCollide<D3Node>().radius((d) => d.radius + 8).strength(0.7))
      .force('x', d3.forceX(width / 2).strength(0.03))
      .force('y', d3.forceY(height / 2).strength(0.03))
      .alphaDecay(0.025)
      .velocityDecay(0.4)
      .on('tick', () => onTickRef.current())

    simulationRef.current = simulation

    return () => {
      simulation.stop()
    }
  }, [entries, relations, width, height, buildNodes, buildLinks])

  const reheat = useCallback(() => {
    simulationRef.current?.alpha(0.3).restart()
  }, [])

  const fixNode = useCallback((id: string, x: number, y: number) => {
    const node = nodesRef.current.find((n) => n.id === id)
    if (node) { node.fx = x; node.fy = y }
  }, [])

  const releaseNode = useCallback((id: string) => {
    const node = nodesRef.current.find((n) => n.id === id)
    if (node) { node.fx = null; node.fy = null }
  }, [])

  return {
    nodesRef,
    linksRef,
    simulationRef,
    reheat,
    fixNode,
    releaseNode,
  }
}
