import { useRef, useState, useCallback, useEffect } from 'react'

export function useThrottledStream(intervalMs = 40) {
  const [display, setDisplay] = useState('')
  const bufferRef = useRef('')
  const rafRef = useRef<number | null>(null)
  const lastFlush = useRef(0)

  const append = useCallback((chunk: string) => {
    bufferRef.current += chunk
    const now = performance.now()
    if (now - lastFlush.current >= intervalMs) {
      lastFlush.current = now
      setDisplay(bufferRef.current)
    } else if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        lastFlush.current = performance.now()
        setDisplay(bufferRef.current)
      })
    }
  }, [intervalMs])

  const reset = useCallback(() => { bufferRef.current = ''; setDisplay('') }, [])

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  return { display, append, reset }
}
