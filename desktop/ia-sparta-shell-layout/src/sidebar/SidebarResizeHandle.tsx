import { useCallback, useRef, useEffect } from 'react'
import { useUIStore } from 'ia-sparta-core'

export function SidebarResizeHandle() {
  const { setSidebarWidth, sidebarOpen } = useUIStore()
  const isDragging = useRef(false)
  const handleRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.body.classList.add('is-dragging-sidebar')
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      // x position relative to the viewport is the new sidebar width
      const newWidth = e.clientX
      setSidebarWidth(newWidth)
    }

    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.body.classList.remove('is-dragging-sidebar')
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [setSidebarWidth])

  if (!sidebarOpen) return null

  return (
    <div
      ref={handleRef}
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        top: 0,
        right: -3,
        width: 6,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Visible drag indicator line */}
      <div
        style={{
          width: 2,
          height: '100%',
          borderRadius: 1,
          background: 'transparent',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--accent)'
        }}
        onMouseLeave={(e) => {
          if (!isDragging.current) {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
          }
        }}
      />
    </div>
  )
}
