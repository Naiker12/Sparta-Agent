import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import type * as THREE from 'three'
import type { MemoryEntry, MemoryGraphNode, MemoryRelation } from '@/types'
import type { MemoryGraphHandle } from './MemoryGraph'
import { useMemoryStore } from '@/stores/memory.store'
import { computeGraphLayout, getNewNodePositions } from '@/services/memory/graph-layout'
import { getGraphNodeColor, getEdgeColor } from '@/lib/graph-colors'

interface MemoryGraphSceneProps {
  onNodeSelect: (entry: MemoryEntry | null, graphNode: MemoryGraphNode | null) => void
  onNodeHover?: (entry: MemoryEntry | null, x: number, y: number) => void
  onZoomChange?: (level: number) => void
  selectedNodeId: string | null
  relations: MemoryRelation[]
}

export const MemoryGraphScene = forwardRef<MemoryGraphHandle, MemoryGraphSceneProps>(
  function MemoryGraphScene({ onNodeSelect, onNodeHover, onZoomChange, selectedNodeId, relations }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const handlersRef = useRef({ onNodeSelect, onNodeHover, onZoomChange })
    handlersRef.current = { onNodeSelect, onNodeHover, onZoomChange }
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
    const THREERef = useRef<typeof import('three') | null>(null)
    const knownEntryIdsRef = useRef<Set<string>>(new Set())

    const apiRef = useRef<MemoryGraphHandle>({
      resetCamera: () => {},
      zoomIn: () => {},
      zoomOut: () => {},
      focusNode: () => {},
      getZoomLevel: () => 20,
    })
    apiRef.current = {
      resetCamera: () => {
        thetaRef.current = 0
        phiRef.current = Math.PI / 3
        radiusRef.current = 20
        updateCameraFromOrbit()
        handlersRef.current.onZoomChange?.(radiusRef.current)
      },
      zoomIn: () => {
        radiusRef.current = Math.max(3, radiusRef.current - 5)
        updateCameraFromOrbit()
        handlersRef.current.onZoomChange?.(radiusRef.current)
      },
      zoomOut: () => {
        radiusRef.current = Math.min(60, radiusRef.current + 5)
        updateCameraFromOrbit()
        handlersRef.current.onZoomChange?.(radiusRef.current)
      },
      focusNode: (id: string) => {
        const sprite = spriteMapRef.current.get(id)
        if (!sprite) return
        const pos = sprite.position
        thetaRef.current = Math.atan2(pos.x, pos.z)
        phiRef.current = Math.PI / 2.5
        radiusRef.current = 8
        updateCameraFromOrbit()
        handlersRef.current.onZoomChange?.(radiusRef.current)
      },
      getZoomLevel: () => radiusRef.current,
    }

    useImperativeHandle(ref, () => ({
      resetCamera: () => apiRef.current.resetCamera(),
      zoomIn: () => apiRef.current.zoomIn(),
      zoomOut: () => apiRef.current.zoomOut(),
      focusNode: (id: string) => apiRef.current.focusNode(id),
      getZoomLevel: () => apiRef.current.getZoomLevel(),
    }), [])

    function updateCameraFromOrbit() {
      const camera = cameraRef.current
      if (!camera) return
      camera.position.x = radiusRef.current * Math.sin(phiRef.current) * Math.sin(thetaRef.current)
      camera.position.y = radiusRef.current * Math.cos(phiRef.current)
      camera.position.z = radiusRef.current * Math.sin(phiRef.current) * Math.cos(thetaRef.current)
      camera.lookAt(0, 0, 0)
    }

    function makeNodeSprite(THREE: typeof import('three'), node: MemoryGraphNode, color: string): THREE.Sprite {
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
      const pos = node.position
      sprite.position.set(pos.x, pos.y, pos.z)
      const nodeRadius = node.radius ?? 0.5
      const spriteScale = Math.min(0.5 + Math.sqrt(nodeRadius) * 0.9, 2.2)
      sprite.scale.set(spriteScale, spriteScale, 1)
      sprite.userData = { entryId: node.memoryId, baseScale: spriteScale }
      return sprite
    }

    function makeLabel(THREE: typeof import('three'), node: MemoryGraphNode, entry: MemoryEntry | undefined): THREE.Sprite {
      const labelCanvas = document.createElement('canvas')
      labelCanvas.width = 256
      labelCanvas.height = 40
      const lctx = labelCanvas.getContext('2d')!

      lctx.fillStyle = 'rgba(0,0,0,0.55)'
      lctx.fillRect(0, 0, 256, 40)

      const raw = entry?.content ?? ''
      const words = raw.trim().split(/\s+/)
      const shortName = words.slice(0, 3).join(' ') + (words.length > 3 ? '...' : '')

      lctx.font = 'bold 16px -apple-system, sans-serif'
      lctx.fillStyle = 'rgba(255,255,255,0.92)'
      lctx.fillText(shortName, 8, 26)

      const labelTexture = new THREE.CanvasTexture(labelCanvas)
      const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false })
      const labelSprite = new THREE.Sprite(labelMaterial)
      const pos = node.position
      const spriteScale = Math.min(0.5 + Math.sqrt(node.radius ?? 0.5) * 0.9, 2.2)
      labelSprite.position.set(pos.x, pos.y + spriteScale * 0.7 + 0.4, pos.z)
      labelSprite.scale.set(3.5, 0.65, 1)
      labelSprite.userData = { isLabel: true, entryId: node.memoryId }
      labelSprite.visible = true
      return labelSprite
    }

    function rebuildEdges(THREE: typeof import('three'), currentRelations: MemoryRelation[]) {
      if (edgeGroupRef.current) {
        sceneRef.current?.remove(edgeGroupRef.current)
        edgeGroupRef.current = null
      }
      const edgeGroup = new THREE.Group()
      const spriteMap = spriteMapRef.current
      if (currentRelations.length > 0) {
        const positions: number[] = []
        for (const rel of currentRelations) {
          const fromSprite = spriteMap.get(rel.fromId)
          const toSprite = spriteMap.get(rel.toId)
          if (!fromSprite || !toSprite) continue
          positions.push(fromSprite.position.x, fromSprite.position.y, fromSprite.position.z)
          positions.push(toSprite.position.x, toSprite.position.y, toSprite.position.z)
        }
        if (positions.length > 0) {
          const edgeGeometry = new THREE.BufferGeometry()
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
      sceneRef.current?.add(edgeGroup)
      edgeGroupRef.current = edgeGroup
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
        const color = getGraphNodeColor(source, entry?.category)

        const sprite = makeNodeSprite(THREE, node, color)
        nodeGroup.add(sprite)
        spriteMap.set(node.memoryId, sprite)

        const labelSprite = makeLabel(THREE, node, entry)
        nodeGroup.add(labelSprite)
        labelMap.set(node.memoryId, labelSprite)
      }

      const edgeGroup = new THREE.Group()
      const currentRelations = relationsRef.current
      if (currentRelations.length > 0) {
        const positions: number[] = []
        for (const rel of currentRelations) {
          const fromSprite = spriteMap.get(rel.fromId)
          const toSprite = spriteMap.get(rel.toId)
          if (!fromSprite || !toSprite) continue
          positions.push(fromSprite.position.x, fromSprite.position.y, fromSprite.position.z)
          positions.push(toSprite.position.x, toSprite.position.y, toSprite.position.z)
        }
        if (positions.length > 0) {
          const edgeGeometry = new THREE.BufferGeometry()
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
      knownEntryIdsRef.current = new Set(entries.map((e) => e.id))

      applySelection()
    }

    function applySelection() {
      const spriteMap = spriteMapRef.current
      for (const [id, sprite] of spriteMap) {
        const base = (sprite.userData.baseScale as number) ?? sprite.scale.x
        if (selectedNodeId && id === selectedNodeId) {
          sprite.scale.set(base * 1.25, base * 1.25, 1)
          if (sprite.material) {
            const mat = sprite.material as THREE.SpriteMaterial
            mat.color?.set('#ffcc00')
          }
        } else {
          sprite.scale.set(base, base, 1)
          if (sprite.material) {
            const mat = sprite.material as THREE.SpriteMaterial
            mat.color?.set('#ffffff')
          }
        }
      }
    }

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      let animId = 0
      let cancelled = false

      import('three').then((THREE) => {
        if (cancelled || !containerRef.current) return
        const ctr = containerRef.current

        // ---- Scene setup ----
        const width = ctr.clientWidth || 800
        const height = ctr.clientHeight || 600

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        camera.position.set(0, 10, 25)
        camera.lookAt(0, 0, 0)

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3))
        renderer.setClearColor(0x000000, 0)
        ctr.appendChild(renderer.domElement)

        const ambientLight = new THREE.AmbientLight(0x404060, 0.5)
        scene.add(ambientLight)
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
        dirLight.position.set(10, 20, 10)
        scene.add(dirLight)

        sceneRef.current = scene
        cameraRef.current = camera
        rendererRef.current = renderer
        THREERef.current = THREE

        populateScene(THREE, scene)

        const nodeGroup = nodeGroupRef.current!
        const raycaster = new THREE.Raycaster()
        const mouse = new THREE.Vector2()

        // ---- Drag / Click state ----
        let isDragging = false
        let hasMoved = false
        let dragStartPos = { x: 0, y: 0 }
        let prevMouse = { x: 0, y: 0 }

        function onMouseDown(e: MouseEvent) {
          isDragging = true
          hasMoved = false
          dragStartPos = { x: e.clientX, y: e.clientY }
          prevMouse = { x: e.clientX, y: e.clientY }
        }

        function onMouseMove(e: MouseEvent) {
          if (!camera) return
          if (isDragging) {
            const dx = e.clientX - dragStartPos.x
            const dy = e.clientY - dragStartPos.y
            if (Math.sqrt(dx * dx + dy * dy) > 3) {
              hasMoved = true
            }
            if (hasMoved) {
              const ddx = e.clientX - prevMouse.x
              const ddy = e.clientY - prevMouse.y
              thetaRef.current -= ddx * 0.005
              phiRef.current = Math.max(0.1, Math.min(Math.PI - 0.1, phiRef.current - ddy * 0.005))
              updateCameraFromOrbit()
            }
            prevMouse = { x: e.clientX, y: e.clientY }
          } else if (nodeGroup) {
            const rect = ctr.getBoundingClientRect()
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
            raycaster.setFromCamera(mouse, camera)
            const sprites = nodeGroup.children.filter((c) => !c.userData.isLabel)
            const intersects = raycaster.intersectObjects(sprites)
            if (intersects.length > 0) {
              const hit = intersects[0].object
              const entryId = hit.userData.entryId as string
              ctr.style.cursor = 'pointer'
              const entry = useMemoryStore.getState().entries.find((en) => en.id === entryId) ?? null
              handlersRef.current.onNodeHover?.(entry, e.clientX - rect.left, e.clientY - rect.top)
            } else {
              ctr.style.cursor = isDragging ? 'grabbing' : 'grab'
              handlersRef.current.onNodeHover?.(null, 0, 0)
            }
          }
        }

        function onMouseUp(_e: MouseEvent) {
          const wasDragging = isDragging && hasMoved
          isDragging = false

          if (wasDragging) return

          if (!camera || !nodeGroup) return
          const rect = ctr.getBoundingClientRect()
          mouse.x = ((_e.clientX - rect.left) / rect.width) * 2 - 1
          mouse.y = -((_e.clientY - rect.top) / rect.height) * 2 + 1
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
          handlersRef.current.onZoomChange?.(radiusRef.current)
        }

        ctr.addEventListener('mousedown', onMouseDown)
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        ctr.addEventListener('wheel', onWheel, { passive: false })
        ctr.addEventListener('contextmenu', (e) => e.preventDefault())

        // ---- Touch events for tablets ----
        function onTouchStart(e: TouchEvent) {
          const t = e.touches[0]
          if (!t) return
          isDragging = true
          hasMoved = false
          dragStartPos = { x: t.clientX, y: t.clientY }
          prevMouse = { x: t.clientX, y: t.clientY }
        }

        function onTouchMove(e: TouchEvent) {
          const t = e.touches[0]
          if (!t || !camera) return
          if (isDragging) {
            const dx = t.clientX - dragStartPos.x
            const dy = t.clientY - dragStartPos.y
            if (Math.sqrt(dx * dx + dy * dy) > 3) {
              hasMoved = true
            }
            if (hasMoved) {
              const ddx = t.clientX - prevMouse.x
              const ddy = t.clientY - prevMouse.y
              thetaRef.current -= ddx * 0.005
              phiRef.current = Math.max(0.1, Math.min(Math.PI - 0.1, phiRef.current - ddy * 0.005))
              updateCameraFromOrbit()
            }
            prevMouse = { x: t.clientX, y: t.clientY }
          }
        }

        function onTouchEnd() {
          const wasDragging = isDragging && hasMoved
          isDragging = false

          if (wasDragging || !camera || !nodeGroup) return

          // Tap → click
          const rect = ctr.getBoundingClientRect()
          const last = prevMouse
          mouse.x = ((last.x - rect.left) / rect.width) * 2 - 1
          mouse.y = -((last.y - rect.top) / rect.height) * 2 + 1
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

        ctr.addEventListener('touchstart', onTouchStart, { passive: true })
        ctr.addEventListener('touchmove', onTouchMove, { passive: true })
        ctr.addEventListener('touchend', onTouchEnd)

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

        // ---- Incremental store subscription ----
        const unsub = useMemoryStore.subscribe((state) => {
          if (cancelled || !sceneRef.current || !THREERef.current) return
          const THREE_NS = THREERef.current
          const oldIds = knownEntryIdsRef.current
          const newIds = new Set(state.entries.map((e) => e.id))

          const addedIds = [...newIds].filter((id) => !oldIds.has(id))
          const removedIds = [...oldIds].filter((id) => !newIds.has(id))

          if (addedIds.length === 0 && removedIds.length === 0) return

          for (const id of removedIds) {
            const sprite = spriteMapRef.current.get(id)
            if (sprite) {
              nodeGroupRef.current?.remove(sprite)
              spriteMapRef.current.delete(id)
            }
            const label = labelMapRef.current.get(id)
            if (label) {
              nodeGroupRef.current?.remove(label)
              labelMapRef.current.delete(id)
            }
          }

          if (addedIds.length > 0) {
            const existingNodes = new Map(
              [...spriteMapRef.current.entries()].map(([id, spr]) => [
                id,
                { memoryId: id, position: { x: spr.position.x, y: spr.position.y, z: spr.position.z }, radius: 0.5, color: '' } as MemoryGraphNode,
              ])
            )
            const newNodes = getNewNodePositions(addedIds, state.entries, existingNodes)
            for (const node of newNodes) {
              const entry = state.entries.find((e) => e.id === node.memoryId)
              const source = entry?.source ?? 'auto'
              const color = getGraphNodeColor(source, entry?.category)
              const sprite = makeNodeSprite(THREE_NS, node, color)
              const label = makeLabel(THREE_NS, node, entry)
              nodeGroupRef.current?.add(sprite)
              nodeGroupRef.current?.add(label)
              spriteMapRef.current.set(node.memoryId, sprite)
              labelMapRef.current.set(node.memoryId, label)
            }
            rebuildEdges(THREE_NS, relationsRef.current)
          }

          knownEntryIdsRef.current = newIds
        })

        // ---- Animate loop ----
        function animate() {
          if (cancelled) return
          animId = requestAnimationFrame(animate)

          const cam = cameraRef.current
          if (cam) {
            for (const [, labelSprite] of labelMapRef.current) {
              const dist = cam.position.distanceTo(labelSprite.position)
              const mat = labelSprite.material as THREE.SpriteMaterial
              const opacity = Math.max(0, Math.min(1, (30 - dist) / 15))
              mat.opacity = opacity
              labelSprite.visible = opacity > 0.05
            }
          }

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

    useEffect(() => {
      applySelection()
    }, [selectedNodeId])

    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
    )
  }
)
