import { useEffect, useState, useRef } from 'react'
import { getRandomSpinner } from '@/lib/spinners'

const STALL_TIMEOUT_MS = 2000
const stallSpinner = getRandomSpinner()

interface StreamStallIndicatorProps {
  streaming: boolean
}

export function StreamStallIndicator({ streaming }: StreamStallIndicatorProps) {
  const [stalled, setStalled] = useState(false)
  const [spinner, setSpinner] = useState(0)
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!streaming) {
      setStalled(false)
      if (stallTimer.current) clearTimeout(stallTimer.current)
      return
    }

    stallTimer.current = setTimeout(() => {
      setStalled(true)
    }, STALL_TIMEOUT_MS)

    return () => {
      if (stallTimer.current) clearTimeout(stallTimer.current)
    }
  }, [streaming])

  useEffect(() => {
    if (!stalled) return
    const interval = setInterval(() => {
      setSpinner((s) => (s + 1) % stallSpinner.frames.length)
    }, stallSpinner.interval)
    return () => clearInterval(interval)
  }, [stalled])

  if (!stalled) return null

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-ui)',
        padding: '2px 6px',
        borderRadius: 'var(--radius-sm)',
        marginTop: 4,
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{stallSpinner.frames[spinner]}</span>
      Pensando...
    </div>
  )
}
