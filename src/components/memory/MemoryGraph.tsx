import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import * as THREE from 'three'
import { useMemoryStore } from '@/stores/memory.store'
import { computeGraphLayout, computeRelations } from '@/lib/graph-layout'
import { getGraphNodeColor, getEdgeColor } from '@/lib/graph-colors'
import type { MemoryEntry, MemoryGraphNode } from '@/types'

export interface MemoryGraphHandle {
  resetCamera: () => void
}

interface MemoryGraphProps {
  onNodeSelect: (entry: MemoryEntry | null, graphNode: MemoryGraphNode | null) => void
  selectedNodeId: string | null
}

export const MemoryGraph = forwardRef<MemoryGraphHandle, MemoryGraphProps>(
  function MemoryGraph({ onNodeSelect, selectedNodeId }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const spriteMapRef = useRef<Map<string, THREE.Sprite>>(new Map())
    const lineRef = useRef<THREE.LineSegments | null>(null)
    const animFrameRef = useRef<number>(0)

    const thetaRef = useRef(0)
    const phiRef = useRef(Math.PI / 3)
    const radiusRef = useRef(20)
    const targetTheta = useRef(0)
    const targetPhi = useRef(Math.PI / 3)
    const targetRadius = useRef(20)
    const isDragging = useRef(false)
    const lastX = useRef(0)
    const lastY = useRef(0)
    const idleSpeed = useRef(0.002)

    useImperativeHandle(ref, () => ({
      resetCamera() {
        targetTheta.current = 0
        targetPhi.current = Math.PI / 3
        targetRadius.current = 20
        idleSpeed.current = 0.002
      },
    }))

    const createNodeTexture = useCallback((color: string, radius: number): THREE.CanvasTexture => {
      const size = 64
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      const center = size / 2
      const r = (size / 2) * Math.min(1, radius * 1.2)
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, r)
      gradient.addColorStop(0, color)
      gradient.addColorStop(0.6, color)
      gradient.addColorStop(1, color + '00')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(center, center, r, 0, Math.PI * 2)
      ctx.fill()
      return new THREE.CanvasTexture(canvas)
    }, [])

    const buildGraph = useCallback(() => {
      const entries = useMemoryStore.getState().entries
      const nodes = computeGraphLayout(entries)
      const relations = computeRelations(entries)
      const scene = sceneRef.current
      if (!scene) return

      const oldSprites = spriteMapRef.current
      oldSprites.forEach((s) => scene.remove(s))
      oldSprites.clear()

      if (lineRef.current) {
        scene.remove(lineRef.current)
        lineRef.current.geometry.dispose()
        ;(lineRef.current.material as THREE.Material).dispose()
        lineRef.current = null
      }

      const spriteMap = new Map<string, THREE.Sprite>()
      for (const node of nodes) {
        const entry = entries.find((e) => e.id === node.memoryId)
        if (!entry) continue
        const color = node.color === 'accent' ? getGraphNodeColor('auto') : getGraphNodeColor('manual')
        const texture = createNodeTexture(color, node.radius)
        const material = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          sizeAttenuation: true,
        })
        const sprite = new THREE.Sprite(material)
        sprite.position.set(node.position.x, node.position.y, node.position.z)
        sprite.scale.set(node.radius * 2, node.radius * 2, 1)
        sprite.userData.memoryId = node.memoryId
        scene.add(sprite)
        spriteMap.set(node.memoryId, sprite)
      }
      spriteMapRef.current = spriteMap

      if (relations.length > 0) {
        const positions: number[] = []
        for (const rel of relations) {
          const fromNode = nodes.find((n) => n.memoryId === rel.fromId)
          const toNode = nodes.find((n) => n.memoryId === rel.toId)
          if (!fromNode || !toNode) continue
          positions.push(fromNode.position.x, fromNode.position.y, fromNode.position.z)
          positions.push(toNode.position.x, toNode.position.y, toNode.position.z)
        }
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        const material = new THREE.LineBasicMaterial({
          color: getEdgeColor(),
          transparent: true,
          opacity: 0.25,
        })
        const lines = new THREE.LineSegments(geometry, material)
        scene.add(lines)
        lineRef.current = lines
      }
    }, [createNodeTexture])

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const w = container.clientWidth
      const h = container.clientHeight

      const scene = new THREE.Scene()
      sceneRef.current = scene

      const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200)
      cameraRef.current = camera

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      })
      renderer.setSize(w, h)
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
      renderer.setClearColor(0x000000, 0)
      container.appendChild(renderer.domElement)
      rendererRef.current = renderer

      buildGraph()

      function animate() {
        thetaRef.current += (targetTheta.current - thetaRef.current) * 0.08
        phiRef.current += (targetPhi.current - phiRef.current) * 0.08
        radiusRef.current += (targetRadius.current - radiusRef.current) * 0.08

        targetTheta.current += idleSpeed.current

        camera.position.x = radiusRef.current * Math.sin(phiRef.current) * Math.cos(thetaRef.current)
        camera.position.y = radiusRef.current * Math.cos(phiRef.current)
        camera.position.z = radiusRef.current * Math.sin(phiRef.current) * Math.sin(thetaRef.current)
        camera.lookAt(0, 0, 0)

        renderer.render(scene, camera)
        animFrameRef.current = requestAnimationFrame(animate)
      }
      animate()

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { clientWidth, clientHeight } = entry.target
          if (clientWidth === 0 || clientHeight === 0) continue
          camera.aspect = clientWidth / clientHeight
          camera.updateProjectionMatrix()
          renderer.setSize(clientWidth, clientHeight)
        }
      })
      resizeObserver.observe(container)

      return () => {
        cancelAnimationFrame(animFrameRef.current)
        resizeObserver.disconnect()
        renderer.dispose()
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
      }
    }, [buildGraph])

    useEffect(() => {
      if (!selectedNodeId) return
      const sprite = spriteMapRef.current.get(selectedNodeId)
      if (!sprite) return
      const nodePos = sprite.position.clone()
      const camera = cameraRef.current
      if (!camera) return
      const dir = nodePos.clone().sub(camera.position).normalize()
      const distance = nodePos.distanceTo(camera.position) * 0.6
      const newPos = camera.position.clone().add(dir.multiplyScalar(distance))
      thetaRef.current = Math.atan2(newPos.z, newPos.x)
      phiRef.current = Math.acos(newPos.y / newPos.length())
      radiusRef.current = newPos.length()
      targetTheta.current = thetaRef.current
      targetPhi.current = phiRef.current
      targetRadius.current = radiusRef.current
      idleSpeed.current = 0
    }, [selectedNodeId])

    useEffect(() => {
      const unsub = useMemoryStore.subscribe(() => {
        buildGraph()
      })
      return () => unsub()
    }, [buildGraph])

    function getNodeAtScreen(x: number, y: number): MemoryEntry | null {
      const camera = cameraRef.current
      const renderer = rendererRef.current
      if (!camera || !renderer) return null

      const rect = renderer.domElement.getBoundingClientRect()
      const px = ((x - rect.left) / rect.width) * 2 - 1
      const py = -((y - rect.top) / rect.height) * 2 + 1

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(px, py), camera)

      const sprites = Array.from(spriteMapRef.current.values())
      const intersects = raycaster.intersectObjects(sprites)
      if (intersects.length === 0) return null

      const hit = intersects[0].object as THREE.Sprite
      const memoryId = hit.userData.memoryId as string
      if (!memoryId) return null
      const entries = useMemoryStore.getState().entries
      return entries.find((e) => e.id === memoryId) || null
    }

    useEffect(() => {
      const renderer = rendererRef.current
      if (!renderer) return

      function onPointerDown(e: PointerEvent) {
        isDragging.current = true
        lastX.current = e.clientX
        lastY.current = e.clientY
        idleSpeed.current = 0
      }

      function onPointerMove(e: PointerEvent) {
        if (!isDragging.current) return
        const dx = e.clientX - lastX.current
        const dy = e.clientY - lastY.current
        targetTheta.current -= dx * 0.008
        targetPhi.current = Math.max(0.1, Math.min(Math.PI - 0.1, targetPhi.current + dy * 0.008))
        lastX.current = e.clientX
        lastY.current = e.clientY
      }

      function onPointerUp(e: PointerEvent) {
        if (!isDragging.current) return
        isDragging.current = false
        const dx = Math.abs(e.clientX - lastX.current)
        const dy = Math.abs(e.clientY - lastY.current)
        if (dx < 4 && dy < 4) {
          const entry = getNodeAtScreen(e.clientX, e.clientY)
          const entries = useMemoryStore.getState().entries
          const nodes = computeGraphLayout(entries)
          if (entry) {
            const gn = nodes.find((n) => n.memoryId === entry.id)
            if (gn) onNodeSelect(entry, gn)
          } else {
            onNodeSelect(null, null)
          }
        }
        setTimeout(() => { idleSpeed.current = 0.002 }, 3000)
      }

      function onWheel(e: WheelEvent) {
        e.preventDefault()
        targetRadius.current = Math.max(5, Math.min(60, targetRadius.current + e.deltaY * 0.02))
        idleSpeed.current = 0
        setTimeout(() => { idleSpeed.current = 0.002 }, 3000)
      }

      renderer.domElement.addEventListener('pointerdown', onPointerDown)
      renderer.domElement.addEventListener('pointermove', onPointerMove)
      renderer.domElement.addEventListener('pointerup', onPointerUp)
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

      return () => {
        renderer.domElement.removeEventListener('pointerdown', onPointerDown)
        renderer.domElement.removeEventListener('pointermove', onPointerMove)
        renderer.domElement.removeEventListener('pointerup', onPointerUp)
        renderer.domElement.removeEventListener('wheel', onWheel)
      }
    }, [onNodeSelect])

    return (
      <div
        ref={containerRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isDragging.current ? 'grabbing' : 'grab' }}
      />
    )
  }
)
