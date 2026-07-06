import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useUIStore } from '@/stores/ui.store'
import { TerminalWorkspace } from './TerminalWorkspace'

interface Rect { top: number; left: number; width: number; height: number }

export function PersistentTerminal() {
  const slot = useUIStore((s) => s.terminalSlotEl)
  const terminalOpen = useUIStore((s) => s.terminalOpen)
  const [rect, setRect] = useState<Rect | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  useLayoutEffect(() => {
    if (!slot) { setRect(null); return }

    const update = () => {
      const r = slot.getBoundingClientRect()
      setRect({ top: Math.floor(r.top), left: Math.floor(r.left), width: Math.ceil(r.right) - Math.floor(r.left), height: Math.ceil(r.bottom) - Math.floor(r.top) })
    }

    update()
    roRef.current = new ResizeObserver(update)
    roRef.current.observe(slot)

    return () => {
      roRef.current?.disconnect()
      roRef.current = null
    }
  }, [slot, terminalOpen])

  const visible = terminalOpen && !!rect && rect.width > 0 && rect.height > 0

  const style: CSSProperties = {
    position: 'fixed',
    top: rect?.top ?? 0,
    left: rect?.left ?? 0,
    width: rect?.width ?? 0,
    height: rect?.height ?? 0,
    display: 'flex',
    flexDirection: 'column',
    visibility: visible ? 'visible' : 'hidden',
    pointerEvents: visible ? 'auto' : 'none',
    zIndex: 30,
    background: '#0C0C10',
  }

  return (
    <div aria-hidden={!visible} style={style}>
      <TerminalWorkspace />
    </div>
  )
}
