import { useState, useEffect } from 'react'
import { messagingAdapter, IS_WEB } from 'ia-sparta-platform'

export function useWebSocketStatus() {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>(
    IS_WEB ? 'connecting' : 'connected'
  )

  useEffect(() => {
    if (!IS_WEB) return

    const interval = setInterval(() => {
      const ready = messagingAdapter.isReady()
      setStatus(ready ? 'connected' : 'connecting')
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return status
}
