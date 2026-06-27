import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import type { MemoryEntry, MemoryGraphNode } from '@/types'
import type { MemoryGraphHandle } from './MemoryGraph'

interface MemoryGraphSceneProps {
  onNodeSelect: (entry: MemoryEntry | null, graphNode: MemoryGraphNode | null) => void
  selectedNodeId: string | null
}

export const MemoryGraphScene = forwardRef<MemoryGraphHandle, MemoryGraphSceneProps>(
  function MemoryGraphScene({ onNodeSelect }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      let animId = 0
      let renderer: any = null
      let scene: any = null
      let camera: any = null
      let spriteMap = new Map<string, any>()
      let nodeGroup: any = null
      let theta = 0
      let phi = Math.PI / 3
      let radius = 20

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

        const { useMemoryStore } = require('@/stores/memory.store')
        const { computeGraphLayout } = require('@/services/memory/graph-layout')
        const { getGraphNodeColor } = require('@/lib/graph-colors')

        const entries = useMemoryStore.getState().entries
        const nodes: any[] = computeGraphLayout(entries, container)
        spriteMap = new Map()
        nodeGroup = new THREE.Group()
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64

        for (const node of nodes) {
          const ctx = canvas.getContext('2d')!
          ctx.clearRect(0, 0, 64, 64)
          const color = getGraphNodeColor(node)
          ctx.beginPath()
          ctx.arc(32, 32, 26, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'
          ctx.lineWidth = 2
          ctx.stroke()
          const texture = new THREE.CanvasTexture(canvas)
          const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
          const sprite = new THREE.Sprite(material)
          const pos = node.position ?? node
          sprite.position.set(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0)
          sprite.scale.set(1.2, 1.2, 1)
          sprite.userData = { entryId: node.id ?? node.memoryId }
          nodeGroup.add(sprite)
          spriteMap.set(node.id ?? node.memoryId, sprite)
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
          theta -= dx * 0.005
          phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi - dy * 0.005))
          prevMouse = { x: e.clientX, y: e.clientY }
          camera.position.x = radius * Math.sin(phi) * Math.sin(theta)
          camera.position.y = radius * Math.cos(phi)
          camera.position.z = radius * Math.sin(phi) * Math.cos(theta)
          camera.lookAt(0, 0, 0)
        }

        function onMouseUp(e: MouseEvent) {
          if (isDragging || !camera) {
            isDragging = false
            return
          }
          mouse.x = (e.clientX / width) * 2 - 1
          mouse.y = -(e.clientY / height) * 2 + 1
          raycaster.setFromCamera(mouse, camera)
          const intersects = raycaster.intersectObjects(nodeGroup.children)
          if (intersects.length > 0) {
            const hit = intersects[0].object
            const entryId = hit.userData.entryId
            const entry = entries.find((en: any) => en.id === entryId)
            const node = nodes.find((n: any) => (n.id ?? n.memoryId) === entryId)
            onNodeSelect(entry ?? null, node ?? null)
          }
        }

        function onWheel(e: WheelEvent) {
          radius = Math.max(5, Math.min(50, radius + e.deltaY * 0.02))
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

      useImperativeHandle(ref, () => ({
        resetCamera: () => {
          theta = 0
          phi = Math.PI / 3
          radius = 20
        },
      }))

      return () => {
        cancelAnimationFrame(animId)
        if (renderer?.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
        renderer?.dispose()
      }
    }, [])

    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
    )
  }
)
