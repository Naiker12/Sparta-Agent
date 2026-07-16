import { useEffect, useRef } from 'react'
import { useUIStore } from '@/stores/ui.store'

export function TerminalSlot() {
  const ref = useRef<HTMLDivElement | null>(null)
  const setTerminalSlotEl = useUIStore((s) => s.setTerminalSlotEl)

  useEffect(() => {
    setTerminalSlotEl(ref.current)
    return () => setTerminalSlotEl(null)
  }, [setTerminalSlotEl])

  return <div ref={ref} className="relative flex min-h-0 min-w-0 flex-1 flex-col" style={{ background: '#0C0C10' }} />
}
