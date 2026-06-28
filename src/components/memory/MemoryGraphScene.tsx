import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import type * as THREE from 'three'
import type { MemoryEntry, MemoryGraphNode, MemoryRelation } from '@/types'
import type { MemoryGraphHandle } from './MemoryGraph'
import { useMemoryStore } from '@/stores/memory.store'
import { computeGraphLayout } from '@/services/memory/graph-layout'
import { getGraphNodeColor, getEdgeColor } from '@/lib/graph-colors'

interface MemoryGraphSceneProps {
  onNodeSelect: (entry: MemoryEntry | null, graphNode: MemoryGraphNode | null) => void
  selectedNodeId: string | null
  relations: MemoryRelation[]
}

export const MemoryGraphScene = forwardRef<MemoryGraphHandle, MemoryGraphSceneProps>(
  function MemoryGraphScene({ onNodeSelect, relations }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const handlersRef = useRef({ onNodeSelect })
    handlersRef.current = { onNodeSelect }
    const thetaRef = useRef(0)
    const phiRef = useRef(Math.PI / 3)
    const radiusRef = useRef(20)

    useImperativeHandle(ref, () => ({
      resetCamera: () => {
        thetaRef.current = 0
        phiRef.current = Math.PI / 3
        radiusRef.current = 20
      },
    }), [])

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      let animId = 0
      let renderer: THREE.WebGLRenderer | null = null
      let scene: THREE.Scene | null = null
      let camera: THREE.PerspectiveCamera | null = null
      let spriteMap = new Map<string, THREE.Sprite>()
      let nodeGroup: THREE.Group | null = null

      import('three').then((THREE) => {
        if (!containerRef.current) return

        const width = container.clientWidth || 800
        const height = container.clientHeight || 600

        scene = new THREE.Scene()
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        camera.position.set(0, 10, 25)
        camera.lookAt(0, 0, 0)

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setClearColor(0x000000, 0)
        container.appendChild(renderer.domElement)

        const ambientLight = new THREE.AmbientLight(0x404060, 0.5)
        scene.add(ambientLight)
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
        dirLight.position.set(10, 20, 10)
        scene.add(dirLight)

        const entries = useMemoryStore.getState().entries
        const nodes: MemoryGraphNode[] = computeGraphLayout(entries)
        spriteMap = new Map()
        nodeGroup = new THREE.Group()

        for (const node of nodes) {
          const entry = entries.find((e) => e.id === node.memoryId)
          const source = entry?.source ?? 'auto'
          const color = getGraphNodeColor(source)

          const canvas = document.createElement('canvas')
          canvas.width = 64
          canvas.height = 64
          const ctx = canvas.getContext('2d')!
          ctx.clearRect(0, 0, 64, 64)
          ctx.beginPath()
          ctx.arc(32, 32, 26, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'
          ctx.lineWidth = 2
          ctx.stroke()
          const texture = new THREE.CanvasTexture(canvas)
          texture.needsUpdate = true
          const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
          const sprite = new THREE.Sprite(material)
          const pos = node.position ?? node
          sprite.position.set(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0)
          const nodeRadius = node.radius ?? 0.5
          const spriteScale = 0.8 + nodeRadius * 2.5
          sprite.scale.set(spriteScale, spriteScale, 1)
          sprite.userData = { entryId: node.memoryId }
          nodeGroup.add(sprite)
          spriteMap.set(node.memoryId, sprite)

          const labelCanvas = document.createElement('canvas')
          labelCanvas.width = 256
          labelCanvas.height = 48
          const lctx = labelCanvas.getContext('2d')!
          lctx.clearRect(0, 0, 256, 48)
          lctx.font = 'bold 18px sans-serif'
          lctx.fillStyle = 'rgba(255,255,255,0.85)'
          const rawLabel = entry?.content ?? ''
          const label = rawLabel.slice(0, 28) + (rawLabel.length > 28 ? '…' : '')
          lctx.fillText(label, 4, 32)
          const labelTexture = new THREE.CanvasTexture(labelCanvas)
          labelTexture.needsUpdate = true
          const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, transparent: true })
          const labelSprite = new THREE.Sprite(labelMaterial)
          labelSprite.position.set(pos.x ?? 0, (pos.y ?? 0) + spriteScale * 0.7, pos.z ?? 0)
          labelSprite.scale.set(3.2, 0.6, 1)
          labelSprite.userData = { isLabel: true }
          nodeGroup.add(labelSprite)
        }

        if (relations.length > 0) {
          const edgeGeometry = new THREE.BufferGeometry()
          const positions: number[] = []
          for (const rel of relations) {
            const fromSprite = spriteMap.get(rel.fromId)
            const toSprite = spriteMap.get(rel.toId)
            if (!fromSprite || !toSprite) continue
            const fp = fromSprite.position
            const tp = toSprite.position
            positions.push(fp.x, fp.y, fp.z, tp.x, tp.y, tp.z)
          }
          if (positions.length > 0) {
            edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
            const edgeMaterial = new THREE.LineBasicMaterial({
              color: getEdgeColor(),
              transparent: true,
              opacity: 0.25,
            })
            const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial)
            scene.add(edges)
          }
        }

        scene.add(nodeGroup)

        const raycaster = new THREE.Raycaster()
        const mouse = new THREE.Vector2()
        let isDragging = false
        let prevMouse = { x: 0, y: 0 }

        function onMouseDown(e: MouseEvent) {
          isDragging = true
          prevMouse = { x: e.clientX, y: e.clientY }
        }

        function onMouseMove(e: MouseEvent) {
          if (!isDragging || !camera) return
          const dx = e.clientX - prevMouse.x
          const dy = e.clientY - prevMouse.y
          thetaRef.current = thetaRef.current - dx * 0.005
          phiRef.current = Math.max(0.1, Math.min(Math.PI - 0.1, phiRef.current - dy * 0.005))
          prevMouse = { x: e.clientX, y: e.clientY }
          camera.position.x = radiusRef.current * Math.sin(phiRef.current) * Math.sin(thetaRef.current)
          camera.position.y = radiusRef.current * Math.cos(phiRef.current)
          camera.position.z = radiusRef.current * Math.sin(phiRef.current) * Math.cos(thetaRef.current)
          camera.lookAt(0, 0, 0)
        }

        function onMouseUp(e: MouseEvent) {
          if (isDragging || !camera) {
            isDragging = false
            return
          }
          if (!nodeGroup || !camera) return
          mouse.x = (e.clientX / width) * 2 - 1
          mouse.y = -(e.clientY / height) * 2 + 1
          raycaster.setFromCamera(mouse, camera)
          const intersects = raycaster.intersectObjects(nodeGroup.children.filter((c: { userData: { isLabel?: boolean } }) => !c.userData.isLabel))
          if (intersects.length > 0) {
            const hit = intersects[0].object
            const entryId = hit.userData.entryId
            const entry = entries.find((en) => en.id === entryId) ?? null
            const node = nodes.find((n) => n.memoryId === entryId) ?? null
            handlersRef.current.onNodeSelect(entry, node)
          }
        }

        function onWheel(e: WheelEvent) {
          radiusRef.current = Math.max(5, Math.min(50, radiusRef.current + e.deltaY * 0.02))
        }

        container.addEventListener('mousedown', onMouseDown)
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        container.addEventListener('wheel', onWheel)
        container.addEventListener('contextmenu', (e) => e.preventDefault())

        function animate() {
          animId = requestAnimationFrame(animate)
          if (renderer && scene && camera) renderer.render(scene, camera)
        }
        animate()
      })

      return () => {
        cancelAnimationFrame(animId)
        if (renderer?.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
        renderer?.dispose()
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
    )
  }
)
