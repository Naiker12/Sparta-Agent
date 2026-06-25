import { useEffect } from 'react'
import { useEventBus } from '@/stores/event-bus.store'
import type { SpartaEvent, EventType } from '@/types'

export function useEventBusListener(
  type: EventType | EventType[],
  handler: (event: SpartaEvent) => void
) {
  const { subscribe } = useEventBus()
  const types = Array.isArray(type) ? type : [type]

  useEffect(() => {
    const unsub = subscribe((event) => {
      if (types.includes(event.type)) {
        handler(event)
      }
    })
    return unsub
  }, [types.join(','), handler, subscribe])
}
