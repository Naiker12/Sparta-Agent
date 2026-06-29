import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react'
import * as d3 from 'd3'
import type { MemoryEntry, MemoryGraphNode, MemoryRelation } from '@/types'
import type { MemoryGraphHandle } from './MemoryGraph'
import { useD3ForceLayout, type D3Node } from '@/hooks/useD3ForceLayout'
import { useMemoryStore } from '@/stores/memory.store'

interface Props {
  onNodeSelect: (entry: MemoryEntry | null, graphNode: MemoryGraphNode | null) => void
  onNodeHover?: (entry: MemoryEntry | null, x: number, y: number) => void
  onZoomChange?: (level: number) => void
  selectedNodeId: string | null
  relations: MemoryRelation[]
}

const EDGE_COLOR: Record<string, string> = {
  same_category: 'rgba(139, 92, 246, 0.35)',
  same_project: 'rgba(34, 197, 94, 0.35)',
  default: 'rgba(148, 163, 184, 0.2)',
}

let dashOffset = 0

export const MemoryGraphD3 = forwardRef<MemoryGraphHandle, Props>(
  function MemoryGraphD3(
    { onNodeSelect, onNodeHover, onZoomChange, selectedNodeId, relations },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })
    const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)
    const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
    const animFrameRef = useRef<number>(0)
    const handlersRef = useRef({ onNodeSelect, onNodeHover, onZoomChange })
    handlersRef.current = { onNodeSelect, onNodeHover, onZoomChange }

    const entries = useMemoryStore((s) => s.entries)

    const redraw = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      const transform = transformRef.current
      ctx.save()
      ctx.translate(transform.x, transform.y)
      ctx.scale(transform.k, transform.k)

      dashOffset = (dashOffset - 0.4) % 20
      const links = linksRef.current
      for (const link of links) {
        const src = link.source as D3Node
        const tgt = link.target as D3Node
        if (!src.x || !src.y || !tgt.x || !tgt.y) continue

        const edgeType = (link as { type?: string }).type ?? 'default'
        ctx.beginPath()
        ctx.moveTo(src.x, src.y)
        ctx.lineTo(tgt.x, tgt.y)
        ctx.strokeStyle = EDGE_COLOR[edgeType] ?? EDGE_COLOR.default
        ctx.lineWidth = 1 / transform.k
        ctx.setLineDash([6, 6])
        ctx.lineDashOffset = dashOffset
        ctx.stroke()
        ctx.setLineDash([])
      }

      const nodes = nodesRef.current
      for (const node of nodes) {
        if (node.x === undefined || node.y === undefined) continue
        const isSelected = node.id === selectedNodeId
        const r = node.radius

        if (isSelected) {
          ctx.beginPath()
          ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2)
          const glow = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r + 10)
          glow.addColorStop(0, 'rgba(251, 191, 36, 0.5)')
          glow.addColorStop(1, 'rgba(251, 191, 36, 0)')
          ctx.fillStyle = glow
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
        ctx.fillStyle = node.color
        ctx.globalAlpha = isSelected ? 1 : 0.85
        ctx.fill()
        ctx.globalAlpha = 1

        ctx.strokeStyle = isSelected ? '#fbbf24' : 'rgba(255,255,255,0.15)'
        ctx.lineWidth = isSelected ? 2 / transform.k : 1 / transform.k
        ctx.stroke()

        const screenRadius = r * transform.k
        if (screenRadius > 8 || transform.k > 0.8) {
          const label = node.entry.content.trim().split(/\s+/).slice(0, 3).join(' ')
          const fontSize = Math.max(9, Math.min(13, r * 1.1))
          ctx.font = `500 ${fontSize}px -apple-system, "Inter", sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'

          const textWidth = ctx.measureText(label).width
          const padX = 5
          const padY = 3
          const lx = node.x - textWidth / 2 - padX
          const ly = node.y + r + 4
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
          ctx.beginPath()
          ctx.roundRect(lx, ly, textWidth + padX * 2, fontSize + padY * 2, 4)
          ctx.fill()

          ctx.fillStyle = isSelected ? '#fbbf24' : 'rgba(255, 255, 255, 0.9)'
          ctx.fillText(label, node.x, ly + padY)
        }
      }

      ctx.restore()
    }, [selectedNodeId])

    const { nodesRef, linksRef, fixNode, releaseNode, reheat } = useD3ForceLayout({
      entries,
      relations,
      width: size.width,
      height: size.height,
      onTick: redraw,
    })

    useEffect(() => {
      let running = true
      function loop() {
        if (!running) return
        redraw()
        animFrameRef.current = requestAnimationFrame(loop)
      }
      animFrameRef.current = requestAnimationFrame(loop)
      return () => {
        running = false
        cancelAnimationFrame(animFrameRef.current)
      }
    }, [redraw])

    useEffect(() => {
      const container = containerRef.current
      if (!container) return
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          if (width > 0 && height > 0) {
            setSize({ width, height })
          }
        }
      })
      ro.observe(container)
      return () => ro.disconnect()
    }, [])

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas || size.width === 0) return

      const zoom = d3
        .zoom<HTMLCanvasElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          transformRef.current = event.transform
          handlersRef.current.onZoomChange?.(Math.round(event.transform.k * 100))
          redraw()
        })

      d3.select(canvas).call(zoom)
      zoomRef.current = zoom

      const initialTransform = d3.zoomIdentity.translate(size.width / 2, size.height / 2).scale(0.85)
      d3.select(canvas).call(zoom.transform, initialTransform)
      transformRef.current = initialTransform

      return () => {
        d3.select(canvas).on('.zoom', null)
      }
    }, [size, redraw])

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas || size.width === 0) return

      let draggingNode: D3Node | null = null
      let hasMoved = false
      let downPos = { x: 0, y: 0 }

      function getNodeAtPoint(clientX: number, clientY: number): D3Node | null {
        const rect = canvas!.getBoundingClientRect()
        const sx = clientX - rect.left
        const sy = clientY - rect.top
        const t = transformRef.current
        const wx = (sx - t.x) / t.k
        const wy = (sy - t.y) / t.k

        let closest: D3Node | null = null
        let minDist = Infinity
        for (const node of nodesRef.current) {
          if (node.x === undefined || node.y === undefined) continue
          const dx = wx - node.x
          const dy = wy - node.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < node.radius + 4 && dist < minDist) {
            minDist = dist
            closest = node
          }
        }
        return closest
      }

      function onMouseDown(e: MouseEvent) {
        downPos = { x: e.clientX, y: e.clientY }
        hasMoved = false
        const hit = getNodeAtPoint(e.clientX, e.clientY)
        if (hit) {
          draggingNode = hit
          fixNode(hit.id, hit.x ?? 0, hit.y ?? 0)
          d3.select(canvas!).on('.zoom', null)
          e.stopPropagation()
        }
      }

      function onMouseMove(e: MouseEvent) {
        const dx = e.clientX - downPos.x
        const dy = e.clientY - downPos.y
        if (Math.sqrt(dx * dx + dy * dy) > 3) hasMoved = true

        if (draggingNode) {
          const rect = canvas!.getBoundingClientRect()
          const t = transformRef.current
          const wx = (e.clientX - rect.left - t.x) / t.k
          const wy = (e.clientY - rect.top - t.y) / t.k
          fixNode(draggingNode.id, wx, wy)
          reheat()
          return
        }

        const hit = getNodeAtPoint(e.clientX, e.clientY)
        canvas!.style.cursor = hit ? 'pointer' : 'grab'
        if (hit) {
          const rect = canvas!.getBoundingClientRect()
          handlersRef.current.onNodeHover?.(hit.entry, e.clientX - rect.left, e.clientY - rect.top)
        } else {
          handlersRef.current.onNodeHover?.(null, 0, 0)
        }
      }

      function onMouseUp(e: MouseEvent) {
        if (draggingNode) {
          releaseNode(draggingNode.id)
          d3.select(canvas!).call(zoomRef.current!)
          draggingNode = null
        }

        if (!hasMoved) {
          const hit = getNodeAtPoint(e.clientX, e.clientY)
          if (hit) {
            const graphNode: MemoryGraphNode = {
              memoryId: hit.id,
              position: { x: hit.x ?? 0, y: hit.y ?? 0, z: 0 },
              radius: hit.radius,
              color: hit.color,
            }
            handlersRef.current.onNodeSelect(hit.entry, graphNode)
          } else {
            handlersRef.current.onNodeSelect(null, null)
          }
        }
      }

      canvas.addEventListener('mousedown', onMouseDown)
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      return () => {
        canvas.removeEventListener('mousedown', onMouseDown)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }
    }, [size, fixNode, releaseNode, reheat, nodesRef])

    useImperativeHandle(ref, () => ({
      resetCamera: () => {
        const canvas = canvasRef.current
        if (!canvas || !zoomRef.current) return
        const t = d3.zoomIdentity.translate(size.width / 2, size.height / 2).scale(0.85)
        d3.select(canvas).call(zoomRef.current.transform, t)
        handlersRef.current.onZoomChange?.(85)
      },
      zoomIn: () => {
        const canvas = canvasRef.current
        if (!canvas || !zoomRef.current) return
        d3.select(canvas).call(zoomRef.current.scaleBy, 1.3)
      },
      zoomOut: () => {
        const canvas = canvasRef.current
        if (!canvas || !zoomRef.current) return
        d3.select(canvas).call(zoomRef.current.scaleBy, 1 / 1.3)
      },
      focusNode: (id: string) => {
        const node = nodesRef.current.find((n) => n.id === id)
        const canvas = canvasRef.current
        if (!node || !canvas || !zoomRef.current || node.x === undefined) return
        const t = d3.zoomIdentity
          .translate(size.width / 2 - node.x * 1.5, size.height / 2 - (node.y ?? 0) * 1.5)
          .scale(1.5)
        d3.select(canvas).call(zoomRef.current.transform, t)
        handlersRef.current.onZoomChange?.(150)
      },
      getZoomLevel: () => Math.round(transformRef.current.k * 100),
    }), [size, nodesRef])

    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', overflow: 'hidden', cursor: 'grab' }}
      >
        {size.width > 0 && (
          <canvas
            ref={canvasRef}
            width={size.width}
            height={size.height}
            style={{ display: 'block' }}
          />
        )}
      </div>
    )
  },
)
