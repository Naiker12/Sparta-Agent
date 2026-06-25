import { useRef, useCallback } from 'react'
import { useUIStore } from '@/stores/ui.store'

const MIN_W = 200
const MAX_W = 420
const SNAP_THRESHOLD = 160

interface SidebarResizeHandleProps {
  isCollapsed: boolean
  onDragChange: (dragging: boolean) => void
}

export function SidebarResizeHandle({ isCollapsed, onDragChange }: SidebarResizeHandleProps) {
  const dragging = useRef(false)
  const { setSidebarWidth } = useUIStore()

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    onDragChange(true)

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const newWidth = Math.round(ev.clientX)
      if (newWidth < SNAP_THRESHOLD) {
        return
      }
      setSidebarWidth(Math.min(MAX_W, Math.max(MIN_W, newWidth)))
    }

    const handleMouseUp = () => {
      dragging.current = false
      onDragChange(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [setSidebarWidth, onDragChange])

  return (
    <div
      onMouseDown={isCollapsed ? undefined : handleMouseDown}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 6,
        cursor: isCollapsed ? 'default' : 'col-resize',
        zIndex: 10,
        background: 'transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!isCollapsed) e.currentTarget.style.background = 'var(--border-focus)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    />
  )
}