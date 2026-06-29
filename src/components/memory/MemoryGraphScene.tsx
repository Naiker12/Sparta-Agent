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
  function MemoryGraphScene({ onNodeSelect, selectedNodeId, relations }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const handlersRef = useRef({ onNodeSelect })
    handlersRef.current = { onNodeSelect }
    const relationsRef = useRef(relations)
    relationsRef.current = relations
    const thetaRef = useRef(0)
    const phiRef = useRef(Math.PI / 3)
    const radiusRef = useRef(20)

    const sceneRef = useRef<THREE.Scene | null>(null)
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const nodeGroupRef = useRef<THREE.Group | null>(null)
    const spriteMapRef = useRef<Map<string, THREE.Sprite>>(new Map())
    const labelMapRef = useRef<Map<string, THREE.Sprite>>(new Map())
    const edgeGroupRef = useRef<THREE.Group | null>(null)
    const hoveredIdRef = useRef<string | null>(null)
    const THREERef = useRef<typeof import('three') | null>(null)

    useImperativeHandle(ref, () => ({
      resetCamera: () => {
        thetaRef.current = 0
        phiRef.current = Math.PI / 3
        radiusRef.current = 20
        updateCameraFromOrbit()
      },
    }), [])

    function updateCameraFromOrbit() {
      const camera = cameraRef.current
      if (!camera) return
      camera.position.x = radiusRef.current * Math.sin(phiRef.current) * Math.sin(thetaRef.current)
      camera.position.y = radiusRef.current * Math.cos(phiRef.current)
      camera.position.z = radiusRef.current * Math.sin(phiRef.current) * Math.cos(thetaRef.current)
      camera.lookAt(0, 0, 0)
    }

    function buildScene(THREE: typeof import('three'), container: HTMLDivElement) {
      THREERef.current = THREE
      const width = container.clientWidth || 800
      const height = container.clientHeight || 600

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 10, 25)
      camera.lookAt(0, 0, 0)

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x000000, 0)
      container.appendChild(renderer.domElement)

      const ambientLight = new THREE.AmbientLight(0x404060, 0.5)
      scene.add(ambientLight)
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
      dirLight.position.set(10, 20, 10)
      scene.add(dirLight)

      sceneRef.current = scene
      cameraRef.current = camera
      rendererRef.current = renderer

      populateScene(THREE, scene)
    }

    function populateScene(THREE: typeof import('three'), scene: THREE.Scene) {
      const entries = useMemoryStore.getState().entries
      const nodes: MemoryGraphNode[] = computeGraphLayout(entries)
      const spriteMap = new Map<string, THREE.Sprite>()
      const labelMap = new Map<string, THREE.Sprite>()
      const nodeGroup = new THREE.Group()

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
        const spriteScale = Math.min(0.5 + Math.sqrt(nodeRadius) * 0.9, 2.2)
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
        labelSprite.position.set(pos.x ?? 0, (pos.y ?? 0) + spriteScale * 0.7 + 0.4, pos.z ?? 0)
        labelSprite.scale.set(3.2, 0.6, 1)
        labelSprite.userData = { isLabel: true, entryId: node.memoryId }
        labelSprite.visible = false
        nodeGroup.add(labelSprite)
        labelMap.set(node.memoryId, labelSprite)
      }

      const edgeGroup = new THREE.Group()
      const currentRelations = relationsRef.current
      if (currentRelations.length > 0) {
        const edgeGeometry = new THREE.BufferGeometry()
        const positions: number[] = []
        for (const rel of currentRelations) {
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
          const segments = new THREE.LineSegments(edgeGeometry, edgeMaterial)
          edgeGroup.add(segments)
        }
      }

      scene.add(nodeGroup)
      scene.add(edgeGroup)

      nodeGroupRef.current = nodeGroup
      edgeGroupRef.current = edgeGroup
      spriteMapRef.current = spriteMap
      labelMapRef.current = labelMap

      applySelection()
    }

    function applySelection() {
      const spriteMap = spriteMapRef.current
      const THREE = THREERef.current
      for (const [id, sprite] of spriteMap) {
        if (!sprite.userData.baseScale) {
          sprite.userData.baseScale = sprite.scale.x
        }
        const base = sprite.userData.baseScale as number
        if (selectedNodeId && id === selectedNodeId) {
          sprite.scale.set(base * 1.25, base * 1.25, 1)
          if (sprite.material && THREE) {
            const mat = sprite.material as THREE.SpriteMaterial
            mat.color?.set('#ffcc00')
          }
        } else {
          sprite.scale.set(base, base, 1)
          if (sprite.material && THREE) {
            const mat = sprite.material as THREE.SpriteMaterial
            mat.color?.set('#ffffff')
          }
        }
      }
    }

    function onNodeHover(entryId: string | null) {
      const labelMap = labelMapRef.current
      for (const [id, labelSprite] of labelMap) {
        labelSprite.visible = id === entryId
      }
      hoveredIdRef.current = entryId
    }

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      let animId = 0
      let cancelled = false

      import('three').then((THREE) => {
        if (cancelled || !containerRef.current) return
        const ctr = containerRef.current

        buildScene(THREE, ctr)

        const camera = cameraRef.current!
        const renderer = rendererRef.current!
        const scene = sceneRef.current!
        const nodeGroup = nodeGroupRef.current!
        const raycaster = new THREE.Raycaster()
        const mouse = new THREE.Vector2()
        let isDragging = false
        let prevMouse = { x: 0, y: 0 }

        function onMouseDown(e: MouseEvent) {
          isDragging = true
          prevMouse = { x: e.clientX, y: e.clientY }
        }

        function onMouseMove(e: MouseEvent) {
          if (!camera) return
          if (isDragging) {
            const dx = e.clientX - prevMouse.x
            const dy = e.clientY - prevMouse.y
            thetaRef.current = thetaRef.current - dx * 0.005
            phiRef.current = Math.max(0.1, Math.min(Math.PI - 0.1, phiRef.current - dy * 0.005))
            prevMouse = { x: e.clientX, y: e.clientY }
            updateCameraFromOrbit()
          } else if (nodeGroup) {
            const rect = ctr.getBoundingClientRect()
            mouse.x = ((e.clientX - rect.left) / ctr.clientWidth) * 2 - 1
            mouse.y = -((e.clientY - rect.top) / ctr.clientHeight) * 2 + 1
            raycaster.setFromCamera(mouse, camera)
            const sprites = nodeGroup.children.filter((c) => !c.userData.isLabel)
            const intersects = raycaster.intersectObjects(sprites)
            if (intersects.length > 0) {
              const hit = intersects[0].object
              const entryId = hit.userData.entryId as string
              ctr.style.cursor = 'pointer'
              onNodeHover(entryId)
            } else {
              ctr.style.cursor = 'grab'
              onNodeHover(null)
            }
          }
        }

        function onMouseUp(e: MouseEvent) {
          if (isDragging || !camera) {
            isDragging = false
            return
          }
          if (!nodeGroup || !camera) return
          const rect = ctr.getBoundingClientRect()
          mouse.x = ((e.clientX - rect.left) / ctr.clientWidth) * 2 - 1
          mouse.y = -((e.clientY - rect.top) / ctr.clientHeight) * 2 + 1
          raycaster.setFromCamera(mouse, camera)
          const sprites = nodeGroup.children.filter((c) => !c.userData.isLabel)
          const intersects = raycaster.intersectObjects(sprites)
          if (intersects.length > 0) {
            const hit = intersects[0].object
            const entryId = hit.userData.entryId as string
            const entries = useMemoryStore.getState().entries
            const allNodes = computeGraphLayout(entries)
            const entry = entries.find((en) => en.id === entryId) ?? null
            const node = allNodes.find((n) => n.memoryId === entryId) ?? null
            handlersRef.current.onNodeSelect(entry, node)
          }
        }

        function onWheel(e: WheelEvent) {
          e.preventDefault()
          radiusRef.current = Math.max(3, Math.min(60, radiusRef.current + e.deltaY * 0.02))
          updateCameraFromOrbit()
        }

        ctr.addEventListener('mousedown', onMouseDown)
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        ctr.addEventListener('wheel', onWheel, { passive: false })
        ctr.addEventListener('contextmenu', (e) => e.preventDefault())

        // ResizeObserver
        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect
            if (width > 0 && height > 0) {
              camera.aspect = width / height
              camera.updateProjectionMatrix()
              renderer.setSize(width, height)
            }
          }
        })
        resizeObserver.observe(ctr)

        // Store subscription for live updates
        const unsub = useMemoryStore.subscribe(() => {
          if (cancelled || !sceneRef.current) return
          const THREE_NS = THREERef.current
          if (!THREE_NS) return
          if (nodeGroupRef.current) {
            sceneRef.current.remove(nodeGroupRef.current)
          }
          if (edgeGroupRef.current) {
            sceneRef.current.remove(edgeGroupRef.current)
          }
          populateScene(THREE_NS, sceneRef.current)
        })

        function animate() {
          if (cancelled) return
          animId = requestAnimationFrame(animate)
          if (renderer && scene && camera) renderer.render(scene, camera)
        }
        animate()

        return () => {
          cancelled = true
          unsub()
          resizeObserver.disconnect()
          cancelAnimationFrame(animId)
          if (rendererRef.current?.domElement && ctr.contains(rendererRef.current.domElement)) {
            ctr.removeChild(rendererRef.current.domElement)
          }
          rendererRef.current?.dispose()
          nodeGroupRef.current = null
          edgeGroupRef.current = null
          sceneRef.current = null
          cameraRef.current = null
          rendererRef.current = null
        }
      })
    }, [])

    // Re-apply selection visual when selectedNodeId changes
    useEffect(() => {
      applySelection()
    }, [selectedNodeId])

    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
    )
  }
)
