import { useLayoutEffect, useState, type CSSProperties } from 'react'
import { useUIStore } from '@/stores/ui.store'
import { TerminalWorkspace } from './TerminalWorkspace'

interface Rect { top: number; left: number; width: number; height: number }

const sameRect = (a: Rect | null, b: Rect) =>
  !!a && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height

export function PersistentTerminal() {
  const slot = useUIStore((s) => s.terminalSlotEl)
  const terminalOpen = useUIStore((s) => s.terminalOpen)
  const [rect, setRect] = useState<Rect | null>(null)
  const [mounted, setMounted] = useState(false)

  useLayoutEffect(() => {
    if (!slot) { setRect(null); return }
    let prev: Rect | null = null
    let frame = 0

    const tick = () => {
      const r = slot.getBoundingClientRect()
      const top = Math.floor(r.top)
      const left = Math.floor(r.left)
      const next: Rect = { top, left, width: Math.ceil(r.right) - left, height: Math.ceil(r.bottom) - top }
      if (!sameRect(prev, next)) {
        prev = next
        setRect(next)
        if (next.width > 0 && next.height > 0) setMounted(true)
      }
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [slot])

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
    contain: 'layout size paint',
  }

  return (
    <div aria-hidden={!visible} style={style}>
      {mounted && <TerminalWorkspace />}
    </div>
  )
}
