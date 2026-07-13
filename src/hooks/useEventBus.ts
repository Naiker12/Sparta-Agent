import { useEffect, useRef } from 'react'
import { useEventBus } from '@/stores/event-bus.store'
import type { SpartaEvent, EventType } from '@/types'

export function useEventBusListener(
  type: EventType | EventType[],
  handler: (event: SpartaEvent) => void,
) {
  const { subscribe } = useEventBus()
  const types = Array.isArray(type) ? type : [type]
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const unsub = subscribe((event) => {
      if (types.includes(event.type)) {
        handlerRef.current(event)
      }
    })
    return unsub
  }, [types.join(','), subscribe])
}
