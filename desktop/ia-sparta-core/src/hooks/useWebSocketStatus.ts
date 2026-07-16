import { useState, useEffect } from 'react'
import { messagingAdapter } from '../lib/messaging-adapter'
import { IS_WEB } from '../lib/env-adapter'

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
